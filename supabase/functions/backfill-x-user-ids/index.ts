// One-off (idempotent) backfill: populate profiles.x_user_id for verified X
// profiles that only have x_username. Calls the X API users/by/username/:name
// endpoint via OAuth 1.0a using the existing TWITTER_* secrets.
//
// Invoke with: { dryRun?: boolean, limit?: number }
//
// Safe to call repeatedly — only touches rows where x_verified=true AND
// x_user_id IS NULL.

import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_API_SECRET")?.trim();
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const TWITTER_ACCESS_SECRET = Deno.env.get("TWITTER_ACCESS_SECRET")?.trim();

function generateOAuthSignature(
  method: string,
  baseUrl: string,
  allParams: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const sigBase = `${method}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(
    Object.entries(allParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&"),
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmac = createHmac("sha1", signingKey);
  hmac.update(sigBase);
  return hmac.digest("base64");
}

function authHeader(method: string, baseUrl: string, queryParams: Record<string, string>): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };
  const all = { ...oauthParams, ...queryParams };
  const signature = generateOAuthSignature(method, baseUrl, all, TWITTER_CONSUMER_SECRET!, TWITTER_ACCESS_SECRET!);
  const signed = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(signed)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

async function lookupXUserId(username: string): Promise<string | null> {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) return null;
  const baseUrl = `https://api.x.com/2/users/by/username/${encodeURIComponent(clean)}`;
  const auth = authHeader("GET", baseUrl, {});
  const res = await fetch(baseUrl, { headers: { Authorization: auth } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[backfill] lookup ${clean} failed ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  const json = await res.json().catch(() => null) as any;
  return json?.data?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TWITTER_CONSUMER_KEY || !TWITTER_CONSUMER_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
      return new Response(JSON.stringify({ error: "Missing TWITTER_* secrets" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;
    const limit = Math.min(Number(body?.limit) || 200, 500);

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, x_username")
      .eq("x_verified", true)
      .is("x_user_id", null)
      .not("x_username", "is", null)
      .limit(limit);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; x_username: string; x_user_id: string | null; updated: boolean }> = [];

    for (const p of profiles || []) {
      const username = (p as any).x_username as string;
      let xUserId: string | null = null;
      try {
        xUserId = await lookupXUserId(username);
      } catch (err) {
        console.error(`[backfill] error for ${username}`, err);
      }

      let updated = false;
      if (xUserId && !dryRun) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ x_user_id: xUserId })
          .eq("id", (p as any).id);
        if (upErr) {
          console.warn(`[backfill] update failed for ${username}:`, upErr.message);
        } else {
          updated = true;
        }
      }

      results.push({ id: (p as any).id, x_username: username, x_user_id: xUserId, updated });

      // Be polite to the X API (Basic tier rate limits)
      await new Promise((r) => setTimeout(r, 1100));
    }

    const summary = {
      scanned: results.length,
      resolved: results.filter(r => !!r.x_user_id).length,
      updated: results.filter(r => r.updated).length,
      dryRun,
      results,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("backfill-x-user-ids error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
