// Twitter Webhook CRC Endpoint for X Account Verification
// Handles Twitter's Challenge-Response Check (CRC) validation and webhook events

import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const TWITTER_API_SECRET = Deno.env.get("TWITTER_API_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Generate HMAC SHA-256 signature for CRC validation
function generateCrcResponseToken(crcToken: string, consumerSecret: string): string {
  const hmac = createHmac("sha256", consumerSecret);
  hmac.update(crcToken);
  const hash = hmac.digest("base64");
  return `sha256=${hash}`;
}

// Verify webhook signature from Twitter
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest("base64")}`;
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let match = true;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== expectedSignature[i]) {
      match = false;
    }
  }
  
  return match;
}

// Extract verification code from tweet text
function extractVerificationCode(text: string): string | null {
  const match = text.match(/VERIFY-[A-Z0-9]{9}/);
  return match ? match[0] : null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if API secret is configured
  if (!TWITTER_API_SECRET) {
    console.error("TWITTER_API_SECRET is not configured");
    return new Response(
      JSON.stringify({ error: "Server misconfiguration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // GET: CRC Validation (Twitter sends this to validate webhook)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const crcToken = url.searchParams.get("crc_token");

    if (!crcToken) {
      console.warn("CRC validation request missing crc_token");
      return new Response(
        JSON.stringify({ error: "Missing crc_token parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing CRC validation request");
    
    const responseToken = generateCrcResponseToken(crcToken, TWITTER_API_SECRET);
    
    console.log("CRC response generated successfully");
    
    return new Response(
      JSON.stringify({ response_token: responseToken }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST: Webhook Events (Twitter sends tweet events here)
  if (req.method === "POST") {
    const bodyText = await req.text();
    
    // Verify webhook signature
    const signature = req.headers.get("x-twitter-webhooks-signature");
    
    if (!signature) {
      console.warn("Webhook request missing signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!verifyWebhookSignature(bodyText, signature, TWITTER_API_SECRET)) {
      console.warn("Webhook signature verification failed");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Webhook signature verified successfully");

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      console.error("Failed to parse webhook body:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process tweet_create_events
    const tweetEvents = body.tweet_create_events;
    
    if (tweetEvents && Array.isArray(tweetEvents)) {
      console.log(`Processing ${tweetEvents.length} tweet event(s)`);
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      for (const tweet of tweetEvents) {
        const tweetText = tweet.text;
        const tweetAuthor = tweet.user?.screen_name;
        const tweetAuthorId = tweet.user?.id_str || (tweet.user?.id != null ? String(tweet.user.id) : null);

        if (!tweetText || !tweetAuthor) {
          console.log("Tweet missing text or author, skipping");
          continue;
        }

        console.log(`Processing tweet from @${tweetAuthor}: ${tweetText.substring(0, 50)}...`);

        // Extract verification code from tweet
        const verificationCode = extractVerificationCode(tweetText);
        
        if (!verificationCode) {
          console.log("No verification code found in tweet, skipping");
          continue;
        }

        console.log(`Found verification code: ${verificationCode}`);

        // Find profile with matching verification code
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, x_username, x_verification_expires_at")
          .eq("x_verification_code", verificationCode)
          .single();

        if (profileError || !profile) {
          console.log(`No profile found for code ${verificationCode}`);
          continue;
        }

        // Check if code has expired
        if (profile.x_verification_expires_at) {
          const expiresAt = new Date(profile.x_verification_expires_at);
          if (expiresAt < new Date()) {
            console.log(`Verification code ${verificationCode} has expired`);
            continue;
          }
        }

        // Verify the tweet author matches the claimed username (case-insensitive)
        if (profile.x_username?.toLowerCase() !== tweetAuthor.toLowerCase()) {
          console.log(`Username mismatch: expected ${profile.x_username}, got ${tweetAuthor}`);
          continue;
        }

        // Mark X account as verified — also persist the X user_id so MagicPay
        // claims can identify recipients by stable user_id, not mutable username.
        const updatePayload: Record<string, unknown> = {
          x_verified: true,
          x_verification_code: null,
          x_verification_expires_at: null,
        };
        if (tweetAuthorId) updatePayload.x_user_id = tweetAuthorId;

        const { error: updateError } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", profile.id);

        if (updateError) {
          console.error(`Failed to verify X account for profile ${profile.id}:`, updateError);
          continue;
        }

        console.log(`Successfully verified X account @${tweetAuthor} (id=${tweetAuthorId || 'unknown'}) for profile ${profile.id}`);
      }
    }

    return new Response(
      JSON.stringify({ status: "ok" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Unsupported method
  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
