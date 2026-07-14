// Scheduled Job Executor
// Polls scheduled_jobs for due items and executes them via relay-payment
// Invoked by pg_cron every minute

import { corsHeaders } from "../_shared/security.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
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

    return new Response(JSON.stringify({ processed: results.length, results }), {
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
    else {
      type = cmd.type;
    }
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
      log("info", `Executing general command: ${type}`, { jobId: job.id });
      return { success: true, command: type };
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
  return /^\d{5,30}$/.test(clean) ? clean : null;
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

  const recipientProfile = await resolveProfileByMonitag(recipientTag);
  const effectiveChain = chooseEffectiveChain(senderProfile, recipientProfile, chain);

  // ── MagicPay path: recipient not registered or explicitly flagged ──────────
  if (!recipientProfile || payload.isMagicPay) {
    const platformUserId = await resolvePlatformRecipientId(platform, recipientTag, payload, job);
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
