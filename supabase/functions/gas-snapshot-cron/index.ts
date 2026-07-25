/**
 * Gas Snapshot Cron
 *
 * Scheduled (daily) function that records the native gas balance of the
 * activation-funder and relayer wallets across every supported chain into
 * `gas_spend_snapshots`. The admin Revenue & Cost dashboard uses the diff
 * between the oldest and newest snapshot in a window to compute total gas
 * spent over that period.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { privateKeyToAccount } from "https://esm.sh/viem@2.44.4/accounts";

const CHAINS = [
  { id: "base",  rpcs: ["https://base-rpc.publicnode.com", "https://base.drpc.org", "https://mainnet.base.org"] },
  { id: "bsc",   rpcs: ["https://bsc-dataseed.binance.org", "https://bsc-rpc.publicnode.com"] },
  { id: "celo",  rpcs: [Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org"] },
  { id: "ink",   rpcs: [Deno.env.get("INK_RPC_URL")  || "https://rpc-qnd.inkonchain.com"] },
  { id: "tempo", rpcs: [Deno.env.get("TEMPO_RPC_URL") || "https://rpc.moderato.tempo.xyz"], tokenAddress: "0x20c0000000000000000000000000000000000001" },
];

async function rpcGetBalance(addr: string, rpcs: string[]): Promise<bigint> {
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [addr, "latest"], id: 1 }),
      });
      const j = await res.json();
      if (j?.result) return BigInt(j.result);
    } catch { /* try next */ }
  }
  return 0n;
}

async function rpcGetTokenBalance(walletAddr: string, tokenAddr: string, rpcs: string[]): Promise<bigint> {
  const padded = walletAddr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const data = `0x70a08231${padded}`;
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: tokenAddr, data }, "latest"] }),
      });
      const j = await res.json();
      if (j?.result) return BigInt(j.result);
    } catch { /* try next */ }
  }
  return 0n;
}

function deriveAddress(envKey: string): string | null {
  const pk = Deno.env.get(envKey);
  if (!pk) return null;
  try {
    return privateKeyToAccount(`0x${pk.replace(/^0x/, "")}` as `0x${string}`).address.toLowerCase();
  } catch { return null; }
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const wallets: Array<{ role: "funder" | "relayer"; address: string | null }> = [
    { role: "funder",  address: deriveAddress("ACTIVATION_FUNDER_PRIVATE_KEY") },
    { role: "relayer", address: deriveAddress("RELAYER_PRIVATE_KEY") },
  ];

  const rows: Array<{ wallet_role: string; chain: string; balance_wei: string }> = [];

  for (const w of wallets) {
    if (!w.address) continue;
    for (const chain of CHAINS) {
      const bal = (chain as any).tokenAddress
        ? await rpcGetTokenBalance(w.address, (chain as any).tokenAddress, chain.rpcs)
        : await rpcGetBalance(w.address, chain.rpcs);
      rows.push({ wallet_role: w.role, chain: chain.id, balance_wei: bal.toString() });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("gas_spend_snapshots").insert(rows);
    if (error) {
      console.error("[gas-snapshot-cron]", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ inserted: rows.length, snapshots: rows }), {
    headers: { "Content-Type": "application/json" },
  });
});