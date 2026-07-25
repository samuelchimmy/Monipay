// Activation Funder Edge Function
// Ensures wallets have sufficient gas for account activation and network transactions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientIP,
  verifyRequestSignature,
} from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ACTIVATION_FUNDER_PRIVATE_KEY = Deno.env.get("ACTIVATION_FUNDER_PRIVATE_KEY");

type ChainType = "BASE" | "BSC" | "CELO" | "INK";

// In-code DEFAULTS — used as fallback when no override row exists in `bot_settings`.
// Admins can override these per-chain via the MoniBot admin "Gas Funding" card
// (writes `gas_min_<chain>` / `gas_fund_<chain>` to bot_settings as wei strings).
const DEFAULT_MIN_REQUIRED: Record<ChainType, bigint> = {
  BASE: BigInt("500000000000000"),   // 0.0005 ETH
  BSC:  BigInt("500000000000000"),   // 0.0005 BNB
  CELO: BigInt("50000000000000000"), // 0.05  CELO
  INK:  BigInt("100000000000000"),   // 0.0001 ETH — Ink gas is ultra-cheap
};

const DEFAULT_FUNDING_AMOUNT: Record<ChainType, string> = {
  BASE: "1000000000000000",   // 0.001 ETH
  BSC:  "1000000000000000",   // 0.001 BNB
  CELO: "50000000000000000",  // 0.05  CELO
  INK:  "200000000000000",    // 0.0002 ETH — matches Ink's cheap gas + stretches funder balance
};

// Resolved at request time from bot_settings (cached for the lifetime of the request).
let MIN_REQUIRED: Record<ChainType, bigint> = { ...DEFAULT_MIN_REQUIRED };
let FUNDING_AMOUNT: Record<ChainType, string> = { ...DEFAULT_FUNDING_AMOUNT };

async function loadGasOverrides(supabase: ReturnType<typeof createClient>) {
  try {
    const keys: string[] = [];
    for (const c of ["base", "bsc", "celo", "ink"]) {
      keys.push(`gas_min_${c}`, `gas_fund_${c}`);
    }
    const { data, error } = await supabase
      .from("bot_settings")
      .select("key, value")
      .in("key", keys);
    if (error || !data) return;
    const map = new Map<string, string>(data.map((r: any) => [r.key, r.value]));
    MIN_REQUIRED = { ...DEFAULT_MIN_REQUIRED };
    FUNDING_AMOUNT = { ...DEFAULT_FUNDING_AMOUNT };
    for (const c of ["BASE", "BSC", "CELO", "INK"] as ChainType[]) {
      const minOverride = map.get(`gas_min_${c.toLowerCase()}`);
      const fundOverride = map.get(`gas_fund_${c.toLowerCase()}`);
      if (minOverride && /^[0-9]+$/.test(minOverride)) MIN_REQUIRED[c] = BigInt(minOverride);
      if (fundOverride && /^[0-9]+$/.test(fundOverride)) FUNDING_AMOUNT[c] = fundOverride;
    }
  } catch (err) {
    console.warn("[activation-funder] loadGasOverrides failed, using defaults:", err);
  }
}

// RPC endpoints
const BASE_RPCS = [
  Deno.env.get("BASE_RPC_URL"),
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://mainnet.base.org",
].filter(Boolean) as string[];

const BSC_RPCS = ["https://bsc-dataseed.binance.org", "https://bsc-rpc.publicnode.com"];

const CELO_RPCS = [
  Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org",
  "https://rpc.ankr.com/celo",
  "https://1rpc.io/celo",
];

const INK_RPCS = [
  Deno.env.get("INK_RPC_URL") || "https://rpc-qnd.inkonchain.com",
  "https://ink.drpc.org",
  "https://ink-public.nodies.app",
];

function getRpcs(chain: ChainType): string[] {
  if (chain === "BSC") return BSC_RPCS;
  if (chain === "CELO") return CELO_RPCS;
  if (chain === "INK") return INK_RPCS;
  return BASE_RPCS;
}

function getFundingAmount(chain: ChainType): string {
  return FUNDING_AMOUNT[chain] || FUNDING_AMOUNT["BASE"];
}

async function rpcRequest(method: string, params: unknown[], rpcs: string[]): Promise<any> {
  let lastErr: unknown;
  for (const rpc of rpcs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
        });
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("retry-after") || "0");
          await new Promise((r) => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 250 * (attempt + 1)));
          continue;
        }
        const data = await response.json();
        if (data?.error) throw new Error(data.error.message || "RPC error");
        return data.result;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("RPC request failed");
}

