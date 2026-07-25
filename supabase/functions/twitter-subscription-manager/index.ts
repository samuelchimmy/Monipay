// Twitter Subscription Manager Edge Function
// Handles checking and creating webhook subscriptions for Twitter Account Activity API

import { createHmac } from "node:crypto";
import { corsHeaders } from "../_shared/security.ts";

const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY");
const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_API_SECRET");
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN");
const TWITTER_ACCESS_SECRET = Deno.env.get("TWITTER_ACCESS_SECRET");
const ENV_NAME = "production";

interface RequestBody {
  action: 'check' | 'subscribe' | 'list-webhooks' | 'register-webhook';
  webhookUrl?: string;
}

// Generate OAuth 1.0a signature
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")
  )}`;
  
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmac = createHmac("sha1", signingKey);
  hmac.update(signatureBaseString);
  return hmac.digest("base64");
}

// Generate OAuth Authorization header
function generateOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
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

function validateEnvVars(): string | null {
  if (!TWITTER_CONSUMER_KEY) return "Missing TWITTER_CONSUMER_KEY";
  if (!TWITTER_CONSUMER_SECRET) return "Missing TWITTER_API_SECRET";
  if (!TWITTER_ACCESS_TOKEN) return "Missing TWITTER_ACCESS_TOKEN";
  if (!TWITTER_ACCESS_SECRET) return "Missing TWITTER_ACCESS_SECRET";
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const body: RequestBody = await req.json();
    const { action } = body;

    console.log(`Twitter subscription manager action: ${action}`);

    // LIST-WEBHOOKS: List all registered webhooks
    if (action === 'list-webhooks') {
      const url = `https://api.twitter.com/1.1/account_activity/all/${ENV_NAME}/webhooks.json`;
      const oauthHeader = generateOAuthHeader("GET", url);
      
      console.log("Listing webhooks...");
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: oauthHeader,
        },
      });

      const responseText = await response.text();
      console.log(`List webhooks response (${response.status}):`, responseText);

      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to list webhooks: ${response.status}`,
            details: responseText 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          webhooks: JSON.parse(responseText) 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK: Check if subscription exists
    if (action === 'check') {
      const url = `https://api.twitter.com/1.1/account_activity/all/${ENV_NAME}/subscriptions.json`;
      const oauthHeader = generateOAuthHeader("GET", url);
      
      console.log("Checking subscription...");
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: oauthHeader,
        },
      });

      const responseText = await response.text();
      console.log(`Check subscription response (${response.status}):`, responseText);

      // 204 = subscription exists, 404 = no subscription
      if (response.status === 204) {
        return new Response(
          JSON.stringify({ 
            subscribed: true,
            message: "Subscription is active" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          subscribed: false,
          status: response.status,
          message: "No active subscription found",
          details: responseText 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SUBSCRIBE: Create the subscription
    if (action === 'subscribe') {
      const url = `https://api.twitter.com/1.1/account_activity/all/${ENV_NAME}/subscriptions.json`;
      const oauthHeader = generateOAuthHeader("POST", url);
      
      console.log("Creating subscription...");
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: oauthHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const responseText = await response.text();
      console.log(`Create subscription response (${response.status}):`, responseText);

      // 204 = subscription created successfully
      if (response.status === 204) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: "Subscription created successfully" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for "already subscribed" error
      if (response.status === 409 || responseText.includes("already subscribed")) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: "Subscription already exists" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to create subscription: ${response.status}`,
          details: responseText 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REGISTER-WEBHOOK: Register a new webhook URL
    if (action === 'register-webhook') {
      const webhookUrl = body.webhookUrl;
      if (!webhookUrl) {
        return new Response(
          JSON.stringify({ error: "webhookUrl is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const baseUrl = `https://api.twitter.com/1.1/account_activity/all/${ENV_NAME}/webhooks.json`;
      const urlWithParams = `${baseUrl}?url=${encodeURIComponent(webhookUrl)}`;
      
      // For OAuth signature, we need to include query params
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: TWITTER_CONSUMER_KEY!,
        oauth_nonce: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: TWITTER_ACCESS_TOKEN!,
        oauth_version: "1.0",
        url: webhookUrl, // Include the url param in signature
      };

      const signature = generateOAuthSignature(
        "POST",
        baseUrl,
        oauthParams,
        TWITTER_CONSUMER_SECRET!,
        TWITTER_ACCESS_SECRET!
      );

      // Remove url param from oauth header (it's a query param, not oauth param)
      delete oauthParams.url;
      const signedOAuthParams = {
        ...oauthParams,
        oauth_signature: signature,
      };

      const oauthHeader = "OAuth " +
        Object.entries(signedOAuthParams)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
          .join(", ");
      
      console.log("Registering webhook:", webhookUrl);
      
      const response = await fetch(urlWithParams, {
        method: "POST",
        headers: {
          Authorization: oauthHeader,
        },
      });

      const responseText = await response.text();
      console.log(`Register webhook response (${response.status}):`, responseText);

      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Failed to register webhook: ${response.status}`,
            details: responseText 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Webhook registered successfully",
          data: JSON.parse(responseText) 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: check, subscribe, list-webhooks, or register-webhook" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Twitter subscription manager error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
