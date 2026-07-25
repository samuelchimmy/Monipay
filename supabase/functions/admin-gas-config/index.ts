/**
 * Admin Gas Config
 *
 * Reads/writes per-chain gas funding amounts (MIN_REQUIRED + FUNDING_AMOUNT)
 * for the activation-funder. Stored as flat key/value rows in `bot_settings`:
 *   gas_min_<chain>   — minimum native balance (wei, base-10 string)
 *   gas_fund_<chain>  — top-up amount (wei, base-10 string)
 *
 * Same admin-wallet signature scheme as admin-wallet-balances.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";
import { checkAdminOrigin, getAdminCorsHeaders, checkRateLimit, RATE_LIMITS, rateLimitedResponse } from "../_shared/security.ts";

const MONIBOT_WALLET_ADDRESS = "0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHAINS = ["base", "bsc", "celo", "ink"] as const;
type Chain = typeof CHAINS[number];

// In-code defaults (kept identical to activation-funder fallbacks).
const DEFAULTS: Record<Chain, { min: string; fund: string }> = {
  base: { min: "500000000000000",   fund: "1000000000000000"  },
  bsc:  { min: "500000000000000",   fund: "1000000000000000"  },
  celo: { min: "50000000000000000", fund: "50000000000000000" },
  ink:  { min: "100000000000000",   fund: "200000000000000"   },
};

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

    const body = await req.json().catch(() => ({}));
    const ts = body?.timestamp || Date.now();
    const action: "get" | "set" = body?.action === "set" ? "set" : "get";
    const signedMessage = `monibot-campaign:gas-config:${action}:${ts}`;

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "get") {
      const { data, error } = await supabase
        .from("bot_settings")
        .select("key, value")
        .or(CHAINS.map(c => `key.eq.gas_min_${c},key.eq.gas_fund_${c}`).join(","));

      if (error) throw error;

      const overrides = new Map<string, string>((data || []).map(r => [r.key, r.value]));
      const config = Object.fromEntries(CHAINS.map(c => ([
        c,
        {
          min:  overrides.get(`gas_min_${c}`)  ?? DEFAULTS[c].min,
          fund: overrides.get(`gas_fund_${c}`) ?? DEFAULTS[c].fund,
          minDefault:  DEFAULTS[c].min,
          fundDefault: DEFAULTS[c].fund,
          overridden: overrides.has(`gas_min_${c}`) || overrides.has(`gas_fund_${c}`),
        },
      ])));

      return new Response(JSON.stringify({ config }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "set"
    const updates: Array<{ chain: string; min?: string; fund?: string }> = body?.updates || [];
    if (!Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ error: "updates required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows: { key: string; value: string }[] = [];
    for (const u of updates) {
      const chain = String(u.chain || "").toLowerCase();
      if (!CHAINS.includes(chain as Chain)) continue;
      if (u.min && /^[0-9]+$/.test(String(u.min))) {
        rows.push({ key: `gas_min_${chain}`, value: String(u.min) });
      }
      if (u.fund && /^[0-9]+$/.test(String(u.fund))) {
        rows.push({ key: `gas_fund_${chain}`, value: String(u.fund) });
      }
    }
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "no valid updates" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await supabase
      .from("bot_settings")
      .upsert(rows, { onConflict: "key" });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ success: true, updated: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[admin-gas-config]", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});