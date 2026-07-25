// wallet-session: lightweight session/profile management for wallet-only users
// (Path B = MiniPay native, Path C = external EVM wallet).
//
// Actions:
//   - upsert: ensure a row exists for this wallet_address. If a legacy
//     `profiles` row already exists for the same address, return it instead
//     (preserves full MoniPay features for legacy users connecting via wallet).
//   - get: fetch current wallet_profile + linked-social state.
//   - updateSettings: patch preferred_name / preferred_network / pay_tag /
//     bot_allowance_amount.
//
// No keys, no PIN. Identity is the wallet address.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PAYTAG_RE = /^[a-z0-9_]{3,20}$/;

// Mirrors the reserved-tag list in check-paytag (kept narrow on purpose:
// wallet-only sessions still get blocked on the same brand/platform tags).
const RESERVED_TAGS = new Set<string>([
  "admin", "monipay", "monibot", "monitag", "support", "help", "official",
  "team", "founder", "security", "wallet", "system", "root", "superuser",
  "mod", "moderator", "staff", "operator", "dev", "developer", "api",
  "webhook", "null", "undefined", "test", "demo", "guest", "bot", "agent",
  "verify", "verified", "trust", "safe", "alert", "notice", "info",
  "contact", "hello", "hi", "hey", "yo",
  "base", "bsc", "solana", "celo", "ink", "tempo", "ethereum", "bitcoin",
  "usdc", "usdt", "eth", "btc", "sol",
  "monipayxyz", "monipayapp", "monipayofficial", "monipaysupport",
  "monipayteam", "monitagofficial", "monitagsupport",
]);

function normalizePayTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const tag = raw.trim().toLowerCase().replace(/^@/, "");
  if (!PAYTAG_RE.test(tag)) return null;
  return tag;
}

async function isPayTagAvailable(
  supabase: ReturnType<typeof createClient>,
  tag: string,
  selfWalletAddress: string | null,
): Promise<{ available: boolean; reserved?: boolean; reason?: string }> {
  if (RESERVED_TAGS.has(tag)) return { available: false, reserved: true };

  // profiles (legacy)
  const { data: legacy } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("pay_tag", tag)
    .maybeSingle();
  if (legacy && legacy.status !== "deactivated") {
    return { available: false, reason: "taken" };
  }

  // wallet_profiles (Path B/C) — allow if the only match is the caller's own row
  const { data: walletMatch } = await supabase
    .from("wallet_profiles")
    .select("wallet_address")
    .eq("pay_tag", tag)
    .maybeSingle();
  if (walletMatch && walletMatch.wallet_address !== selfWalletAddress) {
    return { available: false, reason: "taken" };
  }

  return { available: true };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const action = String(payload.action ?? "");
  const walletAddressRaw = String(payload.walletAddress ?? "").trim();

  if (!EVM_ADDRESS_RE.test(walletAddressRaw)) {
    return jsonResponse({ error: "Invalid walletAddress" }, 400);
  }
  const walletAddress = walletAddressRaw.toLowerCase();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (action === "checkPayTag") {
      const tag = normalizePayTag(payload.payTag);
      if (!tag) {
        return jsonResponse({
          available: false,
          error: "Invalid format. Use 3–20 lowercase letters, numbers, or underscores.",
        }, 200);
      }
      const result = await isPayTagAvailable(supabase, tag, walletAddress);
      return jsonResponse({ ...result, payTag: tag });
    }

    if (action === "upsert") {
      const source = (payload.source as string | undefined)?.slice(0, 32) ?? "unknown";

      // 1) Legacy profile takes precedence — same address means same human.
      const { data: legacy } = await supabase
        .from("profiles")
        .select("id, pay_tag, wallet_address, preferred_network")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (legacy) {
        return jsonResponse({
          profileId: legacy.id,
          payTag: legacy.pay_tag,
          walletAddress,
          isLegacy: true,
          isNew: false,
          preferredNetwork: legacy.preferred_network ?? "base",
        });
      }

      // 2) Upsert wallet_profiles row.
      const { data: existing } = await supabase
        .from("wallet_profiles")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (existing) {
        return jsonResponse({
          profileId: existing.id,
          payTag: existing.pay_tag,
          walletAddress,
          isLegacy: false,
          isNew: false,
          preferredName: existing.preferred_name,
          preferredNetwork: existing.preferred_network,
          source: existing.source,
        });
      }

      const { data: inserted, error } = await supabase
        .from("wallet_profiles")
        .insert({ wallet_address: walletAddress, source })
        .select("*")
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({
        profileId: inserted.id,
        payTag: inserted.pay_tag,
        walletAddress,
        isLegacy: false,
        isNew: true,
        preferredName: inserted.preferred_name,
        preferredNetwork: inserted.preferred_network,
        source: inserted.source,
      });
    }

    if (action === "get") {
      // Check legacy profiles first (same address = same human)
      const { data: legacy } = await supabase
        .from("profiles")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (legacy) {
        // Return legacy profile data with all social identities
        return jsonResponse({ profile: legacy, isLegacy: true });
      }

      // Fall back to wallet_profiles
      const { data, error } = await supabase
        .from("wallet_profiles")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ profile: null });
      return jsonResponse({ profile: data, isLegacy: false });
    }

    if (action === "updateSettings") {
      const updates: Record<string, unknown> = {};
      const allowed = [
        "preferred_name",
        "preferred_network",
        "pay_tag",
        "bot_allowance_amount",
      ] as const;
      for (const key of allowed) {
        if (key in payload && payload[key] !== undefined) {
          updates[key] = payload[key];
        }
      }
      if (Object.keys(updates).length === 0) {
        return jsonResponse({ error: "No valid fields to update" }, 400);
      }

      // pay_tag: normalize + reserved + cross-table uniqueness check.
      if (typeof updates.pay_tag === "string") {
        const tag = normalizePayTag(updates.pay_tag);
        if (!tag) {
          return jsonResponse({ error: "Invalid pay_tag format" }, 400);
        }
        const avail = await isPayTagAvailable(supabase, tag, walletAddress);
        if (!avail.available) {
          return jsonResponse(
            { error: avail.reserved ? "This moniTag™ is reserved" : "This moniTag™ is already taken" },
            409,
          );
        }
        updates.pay_tag = tag;
      }

      const { data, error } = await supabase
        .from("wallet_profiles")
        .update(updates)
        .eq("wallet_address", walletAddress)
        .select("*")
        .single();

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ profile: data });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
});