/**
 * Admin Wallet Balances
 *
 * Returns native gas balances for the activation funder and the relayer
 * across every supported chain (Base, BSC, Celo, Ink). Used by the MoniBot
 * admin Overview tab to monitor operational wallets.
 *
 * Read-only. Requires @monibot wallet signature (same scheme as monibot-chat).
 */

import { verifyMessage } from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.44.4/accounts";
import { checkAdminOrigin, getAdminCorsHeaders, checkRateLimit, RATE_LIMITS, rateLimitedResponse } from "../_shared/security.ts";

const MONIBOT_WALLET_ADDRESS = "0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3";

const BASE_RPCS = [
  Deno.env.get("BASE_RPC_URL"),
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://mainnet.base.org",
].filter(Boolean) as string[];

const BSC_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-rpc.publicnode.com",
];

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

const TEMPO_RPCS = [
  Deno.env.get("TEMPO_RPC_URL") || "https://rpc.moderato.tempo.xyz",
];

// aUSD TIP-20 token on Tempo (6 decimals)
const TEMPO_AUSD_TOKEN = "0x20c0000000000000000000000000000000000001";

const CHAINS = [
  { id: "base", label: "Base",  symbol: "ETH",  decimals: 18, rpcs: BASE_RPCS, low: 0.0005 },
  { id: "bsc",  label: "BSC",   symbol: "BNB",  decimals: 18, rpcs: BSC_RPCS,  low: 0.005  },
  { id: "celo", label: "Celo",  symbol: "CELO", decimals: 18, rpcs: CELO_RPCS, low: 0.05   },
  { id: "ink",  label: "Ink",   symbol: "ETH",  decimals: 18, rpcs: INK_RPCS,  low: 0.0005 },
  { id: "tempo", label: "Tempo", symbol: "aUSD", decimals: 6, rpcs: TEMPO_RPCS, low: 1, tokenAddress: TEMPO_AUSD_TOKEN },
];

async function rpcGetBalance(address: string, rpcs: string[]): Promise<bigint> {
  let lastErr: unknown;
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 }),
      });
      if (res.status === 429) { lastErr = new Error("rate limited"); continue; }
      const data = await res.json();
      if (data?.error) { lastErr = new Error(data.error.message || "rpc error"); continue; }
      return BigInt(data.result);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("RPC failed");
}

/** ERC-20 / TIP-20 balanceOf via eth_call. address is the wallet, token is the token contract. */
async function rpcGetTokenBalance(walletAddr: string, tokenAddr: string, rpcs: string[]): Promise<bigint> {
  // balanceOf(address) => 0x70a08231 + 32-byte padded address
  const padded = walletAddr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const data = `0x70a08231${padded}`;
  let lastErr: unknown;
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "eth_call",
          params: [{ to: tokenAddr, data }, "latest"],
        }),
      });
      if (res.status === 429) { lastErr = new Error("rate limited"); continue; }
      const j = await res.json();
      if (j?.error) { lastErr = new Error(j.error.message || "rpc error"); continue; }
      const hex = j.result || "0x0";
      return BigInt(hex);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("RPC failed");
}

function fmt(wei: bigint, decimals = 18): string {
  const s = wei.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals);
  const fracPart = s.slice(-decimals).slice(0, 6);
  return `${intPart}.${fracPart}`.replace(/\.?0+$/, "") || "0";
}

function deriveAddress(envKey: string): string | null {
  const pk = Deno.env.get(envKey);
  if (!pk) return null;
  try {
    const acc = privateKeyToAccount(`0x${pk.replace(/^0x/, "")}` as `0x${string}`);
    return acc.address.toLowerCase();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getAdminCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const originBlock = checkAdminOrigin(req);
  if (originBlock) return originBlock;

  try {
    const walletAddress = req.headers.get("x-wallet-address")?.toLowerCase();
    const walletSignature = req.headers.get("x-wallet-signature");

    if (!walletAddress || !walletSignature || walletAddress !== MONIBOT_WALLET_ADDRESS) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const ts = body?.timestamp || Date.now();
    const signedMessage = `monibot-campaign:wallet-balances:${ts}`;

    const valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message: signedMessage,
      signature: walletSignature as `0x${string}`,
    }).catch(() => false);

    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rl = await checkRateLimit(walletAddress, RATE_LIMITS.admin);
    if (!rl.allowed) return rateLimitedResponse(rl);

    const funderAddress  = deriveAddress("ACTIVATION_FUNDER_PRIVATE_KEY");
    const relayerAddress = deriveAddress("RELAYER_PRIVATE_KEY");

    const wallets: Array<{ role: "funder" | "relayer"; address: string | null }> = [
      { role: "funder",  address: funderAddress },
      { role: "relayer", address: relayerAddress },
    ];

    const results = await Promise.all(
      wallets.flatMap(w =>
        CHAINS.map(async chain => {
          if (!w.address) {
            return { role: w.role, chain: chain.id, label: chain.label, symbol: chain.symbol,
              address: null, balance: "0", lowThreshold: chain.low, error: "key not configured" };
          }
          try {
            const bal = (chain as any).tokenAddress
              ? await rpcGetTokenBalance(w.address, (chain as any).tokenAddress, chain.rpcs)
              : await rpcGetBalance(w.address, chain.rpcs);
            return {
              role: w.role, chain: chain.id, label: chain.label, symbol: chain.symbol,
              address: w.address, balance: fmt(bal, chain.decimals), lowThreshold: chain.low,
            };
          } catch (err: any) {
            return {
              role: w.role, chain: chain.id, label: chain.label, symbol: chain.symbol,
              address: w.address, balance: "0", lowThreshold: chain.low,
              error: err?.message || "rpc failed",
            };
          }
        })
      )
    );

    return new Response(JSON.stringify({
      funderAddress, relayerAddress, balances: results, fetchedAt: Date.now(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[admin-wallet-balances]", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
