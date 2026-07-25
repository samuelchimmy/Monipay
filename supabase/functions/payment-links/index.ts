// MoniPay Payment Links Edge Function
// Handles payment link CRUD: create, list, get, update, deactivate, validate

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  checkRateLimit, 
  getClientIP,
  rateLimitedResponse,
} from "../_shared/security.ts";

// Payment URL base
const PAYMENT_URL_BASE = "https://monipay.xyz/pay";

// Rate limits
const RATE_LIMITS = {
  mutations: { windowMs: 60_000, maxRequests: 30, keyPrefix: "paylink_mutate" },
  reads: { windowMs: 60_000, maxRequests: 100, keyPrefix: "paylink_read" },
};

// Generate unique link code
function generateLinkCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return `pl_${Array.from(array, byte => chars[byte % chars.length]).join('')}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const clientIP = getClientIP(req);
    const body = await req.json();
    const { 
      action, 
      profileId, 
      linkCode, 
      productId, 
      name, 
      description, 
      amount, 
      usageLimit, 
      expiresAt,
      isActive,
      metadata 
    } = body;

    console.log(`payment-links action: ${action}, profileId: ${profileId?.slice(0, 8) || 'N/A'}...`);

    // === CREATE: Generate new payment link ===
    if (action === "create") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.mutations);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId || !name || !amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: profileId, name, amount (must be > 0)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify profile exists
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, pay_tag")
        .eq("id", profileId)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: "Profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If productId provided, verify it belongs to this profile
      if (productId) {
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("id, name, price")
          .eq("id", productId)
          .eq("profile_id", profileId)
          .maybeSingle();

        if (productError || !product) {
          return new Response(
            JSON.stringify({ error: "Product not found or doesn't belong to this profile" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const newLinkCode = generateLinkCode();

      const { data: link, error: insertError } = await supabase
        .from("payment_links")
        .insert({
          profile_id: profileId,
          product_id: productId || null,
          link_code: newLinkCode,
          name: name,
          description: description || null,
          amount: amount,
          is_active: true,
          usage_limit: usageLimit || null,
          usage_count: 0,
          expires_at: expiresAt || null,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create payment link:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create payment link" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Created payment link ${newLinkCode} for profile ${profileId}`);

      return new Response(
        JSON.stringify({
          success: true,
          link: {
            ...link,
            url: `${PAYMENT_URL_BASE}/${newLinkCode}`,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === LIST: Get merchant's payment links ===
    if (action === "list") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.reads);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Missing profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: links, error } = await supabase
        .from("payment_links")
        .select("*, products(name, icon)")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch payment links:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch payment links" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add URLs to each link
      const linksWithUrls = (links || []).map(link => ({
        ...link,
        url: `${PAYMENT_URL_BASE}/${link.link_code}`,
      }));

      return new Response(
        JSON.stringify({ links: linksWithUrls }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === GET: Get payment link by code (public) ===
    if (action === "get") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.reads);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!linkCode) {
        return new Response(
          JSON.stringify({ error: "Missing linkCode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: link, error } = await supabase
        .from("payment_links")
        .select("*, products(name, icon, description)")
        .eq("link_code", linkCode)
        .maybeSingle();

      if (error || !link) {
        return new Response(
          JSON.stringify({ error: "Payment link not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if link is still valid
      if (!link.is_active) {
        return new Response(
          JSON.stringify({ error: "This payment link has been deactivated" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This payment link has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (link.usage_limit && link.usage_count >= link.usage_limit) {
        return new Response(
          JSON.stringify({ error: "This payment link has reached its usage limit" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get merchant info
      const { data: merchant } = await supabase
        .from("profiles")
        .select("pay_tag, wallet_address")
        .eq("id", link.profile_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          link: {
            ...link,
            url: `${PAYMENT_URL_BASE}/${link.link_code}`,
          },
          merchant: {
            payTag: merchant?.pay_tag,
            walletAddress: merchant?.wallet_address,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === UPDATE: Modify payment link settings ===
    if (action === "update") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.mutations);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId || !linkCode) {
        return new Response(
          JSON.stringify({ error: "Missing profileId or linkCode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build update object with only provided fields
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (amount !== undefined && amount > 0) updates.amount = amount;
      if (usageLimit !== undefined) updates.usage_limit = usageLimit;
      if (expiresAt !== undefined) updates.expires_at = expiresAt;
      if (isActive !== undefined) updates.is_active = isActive;
      if (metadata !== undefined) updates.metadata = metadata;

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ error: "No fields to update" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: link, error } = await supabase
        .from("payment_links")
        .update(updates)
        .eq("link_code", linkCode)
        .eq("profile_id", profileId)
        .select()
        .single();

      if (error) {
        console.error("Failed to update payment link:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update payment link" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          link: {
            ...link,
            url: `${PAYMENT_URL_BASE}/${link.link_code}`,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === DEACTIVATE: Disable a payment link ===
    if (action === "deactivate") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.mutations);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId || !linkCode) {
        return new Response(
          JSON.stringify({ error: "Missing profileId or linkCode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("payment_links")
        .update({ is_active: false })
        .eq("link_code", linkCode)
        .eq("profile_id", profileId);

      if (error) {
        console.error("Failed to deactivate payment link:", error);
        return new Response(
          JSON.stringify({ error: "Failed to deactivate payment link" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Deactivated payment link ${linkCode} for profile ${profileId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === INCREMENT_USAGE: Called when payment is made (internal) ===
    if (action === "incrementUsage") {
      if (!linkCode) {
        return new Response(
          JSON.stringify({ error: "Missing linkCode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Simple increment
      const { data: link } = await supabase
        .from("payment_links")
        .select("usage_count")
        .eq("link_code", linkCode)
        .single();

      if (link) {
        await supabase
          .from("payment_links")
          .update({ usage_count: (link.usage_count || 0) + 1 })
          .eq("link_code", linkCode);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Payment links error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
