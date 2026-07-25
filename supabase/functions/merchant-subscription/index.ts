import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  checkRateLimit, 
  RATE_LIMITS, 
  verifyRequestSignature,
  rateLimitedResponse,
  unauthorizedResponse,
  getClientIP,
} from "../_shared/security.ts";

const MONIBOT_PAY_TAG = "monibot";
const SUBSCRIPTION_AMOUNT = 30; // $30 USDC per month
const SUBSCRIPTION_DAYS = 30;
const GRACE_PERIOD_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const bodyText = await req.text();

  try {
    const parsed = JSON.parse(bodyText);

    // Public action: check subscription status (no auth required)
    if (parsed.action === "checkStatus") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const clientIP = getClientIP(req);
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

      const { profileId, payTag } = parsed;
      
      // Admin account @monibot gets free access
      if (payTag === 'monibot') {
        return new Response(
          JSON.stringify({ active: true, plan: 'admin' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let targetProfileId = profileId;
      
      // If payTag provided, look up profile
      if (payTag && !profileId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, pay_tag")
          .eq("pay_tag", payTag.toLowerCase())
          .maybeSingle();
        if (!profile) {
          return new Response(
            JSON.stringify({ error: "Merchant not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Also check if resolved profile is monibot
        if (profile.pay_tag === 'monibot') {
          return new Response(
            JSON.stringify({ active: true, plan: 'admin' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        targetProfileId = profile.id;
      }
      
      // Check if profileId belongs to monibot
      if (profileId && !payTag) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("pay_tag")
          .eq("id", profileId)
          .maybeSingle();
        if (prof?.pay_tag === 'monibot') {
          return new Response(
            JSON.stringify({ active: true, plan: 'admin' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (!targetProfileId) {
        return new Response(
          JSON.stringify({ error: "Profile ID or PayTag required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for active subscription
      const now = new Date().toISOString();
      const { data: sub } = await supabase
        .from("merchant_subscriptions")
        .select("*")
        .eq("profile_id", targetProfileId)
        .eq("status", "active")
        .gte("expires_at", now)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        return new Response(
          JSON.stringify({ 
            active: true, 
            expiresAt: sub.expires_at,
            plan: sub.plan,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check grace period
      const graceDate = new Date();
      graceDate.setDate(graceDate.getDate() - GRACE_PERIOD_DAYS);
      
      const { data: expiredSub } = await supabase
        .from("merchant_subscriptions")
        .select("*")
        .eq("profile_id", targetProfileId)
        .gte("expires_at", graceDate.toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (expiredSub) {
        return new Response(
          JSON.stringify({ 
            active: false, 
            gracePeriod: true,
            expiresAt: expiredSub.expires_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ active: false, gracePeriod: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (_) {
    // Not a public action, continue
  }

  // Verify signature for authenticated actions
  const signatureResult = await verifyRequestSignature(req, bodyText);
  if (!signatureResult.valid) {
    return unauthorizedResponse(signatureResult.error);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, profileId, txHash } = JSON.parse(bodyText);
    const clientIP = getClientIP(req);

    if (action === "subscribe") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.relay);
      if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

      if (!profileId || !txHash) {
        return new Response(
          JSON.stringify({ error: "Profile ID and transaction hash required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the profile exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, pay_tag")
        .eq("id", profileId)
        .single();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: "Profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if tx_hash already used
      const { data: existingSub } = await supabase
        .from("merchant_subscriptions")
        .select("id")
        .eq("tx_hash", txHash)
        .maybeSingle();

      if (existingSub) {
        return new Response(
          JSON.stringify({ error: "This transaction has already been used" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for existing active subscription to extend
      const now = new Date();
      const { data: activeSub } = await supabase
        .from("merchant_subscriptions")
        .select("*")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .gte("expires_at", now.toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let expiresAt: Date;
      if (activeSub) {
        // Extend from current expiry
        expiresAt = new Date(activeSub.expires_at);
        expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_DAYS);
      } else {
        // Start fresh
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_DAYS);
      }

      const { data: newSub, error } = await supabase
        .from("merchant_subscriptions")
        .insert({
          profile_id: profileId,
          plan: "pro",
          amount: SUBSCRIPTION_AMOUNT,
          currency: "USDC",
          status: "active",
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          tx_hash: txHash,
        })
        .select()
        .single();

      if (error) {
        console.error("Subscription creation error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to create subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Subscription created for ${profile.pay_tag}: expires ${expiresAt.toISOString()}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          subscription: {
            id: newSub.id,
            expiresAt: newSub.expires_at,
            plan: newSub.plan,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Subscription edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
