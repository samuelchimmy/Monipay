import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * claim-iou Edge Function
 * 
 * Called when a user links a social account that has pending IOUs.
 * Also callable manually from the ClaimIOU page.
 * 
 * Two modes:
 *   1. check: { action: "check", platform, platformUserId }
 *      → Returns pending IOUs for that social identity
 *   2. claim: { action: "claim", iouDbId, claimantProfileId }
 *      → Marks IOU as claimed, triggers on-chain claim via vault
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // ─── CHECK: Find pending IOUs for a social identity ───
    if (action === "check") {
      const { platform, platformUserId } = body;
      if (!platform || !platformUserId) {
        return new Response(JSON.stringify({ error: "platform and platformUserId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pendingIOUs, error } = await supabase
        .from("ious")
        .select("*")
        .eq("platform", platform)
        .eq("platform_user_id", platformUserId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ pendingIOUs: pendingIOUs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── LIST BY SENDER/RECIPIENT: MagicPay receipts (IOUs sent or received by a profile) ───
    if (action === "list-by-sender" || action === "list") {
      const profileId = body.profileId || body.senderProfileId;
      const { limit = 50 } = body;
      if (!profileId) {
        return new Response(JSON.stringify({ error: "profileId or senderProfileId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ious, error } = await supabase
        .from("ious")
        .select("id, iou_id, status, amount, token_symbol, chain, platform, recipient_identifier, recipient_id, sender_profile_id, recipient_profile_id, sender_pay_tag, expiry, created_at, claimed_at, tx_hash_create, tx_hash_claim")
        .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(limit) || 50, 200));

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-mark expired pending IOUs (display only; refund happens on-chain elsewhere)
      const now = Date.now();
      const enriched = (ious || []).map((i: any) => {
        const expiresMs = i.expiry ? new Date(i.expiry).getTime() : 0;
        const isExpired = i.status === "pending" && expiresMs > 0 && expiresMs < now;
        return { ...i, displayStatus: isExpired ? "expired" : i.status };
      });

      return new Response(JSON.stringify({ ious: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CLAIM: Mark IOU as claimed and assign to profile ───
    if (action === "claim") {
      const { iouDbId, claimantProfileId } = body;
      if (!iouDbId || !claimantProfileId) {
        return new Response(JSON.stringify({ error: "iouDbId and claimantProfileId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the IOU
      const { data: iou, error: fetchErr } = await supabase
        .from("ious")
        .select("*")
        .eq("id", iouDbId)
        .eq("status", "pending")
        .maybeSingle();

      if (fetchErr || !iou) {
        return new Response(JSON.stringify({ error: "IOU not found or already claimed" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get claimant's wallet address
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_address, pay_tag")
        .eq("id", claimantProfileId)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Claimant profile not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // TODO: Execute on-chain claim via vault wallet
      // For now, mark as claimed in DB. On-chain claim will be added
      // when IOURegistry contract is deployed and vault key is configured.

      const { error: updateErr } = await supabase
        .from("ious")
        .update({
          status: "claimed",
          recipient_profile_id: claimantProfileId,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", iouDbId);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log to transactions ledger
      await supabase.from("transactions").insert({
        profile_id: claimantProfileId,
        type: "iou_claim",
        amount: iou.amount,
        counterparty: iou.sender_pay_tag,
        source: "iou",
        status: "completed",
        metadata: { iou_id: iou.iou_id, chain: iou.chain, platform: iou.platform },
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Claimed ${iou.amount} ${iou.token_symbol} from @${iou.sender_pay_tag}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── AUTO-CHECK: Called during social identity linking ───
    if (action === "auto-link-check") {
      const { profileId, platform, platformUserId } = body;
      if (!profileId || !platform || !platformUserId) {
        return new Response(JSON.stringify({ error: "profileId, platform, platformUserId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find all pending IOUs for this social identity
      const { data: pendingIOUs } = await supabase
        .from("ious")
        .select("*")
        .eq("platform", platform)
        .eq("platform_user_id", platformUserId)
        .eq("status", "pending");

      if (!pendingIOUs?.length) {
        return new Response(JSON.stringify({ pendingCount: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-assign recipient_profile_id to all pending IOUs
      const iouIds = pendingIOUs.map(i => i.id);
      await supabase
        .from("ious")
        .update({ recipient_profile_id: profileId })
        .in("id", iouIds);

      return new Response(JSON.stringify({
        pendingCount: pendingIOUs.length,
        totalAmount: pendingIOUs.reduce((sum, i) => sum + Number(i.amount), 0),
        ious: pendingIOUs,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("claim-iou error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