async function getGasBalance(address: string, chain: ChainType): Promise<bigint> {
  const result = await rpcRequest("eth_getBalance", [address, "latest"], getRpcs(chain));
  return BigInt(result);
}

async function sendFunding(privateKey: string, to: string, value: string, chain: ChainType): Promise<string> {
  const { createWalletClient, createPublicClient, http } = await import("https://esm.sh/viem@2.44.4");
  const { privateKeyToAccount } = await import("https://esm.sh/viem@2.44.4/accounts");
  const { base, bsc, celo, ink } = await import("https://esm.sh/viem@2.44.4/chains");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const viemChain = chain === "BSC" ? bsc : chain === "CELO" ? celo : chain === "INK" ? ink : base;
  const rpcs = getRpcs(chain);

  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcs[0]),
  });

  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(rpcs[0]),
  });

  let gasPrice = await publicClient.getGasPrice();
  const relayerAddr = walletClient.account.address;

  let lastErr: unknown;
  let sent: `0x${string}` | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const pendingNonce = await publicClient.getTransactionCount({
        address: relayerAddr,
        blockTag: "pending",
      });
      // Append Celo Attribution Tag (celo_b6186af7f424) for leaderboard tracking
      let txData: `0x${string}` | undefined = undefined;
      if (chain === "CELO") {
        txData = "0x63656c6f5f623631383661663766343234110080218021802180218021802180218021";
      }

      sent = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: BigInt(value),
        chain: viemChain,
        account,
        data: txData,
        gasPrice,
        nonce: pendingNonce,
      });
      break;
    } catch (err: any) {
      const msg = err?.message || String(err);
      const isUnderpriced =
        msg.includes("underpriced") ||
        msg.includes("replacement transaction") ||
        msg.includes("nonce too low");
      if (!isUnderpriced || attempt === 2) {
        lastErr = err;
        throw err;
      }
      console.warn(`[tx-retry] Attempt ${attempt + 1} failed: ${msg.slice(0, 120)}`);
      gasPrice = (gasPrice * 125n) / 100n;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  if (!sent) throw lastErr ?? new Error("Transaction submission failed");
  return sent;
}

interface FundRequest {
  action: string;
  walletAddress?: string;
  deviceId?: string;
  chain?: "BASE" | "BSC" | "CELO" | "INK" | string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();

