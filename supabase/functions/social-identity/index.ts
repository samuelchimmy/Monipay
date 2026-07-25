// MoniBot AI - Social Identity Management Edge Function
// Handles Farcaster, X, Discord, Telegram account linking + bot allowances
// All mutation actions require walletAddress ownership verification

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// X OAuth app credentials (set these in your Supabase edge function secrets)
const X_CLIENT_ID = Deno.env.get("X_CLIENT_ID")!;
const X_CLIENT_SECRET = Deno.env.get("X_CLIENT_SECRET")!;

// Telegram bot token — used to verify Telegram Login Widget HMAC signatures
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

interface RequestBody {
  action:
    | "get"
    | "generate-x-code"
    | "check-x-verification"
    | "unlink-x"
    | "link-x-oauth"
    | "link-farcaster"
    | "unlink-farcaster"
    | "update-allowance"
    | "link-discord"
    | "unlink-discord"
    | "link-telegram"
    | "unlink-telegram"
    | "link-bluesky"
    | "unlink-bluesky";
  profileId: string;
  walletAddress?: string;
  xUsername?: string;
  farcasterFid?: number;
  farcasterUsername?: string;
  amount?: number;
  discordId?: string;
  discordUsername?: string;
  telegramId?: string;
  telegramUsername?: string;
  // X OAuth PKCE fields
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  // Telegram Login Widget payload (signed query params)
  widgetPayload?: Record<string, string>;
  // Bluesky app password login
  blueskyHandle?: string;
  blueskyAppPassword?: string;
}

// ============ Helpers ============

function generateVerificationCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "VERIFY-";
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidDiscordId(id: string): boolean {
  return /^\d{17,20}$/.test(id);
}

