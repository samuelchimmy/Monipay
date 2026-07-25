// Twitter Poll Verification Edge Function
// Polls the X Search API for tweets containing verification codes
// Works with Basic tier ($100/mo) - 60 requests per 15 minutes

import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_API_SECRET")?.trim();
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const TWITTER_ACCESS_SECRET = Deno.env.get("TWITTER_ACCESS_SECRET")?.trim();

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Generate OAuth 1.0a signature
// For GET requests with query params, ALL params (oauth + query) must be in the signature
function generateOAuthSignature(
  method: string,
  baseUrl: string,
  allParams: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(
    Object.entries(allParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")
  )}`;

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmac = createHmac("sha1", signingKey);
  hmac.update(signatureBaseString);
  return hmac.digest("base64");
}

// Generate OAuth Authorization header with query params included in signature
function generateOAuthHeaderWithParams(
  method: string,
  baseUrl: string,
  queryParams: Record<string, string>
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  // Merge oauth params with query params for signature
  const allParams = { ...oauthParams, ...queryParams };

  const signature = generateOAuthSignature(
    method,
    baseUrl,
    allParams,
    TWITTER_CONSUMER_SECRET!,
    TWITTER_ACCESS_SECRET!
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return (
    "OAuth " +
    Object.entries(signedOAuthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

// Extract verification code from tweet text
function extractVerificationCode(text: string): string | null {
  const match = text.match(/VERIFY-[A-Z0-9]{9}/);
  return match ? match[0] : null;
}

// Validate environment variables
function validateEnvVars(): string | null {
  if (!TWITTER_CONSUMER_KEY) return "Missing TWITTER_CONSUMER_KEY";
  if (!TWITTER_CONSUMER_SECRET) return "Missing TWITTER_API_SECRET";
  if (!TWITTER_ACCESS_TOKEN) return "Missing TWITTER_ACCESS_TOKEN";
  if (!TWITTER_ACCESS_SECRET) return "Missing TWITTER_ACCESS_SECRET";
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const envError = validateEnvVars();
    if (envError) {
      console.error(envError);
      return new Response(
        JSON.stringify({ error: envError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting Twitter verification poll...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending X verifications (profiles with verification codes that haven't expired)
    const { data: pendingProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, x_username, x_verification_code, x_verification_expires_at")
      .not("x_verification_code", "is", null)
      .eq("x_verified", false);

    if (profilesError) {
      console.error("Failed to fetch pending profiles:", profilesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending profiles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingProfiles || pendingProfiles.length === 0) {
      console.log("No pending verifications found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending verifications",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingProfiles.length} pending verification(s)`);

    // Filter out expired verifications
    const now = new Date();
    const validPendingProfiles = pendingProfiles.filter(profile => {
      if (!profile.x_verification_expires_at) return true;
      return new Date(profile.x_verification_expires_at) > now;
    });

    if (validPendingProfiles.length === 0) {
      console.log("All pending verifications have expired");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All pending verifications expired",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build search query - search for any of the verification codes
    // Note: Twitter Search API v2 has a max query length of 512 chars
    const verificationCodes = validPendingProfiles
      .map(p => p.x_verification_code)
      .filter(Boolean);

    // Search for tweets containing the verification code prefix.
    // We intentionally DO NOT require an @mention to avoid spammy mentions.
    // Matching to a profile is done via (code + username) below.
    const searchQuery = "VERIFY- -is:retweet";
    const baseUrl = "https://api.twitter.com/2/tweets/search/recent";
    const queryParamsObj: Record<string, string> = {
      query: searchQuery,
      "tweet.fields": "author_id,created_at,text",
      "user.fields": "username",
      expansions: "author_id",
      max_results: "100"
    };

    const queryParams = new URLSearchParams(queryParamsObj);
    const fullUrl = `${baseUrl}?${queryParams.toString()}`;
    const oauthHeader = generateOAuthHeaderWithParams("GET", baseUrl, queryParamsObj);

    console.log("Searching for tweets with query:", searchQuery);

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        Authorization: oauthHeader,
      },
    });

    const responseText = await response.text();
    console.log(`Search response (${response.status}):`, responseText.substring(0, 500));

    if (!response.ok) {
      // Check for rate limit
      if (response.status === 429) {
        const resetTime = response.headers.get("x-rate-limit-reset");
        console.log("Rate limited. Reset at:", resetTime);
        return new Response(
          JSON.stringify({ 
            error: "Rate limited",
            resetAt: resetTime,
            message: "Twitter API rate limit reached. Try again later."
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: `Twitter API error: ${response.status}`,
          details: responseText
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchResult = JSON.parse(responseText);
    const tweets = searchResult.data || [];
    const users = searchResult.includes?.users || [];

    console.log(`Found ${tweets.length} tweet(s) to process`);

    // Create a map of author_id to username
    const userMap = new Map<string, string>(users.map((u: { id: string; username: string }) => [u.id, u.username]));

    let verifiedCount = 0;
    const verifiedProfiles: string[] = [];

    // Process each tweet
    for (const tweet of tweets) {
      const tweetText = tweet.text;
      const authorId = tweet.author_id;
      const authorUsername = userMap.get(authorId);

      if (!tweetText || !authorUsername) {
        console.log("Tweet missing text or author, skipping");
        continue;
      }

      console.log(`Processing tweet from @${authorUsername}: ${tweetText.substring(0, 50)}...`);

      // Extract verification code from tweet
      const verificationCode = extractVerificationCode(tweetText);

      if (!verificationCode) {
        console.log("No verification code found in tweet, skipping");
        continue;
      }

      console.log(`Found verification code: ${verificationCode}`);

      // Find matching profile
      const matchingProfile = validPendingProfiles.find(
        p => p.x_verification_code === verificationCode &&
             String(p.x_username || "").toLowerCase() === authorUsername.toLowerCase()
      );

      if (!matchingProfile) {
        console.log(`No matching profile for code ${verificationCode} from @${authorUsername}`);
        continue;
      }

      // Mark X account as verified — also persist the X user_id (author_id)
      // so MagicPay claims can verify by stable user_id, not mutable username.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          x_verified: true,
          x_user_id: authorId,
          x_verification_code: null,
          x_verification_expires_at: null,
        })
        .eq("id", matchingProfile.id);

      if (updateError) {
        console.error(`Failed to verify X account for profile ${matchingProfile.id}:`, updateError);
        continue;
      }

      console.log(`✅ Successfully verified X account @${authorUsername} for profile ${matchingProfile.id}`);
      verifiedCount++;
      verifiedProfiles.push(`@${authorUsername}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Processed ${tweets.length} tweets, verified ${verifiedCount} accounts`,
        verified: verifiedProfiles,
        pendingCount: validPendingProfiles.length - verifiedCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Twitter poll verification error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
