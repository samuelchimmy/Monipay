/**
 * Arc Waitlist Admin
 *
 * Returns recent arc_waitlist signups. Requires @monibot wallet signature
 * (same admin scheme as admin-wallet-balances).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";
import { checkAdminOrigin, getAdminCorsHeaders, checkRateLimit, RATE_LIMITS, rateLimitedResponse } from "../_shared/security.ts";

const MONIBOT_WALLET_ADDRESS = "0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3";
const MAX_LIMIT = 5000;

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
    const limit = Math.min(Number(body?.limit) || 500, MAX_LIMIT);
    const signedMessage = `monibot-campaign:arc-waitlist:${ts}`;

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error, count } = await supabase
      .from("arc_waitlist")
      .select("id,email,monitag,source,user_agent,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return new Response(JSON.stringify({
      total: count ?? data?.length ?? 0,
      rows: data ?? [],
      fetchedAt: Date.now(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[arc-waitlist-admin]", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});