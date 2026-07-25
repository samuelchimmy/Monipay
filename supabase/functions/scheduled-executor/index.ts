// Scheduled Job Executor
// Polls scheduled_jobs for due items and executes them via relay-payment
// Invoked by pg_cron every minute

import { corsHeaders } from "../_shared/security.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { createWalletClient, createPublicClient, http, parseAbi, type Hex, type Chain } from "npm:viem@2.44.4";
import { privateKeyToAccount } from "npm:viem@2.44.4/accounts";
import { base, bsc } from "npm:viem@2.44.4/chains";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BATCH_LIMIT = 10;

// ─── Column sets per table ───────────────────────────────────────────────────
// profiles        → has tempo_address, solana_address, telegram_id, x_username
// wallet_profiles → does NOT have tempo_address or solana_address
// Selecting non-existent columns causes Supabase to return null rows,
// so we use separate field lists for each table.
const PROFILE_FIELDS =
  "id, pay_tag, wallet_address, preferred_network, tempo_address, solana_address, status, discord_id, telegram_id, x_username, x_user_id, bot_allowance_amount";

const WALLET_PROFILE_FIELDS =
  "id, pay_tag, wallet_address, preferred_network, discord_id, telegram_id, x_username, x_user_id, bot_allowance_amount";

// ─── UUID guard ───────────────────────────────────────────────────────────────
// Prevents Telegram numeric user IDs (e.g. "123456789") from being passed
// to a UUID column lookup, which would return nothing and cause a false miss.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Chain helpers ────────────────────────────────────────────────────────────

function isMiniPay(profile: any) {
  return profile?._source === "wallet_profile";
}

function chooseEffectiveChain(sender: any, recipient: any, requested?: string | null) {
  const chain = (requested || "").toLowerCase();
  if (chain) return chain;
  if (isMiniPay(sender) || isMiniPay(recipient)) return "celo";
  return (sender?.preferred_network || "base").toLowerCase();
}

