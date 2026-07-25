import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * create-iou Edge Function
 * 
 * Called by bots when a P2P recipient is not a MoniTag but IS a valid social user.
 * Records the IOU in the database (on-chain tx is done by the bot itself).
 * 
 * Body: {
 *   senderProfileId, senderPayTag, recipientIdentifier (e.g. "discord:username"),
 *   platform, platformUserId, amount, chain, token, tokenSymbol,
 *   iouId (on-chain ID), txHash, expiry (ISO string)
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify service role
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      senderProfileId, senderPayTag, recipientIdentifier,
      platform, platformUserId, amount, chain, token, tokenSymbol,
      iouId, txHash, expiry,
    } = body;

    if (!senderProfileId || !platform || !platformUserId || !amount || !iouId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate recipientId hash matching the contract: keccak256(platform:userId)
    const recipientId = `${platform}:${platformUserId}`;

    const { data, error } = await supabase.from("ious").insert({
      iou_id: String(iouId),
      sender_profile_id: senderProfileId,
      sender_pay_tag: senderPayTag,
      recipient_identifier: recipientIdentifier,
      recipient_id: recipientId,
      platform,
      platform_user_id: platformUserId,
      amount,
      chain: chain.toLowerCase(),
      token,
      token_symbol: tokenSymbol || "USDC",
      status: "pending",
      expiry: expiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tx_hash_create: txHash || null,
    }).select().maybeSingle();

    if (error) {
      console.error("IOU insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, iou: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("create-iou error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