    // Verify request signature
    const sigResult = await verifyRequestSignature(req, bodyText);
    if (!sigResult.valid) {
      return new Response(JSON.stringify({ error: sigResult.error || "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: FundRequest = JSON.parse(bodyText);
    const { action, walletAddress, deviceId } = body;
    const chainUpper: ChainType =
      String(body.chain || "").toUpperCase() === "BSC"
        ? "BSC"
        : String(body.chain || "").toUpperCase() === "CELO"
          ? "CELO"
          : String(body.chain || "").toUpperCase() === "INK"
            ? "INK"
            : "BASE";
    const chain = chainUpper;
    const chainDb = chainUpper.toLowerCase();

    // Tempo uses fee sponsorship - skip funding completely
    if ((body.chain as string)?.toLowerCase() === "tempo") {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyFunded: true,
          status: "funded",
          message: "Tempo uses fee sponsorship - no gas funding needed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const clientIP = getClientIP(req);

    // Pull any admin overrides for MIN_REQUIRED / FUNDING_AMOUNT.
    await loadGasOverrides(supabase);

    // ===== CHECK GAS BALANCE =====
    if (action === "checkEthBalance" || action === "checkGasBalance") {
      if (!walletAddress) {
        return new Response(JSON.stringify({ error: "walletAddress required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const balance = await getGasBalance(walletAddress, chain);
        return new Response(
          JSON.stringify({
            success: true,
            balance: balance.toString(),
            hasEnoughForActivation: balance >= MIN_REQUIRED[chain],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("Error checking balance:", error);
        return new Response(JSON.stringify({ error: "Failed to check balance" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== CHECK FUNDING STATUS =====
    if (action === "checkStatus") {
      if (!walletAddress) {
        return new Response(JSON.stringify({ error: "walletAddress required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: funding, error } = await supabase
        .from("activation_fundings")
        .select("*")
        .ilike("wallet_address", walletAddress)
        .eq("chain", chainDb)
        .maybeSingle();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to check status" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          funded: funding?.status === "funded",
          status: funding?.status || "not_found",
          txHash: funding?.tx_hash,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== FUND WALLET (single with top-up model) =====
    if (action === "fund") {
      if (!walletAddress) {
        return new Response(JSON.stringify({ error: "walletAddress required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!ACTIVATION_FUNDER_PRIVATE_KEY) {
        return new Response(JSON.stringify({ error: "Funder not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. IP Rate Limiting (Prevents mass API spam)
      const ipRateLimit = await checkRateLimit(clientIP, {
        windowMs: 3600_000,
        maxRequests: 10,
        keyPrefix: "activation_fund",
      });
      if (!ipRateLimit.allowed) return rateLimitedResponse(ipRateLimit);

      // Verify profile exists. Wallet-only sessions (MiniPay / WalletConnect)
      // don't have a `profiles` row — they live in `wallet_profiles`. Accept
      // either, and fall through to a profile-less funding if a wallet is
      // simply connected but not yet registered anywhere (rare race).
      let profileId: string | null = null;
      let isExternalWallet = false;
      {
        const { data: p } = await supabase
          .from("profiles")
          .select("id")
          .ilike("wallet_address", walletAddress)
          .maybeSingle();
        if (p?.id) profileId = p.id;
        if (!profileId) {
          const { data: wp } = await supabase
            .from("wallet_profiles")
            .select("id")
            .ilike("wallet_address", walletAddress)
            .maybeSingle();
          if (wp?.id) {
            profileId = null; // wallet_profiles.id is a separate namespace; keep FK null
            isExternalWallet = true;
          }
        }
      }

      // 2. Fetch Real On-Chain State
      const currentBalance = await getGasBalance(walletAddress, chain);
      const minRequired = MIN_REQUIRED[chain];

      console.log(
        `[Activation] Checking ${walletAddress} on ${chain}. Balance: ${currentBalance}, Required: ${minRequired}`,
      );

      // Check DB for logging history
      const { data: existingFunding } = await supabase
        .from("activation_fundings")
        .select("id, status")
        .ilike("wallet_address", walletAddress)
        .eq("chain", chainDb)
        .maybeSingle();

      // 3. Early Return based on actual On-Chain Balance
      if (currentBalance >= minRequired) {
        console.log(`[Activation] Skipped: ${walletAddress} on ${chain}. Balance (${currentBalance}) is sufficient.`);

        // Quietly sync DB history to 'funded' if missing/pending to keep dashboard views clean
        if (!existingFunding || existingFunding.status !== "funded") {
          if (existingFunding) {
            await supabase
              .from("activation_fundings")
              .update({ status: "funded", updated_at: new Date().toISOString() })
              .eq("id", existingFunding.id);
          } else {
            await supabase.from("activation_fundings").insert({
              wallet_address: walletAddress.toLowerCase(),
              profile_id: profileId,
              status: "funded",
              amount_wei: "0",
              chain: chainDb,
            });
          }
        }

        return new Response(JSON.stringify({ success: true, alreadyFunded: true, status: "funded" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(
        `[Activation] ${walletAddress} balance is low (${currentBalance} < ${minRequired}). Proceeding to top-up...`,
      );

      // 4. Device Rate Limiting (Applied strictly to prevent new wallet spam)
      // *Bypass* the device limit for legitimate Top-Ups on a previously verified existing wallet.
      const isTopUp = !!existingFunding;
      // External wallet (WalletConnect / MiniPay) users bring their own keys —
      // device rate-limit doesn't apply, otherwise re-connecting a wallet on the
      // same browser would falsely lock activation across all their chains.
      if (deviceId && !isTopUp && !isExternalWallet) {
        const deviceRateLimit = await checkRateLimit(`${deviceId}_${chain}`, {
          windowMs: 365 * 24 * 60 * 60 * 1000,
          maxRequests: 1,
          keyPrefix: "activation_device",
        });
        if (!deviceRateLimit.allowed) {
          return new Response(
            JSON.stringify({ error: `This device already activated on ${chain}`, deviceLimited: true }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      const fundingAmount = getFundingAmount(chain);

      // 5. Update Logging State
      if (existingFunding) {
        await supabase
          .from("activation_fundings")
          .update({
            status: "pending",
            amount_wei: fundingAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingFunding.id);
      } else {
        const { error: insertError } = await supabase.from("activation_fundings").insert({
          wallet_address: walletAddress.toLowerCase(),
          profile_id: profileId,
          status: "pending",
          amount_wei: fundingAmount,
          chain: chainDb,
        });

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(JSON.stringify({ error: "Failed to create funding logging record" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // 6. Execute Top-up / Funding Transaction
      try {
        console.log(`[Activation] Sending ${fundingAmount} wei on ${chain} to ${walletAddress}`);
        const txHash = await sendFunding(ACTIVATION_FUNDER_PRIVATE_KEY, walletAddress, fundingAmount, chain);
        console.log(`[Activation] ${chain} tx sent: ${txHash}`);

        await supabase
          .from("activation_fundings")
          .update({ tx_hash: txHash, status: "funded", funded_at: new Date().toISOString() })
          .ilike("wallet_address", walletAddress)
          .eq("chain", chainDb);

        return new Response(JSON.stringify({ success: true, txHash }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`[Activation] ${chain} funding error:`, error);
        await supabase
          .from("activation_fundings")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .ilike("wallet_address", walletAddress)
          .eq("chain", chainDb);

        const msg = (error as any)?.message || String(error);
        const isFunderEmpty = /insufficient funds|exceeds the balance/i.test(msg);
        return new Response(JSON.stringify({
          pending: !isFunderEmpty,
          error: isFunderEmpty
            ? `Activation funder is temporarily low on ${chain}. Please try again in a few minutes or contact support.`
            : undefined,
          message: isFunderEmpty
            ? undefined
            : "Setting up your account...",
          retry: !isFunderEmpty,
          funderEmpty: isFunderEmpty,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== BATCH FUND ALL UNDERFUNDED PROFILES FOR A CHAIN =====
    if (action === "batchFund") {
      if (!ACTIVATION_FUNDER_PRIVATE_KEY) {
        return new Response(JSON.stringify({ error: "Funder not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, wallet_address, pay_tag");

      if (profilesError || !profiles) {
        return new Response(JSON.stringify({ error: "Failed to fetch profiles" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: { payTag: string; status: string; txHash?: string; error?: string }[] = [];
      const fundingAmount = getFundingAmount(chain);
      const minRequired = MIN_REQUIRED[chain];

      console.log(`[Batch] ${chain}: Scanning ${profiles.length} profiles for underfunding...`);

      const { createPublicClient, http } = await import("https://esm.sh/viem@2.44.4");
      const { base, bsc, celo, ink } = await import("https://esm.sh/viem@2.44.4/chains");
      const viemChain = chain === "BSC" ? bsc : chain === "CELO" ? celo : chain === "INK" ? ink : base;
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(getRpcs(chain)[0]),
      });

      for (const profile of profiles) {
        try {
          // Dynamic Balance Decision Check
          const balance = await getGasBalance(profile.wallet_address, chain);
          if (balance >= minRequired) {
            continue; // Safely skip already funded users
          }

          // Fetch explicit DB record to execute update vs insert correctly
          const { data: existing } = await supabase
            .from("activation_fundings")
            .select("id")
            .ilike("wallet_address", profile.wallet_address)
            .eq("chain", chainDb)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("activation_fundings")
              .update({ status: "pending", amount_wei: fundingAmount })
              .eq("id", existing.id);
          } else {
            await supabase.from("activation_fundings").insert({
              wallet_address: profile.wallet_address.toLowerCase(),
              profile_id: profile.id,
              status: "pending",
              amount_wei: fundingAmount,
              chain: chainDb,
            });
          }

          const txHash = await sendFunding(ACTIVATION_FUNDER_PRIVATE_KEY, profile.wallet_address, fundingAmount, chain);

          // Wait for transaction receipt before initiating the next funding transaction
          console.log(`[Batch] Waiting for receipt of ${txHash}...`);
          await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 60_000 });

          await supabase
            .from("activation_fundings")
            .update({ tx_hash: txHash, status: "funded", funded_at: new Date().toISOString() })
            .ilike("wallet_address", profile.wallet_address)
            .eq("chain", chainDb);

          results.push({ payTag: profile.pay_tag, status: "funded", txHash });
          console.log(`[Batch] Funded ${profile.pay_tag} on ${chain}: ${txHash}`);

          // Small delay to avoid RPC nonce/rate limits
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          console.error(`[Batch] Failed to fund ${profile.pay_tag}:`, err);
          await supabase
            .from("activation_fundings")
            .update({ status: "failed" })
            .ilike("wallet_address", profile.wallet_address)
            .eq("chain", chainDb);
          results.push({ payTag: profile.pay_tag, status: "failed", error: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          chain,
          scanned: profiles.length,
          funded: results.filter((r) => r.status === "funded").length,
          failed: results.filter((r) => r.status === "failed").length,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Activation Funder Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