// ─── Retry classification ─────────────────────────────────────────────────────
// Only transient errors should be retried. Permanent failures (bad recipient,
// insufficient balance) should not consume retry attempts.
function shouldRetry(errorMessage: string) {
  return /429|timeout|timed out|fetch failed|network|rpc|temporar|502|503|504/i.test(errorMessage || "");
}

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(level: string, message: string, metadata?: Record<string, unknown>) {
  const prefix = `[${level.toUpperCase()}] [scheduled-executor]`;
  if (metadata) {
    console.log(`${prefix} ${message}`, JSON.stringify(metadata));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// ─── Profile resolution helpers ───────────────────────────────────────────────
// Two-step lookup: profiles (MoniPay) → wallet_profiles (MiniPay).
// wallet_profiles rows default to "celo" network.

function normalizeProfile(data: any, source: "profile" | "wallet_profile") {
  if (!data) return null;
  return {
    ...data,
    _source: source,
    preferred_network:
      source === "wallet_profile" && !data.preferred_network
        ? "celo"
        : data.preferred_network,
    // Safe defaults so downstream code never gets undefined on these fields
    status: data.status ?? "active",
    solana_address: data.solana_address ?? null,
    tempo_address: data.tempo_address ?? null,
  };
}

/** Look up by internal UUID — checks both tables. */
async function resolveProfileById(id: string) {
  const { data: p } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (p) return normalizeProfile(p, "profile");

  const { data: wp } = await supabase
    .from("wallet_profiles")
    .select(WALLET_PROFILE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return normalizeProfile(wp, "wallet_profile");
}

/** Look up by platform social ID. For X/Twitter try stable user_id before username. */
async function resolveProfileByPlatform(platform: string, platformUserId: string) {
  if (!platform || !platformUserId) return null;

  const columns =
    platform === "discord"  ? ["discord_id"]
    : platform === "telegram" ? ["telegram_id"]
    : ["x_user_id", "x_username"];

  for (const column of columns) {
    const { data: p } = await supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq(column, platformUserId)
      .maybeSingle();
    if (p) return normalizeProfile(p, "profile");

    const { data: wp } = await supabase
      .from("wallet_profiles")
      .select(WALLET_PROFILE_FIELDS)
      .eq(column, platformUserId)
      .maybeSingle();
    if (wp) return normalizeProfile(wp, "wallet_profile");
  }

  return null;
}

/** Look up by MoniTag / pay_tag. */
async function resolveProfileByMonitag(tag: string) {
  const clean = tag.replace("@", "").toLowerCase();

  const { data: p } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .ilike("pay_tag", clean)
    .maybeSingle();
  if (p) return normalizeProfile(p, "profile");

  const { data: wp } = await supabase
    .from("wallet_profiles")
    .select(WALLET_PROFILE_FIELDS)
    .ilike("pay_tag", clean)
    .maybeSingle();
  return normalizeProfile(wp, "wallet_profile");
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 30-second look-ahead window compensates for pg_cron 1-minute granularity.
    // Jobs scheduled at HH:MM:30 are picked up at HH:MM:00 and waited on inline.
    const lookAheadMs = 30_000;
    const windowEnd = new Date(Date.now() + lookAheadMs).toISOString();

    const { data: jobs, error: fetchErr } = await supabase
      .from("scheduled_jobs")
      .select("*")
      .eq("status", "pending")
      .neq("type", "conditional_sports_p2p")
      .lte("scheduled_at", windowEnd)
      .lt("attempts", 3)
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (fetchErr) {
      log("error", `Failed to fetch jobs: ${fetchErr.message}`);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Always drain feedback queue, even if no scheduled jobs ─────────────
    let earlyFeedbackCount = 0;
    if (!jobs || jobs.length === 0) {
      try {
        earlyFeedbackCount = await drainPeerFeedbackQueue(supabase);
      } catch (err: any) {
        log("error", `Error draining peer feedback queue (early): ${err.message}`);
      }
      return new Response(JSON.stringify({ processed: 0, processedFeedback: earlyFeedbackCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("info", `⏰ Processing ${jobs.length} scheduled job(s)`, {
      jobIds: jobs.map((j: any) => j.id),
    });

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const job of jobs) {
      // Wait inline if the job is in the look-ahead window but not yet due
      const scheduledAt = new Date(job.scheduled_at).getTime();
      const nowMs = Date.now();
      if (scheduledAt > nowMs) {
        const waitMs = scheduledAt - nowMs;
        log("info", `⏳ Job ${job.id} not yet due, waiting ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      await supabase
        .from("scheduled_jobs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq("id", job.id);

      try {
        const result = await executeJob(job);

        await supabase
          .from("scheduled_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            result: result ?? {},
            error_message: null,
          })
          .eq("id", job.id);

        // ── Recurring reschedule ──────────────────────────────────────────────
        // Only fires after a successful execution. Termination is checked inside
        // handleRescheduling — it will no-op if count is exhausted or endAt passed.
        if (job.payload?.isRecurring && job.payload?.recurrenceRule) {
          await handleRescheduling(job);
        }

        results.push({ id: job.id, status: "completed" });
        log("info", `✅ Job ${job.id} completed`, { result });
      } catch (err: any) {
        const newAttempts = job.attempts + 1;
        const retryable = shouldRetry(err.message);
        const finalStatus =
          retryable && newAttempts < job.max_attempts ? "pending" : "failed";

        await supabase
          .from("scheduled_jobs")
          .update({ status: finalStatus, error_message: err.message })
          .eq("id", job.id);

        results.push({ id: job.id, status: finalStatus, error: err.message });
        log(
          "error",
          `❌ Job ${job.id} failed (attempt ${newAttempts}/${job.max_attempts}, retryable=${retryable})`,
          { error: err.message, jobType: job.type, payload: job.payload }
        );
      }
    }

    let processedFeedbackCount = 0;
    try {
      processedFeedbackCount = await drainPeerFeedbackQueue(supabase);
    } catch (err: any) {
      log("error", `Error draining peer feedback queue: ${err.message}`);
    }

    return new Response(JSON.stringify({ processed: results.length, results, processedFeedback: processedFeedbackCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("error", `Executor crash: ${error.message}`, { stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Recurring reschedule ─────────────────────────────────────────────────────
// Called after each successful execution of a recurring job.
// Checks termination conditions before inserting the next occurrence.
async function handleRescheduling(job: any): Promise<void> {
  const payload = job.payload;
  const { recurrenceRule, recurrenceInterval = 1, remainingCount, endAt, recurringGroupId } = payload;

  // ── Decrement count ────────────────────────────────────────────────────────
  const newRemaining: number | null =
    remainingCount !== null && remainingCount !== undefined
      ? remainingCount - 1
      : null;

  // ── Termination: count exhausted ──────────────────────────────────────────
  if (newRemaining !== null && newRemaining <= 0) {
    log("info", `🔁 Recurring job ${job.id} series complete (count exhausted)`, {
      recurringGroupId,
    });
    return;
  }

  // ── Calculate next run time ───────────────────────────────────────────────
  const nextScheduledAt = calculateNextRun(recurrenceRule, recurrenceInterval);

  // ── Termination: past endAt ───────────────────────────────────────────────
  if (endAt && nextScheduledAt > new Date(endAt)) {
    log("info", `🔁 Recurring job ${job.id} series complete (past endAt)`, {
      recurringGroupId,
      endAt,
    });
    return;
  }

  // ── Insert next occurrence ────────────────────────────────────────────────
  const { error } = await supabase.from("scheduled_jobs").insert({
    type: job.type,
    status: "pending",
    scheduled_at: nextScheduledAt.toISOString(),
    payload: {
      ...payload,
      remainingCount: newRemaining,
    },
    source_author_id: job.source_author_id,
    max_attempts: job.max_attempts,   // carry over retry budget from parent
    attempts: 0,
  });

  if (error) {
    log("error", `🔴 Failed to reschedule recurring job ${job.id}`, {
      error: error.message,
      recurringGroupId,
    });
  } else {
    log("info", `🔁 Rescheduled recurring job — next run: ${nextScheduledAt.toISOString()}`, {
      parentJobId: job.id,
      recurringGroupId,
      remainingCount: newRemaining,
    });
  }
}

// Computes the next run Date from a recurrenceRule + interval.
function calculateNextRun(rule: string, interval: number): Date {
  const now = new Date();
  const ms = interval;

  switch (rule) {
    case "minute":  return new Date(now.getTime() + ms * 60_000);
    case "hour":    return new Date(now.getTime() + ms * 3_600_000);
    case "day":     return new Date(now.getTime() + ms * 86_400_000);
    case "week":    return new Date(now.getTime() + ms * 604_800_000);
    case "month": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() + ms);
      return d;
    }
    default: {
      // Named day-of-week: "monday", "friday", etc.
      const days: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      if (rule in days) {
        const target = days[rule];
        const d = new Date(now);
        let daysAhead = target - d.getUTCDay();
        if (daysAhead <= 0) daysAhead += 7;
        d.setUTCDate(d.getUTCDate() + daysAhead);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }
      // Unrecognized rule — default to 7 days (safe fallback, will surface in logs)
      log("warn", `⚠️ Unrecognized recurrenceRule "${rule}", defaulting to 7 days`);
      return new Date(now.getTime() + 7 * 86_400_000);
    }
  }
}

// ─── Job execution dispatcher ─────────────────────────────────────────────────
async function executeJob(job: any): Promise<any> {
  let { type, payload } = job;

  log("info", `🔧 Dispatching job ${job.id}`, { type, payloadKeys: Object.keys(payload) });

  // Normalize payload: Discord/Telegram wrap the command inside payload.command
  if (payload?.command && !payload.recipients) {
    const cmd = payload.command;
    payload.amount      = cmd.amount;
    payload.recipients  = cmd.recipients;
    // Defer default chain selection until after sender/recipient resolution.
    payload.chain       = cmd.chain || payload.chain || null;
    payload.maxParticipants = cmd.maxParticipants;
    payload.isMagicPay  = cmd.isMagicPay  || payload.isMagicPay  || false;
    payload.recipientId = cmd.recipientId || payload.recipientId || null;

    if (cmd.type === "p2p_multi") type = "p2p_multi";
    else if (cmd.type === "p2p")  type = "p2p";
    else if (cmd.type === "giveaway") type = "giveaway";
  }

  log("info", `📋 Resolved type: ${type}`, {
    amount:     payload.amount,
    recipients: payload.recipients,
    chain:      payload.chain,
    sender:     payload.senderPayTag,
  });

  switch (type) {
    case "p2p":
    case "p2p_command":
    case "scheduled_p2p":
      if (payload?.recipients?.length > 1) return executeMultiTransfer(job);
      return executePeerTransfer(job);
    case "p2p_multi":
      return executeMultiTransfer(job);
    case "giveaway":
    case "scheduled_giveaway":
      return {
        skipped: true,
        reason: "Giveaways require real-time interaction and cannot be scheduled",
      };
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

// ─── Sender resolution ────────────────────────────────────────────────────────
// Four-stage: UUID → platform social ID (via source_author_id) →
//             platform social ID (via payload.senderPlatformId) → pay_tag
async function resolveSender(job: any): Promise<any> {
  const payload = job.payload;
  const { senderId, senderPayTag, platform, senderPlatformId } = payload;
  let profile: any = null;

  // Stage 1: internal UUID (guard against non-UUID platform IDs)
  if (senderId && UUID_RE.test(senderId)) {
    profile = await resolveProfileById(senderId);
    if (profile) {
      log("info", `👤 Sender resolved by UUID: @${profile.pay_tag} (source=${profile._source})`, { jobId: job.id });
      return profile;
    }
    log("warn", `⚠️ UUID ${senderId} not found, trying platform ID`, { jobId: job.id });
  }

  // Stage 2: platform ID from job.source_author_id
  if (platform && job.source_author_id) {
    profile = await resolveProfileByPlatform(platform, job.source_author_id);
    if (profile) {
      log("info", `👤 Sender resolved by source_author_id: @${profile.pay_tag} (source=${profile._source})`, { jobId: job.id });
      return profile;
    }
    log("warn", `⚠️ Platform lookup (${platform}:${job.source_author_id}) failed, trying senderPlatformId`, { jobId: job.id });
  }

  // Stage 3: platform ID from payload.senderPlatformId (Telegram numeric IDs land here)
  if (platform && senderPlatformId) {
    profile = await resolveProfileByPlatform(platform, String(senderPlatformId));
    if (profile) {
      log("info", `👤 Sender resolved by senderPlatformId: @${profile.pay_tag} (source=${profile._source})`, { jobId: job.id });
      return profile;
    }
    log("warn", `⚠️ senderPlatformId lookup (${platform}:${senderPlatformId}) failed, trying pay_tag`, { jobId: job.id });
  }

  // Stage 4: pay_tag fallback
  if (senderPayTag) {
    profile = await resolveProfileByMonitag(senderPayTag);
    if (profile) {
      log("info", `👤 Sender resolved by pay_tag: @${profile.pay_tag} (source=${profile._source})`, { jobId: job.id });
      return profile;
    }
  }

  return null;
}

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

function twitterAuthHeader(method: string, baseUrl: string, queryParams: Record<string, string>): string | null {
  if (!TWITTER_CONSUMER_KEY || !TWITTER_CONSUMER_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    return null;
  }
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY,
    oauth_nonce: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  const all = { ...oauthParams, ...queryParams };
  const signature = generateOAuthSignature(method, baseUrl, all, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_SECRET);
  const signed = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(signed)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

async function lookupTwitterUserId(username: string): Promise<string | null> {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) return null;
  const baseUrl = `https://api.x.com/2/users/by/username/${encodeURIComponent(clean)}`;
  const auth = twitterAuthHeader("GET", baseUrl, {});
  if (!auth) {
    log("warn", `Skipping Twitter API lookup for ${clean} due to missing credentials`);
    return null;
  }
  const res = await fetch(baseUrl, { headers: { Authorization: auth } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log("warn", `Twitter lookup ${clean} failed ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  const json = await res.json().catch(() => null) as any;
  return json?.data?.id || null;
}

async function resolvePlatformRecipientId(
  platform: string | null,
  tag: string,
  payload: any,
  job: any
) {
  if (payload.recipientId) return String(payload.recipientId);
  const clean = String(tag || "").replace("@", "").trim();
  if (!clean) return null;
  if (platform === "discord" && /^\d{10,25}$/.test(clean)) return clean;
  if (platform === "telegram") {
    const { data } = await supabase
      .from("telegram_user_cache")
      .select("telegram_id")
      .ilike("username", clean)
      .maybeSingle();
    if (data?.telegram_id) return String(data.telegram_id);
  }
  if (platform === "twitter" || platform === "x") {
    // First try database lookup by x_username
    const { data: p } = await supabase
      .from("profiles")
      .select("x_user_id")
      .ilike("x_username", clean)
      .maybeSingle();
    if (p?.x_user_id) return String(p.x_user_id);

    const { data: wp } = await supabase
      .from("wallet_profiles")
      .select("x_user_id")
      .ilike("x_username", clean)
      .maybeSingle();
    if (wp?.x_user_id) return String(wp.x_user_id);

    // As a fallback, try lookup via Twitter API
    try {
      const apiUserId = await lookupTwitterUserId(clean);
      if (apiUserId) return apiUserId;
    } catch (err: any) {
      log("warn", `Twitter API lookup failed for ${clean}: ${err.message}`);
    }
  }
  return /^\d{5,30}$/.test(clean) ? clean : null;
}

async function resolveRecipient(job: any): Promise<any> {
  const payload = job.payload;
  const { receiverId, recipients, platform } = payload;
  const recipientTag = recipients?.[0];
  let profile: any = null;

  // Stage 1: Try resolving by internal UUID (receiverId)
  if (receiverId && UUID_RE.test(receiverId)) {
    profile = await resolveProfileById(receiverId);
    if (profile) {
      log("info", `👤 Recipient resolved by UUID: @${profile.pay_tag} (source=${profile._source})`, { jobId: job.id });
      return profile;
    }
  }

  // Stage 2: Try resolving by monitag
  if (recipientTag) {
    profile = await resolveProfileByMonitag(recipientTag);
    if (profile) {
      log("info", `👤 Recipient resolved by monitag: @${profile.pay_tag} (source=${profile._source})`, { jobId: job.id });
      return profile;
    }
  }

  // Stage 3: Try resolving by platform ID if we can resolve the platform user ID from the username/tag
  if (platform && recipientTag) {
    const platformUserId = await resolvePlatformRecipientId(platform, recipientTag, payload, job);
    if (platformUserId) {
      profile = await resolveProfileByPlatform(platform, platformUserId);
      if (profile) {
        log("info", `👤 Recipient resolved by platform ID preflight: @${profile.pay_tag} (source=${profile._source})`, { jobId: job.id });
        return profile;
      }
    }
  }

  return null;
}

// ─── P2P Transfer ─────────────────────────────────────────────────────────────
async function executePeerTransfer(job: any): Promise<any> {
  const { payload } = job;
  const { amount, recipients, chain, senderId, platform, senderPayTag } = payload;

  if (!recipients?.length || !amount) {
    throw new Error("Missing recipients or amount in payload");
  }

  const recipientTag = recipients[0];

  const senderProfile = await resolveSender(job);
  if (!senderProfile) {
    throw new Error(
      `Sender profile not found — tried UUID(${senderId}), platform(${platform}:${job.source_author_id}), senderPlatformId(${payload.senderPlatformId}), pay_tag(${senderPayTag})`
    );
  }

  let recipientProfile = await resolveRecipient(job);
  let platformUserId = null;

  if (platform && recipientTag) {
    platformUserId = await resolvePlatformRecipientId(platform, recipientTag, payload, job);
    if (platformUserId && !recipientProfile) {
      const p = await resolveProfileByPlatform(platform, platformUserId);
      if (p) {
        recipientProfile = p;
        log("info", `👤 Recipient resolved via platform ID preflight: @${recipientProfile.pay_tag} (source=${recipientProfile._source})`, { jobId: job.id });
      }
    }
  }

  const effectiveChain = chooseEffectiveChain(senderProfile, recipientProfile, chain);

  // ── MagicPay path: recipient not registered at all ──────────────────────────
  if (!recipientProfile) {
    if (!platformUserId && platform && recipientTag) {
      platformUserId = await resolvePlatformRecipientId(platform, recipientTag, payload, job);
    }
    if (!platformUserId) {
      throw new Error(
        `Recipient @${recipientTag} not found and no ${platform || "social"} ID available for MagicPay`
      );
    }

    const relayResponse = await supabase.functions.invoke("relay-payment", {
      body: {
        action: "bot-magicpay",
        senderProfileId: senderProfile.id,
        amount,
        chain: effectiveChain,
        platform: platform || "discord",
        platformUserId,
        recipientUsername: recipientTag,
        source: `scheduled_${platform || "unknown"}`,
      },
    });

    if (relayResponse.error) {
      throw new Error(`Relay error: ${relayResponse.error.message || JSON.stringify(relayResponse.error)}`);
    }
    const data = relayResponse.data;
    if (!data?.success) throw new Error(data?.error || "MagicPay relay returned failure");

    await supabase.from("monibot_transactions").insert({
      sender_id:          senderProfile.id,
      receiver_id:        null,
      amount,
      fee:                data.fee || 0,
      tx_hash:            data.txHash || "SCHEDULED_MAGICPAY",
      type:               "magicpay",
      payer_pay_tag:      senderProfile.pay_tag,
      recipient_pay_tag:  `${platform || "social"}:${platformUserId}`,
      chain:              effectiveChain,
      status:             "completed",
      replied:            true,
      sender_source:      senderProfile._source === "wallet_profile" ? "wallet_profiles" : "profiles",
      magicpay_claim_mode: senderProfile._source === "wallet_profile" ? "mandatory" : "optional",
    });

    return { txHash: data.txHash, recipient: recipientTag, amount, magicpay: true };
  }

  // ── Standard P2P ──────────────────────────────────────────────────────────
  log("info", `💸 P2P: @${senderProfile.pay_tag} → @${recipientProfile.pay_tag}, $${amount} on ${effectiveChain}`, {
    jobId: job.id,
    senderId: senderProfile.id,
    recipientId: recipientProfile.id,
  });

  const relayResponse = await supabase.functions.invoke("relay-payment", {
    body: {
      action: "bot-p2p",
      senderProfileId:    senderProfile.id,
      recipientProfileId: recipientProfile.id,
      amount,
      chain:              effectiveChain,
      source:             `scheduled_${platform || "unknown"}`,
    },
  });

  if (relayResponse.error) {
    const errMsg = relayResponse.error?.message || JSON.stringify(relayResponse.error);
    log("error", `🔴 Relay invoke error for job ${job.id}`, { error: errMsg });
    throw new Error(`Relay error: ${errMsg}`);
  }

  const data = relayResponse.data;
  if (!data?.success) {
    const reason = data?.error || "Relay payment returned failure (no error detail)";
    log("error", `🔴 Relay payment failed for job ${job.id}`, { relayResponse: data });
    throw new Error(reason);
  }

  await supabase.from("monibot_transactions").insert({
    sender_id:         senderProfile.id,
    receiver_id:       recipientProfile.id,
    amount,
    fee:               data.fee || 0,
    tx_hash:           data.txHash || "SCHEDULED_EXECUTED",
    type:              "p2p_command",
    payer_pay_tag:     senderProfile.pay_tag,
    recipient_pay_tag: recipientProfile.pay_tag,
    chain:             effectiveChain,
    status:            "completed",
    replied:           true,
  });

  log("info", `✅ P2P complete: @${senderProfile.pay_tag} → @${recipientProfile.pay_tag}, $${amount}, tx=${data.txHash}`, {
    jobId: job.id,
  });

  return { txHash: data.txHash, recipient: recipientTag, amount };
}

// ─── Multi-recipient Transfer ─────────────────────────────────────────────────
async function executeMultiTransfer(job: any): Promise<any> {
  const { payload } = job;
  const { amount, recipients, chain, platform, senderId, senderPayTag } = payload;

  if (!recipients?.length || !amount) {
    throw new Error("Missing recipients or amount in payload");
  }

  const senderProfile = await resolveSender(job);
  if (!senderProfile) {
    throw new Error(
      `Sender profile not found — tried UUID(${senderId}), platform(${platform}:${job.source_author_id}), senderPlatformId(${payload.senderPlatformId}), pay_tag(${senderPayTag})`
    );
  }

  const effectiveChain = chooseEffectiveChain(senderProfile, null, chain);

  log("info", `💸 Multi-transfer: @${senderProfile.pay_tag} → ${recipients.length} recipients, $${amount} each on ${effectiveChain}`, {
    jobId: job.id,
  });

  const results = [];

  for (const tag of recipients) {
    try {
      const recipient = await resolveProfileByMonitag(tag);
      if (!recipient) {
        results.push({ tag, status: "failed", reason: "not_found" });
        log("warn", `⚠️ Recipient @${tag} not found`, { jobId: job.id });
        continue;
      }

      const relayResponse = await supabase.functions.invoke("relay-payment", {
        body: {
          action:             "bot-p2p",
          senderProfileId:    senderProfile.id,
          recipientProfileId: recipient.id,
          amount,
          chain:              effectiveChain,
          source:             `scheduled_${platform || "unknown"}`,
        },
      });

      const data  = relayResponse.data;
      const error = relayResponse.error;

      if (error || !data?.success) {
        const reason = data?.error || error?.message || "Relay failed";
        results.push({ tag, status: "failed", reason });
        log("error", `🔴 Multi-transfer to @${tag} failed: ${reason}`, { jobId: job.id });
      } else {
        results.push({ tag, status: "success", txHash: data.txHash });

        await supabase.from("monibot_transactions").insert({
          sender_id:         senderProfile.id,
          receiver_id:       recipient.id,
          amount,
          fee:               data.fee || 0,
          tx_hash:           data.txHash || "SCHEDULED_MULTI",
          type:              "p2p_command",
          payer_pay_tag:     senderProfile.pay_tag,
          recipient_pay_tag: recipient.pay_tag,
          chain:             effectiveChain,
          status:            "completed",
          replied:           true,
        });

        log("info", `✅ Multi-transfer to @${recipient.pay_tag}: tx=${data.txHash}`, { jobId: job.id });
      }
    } catch (e: any) {
      results.push({ tag, status: "failed", reason: e.message });
      log("error", `🔴 Multi-transfer to @${tag} exception: ${e.message}`, { jobId: job.id });
    }
  }

  const successCount = results.filter((r: any) => r.status === "success").length;
  log("info", `📊 Multi-transfer done: ${successCount}/${recipients.length} succeeded`, {
    jobId: job.id,
    results,
  });

  return { results, total: recipients.length, success: successCount };
}

// ─── ERC-8004 feedback queue drainer ──────────────────────────────────────────

const REGISTRY_ABI = parseAbi([
  "function giveFeedback(uint256 agentId, uint8 score, string calldata uri) external"
]);

async function drainPeerFeedbackQueue(supabaseClient: any): Promise<number> {
  const relayerPrivateKey = Deno.env.get("MONIBOT_WALLET_PRIVATE_KEY") || Deno.env.get("RELAYER_PRIVATE_KEY");
  if (!relayerPrivateKey) {
    log("warn", "Neither MONIBOT_WALLET_PRIVATE_KEY nor RELAYER_PRIVATE_KEY set, skipping feedback queue drain");
    return 0;
  }

  // Fetch pending feedback items
  const { data: items, error: fetchErr } = await supabaseClient
    .from("agent_peer_feedback_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(5);

  if (fetchErr) {
    log("error", `Failed to fetch feedback queue: ${fetchErr.message}`);
    return 0;
  }

  if (!items || items.length === 0) {
    return 0;
  }

  log("info", `Drainer: Processing ${items.length} peer feedback item(s)`);

  const celoChain = {
    id: 42220,
    name: "Celo",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    rpcUrls: { default: { http: ["https://forno.celo.org"] } }
  } as const;

  for (const item of items) {
    // Mark as running to avoid duplicate processing
    await supabaseClient
      .from("agent_peer_feedback_queue")
      .update({
        status: "running",
        attempts: item.attempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id);

    try {
      const reg = item.peer_registry || "";
      const match = reg.match(/^eip155:(\d+):(0x[0-9a-fA-F]{40})$/);
      if (!match) {
        throw new Error(`Invalid registry format: ${reg}`);
      }

      const chainId = parseInt(match[1], 10);
      const contractAddress = match[2] as Hex;

      let chain: Chain;
      let rpcUrl: string;

      if (chainId === 8453) {
        chain = base;
        rpcUrl = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
      } else if (chainId === 42220) {
        chain = celoChain as any;
        rpcUrl = Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org";
      } else if (chainId === 56) {
        chain = bsc;
        rpcUrl = Deno.env.get("BSC_RPC_URL") || "https://bsc-dataseed.binance.org";
      } else {
        throw new Error(`Unsupported chain ID for feedback registry: ${chainId}`);
      }

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      const account = privateKeyToAccount(`0x${relayerPrivateKey.replace(/^0x/, "")}` as Hex);
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });

      const agentId = BigInt(item.peer_agent_id);
      const score = item.score || 5;
      const uri = item.receipt_uri || "";

      log("info", `Attesting peer feedback: agentId=${agentId}, score=${score}, uri="${uri}" on registry ${contractAddress} (chain ${chainId})`);

      let gasPrice = await publicClient.getGasPrice();
      const relayerAddr = walletClient.account.address;

      let lastErr: unknown;
      let sent: Hex | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const pendingNonce = await publicClient.getTransactionCount({
            address: relayerAddr,
            blockTag: "pending",
          });

          sent = await walletClient.writeContract({
            address: contractAddress,
            abi: REGISTRY_ABI,
            functionName: "giveFeedback",
            args: [agentId, score, uri],
            gasPrice,
            nonce: pendingNonce,
          });
          break;
        } catch (err: any) {
          const msg = err?.message || String(err);
          const isUnderpriced =
            msg.includes("underpriced") ||
            msg.includes("replacement transaction") ||
            msg.includes("nonce too low");
          if (!isUnderpriced || attempt === 2) {
            lastErr = err;
            throw err;
          }
          console.warn(`[tx-retry] Attempt ${attempt + 1} failed: ${msg.slice(0, 120)}`);
          gasPrice = (gasPrice * 125n) / 100n;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!sent) throw lastErr ?? new Error("Transaction submission failed");
      const txHash = sent;

      log("info", `Feedback transaction submitted: ${txHash}`);

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      log("info", `Feedback transaction confirmed in block ${receipt.blockNumber} with status ${receipt.status}`);

      await supabaseClient
        .from("agent_peer_feedback_queue")
        .update({
          status: "completed",
          processed_tx_hash: txHash,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id);

    } catch (err: any) {
      const finalStatus = item.attempts + 1 >= 3 ? "failed" : "pending";
      log("error", `Failed peer feedback transaction for item ${item.id}: ${err.message}`);

      await supabaseClient
        .from("agent_peer_feedback_queue")
        .update({
          status: finalStatus,
          last_error: err.message || String(err),
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id);
    }
  }

  return items.length;
}
