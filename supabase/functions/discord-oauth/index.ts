// Discord OAuth2 callback handler
// Exchanges authorization code for access token, fetches user info, links to MoniPay profile

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_CLIENT_ID = Deno.env.get("DISCORD_CLIENT_ID")!;
const DISCORD_CLIENT_SECRET = Deno.env.get("DISCORD_CLIENT_SECRET")!;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, redirectUri, profileId, walletAddress } = await req.json();

    if (!code || typeof code !== "string") {
      return jsonResponse({ error: "Authorization code is required" }, 400);
    }
    if (!profileId || !UUID_RE.test(profileId)) {
      return jsonResponse({ error: "Valid profile ID is required" }, 400);
    }
    if (!walletAddress || typeof walletAddress !== "string") {
      return jsonResponse({ error: "Wallet address is required" }, 400);
    }
    if (!redirectUri || typeof redirectUri !== "string") {
      return jsonResponse({ error: "Redirect URI is required" }, 400);
    }

    // 1. Verify profile ownership — supports both legacy `profiles`
    //    (PIN/encrypted-key users) and `wallet_profiles` (MiniPay /
    //    external-wallet sessions). Discord linking must work for both.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let table: "profiles" | "wallet_profiles" = "profiles";
    let { data: profile } = await supabase
      .from("profiles")
      .select("id, wallet_address, discord_id")
      .eq("id", profileId)
      .maybeSingle();

    if (!profile) {
      const { data: walletProfile } = await supabase
        .from("wallet_profiles")
        .select("id, wallet_address, discord_id")
        .eq("id", profileId)
        .maybeSingle();
      if (walletProfile) {
        profile = walletProfile;
        table = "wallet_profiles";
      }
    }

    if (!profile) {
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    if ((profile as any).wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
      return jsonResponse({ error: "Ownership verification failed" }, 403);
    }

    // 2. Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("Discord token exchange failed:", err);
      return jsonResponse({ error: "Failed to exchange Discord authorization code" }, 400);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 3. Fetch Discord user info
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      console.error("Discord user fetch failed:", await userResponse.text());
      return jsonResponse({ error: "Failed to fetch Discord user info" }, 500);
    }

    const discordUser = await userResponse.json();
    const discordId = discordUser.id;
    const discordUsername = discordUser.username;

    // 4. Check if this Discord account is already linked to another profile
    //    (across both tables).
    for (const t of ["profiles", "wallet_profiles"] as const) {
      const { data: existing } = await supabase
        .from(t)
        .select("id, pay_tag")
        .eq("discord_id", discordId)
        .neq("id", profileId)
        .maybeSingle();
      if (existing) {
        return jsonResponse(
          { error: `This Discord account is already linked to @${(existing as any).pay_tag}` },
          409,
        );
      }
    }

    // 5. Already linked on this profile?
    if ((profile as any).discord_id) {
      return jsonResponse(
        { error: "A Discord account is already linked. Unlink it first." },
        409,
      );
    }

    // 6. Link Discord to profile (correct table)
    const { error: updateError } = await supabase
      .from(table)
      .update({ discord_id: discordId, discord_username: discordUsername })
      .eq("id", profileId);

    if (updateError) {
      console.error("Error linking Discord:", updateError);
      return jsonResponse({ error: "Failed to link Discord account" }, 500);
    }

    console.log(`Linked Discord ${discordUsername} (${discordId}) to ${table}:${profileId} via OAuth`);

    // 7. Revoke the access token (we don't need ongoing access)
    try {
      await fetch("https://discord.com/api/v10/oauth2/token/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          token: accessToken,
        }),
      });
    } catch {
      // Non-critical, continue
    }

    return jsonResponse({
      success: true,
      discord_id: discordId,
      discord_username: discordUsername,
    });
  } catch (error) {
    console.error("Discord OAuth error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
