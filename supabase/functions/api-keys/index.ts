// MoniPay API Keys Edge Function
// Handles merchant API key lifecycle: generate, list, revoke, validate, webhook management

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  checkRateLimit, 
  getClientIP,
  rateLimitedResponse,
  unauthorizedResponse,
} from "../_shared/security.ts";
import { loadPrincipal } from "../_shared/principals.ts";

// Rate limits for API key operations
const RATE_LIMITS = {
  keyOperations: { windowMs: 3600_000, maxRequests: 10, keyPrefix: "apikey_ops" }, // 10/hour
  validation: { windowMs: 60_000, maxRequests: 100, keyPrefix: "apikey_validate" }, // 100/min
};

// Generate cryptographically secure random string
function generateSecureString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

// Hash secret key using SHA-256 (simpler than bcrypt for Edge Functions)
async function hashSecretKey(secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secretKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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
    const { action, profileId, publicKey, secretKey, webhookUrl } = body;

    console.log(`api-keys action: ${action}, profileId: ${profileId?.slice(0, 8)}...`);

    // === GENERATE: Create new API key pair ===
    if (action === "generate") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.keyOperations);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Missing profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if profile exists (legacy or wallet-only)
      const profile = await loadPrincipal(supabase, profileId);
      if (!profile) {
        return new Response(
          JSON.stringify({ error: "Profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if keys already exist and revoke them
      await supabase
        .from("api_keys")
        .update({ is_active: false })
        .eq("profile_id", profileId)
        .eq("is_active", true);

      // Generate new key pair
      const newPublicKey = `pk_live_${generateSecureString(24)}`;
      const newSecretKey = `sk_live_${generateSecureString(32)}`;
      const secretKeyHash = await hashSecretKey(newSecretKey);
      const secretKeyPreview = `sk_live_...${newSecretKey.slice(-4)}`;

      // Insert new keys
      const { error: insertError } = await supabase
        .from("api_keys")
        .insert({
          profile_id: profileId,
          public_key: newPublicKey,
          secret_key_hash: secretKeyHash,
          secret_key_preview: secretKeyPreview,
          is_active: true,
        });

      if (insertError) {
        console.error("Failed to insert API keys:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to generate API keys" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Generated new API keys for profile ${profileId}`);

      // IMPORTANT: Secret key is only returned once at creation!
      return new Response(
        JSON.stringify({
          success: true,
          publicKey: newPublicKey,
          secretKey: newSecretKey, // Only shown once!
          secretKeyPreview: secretKeyPreview,
          message: "Save your secret key now. It will not be shown again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === LIST: Get merchant's API keys (masked) ===
    if (action === "list") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.keyOperations);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Missing profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: keys, error } = await supabase
        .from("api_keys")
        .select("id, public_key, secret_key_preview, webhook_url, is_active, created_at, last_used_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch API keys:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch API keys" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ keys: keys || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REVOKE: Deactivate an API key ===
    if (action === "revoke") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.keyOperations);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId || !publicKey) {
        return new Response(
          JSON.stringify({ error: "Missing profileId or publicKey" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: false })
        .eq("profile_id", profileId)
        .eq("public_key", publicKey);

      if (error) {
        console.error("Failed to revoke API key:", error);
        return new Response(
          JSON.stringify({ error: "Failed to revoke API key" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Revoked API key ${publicKey} for profile ${profileId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === UPDATE WEBHOOK: Set webhook URL for notifications ===
    if (action === "updateWebhook") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.keyOperations);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Missing profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate webhook URL format if provided
      if (webhookUrl) {
        try {
          const url = new URL(webhookUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error("Invalid protocol");
          }
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid webhook URL format" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update webhook URL on all active keys for this profile
      const { error } = await supabase
        .from("api_keys")
        .update({ webhook_url: webhookUrl || null })
        .eq("profile_id", profileId)
        .eq("is_active", true);

      if (error) {
        console.error("Failed to update webhook URL:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update webhook URL" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Updated webhook URL for profile ${profileId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === VALIDATE: Validate secret key for external API calls ===
    if (action === "validate") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.validation);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!publicKey || !secretKey) {
        return new Response(
          JSON.stringify({ error: "Missing publicKey or secretKey" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the key record
      const { data: keyRecord, error } = await supabase
        .from("api_keys")
        .select("id, profile_id, secret_key_hash, is_active")
        .eq("public_key", publicKey)
        .maybeSingle();

      if (error || !keyRecord) {
        console.warn(`API key validation failed: key not found for ${publicKey}`);
        return unauthorizedResponse("Invalid API key");
      }

      if (!keyRecord.is_active) {
        console.warn(`API key validation failed: key inactive for ${publicKey}`);
        return unauthorizedResponse("API key has been revoked");
      }

      // Hash the provided secret key and compare
      const providedHash = await hashSecretKey(secretKey);
      if (!secureCompare(providedHash, keyRecord.secret_key_hash)) {
        console.warn(`API key validation failed: secret mismatch for ${publicKey}`);
        return unauthorizedResponse("Invalid API key");
      }

      // Update last_used_at
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRecord.id);

      // Get merchant profile info (legacy or wallet-only)
      const profile = await loadPrincipal(supabase, keyRecord.profile_id);

      return new Response(
        JSON.stringify({
          valid: true,
          profileId: keyRecord.profile_id,
          payTag: profile?.pay_tag,
          walletAddress: profile?.wallet_address,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("API keys error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
