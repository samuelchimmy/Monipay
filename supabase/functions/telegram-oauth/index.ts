// Telegram Login Widget verification + profile linking
// Verifies Telegram auth data hash using HMAC-SHA256 of the bot token

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifyTelegramAuth(authData: Record<string, string>): Promise<boolean> {
  const { hash, ...data } = authData;
  if (!hash) return false;

  // Check auth_date is not too old (allow 1 hour)
  const authDate = parseInt(data.auth_date || "0");
  if (Date.now() / 1000 - authDate > 3600) return false;

  // Build check string: key=value pairs sorted alphabetically, joined by \n
  const checkString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");

  // SHA256 of the bot token is the secret key
  const encoder = new TextEncoder();
  const botTokenKey = await crypto.subtle.digest("SHA-256", encoder.encode(TELEGRAM_BOT_TOKEN));

  // HMAC-SHA256 of check_string using the secret key
  const key = await crypto.subtle.importKey(
    "raw",
    botTokenKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(checkString));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hexSignature === hash;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { telegramAuthData, profileId, walletAddress } = await req.json();

    if (!telegramAuthData || typeof telegramAuthData !== "object") {
      return jsonResponse({ error: "Telegram auth data is required" }, 400);
    }
    if (!profileId || !UUID_RE.test(profileId)) {
      return jsonResponse({ error: "Valid profile ID is required" }, 400);
    }
    if (!walletAddress || typeof walletAddress !== "string") {
      return jsonResponse({ error: "Wallet address is required" }, 400);
    }

    // 1. Verify Telegram auth hash
    const isValid = await verifyTelegramAuth(telegramAuthData);
    if (!isValid) {
      console.warn("Telegram auth verification failed for profile", profileId);
      return jsonResponse({ error: "Telegram authentication verification failed" }, 403);
    }

    const telegramId = telegramAuthData.id?.toString();
    const telegramUsername = telegramAuthData.username || telegramAuthData.first_name || telegramId;

    if (!telegramId) {
      return jsonResponse({ error: "No Telegram user ID in auth data" }, 400);
    }

    // 2. Verify profile ownership
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, wallet_address")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    if (profile.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
      return jsonResponse({ error: "Ownership verification failed" }, 403);
    }

    // 3. Check if already linked to this profile
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("telegram_id")
      .eq("id", profileId)
      .single();

    if (currentProfile?.telegram_id) {
      return jsonResponse({ error: "A Telegram account is already linked. Unlink it first." }, 409);
    }

    // 4. Check if this Telegram ID is linked to another profile
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, pay_tag")
      .eq("telegram_id", telegramId)
      .neq("id", profileId)
      .maybeSingle();

    if (existing) {
      return jsonResponse(
        { error: `This Telegram account is already linked to @${existing.pay_tag}` },
        409
      );
    }

    // 5. Link Telegram to profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ telegram_id: telegramId, telegram_username: telegramUsername })
      .eq("id", profileId);

    if (updateError) {
      console.error("Error linking Telegram:", updateError);
      return jsonResponse({ error: "Failed to link Telegram account" }, 500);
    }

    console.log(`Linked Telegram @${telegramUsername} (${telegramId}) to profile ${profileId} via OAuth`);

    return jsonResponse({
      success: true,
      telegram_id: telegramId,
      telegram_username: telegramUsername,
    });
  } catch (error) {
    console.error("Telegram OAuth error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
