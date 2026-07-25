/**
 * relay-payment-celo/index.ts — NEW FILE
 * Location: supabase/functions/relay-payment-celo/index.ts
 *
 * Celo-specific payment relay. Handles all the same actions as
 * relay-payment (relay, getNonce, checkApproval, checkTxStatus,
 * history, updateItems) but wired to:
 *
 *   Chain:   Celo Mainnet (chainId 42220)
 *   Token:   USDT  0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e  (6 decimals)
 *   Router:  MoniPayRouter  0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0
 *   RPC:     https://forno.celo.org  (Celo Foundation public RPC)
 *   Explorer: https://celoscan.io
 *
 * Why a separate function instead of adding "celo" to relay-payment?
 *   - Zero risk of touching live Base/BSC/Tempo flows
 *   - Celo has unique considerations (feeCurrency, legacy tx — though
 *     those are frontend concerns; the relayer itself uses standard viem)
 *   - Easier to iterate and deploy independently
 *
 * ENV VARS needed in Supabase dashboard (same as relay-payment):
 *   SUPABASE_URL               (auto-set by Supabase)
 *   SUPABASE_SERVICE_ROLE_KEY  (auto-set by Supabase)
 *   RELAYER_PRIVATE_KEY        — same relayer wallet as Base/BSC, or a new one
 *   VITE_APP_SIGNING_SECRET    — same signing secret as rest of app
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  encodeFunctionData,
  type Hex,
} from "npm:viem@2.44.4";
import { privateKeyToAccount } from "npm:viem@2.44.4/accounts";
import {
  corsHeaders,
  checkRateLimit,
  RATE_LIMITS,
  verifyRequestSignature,
  rateLimitedResponse,
  unauthorizedResponse,
  getClientIP,
} from "../_shared/security.ts";
import { loadPrincipal } from "../_shared/principals.ts";

// ─── Celo chain definition ────────────────────────────────────────────────────

const celoMainnet = {
  id: 42220,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo.org"] },
  },
  blockExplorers: {
    default: { name: "CeloScan", url: "https://celoscan.io" },
  },
} as const;

// ─── Config ───────────────────────────────────────────────────────────────────

const CELO_ROUTER      = "0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0" as Hex;
const CHAIN_ID         = 42220;

const SUPPORTED_CELO_TOKENS = [
  { symbol: 'USDT',  address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as Hex, decimals: 6  },
  { symbol: 'G$',    address: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A' as Hex, decimals: 18 },
  { symbol: 'USDC',  address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Hex, decimals: 6  },
  { symbol: 'USDm',  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as Hex, decimals: 18 },
];

const CELO_RPC_URLS = [
  Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org",
  "https://rpc.ankr.com/celo",
  "https://1rpc.io/celo",
];

// ─── ABIs ────────────────────────────────────────────────────────────────────

const ROUTER_ABI = parseAbi([
  "function relayPayment(address from, address to, uint256 amount, uint256 fee, uint256 nonce, uint256 deadline, bytes signature) external",
  "function isNonceUsed(address user, uint256 nonce) view returns (bool)",
  "function calculateFee(uint256 grossAmount) pure returns (uint256)",
]);

const TOKEN_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHuman(raw: bigint, decimals: number): number {
  return Number(raw) / Math.pow(10, decimals);
}

function getRpcPublicClient() {
  return createPublicClient({
    chain: celoMainnet as any,
    transport: http(CELO_RPC_URLS[0]),
  });
}

function getRpcWalletClient(privateKey: string) {
  const account = privateKeyToAccount(`0x${privateKey.replace("0x", "")}` as Hex);
  return createWalletClient({
    account,
    chain: celoMainnet as any,
    transport: http(CELO_RPC_URLS[0]),
  });
}

// ─── Sync external incoming USDT transfers (same logic as relay-payment) ──────

async function syncExternalIncoming(opts: {
  supabase: any;
  profileId: string;
  walletAddress: Hex;
}) {
  const { supabase, profileId, walletAddress } = opts;
  const publicClient = getRpcPublicClient();

  // Celo ~5s blocks → ~17000 blocks/day. Look back ~1 day.
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock   = latestBlock > 17000n ? latestBlock - 17000n : 0n;

  const logsArrays = await Promise.all(SUPPORTED_CELO_TOKENS.map(async (token) => {
    try {
      const tokenLogs = await publicClient.getLogs({
        address: token.address,
        event:   TRANSFER_EVENT,
        args:    { to: walletAddress },
        fromBlock,
        toBlock: latestBlock,
      });
      return tokenLogs.map(log => ({ ...log, tokenConfig: token }));
    } catch (err) {
      console.error(`Failed to fetch logs for ${token.symbol}:`, err);
      return [];
    }
  }));

  const logs = logsArrays.flat();
  if (!logs.length) return;

  for (const log of logs) {
    const txHash = (log as any).transactionHash as string | null;
    if (!txHash) continue;

    // Skip if already recorded
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("profile_id", profileId)
      .eq("tx_hash", txHash)
      .eq("type", "received")
      .limit(1);

    if (existing?.length) continue;

    const block     = await publicClient.getBlock({ blockNumber: (log as any).blockNumber });
    const createdAt = new Date(Number(block.timestamp) * 1000).toISOString();
    const amount    = toHuman((log as any).args.value as bigint, log.tokenConfig.decimals);
    const from      = ((log as any).args.from as string) || "";

    await supabase.from("transactions").insert({
      profile_id:   profileId,
      type:         "received",
      amount,
      fee:          0,
      counterparty: from,
      tx_hash:      txHash,
      status:       "completed",
      created_at:   createdAt,
      source:       "external",
      metadata:     { 
        network: "celo", 
        token_symbol: log.tokenConfig.symbol, 
        decimals: log.tokenConfig.decimals 
      },
    });
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const bodyText = await req.text();

  // Verify HMAC signature (same as relay-payment)
  const signatureResult = await verifyRequestSignature(req, bodyText);
  if (!signatureResult.valid) {
    console.error("[celo-relay] Signature verification failed:", signatureResult.error);
    return unauthorizedResponse(signatureResult.error);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const parsed  = bodyText ? JSON.parse(bodyText) : {};
  const payload = parsed?.body && typeof parsed.body === "object" ? parsed.body : parsed;

  const {
    action,
    signature,
    message,
    senderProfileId,
    recipientPayTag,
    items,
    invoiceId,
    // Multi-token overrides (passed by frontend when using G$/USDC/USDm on Celo V2)
    tokenAddress,
    routerAddress,
    decimals,
    tokenSymbol,
  } = payload ?? {};

  const clientIP = getClientIP(req);

  console.log("[celo-relay] action:", action, "| senderProfile:", senderProfileId);

  // ── ACTION: relay ───────────────────────────────────────────────────────────
  if (action === "relay") {
    // Rate limiting — same thresholds as relay-payment
    const walletRateLimit = await checkRateLimit(
      message?.from || senderProfileId || clientIP,
      RATE_LIMITS.relay
    );
    if (!walletRateLimit.allowed) return rateLimitedResponse(walletRateLimit);

    const ipRateLimit = await checkRateLimit(clientIP, RATE_LIMITS.relayIP);
    if (!ipRateLimit.allowed) return rateLimitedResponse(ipRateLimit);

    if (!message || !senderProfileId || !signature) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message, senderProfileId, signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { from, to, amount, fee, nonce, deadline } = message;

    if (!from || !to || !amount || fee === undefined || nonce === undefined || !deadline) {
      return new Response(
        JSON.stringify({ error: "Invalid message structure" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const relayerKey = Deno.env.get("RELAYER_PRIVATE_KEY");
    if (!relayerKey) {
      return new Response(
        JSON.stringify({ error: "Relayer not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const activeToken = (tokenAddress || "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e") as Hex;
    const activeRouter = (routerAddress || "0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0") as Hex;
    const activeDecimals = decimals !== undefined ? Number(decimals) : 6;
    const activeCurrency = tokenSymbol || "USDT";

    const publicClient = getRpcPublicClient();
    const walletClient = getRpcWalletClient(relayerKey);

    const totalRequired = BigInt(amount) + BigInt(fee);

    // Balance check
    const balance = await publicClient.readContract({
      address: activeToken,
      abi:     TOKEN_ABI,
      functionName: "balanceOf",
      args: [from as Hex],
    });
    if (balance < totalRequired) {
      return new Response(
        JSON.stringify({ error: `Insufficient ${activeCurrency} balance` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allowance check
    const allowance = await publicClient.readContract({
      address: activeToken,
      abi:     TOKEN_ABI,
      functionName: "allowance",
      args: [from as Hex, activeRouter],
    });
    if (allowance < totalRequired) {
      return new Response(
        JSON.stringify({
          error:             `Insufficient ${activeCurrency} allowance`,
          needsApproval:     true,
          requiredAllowance: totalRequired.toString(),
          currentAllowance:  allowance.toString(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nonce check
    const nonceUsed = await publicClient.readContract({
      address: activeRouter,
      abi:     ROUTER_ABI,
      functionName: "isNonceUsed",
      args: [from as Hex, BigInt(nonce)],
    });
    if (nonceUsed) {
      return new Response(
        JSON.stringify({ error: "Nonce already used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deadline check
    const now = Math.floor(Date.now() / 1000);
    if (Number(deadline) < now) {
      return new Response(
        JSON.stringify({ error: "Payment authorization expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Submit the relay transaction with explicit gas pricing + retry on
    // "underpriced" / replacement errors. Celo's mempool rejects same-price
    // re-broadcasts, so each retry bumps gasPrice by 25% and re-fetches the
    // pending nonce of the relayer.
    let txHash: Hex;
    try {
      const calldata = encodeFunctionData({
        abi:          ROUTER_ABI,
        functionName: "relayPayment",
        args: [
          from      as Hex,
          to        as Hex,
          BigInt(amount),
          BigInt(fee),
          BigInt(nonce),
          BigInt(deadline),
          signature as Hex,
        ],
      });

      console.log(`[celo-relay] Submitting relayPayment on Celo: ${toHuman(BigInt(amount), activeDecimals)} ${activeCurrency}`);

      // Pre-flight simulate to surface revert reasons (signature mismatch, etc.)
      try {
        await publicClient.simulateContract({
          address: activeRouter,
          abi:     ROUTER_ABI,
          functionName: "relayPayment",
          args: [
            from      as Hex,
            to        as Hex,
            BigInt(amount),
            BigInt(fee),
            BigInt(nonce),
            BigInt(deadline),
            signature as Hex,
          ],
          account: walletClient.account!.address,
        });
      } catch (simErr: any) {
        const reason = simErr?.shortMessage || simErr?.message || "simulation failed";
        console.error("[celo-relay] Simulation reverted:", reason);
        return new Response(
          JSON.stringify({
            error:   "Transaction would revert",
            details: reason,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Base gas price from the network
      let gasPrice = await publicClient.getGasPrice();
      const relayerAddr = walletClient.account!.address;

      let lastErr: unknown;
      let sent: Hex | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const pendingNonce = await publicClient.getTransactionCount({
            address: relayerAddr,
            blockTag: "pending",
          });
          // Append Celo Attribution Tag (celo_b6186af7f424)
          const CELO_TAG_SUFFIX = "63656c6f5f623631383661663766343234110080218021802180218021802180218021";
          const dataWithTag = ((calldata && calldata !== "0x" ? calldata : "0x") + CELO_TAG_SUFFIX) as Hex;

          sent = await walletClient.sendTransaction({
            chain:    celoMainnet as any,
            to:       activeRouter,
            data:     dataWithTag,
            gasPrice,
            nonce:    pendingNonce,
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
          console.warn(`[celo-relay] Retry ${attempt + 1} after underpriced/nonce error: ${msg.slice(0, 120)}`);
          // Bump 25%
          gasPrice = (gasPrice * 125n) / 100n;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!sent) throw lastErr ?? new Error("Failed to submit Celo relay tx");
      txHash = sent;
    } catch (txErr) {
      console.error("[celo-relay] Transaction failed:", txErr);
      return new Response(
        JSON.stringify({
          error:   "Transaction failed",
          details: txErr instanceof Error ? txErr.message : "Unknown error",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[celo-relay] Tx submitted: ${txHash}`);

    // Wait for receipt (60s timeout)
    let receipt: any;
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      console.log(`[celo-relay] Confirmed in block ${receipt.blockNumber}`);
    } catch (receiptErr) {
      console.error("[celo-relay] Receipt timeout:", receiptErr);
    }

    const status =
      receipt?.status === "success"  ? "completed" :
      receipt?.status === "reverted" ? "failed"    : "pending";

    const amountHuman = toHuman(BigInt(amount), activeDecimals);
    const feeHuman    = toHuman(BigInt(fee), activeDecimals);

    // Lookup sender PayTag
    const senderPrincipal = await loadPrincipal(supabase, senderProfileId);
    const senderPayTag = senderPrincipal?.pay_tag || (from as string).slice(0, 10) + "...";

    const counterparty = recipientPayTag || (to as string).slice(0, 10) + "...";
    const txSource     = invoiceId ? "invoice" : "p2p";

    // Record sender transaction
    await supabase.from("transactions").insert({
      profile_id:    senderProfileId,
      type:          "sent",
      amount:        amountHuman,
      fee:           feeHuman,
      counterparty,
      tx_hash:       txHash,
      status,
      items:         items || null,
      invoice_id:    invoiceId || null,
      payer_pay_tag: senderPayTag,
      source:        txSource,
      metadata:      { network: "celo", token_symbol: activeCurrency, decimals: activeDecimals },
    });

    // Record recipient transaction if they have a MoniPay profile
    if (recipientPayTag) {
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("id, pay_tag")
        .eq("pay_tag", recipientPayTag.toLowerCase())
        .maybeSingle();

      if (recipientProfile) {
        await supabase.from("transactions").insert({
          profile_id:    recipientProfile.id,
          type:          "received",
          amount:        amountHuman,
          fee:           0,
          counterparty:  senderPayTag,
          tx_hash:       txHash,
          status,
          items:         items || null,
          invoice_id:    invoiceId || null,
          payer_pay_tag: senderPayTag,
          source:        txSource,
          metadata:      { network: "celo", token_symbol: activeCurrency, decimals: activeDecimals },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success:     status === "completed",
        txHash,
        amount:      amountHuman,
        fee:         feeHuman,
        status,
        blockNumber: receipt?.blockNumber?.toString(),
        network:     "celo",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── ACTION: getNonce ────────────────────────────────────────────────────────
  if (action === "getNonce") {
    const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

    const { walletAddress } = message || {};
    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const publicClient = getRpcPublicClient();
    let nonce = 0;
    try {
      while (nonce < 1000) {
        const used = await publicClient.readContract({
          address: CELO_ROUTER,
          abi:     ROUTER_ABI,
          functionName: "isNonceUsed",
          args: [walletAddress as Hex, BigInt(nonce)],
        });
        console.log(`[getNonce] isNonceUsed(${walletAddress}, ${nonce}) = ${used}`);
        if (!used) break;
        nonce++;
      }
    } catch (err) {
      console.error(`[getNonce] readContract failed for ${walletAddress}:`, err);
      return new Response(
        JSON.stringify({ error: "Failed to read nonce from contract", details: String(err) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[getNonce] Returning nonce ${nonce} for ${walletAddress}`);
    return new Response(
      JSON.stringify({ nonce }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── ACTION: checkApproval ───────────────────────────────────────────────────
  if (action === "checkApproval") {
    const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

    const { walletAddress } = message || {};
    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const activeToken = (tokenAddress || "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e") as Hex;
    const activeRouter = (routerAddress || "0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0") as Hex;
    const activeDecimals = decimals !== undefined ? Number(decimals) : 6;
    const activeCurrency = tokenSymbol || "USDT";

    const publicClient = getRpcPublicClient();
    const [allowance, balance] = await Promise.all([
      publicClient.readContract({
        address: activeToken,
        abi:     TOKEN_ABI,
        functionName: "allowance",
        args: [walletAddress as Hex, activeRouter],
      }),
      publicClient.readContract({
        address: activeToken,
        abi:     TOKEN_ABI,
        functionName: "balanceOf",
        args: [walletAddress as Hex],
      }),
    ]);

    const divisor = Math.pow(10, activeDecimals);
    return new Response(
      JSON.stringify({
        allowance:            allowance.toString(),
        allowanceFormatted:   Number(allowance) / divisor,
        balance:              balance.toString(),
        balanceFormatted:     Number(balance) / divisor,
        hasUnlimitedApproval: allowance > BigInt("0xffffffffffffffffffffffff"),
        routerAddress:        activeRouter,
        network:              "celo",
        currency:             activeCurrency,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── ACTION: checkTxStatus ───────────────────────────────────────────────────
  if (action === "checkTxStatus") {
    const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

    const { txHash } = message || {};
    if (!txHash) {
      return new Response(
        JSON.stringify({ error: "Missing txHash" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const publicClient = getRpcPublicClient();
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex });
      const status  = receipt
        ? (receipt.status === "success" ? "confirmed" : "failed")
        : "pending";
      return new Response(
        JSON.stringify({ status, blockNumber: receipt?.blockNumber?.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      return new Response(
        JSON.stringify({ status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // ── ACTION: history ─────────────────────────────────────────────────────────
  if (action === "history") {
    const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

    const profileId = senderProfileId || message?.profileId;
    const pageSize  = Math.min(message?.limit ?? 50, 200);
    const cursor    = message?.cursor ?? null;

    // Sync external incoming USDT transfers for this wallet.
    // Falls back to `wallet_profiles` so MiniPay (wallet-only) users also
    // get external deposits picked up.
    let walletAddr: string | null = null;
    {
      const { data: p } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", profileId)
        .maybeSingle();
      if (p?.wallet_address) walletAddr = p.wallet_address;
      else {
        const { data: w } = await supabase
          .from("wallet_profiles")
          .select("wallet_address")
          .eq("id", profileId)
          .maybeSingle();
        if (w?.wallet_address) walletAddr = w.wallet_address;
      }
    }

    if (walletAddr) {
      try {
        await syncExternalIncoming({
          supabase,
          profileId,
          walletAddress: walletAddr as Hex,
        });
      } catch (syncErr) {
        console.error("[celo-relay] External sync failed:", syncErr);
      }
    }

    // Fetch main transactions with network="celo" filter
    let mainQuery = supabase
      .from("transactions")
      .select("*")
      .eq("profile_id", profileId)
      .or("metadata->>network.eq.celo,source.eq.external")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (cursor) mainQuery = mainQuery.lt("created_at", cursor);

    const { data: mainData, error: mainError } = await mainQuery;
    if (mainError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch history" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also pull MoniBot transactions (sender or receiver) for this profile.
    let monibotQuery = supabase
      .from("monibot_transactions")
      .select("*")
      .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(pageSize);
    if (cursor) monibotQuery = monibotQuery.lt("created_at", cursor);
    const { data: monibotData } = await monibotQuery;

    // Resolve pay_tags for monibot counterparties
    const idsToResolve = new Set<string>();
    (monibotData || []).forEach((tx: any) => {
      if (tx.sender_id && tx.sender_id !== profileId) idsToResolve.add(tx.sender_id);
      if (tx.receiver_id && tx.receiver_id !== profileId) idsToResolve.add(tx.receiver_id);
    });
    const payTagMap: Record<string, string> = {};
    if (idsToResolve.size > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, pay_tag")
        .in("id", Array.from(idsToResolve));
      (ps || []).forEach((p: any) => {
        if (p.id && p.pay_tag) payTagMap[p.id] = p.pay_tag;
      });
    }

    const mappedMonibot = (monibotData || []).map((tx: any) => {
      const isSender = tx.sender_id === profileId;
      const source = tx.type === "grant" ? "monibot_grant" : "monibot_p2p";
      const counterparty = isSender
        ? (tx.recipient_pay_tag || payTagMap[tx.receiver_id] || tx.receiver_id)
        : (tx.payer_pay_tag || payTagMap[tx.sender_id] || "monibot");
      return {
        id: `monibot_${tx.id}`,
        type: isSender ? "sent" : "received",
        amount: parseFloat(tx.amount),
        fee: isSender ? parseFloat(tx.fee || 0) : 0,
        counterparty,
        created_at: tx.created_at,
        tx_hash: tx.tx_hash,
        payer_pay_tag: tx.payer_pay_tag,
        source,
        metadata: {
          monibot_type: tx.type === "grant" ? "grant" : "p2p",
          tweet_id: tx.tweet_id,
          campaign_id: tx.campaign_id,
          network: (tx.chain || "celo").toLowerCase(),
        },
        items: null,
        invoice_id: null,
      };
    });

    // De-dupe by tx_hash, prefer monibot enrichment
    const normHash = (h?: string | null) => {
      if (!h) return null;
      const t = String(h).trim().toLowerCase();
      return t.startsWith("0x") ? t : `0x${t}`;
    };
    const byHash = new Map<string, any>();
    for (const tx of (mainData || [])) {
      const key = normHash(tx.tx_hash) || `nohash_${tx.id}`;
      byHash.set(key, tx);
    }
    for (const mb of mappedMonibot) {
      const key = normHash(mb.tx_hash) || `nohash_${mb.id}`;
      const existing = byHash.get(key);
      if (!existing) { byHash.set(key, mb); continue; }
      const existingIsAddr = existing.counterparty?.startsWith("0x");
      const mbResolved = mb.counterparty && !mb.counterparty.startsWith("0x");
      byHash.set(key, {
        ...existing,
        counterparty: existingIsAddr && mbResolved ? mb.counterparty : existing.counterparty,
        source: mb.source,
        metadata: { ...(existing.metadata || {}), ...(mb.metadata || {}) },
        payer_pay_tag: existing.payer_pay_tag || mb.payer_pay_tag,
      });
    }

    const merged = Array.from(byHash.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, pageSize);

    const nextCursor = merged.length === pageSize
      ? merged[merged.length - 1]?.created_at ?? null
      : null;

    return new Response(
      JSON.stringify({ transactions: merged, nextCursor, hasMore: Boolean(nextCursor) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── ACTION: updateItems ─────────────────────────────────────────────────────
  if (action === "updateItems") {
    const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

    const { txId, profileId, items: updateItems } = message || {};
    if (!txId || !profileId) {
      return new Response(
        JSON.stringify({ error: "Missing txId or profileId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ items: updateItems || null })
      .eq("id", txId)
      .eq("profile_id", profileId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Unknown action ──────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({ error: `Unknown action: ${action}` }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