function isValidTelegramId(id: string): boolean {
  return /^\d{5,15}$/.test(id);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProfileTable = "profiles" | "wallet_profiles";

/** Resolve which table a profileId belongs to. */
async function resolveTable(
  supabase: any,
  profileId: string,
): Promise<ProfileTable | null> {
  const { data: legacy } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (legacy) return "profiles";
  const { data: wallet } = await supabase
    .from("wallet_profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (wallet) return "wallet_profiles";
  return null;
}

/** Verify that the caller owns the profile by matching walletAddress */
async function verifyOwnership(
  supabase: any,
  profileId: string,
  walletAddress?: string,
  tableName: ProfileTable = "profiles",
): Promise<{ profile: any } | { error: Response }> {
  if (!walletAddress) {
    return { error: jsonResponse({ error: "walletAddress is required for this action" }, 400) };
  }

  const { data: profile, error } = await supabase
    .from(tableName)
    .select("id, wallet_address")
    .eq("id", profileId)
    .single();

  if (error || !profile) {
    return { error: jsonResponse({ error: "Profile not found" }, 404) };
  }

  const profileWallet = (profile as any).wallet_address as string;
  if (profileWallet.toLowerCase() !== walletAddress.toLowerCase()) {
    console.warn(
      `Ownership mismatch for profile ${profileId}: expected ${profileWallet}, got ${walletAddress}`,
    );
    return { error: jsonResponse({ error: "Ownership verification failed" }, 403) };
  }

  return { profile };
}

// ============ X OAuth PKCE Token Exchange ============

/**
 * Exchange an authorization code for X user info using PKCE.
 * Returns { x_user_id, x_username } on success.
 */
async function exchangeXOAuthCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ x_user_id: string; x_username: string }> {
  // Step 1: Exchange code for access token
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: X_CLIENT_ID,
  });

  const credentials = btoa(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`);

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("X token exchange failed:", err);
    throw new Error("Failed to exchange X authorization code");
  }

  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;

  if (!accessToken) {
    throw new Error("No access token returned from X");
  }

  // Step 2: Fetch user info with the access token
  const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=username", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userRes.ok) {
    const err = await userRes.text();
    console.error("X user fetch failed:", err);
    throw new Error("Failed to fetch X user info");
  }

  const userData = await userRes.json();
  const x_user_id: string = userData?.data?.id;
  const x_username: string = userData?.data?.username;

  if (!x_user_id || !x_username) {
    throw new Error("Invalid user data returned from X");
  }

  return { x_user_id, x_username };
}

// ============ Main Handler ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { action, profileId, walletAddress } = body;

    if (!profileId || !UUID_RE.test(profileId)) {
      return jsonResponse({ error: "Valid profile ID is required" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const tableName = await resolveTable(supabase, profileId);
    if (!tableName) {
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    // ============ READ-ONLY: No ownership check needed ============

    // GET: Fetch social identity data
    if (action === "get") {
      const { data, error } = await supabase
        .from(tableName)
        .select(
          "farcaster_fid, farcaster_username, x_username, x_user_id, x_verified, x_verification_code, bot_allowance_amount, discord_id, discord_username, telegram_id, telegram_username, bluesky_id, bluesky_username",
        )
        .eq("id", profileId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return jsonResponse({ error: "Failed to fetch profile" }, 500);
      }

      return jsonResponse(data);
    }

    // CHECK-X-VERIFICATION (kept for backwards compat — no longer used by new flow)
    if (action === "check-x-verification") {
      const { data, error } = await supabase
        .from(tableName)
        .select("x_username, x_verified, x_verification_code, x_verification_expires_at")
        .eq("id", profileId)
        .single();

      if (error || !data) {
        return jsonResponse({ error: "Profile not found" }, 404);
      }

      if (data.x_verified) {
        return jsonResponse({ verified: true, username: data.x_username });
      }

      if (data.x_verification_expires_at) {
        const expiresAt = new Date(data.x_verification_expires_at);
        if (expiresAt < new Date()) {
          await supabase
            .from(tableName)
            .update({ x_verification_code: null, x_verification_expires_at: null })
            .eq("id", profileId);
          return jsonResponse({ error: "Verification code has expired. Please generate a new one." }, 400);
        }
      }

      return jsonResponse({ verified: false, pending: true });
    }

    // ============ MUTATIONS: Require ownership verification ============

    const ownershipResult = await verifyOwnership(supabase, profileId, walletAddress, tableName);
    if ("error" in ownershipResult) {
      return ownershipResult.error;
    }

    // ── LINK-X-OAUTH (new PKCE OAuth flow) ──────────────────────────
    if (action === "link-x-oauth") {
      const { code, codeVerifier, redirectUri } = body;

      if (!code || !codeVerifier || !redirectUri) {
        return jsonResponse({ error: "code, codeVerifier, and redirectUri are required" }, 400);
      }

      let x_user_id: string;
      let x_username: string;

      try {
        ({ x_user_id, x_username } = await exchangeXOAuthCode(code, codeVerifier, redirectUri));
      } catch (err: any) {
        console.error("X OAuth exchange error:", err);
        return jsonResponse({ error: err.message || "Failed to authenticate with X" }, 502);
      }

      // Check if this X account is already linked to a different profile
      const { data: existingProfile } = await supabase
        .from(tableName)
        .select("id, pay_tag")
        .eq("x_user_id", x_user_id)
        .neq("id", profileId)
        .maybeSingle();

      if (existingProfile) {
        return jsonResponse({ error: `This X account is already linked to @${existingProfile.pay_tag}` }, 409);
      }

      // Cross-table dedup: same X account must not exist in the OTHER profile table.
      const otherXTable = tableName === "profiles" ? "wallet_profiles" : "profiles";
      const { data: crossX } = await supabase
        .from(otherXTable)
        .select("id, pay_tag")
        .eq("x_user_id", x_user_id)
        .maybeSingle();
      if (crossX) {
        return jsonResponse({ error: `This X account is already linked to @${crossX.pay_tag} on another MoniPay context. Unlink it there first.` }, 409);
      }

      // Persist — mark as verified immediately (OAuth proof is sufficient)
      const { error: updateErr } = await supabase
        .from(tableName)
        .update({
          x_user_id,
          x_username,
          x_verified: true,
          // Clear any old tweet-verification state
          x_verification_code: null,
          x_verification_expires_at: null,
        })
        .eq("id", profileId);

      if (updateErr) {
        console.error("Error saving X OAuth data:", updateErr);
        return jsonResponse({ error: "Failed to link X account" }, 500);
      }

      console.log(`Linked X @${x_username} (ID: ${x_user_id}) to profile ${profileId} via OAuth`);
      return jsonResponse({ success: true, x_username, x_user_id });
    }

    // GENERATE-X-CODE (legacy tweet-verification — kept for backwards compat)
    if (action === "generate-x-code") {
      const { xUsername } = body;
      if (!xUsername || xUsername.length < 1 || xUsername.length > 30) {
        return jsonResponse({ error: "Valid X username is required (1-30 characters)" }, 400);
      }

      const cleanUsername = xUsername.replace(/^@/, "").trim();
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        return jsonResponse({ error: "X username can only contain letters, numbers, and underscores" }, 400);
      }

      const { data: existingProfile } = await supabase
        .from(tableName)
        .select("id")
        .ilike("x_username", cleanUsername)
        .eq("x_verified", true)
        .neq("id", profileId)
        .single();

      if (existingProfile) {
        return jsonResponse({ error: "This X account is already linked to another MoniTag" }, 409);
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from(tableName)
        .update({
          x_username: cleanUsername,
          x_verification_code: code,
          x_verification_expires_at: expiresAt.toISOString(),
          x_verified: false,
        })
        .eq("id", profileId);

      if (error) {
        console.error("Error updating profile:", error);
        return jsonResponse({ error: "Failed to generate verification code" }, 500);
      }

      console.log(`Generated X verification code for profile ${profileId}`);
      return jsonResponse({ code, expiresAt: expiresAt.toISOString() });
    }

    // UNLINK-X
    if (action === "unlink-x") {
      const { error } = await supabase
        .from(tableName)
        .update({
          x_username: null,
          x_user_id: null,
          x_verified: false,
          x_verification_code: null,
          x_verification_expires_at: null,
        })
        .eq("id", profileId);

      if (error) {
        console.error("Error unlinking X:", error);
        return jsonResponse({ error: "Failed to unlink X account" }, 500);
      }

      console.log(`Unlinked X account for profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    // LINK-FARCASTER
    if (action === "link-farcaster") {
      const { farcasterFid, farcasterUsername } = body;
      if (!farcasterFid || !farcasterUsername) {
        return jsonResponse({ error: "Farcaster FID and username are required" }, 400);
      }

      const { data: existingProfile } = await supabase
        .from(tableName)
        .select("id")
        .eq("farcaster_fid", farcasterFid)
        .neq("id", profileId)
        .single();

      if (existingProfile) {
        return jsonResponse({ error: "This Farcaster account is already linked to another MoniTag" }, 409);
      }

      const { error } = await supabase
        .from(tableName)
        .update({
          farcaster_fid: farcasterFid,
          farcaster_username: farcasterUsername,
        })
        .eq("id", profileId);

      if (error) {
        console.error("Error linking Farcaster:", error);
        return jsonResponse({ error: "Failed to link Farcaster account" }, 500);
      }

      console.log(`Linked Farcaster @${farcasterUsername} (FID: ${farcasterFid}) to profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    // UNLINK-FARCASTER
    if (action === "unlink-farcaster") {
      const { error } = await supabase
        .from(tableName)
        .update({
          farcaster_fid: null,
          farcaster_username: null,
        })
        .eq("id", profileId);

      if (error) {
        console.error("Error unlinking Farcaster:", error);
        return jsonResponse({ error: "Failed to unlink Farcaster account" }, 500);
      }

      console.log(`Unlinked Farcaster for profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    // UPDATE-ALLOWANCE
    if (action === "update-allowance") {
      const { amount } = body;
      if (amount === undefined || amount < 0 || amount > 1000000) {
        return jsonResponse({ error: "Valid amount is required (0 - 1,000,000)" }, 400);
      }

      const { error } = await supabase.from(tableName).update({ bot_allowance_amount: amount }).eq("id", profileId);

      if (error) {
        console.error("Error updating allowance:", error);
        return jsonResponse({ error: "Failed to update allowance" }, 500);
      }

      console.log(`Updated bot allowance to ${amount} for profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    // LINK-DISCORD
    if (action === "link-discord") {
      const { discordId, discordUsername } = body;
      if (!discordId) {
        return jsonResponse({ error: "Discord ID is required" }, 400);
      }
      if (!isValidDiscordId(discordId)) {
        return jsonResponse(
          {
            error:
              "Invalid Discord ID format. Must be a 17-20 digit number. Right-click your username in Discord → Copy User ID.",
          },
          400,
        );
      }

      // Check if already linked to this profile
      const { data: currentProfile } = await supabase
        .from(tableName)
        .select("discord_id")
        .eq("id", profileId)
        .single();

      if (currentProfile?.discord_id) {
        return jsonResponse({ error: "A Discord account is already linked. Unlink it first." }, 409);
      }

      // Check if this Discord ID is linked to another profile
      const { data: existing } = await supabase
        .from(tableName)
        .select("id, pay_tag")
        .eq("discord_id", discordId)
        .neq("id", profileId)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ error: `This Discord account is already linked to @${existing.pay_tag}` }, 409);
      }

      // Cross-table dedup: same Discord account must not exist in the OTHER profile table.
      const otherDiscordTable = tableName === "profiles" ? "wallet_profiles" : "profiles";
      const { data: crossDiscord } = await supabase
        .from(otherDiscordTable)
        .select("id, pay_tag")
        .eq("discord_id", discordId)
        .maybeSingle();
      if (crossDiscord) {
        return jsonResponse({ error: `This Discord account is already linked to @${crossDiscord.pay_tag} on another MoniPay context. Unlink it there first.` }, 409);
      }

      const { error } = await supabase
        .from(tableName)
        .update({
          discord_id: discordId,
          discord_username: discordUsername || null,
        })
        .eq("id", profileId);

      if (error) {
        console.error("Error linking Discord:", error);
        return jsonResponse({ error: "Failed to link Discord" }, 500);
      }

      console.log(`Linked Discord ${discordId} to profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    // UNLINK-DISCORD
    if (action === "unlink-discord") {
      const { error } = await supabase
        .from(tableName)
        .update({ discord_id: null, discord_username: null })
        .eq("id", profileId);
      if (error) return jsonResponse({ error: "Failed to unlink Discord" }, 500);

      console.log(`Unlinked Discord for profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    // LINK-TELEGRAM (Telegram Login Widget — verifies HMAC signature)
    // Accepts either:
    //   { widgetPayload: { id, hash, auth_date, username?, first_name?, ... } }  ← preferred
    //   { telegramId, telegramUsername }                                          ← legacy fallback
    if (action === "link-telegram") {
      const { widgetPayload } = body;
      let telegramId: string | undefined = body.telegramId;
      let telegramUsername: string | null | undefined = body.telegramUsername;

      if (widgetPayload && typeof widgetPayload === "object") {
        // Verify the HMAC-SHA256 signature per Telegram Login Widget spec:
        // 1. data_check_string = sorted "key=value" lines joined by \n (excluding `hash`)
        // 2. secret_key = SHA256(bot_token)
        // 3. expected = HMAC-SHA256(secret_key, data_check_string) hex
        const { hash: providedHash, ...rest } = widgetPayload;
        if (!providedHash) {
          return jsonResponse({ error: "Missing Telegram widget hash" }, 400);
        }

        const dataCheckString = Object.keys(rest)
          .sort()
          .map((k) => `${k}=${rest[k]}`)
          .join("\n");

        const enc = new TextEncoder();
        const secretKey = await crypto.subtle.digest("SHA-256", enc.encode(TELEGRAM_BOT_TOKEN));
        const hmacKey = await crypto.subtle.importKey(
          "raw",
          secretKey,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const sig = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(dataCheckString));
        const expectedHash = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (expectedHash !== providedHash) {
          console.warn("Telegram widget HMAC mismatch", { profileId });
          return jsonResponse({ error: "Invalid Telegram authorization signature" }, 401);
        }

        // Reject auth payloads older than 1 day (Telegram recommendation)
        const authDate = parseInt(rest.auth_date || "0", 10);
        if (!authDate || Date.now() / 1000 - authDate > 86400) {
          return jsonResponse({ error: "Telegram authorization expired. Please try again." }, 401);
        }

        telegramId = String(rest.id);
        telegramUsername = rest.username || rest.first_name || null;
      }

      if (!telegramId) {
        return jsonResponse({ error: "Telegram ID is required" }, 400);
      }
      if (!isValidTelegramId(telegramId)) {
        return jsonResponse(
          {
            error:
              "Invalid Telegram ID format. Must be a 5-15 digit number. Message @userinfobot on Telegram to get your ID.",
          },
          400,
        );
      }

      // Check if already linked to this profile. Treat repeat callbacks as
      // success because Telegram can fire the widget callback more than once,
      // especially from mobile/in-app browser popups.
      const { data: currentProfile } = await supabase
        .from(tableName)
        .select("id, wallet_address, telegram_id, telegram_username")
        .eq("id", profileId)
        .single();

      if (currentProfile?.telegram_id) {
        if (String(currentProfile.telegram_id) === telegramId) {
          return jsonResponse({
            success: true,
            telegram_id: telegramId,
            telegram_username: currentProfile.telegram_username || telegramUsername || null,
            alreadyLinked: true,
          });
        }
        return jsonResponse({ error: "A different Telegram account is already linked. Unlink it first." }, 409);
      }

      // Check if this Telegram ID is linked to another profile
      const { data: existing } = await supabase
        .from(tableName)
        .select("id, pay_tag, wallet_address")
        .eq("telegram_id", telegramId)
        .neq("id", profileId)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ error: `This Telegram account is already linked to @${existing.pay_tag}` }, 409);
      }

      // Cross-table dedup: block a Telegram account linked to a different
      // wallet, but allow the same wallet to carry the identity in both
      // `profiles` and `wallet_profiles`. MiniPay/WalletConnect sessions can
      // legitimately resolve through either table depending on the entry path.
      const otherTgTable = tableName === "profiles" ? "wallet_profiles" : "profiles";
      const { data: crossTg } = await supabase
        .from(otherTgTable)
        .select("id, pay_tag, wallet_address, telegram_username")
        .eq("telegram_id", telegramId)
        .maybeSingle();
      if (crossTg) {
        const crossWallet = String(crossTg.wallet_address || "").toLowerCase();
        const currentWallet = String(currentProfile?.wallet_address || walletAddress || "").toLowerCase();
        if (crossWallet !== currentWallet) {
          return jsonResponse({ error: `This Telegram account is already linked to @${crossTg.pay_tag} on another MoniPay context. Unlink it there first.` }, 409);
        }
        telegramUsername = telegramUsername || crossTg.telegram_username || null;
      }

      const { error } = await supabase
        .from(tableName)
        .update({
          telegram_id: telegramId,
          telegram_username: telegramUsername || null,
        })
        .eq("id", profileId);

      if (error) {
        console.error("Error linking Telegram:", error);
        return jsonResponse({ error: "Failed to link Telegram" }, 500);
      }

      console.log(`Linked Telegram ${telegramId} to profile ${profileId}`);
      return jsonResponse({ success: true, telegram_id: telegramId, telegram_username: telegramUsername || null });
    }

    // UNLINK-TELEGRAM
    if (action === "unlink-telegram") {
      const { error } = await supabase
        .from(tableName)
        .update({ telegram_id: null, telegram_username: null })
        .eq("id", profileId);
      if (error) return jsonResponse({ error: "Failed to unlink Telegram" }, 500);

      console.log(`Unlinked Telegram for profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    // LINK-BLUESKY (handle + app password → AT Protocol createSession)
    if (action === "link-bluesky") {
      const { blueskyHandle, blueskyAppPassword } = body;
      if (!blueskyHandle || !blueskyAppPassword) {
        return jsonResponse(
          { error: "Bluesky handle and app password are required" },
          400,
        );
      }

      // Normalize handle: strip @, lowercase, default to .bsky.social if no dot
      let handle = blueskyHandle.trim().replace(/^@/, "").toLowerCase();
      if (!handle.includes(".")) handle = `${handle}.bsky.social`;

      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(handle)) {
        return jsonResponse({ error: "Invalid Bluesky handle format" }, 400);
      }

      // App password format is typically xxxx-xxxx-xxxx-xxxx (allow flexibility)
      if (blueskyAppPassword.length < 8 || blueskyAppPassword.length > 64) {
        return jsonResponse(
          {
            error:
              "Invalid app password. Generate one at https://bsky.app/settings/app-passwords",
          },
          400,
        );
      }

      // Verify credentials with the public AppView
      let did: string;
      let resolvedHandle: string;
      try {
        const sessionRes = await fetch(
          "https://bsky.social/xrpc/com.atproto.server.createSession",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifier: handle,
              password: blueskyAppPassword,
            }),
          },
        );

        if (!sessionRes.ok) {
          const errBody = await sessionRes.json().catch(() => ({}));
          const msg = String(errBody?.message || "").toLowerCase();
          if (msg.includes("invalid") || sessionRes.status === 401) {
            return jsonResponse(
              {
                error:
                  "Invalid handle or app password. Make sure you're using an app password, not your main account password.",
              },
              401,
            );
          }
          return jsonResponse(
            { error: errBody?.message || "Bluesky authentication failed" },
            502,
          );
        }

        const sessionData = await sessionRes.json();
        did = sessionData?.did;
        resolvedHandle = sessionData?.handle || handle;

        if (!did || !did.startsWith("did:")) {
          return jsonResponse(
            { error: "Bluesky returned an invalid identity" },
            502,
          );
        }
      } catch (err) {
        console.error("Bluesky createSession error:", err);
        return jsonResponse(
          { error: "Failed to reach Bluesky. Please try again." },
          502,
        );
      }

      // Check if already linked to a different profile
      const { data: existing } = await supabase
        .from(tableName)
        .select("id, pay_tag")
        .eq("bluesky_id", did)
        .neq("id", profileId)
        .maybeSingle();

      if (existing) {
        return jsonResponse(
          { error: `This Bluesky account is already linked to @${existing.pay_tag}` },
          409,
        );
      }

      const { error: updateErr } = await supabase
        .from(tableName)
        .update({
          bluesky_id: did,
          bluesky_username: resolvedHandle,
        })
        .eq("id", profileId);

      if (updateErr) {
        console.error("Error linking Bluesky:", updateErr);
        return jsonResponse({ error: "Failed to save Bluesky link" }, 500);
      }

      console.log(`Linked Bluesky @${resolvedHandle} (${did}) to profile ${profileId}`);

      // Auto-claim check: scan for pending IOUs sent to this Bluesky DID
      let pendingIOUs: unknown[] = [];
      try {
        const claimRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/claim-iou`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              action: "auto-link-check",
              profileId,
              platform: "bluesky",
              platformUserId: did,
            }),
          },
        );
        if (claimRes.ok) {
          const claimData = await claimRes.json();
          pendingIOUs = claimData.ious || [];
        }
      } catch (e) {
        console.error("Bluesky auto-link IOU check failed:", e);
      }

      return jsonResponse({
        success: true,
        bluesky_id: did,
        bluesky_username: resolvedHandle,
        pendingIOUs,
      });
    }

    // UNLINK-BLUESKY
    if (action === "unlink-bluesky") {
      const { error } = await supabase
        .from(tableName)
        .update({ bluesky_id: null, bluesky_username: null })
        .eq("id", profileId);
      if (error) return jsonResponse({ error: "Failed to unlink Bluesky" }, 500);

      console.log(`Unlinked Bluesky for profile ${profileId}`);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Social identity error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
