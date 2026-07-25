/**
 * relay-payment-ink/index.ts
 *
 * Ink-specific payment relay. Handles all the same actions as
 * relay-payment (relay, getNonce, checkApproval, checkTxStatus,
 * history, updateItems) but wired to:
 *
 *   Chain:   Ink Mainnet (chainId 57073)
 *   Token:   USDT0  0x0200C29006150606B650577BBE7B6248F58470c1  (6 decimals)
 *   Router:  MoniPayRouter  0xb5f22E6a45Bc8992DE276Ed4d3aD8626D382E76b
 *   RPC:     https://rpc-qnd.inkonchain.com
 *   Explorer: https://explorer.inkonchain.com
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

// ─── Ink chain definition ─────────────────────────────────────────────────────

const inkMainnet = {
  id: 57073,
  name: "Ink Mainnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-qnd.inkonchain.com"] },
  },
  blockExplorers: {
    default: { name: "Ink Explorer", url: "https://explorer.inkonchain.com" },
  },
} as const;

// ─── Config ───────────────────────────────────────────────────────────────────

const INK_USDT0       = "0x0200C29006150606B650577BBE7B6248F58470c1" as Hex;
const INK_ROUTER      = "0xb5f22E6a45Bc8992DE276Ed4d3aD8626D382E76b" as Hex;
const TOKEN_DECIMALS  = 6;
const CURRENCY_LABEL  = "USDT0";
const CHAIN_ID        = 57073;

const INK_RPC_URLS = [
  "https://rpc-qnd.inkonchain.com",
  "https://ink.drpc.org",
  "https://ink-public.nodies.app",
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

function toHuman(raw: bigint): number {
  return Number(raw) / Math.pow(10, TOKEN_DECIMALS);
}

function getRpcPublicClient() {
  return createPublicClient({
    chain: inkMainnet as any,
    transport: http(INK_RPC_URLS[0]),
  });
}

function getRpcWalletClient(privateKey: string) {
  const account = privateKeyToAccount(`0x${privateKey.replace("0x", "")}` as Hex);
  return createWalletClient({
    account,
    chain: inkMainnet as any,
    transport: http(INK_RPC_URLS[0]),
  });
}

// ─── Sync external incoming USDT0 transfers ───────────────────────────────────

async function syncExternalIncoming(opts: {
  supabase: any;
  profileId: string;
  walletAddress: Hex;
}) {
  const { supabase, profileId, walletAddress } = opts;
  const publicClient = getRpcPublicClient();

  // Ink ~2s blocks → ~43000 blocks/day. Look back ~1 day.
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock   = latestBlock > 43000n ? latestBlock - 43000n : 0n;

  const logs = await publicClient.getLogs({
    address: INK_USDT0,
    event:   TRANSFER_EVENT,
    args:    { to: walletAddress },
    fromBlock,
    toBlock: latestBlock,
  });

  if (!logs.length) return;

  for (const log of logs) {
    const txHash = (log as any).transactionHash as string | null;
    if (!txHash) continue;

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
    const amount    = toHuman((log as any).args.value as bigint);
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
      metadata:     { network: "ink" },
    });
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const bodyText = await req.text();

  const signatureResult = await verifyRequestSignature(req, bodyText);
  if (!signatureResult.valid) {
    console.error("[ink-relay] Signature verification failed:", signatureResult.error);
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
  } = payload ?? {};

  const clientIP = getClientIP(req);

  console.log("[ink-relay] action:", action, "| senderProfile:", senderProfileId);

  // ── ACTION: relay ───────────────────────────────────────────────────────────
  if (action === "relay") {
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

    const publicClient = getRpcPublicClient();
    const walletClient = getRpcWalletClient(relayerKey);

    const totalRequired = BigInt(amount) + BigInt(fee);

    // Balance check
    const balance = await publicClient.readContract({
      address: INK_USDT0,
      abi:     TOKEN_ABI,
      functionName: "balanceOf",
      args: [from as Hex],
    });
    if (balance < totalRequired) {
      return new Response(
        JSON.stringify({ error: `Insufficient ${CURRENCY_LABEL} balance` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allowance check
    const allowance = await publicClient.readContract({
      address: INK_USDT0,
      abi:     TOKEN_ABI,
      functionName: "allowance",
      args: [from as Hex, INK_ROUTER],
    });
    if (allowance < totalRequired) {
      return new Response(
        JSON.stringify({
          error:             `Insufficient ${CURRENCY_LABEL} allowance`,
          needsApproval:     true,
          requiredAllowance: totalRequired.toString(),
          currentAllowance:  allowance.toString(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nonce check
    const nonceUsed = await publicClient.readContract({
      address: INK_ROUTER,
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

    // Submit the relay transaction
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

      console.log(`[ink-relay] Submitting relayPayment on Ink: ${toHuman(BigInt(amount))} ${CURRENCY_LABEL}`);

      let gasPrice = await publicClient.getGasPrice();
      const relayerAddr = walletClient.account.address;

      let lastErr: unknown;
      let sent: Hex | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const pendingNonce = await publicClient.getTransactionCount({
            address: relayerAddr,
            blockTag: "pending",
          });

          sent = await walletClient.sendTransaction({
            chain: inkMainnet as any,
            to:   INK_ROUTER,
            data: calldata,
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
      txHash = sent;
    } catch (txErr) {
      console.error("[ink-relay] Transaction failed:", txErr);
      return new Response(
        JSON.stringify({
          error:   "Transaction failed",
          details: txErr instanceof Error ? txErr.message : "Unknown error",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ink-relay] Tx submitted: ${txHash}`);

    // Wait for receipt (60s timeout)
    let receipt: any;
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      console.log(`[ink-relay] Confirmed in block ${receipt.blockNumber}`);
    } catch (receiptErr) {
      console.error("[ink-relay] Receipt timeout:", receiptErr);
    }

    const status =
      receipt?.status === "success"  ? "completed" :
      receipt?.status === "reverted" ? "failed"    : "pending";

    const amountHuman = toHuman(BigInt(amount));
    const feeHuman    = toHuman(BigInt(fee));

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
      metadata:      { network: "ink" },
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
          metadata:      { network: "ink" },
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
        network:     "ink",
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
          address: INK_ROUTER,
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

    const publicClient = getRpcPublicClient();
    const [allowance, balance] = await Promise.all([
      publicClient.readContract({
        address: INK_USDT0,
        abi:     TOKEN_ABI,
        functionName: "allowance",
        args: [walletAddress as Hex, INK_ROUTER],
      }),
      publicClient.readContract({
        address: INK_USDT0,
        abi:     TOKEN_ABI,
        functionName: "balanceOf",
        args: [walletAddress as Hex],
      }),
    ]);

    const divisor = Math.pow(10, TOKEN_DECIMALS);
    return new Response(
      JSON.stringify({
        allowance:            allowance.toString(),
        allowanceFormatted:   Number(allowance) / divisor,
        balance:              balance.toString(),
        balanceFormatted:     Number(balance) / divisor,
        hasUnlimitedApproval: allowance > BigInt("0xffffffffffffffffffffffff"),
        routerAddress:        INK_ROUTER,
        network:              "ink",
        currency:             CURRENCY_LABEL,
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

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", profileId)
      .maybeSingle();

    if (profileRow?.wallet_address) {
      try {
        await syncExternalIncoming({
          supabase,
          profileId,
          walletAddress: profileRow.wallet_address as Hex,
        });
      } catch (syncErr) {
        console.error("[ink-relay] External sync failed:", syncErr);
      }
    }

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("profile_id", profileId)
      .or("metadata->>network.eq.ink,source.eq.external")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (cursor) query = query.lt("created_at", cursor);

    const { data, error } = await query;
    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch history" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nextCursor = data?.length === pageSize
      ? data[data.length - 1]?.created_at ?? null
      : null;

    return new Response(
      JSON.stringify({ transactions: data || [], nextCursor, hasMore: Boolean(nextCursor) }),
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
