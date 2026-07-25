# Recurring Payments — Bot Implementation Prompt

> Verified against the live MoniPay backend on 2026-06-10.
> The `scheduled_jobs` table and the `scheduled-executor` edge function
> already support this design **without any schema or executor changes**,
> provided the bots follow the rules in the "Compatibility Contract"
> section below.

---

## Vision

> *"Since our scheduled payment already works perfectly, why not treat every
> recurring payment as an advanced scheduled payment by simply building a
> calculation logic that calculates the timing of each payment as a separate
> scheduled payment."*

Instead of dynamic rescheduling, a recurring command is **expanded upfront
into N independent scheduled jobs**, each with its own `scheduled_at`.
Every job then flows through the existing scheduled-payment pipeline that
is already battle-tested.

### Example

Command: `send $1 to @jadetest every 1 minute 5 times`

Result: 5 rows in `scheduled_jobs`, scheduled at `now+1m`, `now+2m`, …,
`now+5m`. Each row is independent — if one fails the rest still run.

---

## Compatibility Contract (MUST FOLLOW)

These rules are non-negotiable. Violating them will either double-execute
payments or break the executor.

### 1. Do NOT set the legacy recurring flags

The executor (`supabase/functions/scheduled-executor/index.ts`, lines
218–223) automatically inserts a follow-up job after success **iff** the
payload contains both `isRecurring: true` and `recurrenceRule`.

If the bot pre-creates 5 jobs AND sets `isRecurring`, the executor will
also create reschedules → duplicate payments.

✅ Pre-creation payloads must omit `isRecurring` and `recurrenceRule`
entirely (or set `isRecurring: false`).

### 2. Use the existing job `type` values

The dispatcher only knows these types:
`p2p`, `p2p_command`, `scheduled_p2p`, `p2p_multi`, `giveaway`,
`scheduled_giveaway`.

Recurring P2P jobs MUST use `type: 'scheduled_p2p'` (or `'p2p_multi'` for
multi-recipient). Do **not** invent a new `type` like `recurring_p2p`.

### 3. Store series metadata inside `payload`

The schema has no dedicated columns for series tracking. Use the existing
`payload jsonb` column:

```jsonc
{
  "platform": "telegram",                  // or "discord"
  "chatId": 123,                            // telegram
  "channelId": "...", "guildId": "...",    // discord
  "senderId": "<profile uuid>",
  "senderPlatformId": "<tg/discord user id>",
  "senderSource": "profile",
  "senderPayTag": "alice",
  "senderWallet": "0x...",
  "command": { /* parsed p2p command */ },
  "originalText": "send $1 to @jadetest every 1 minute 5 times",

  // ── recurring-series metadata ────────────────────────────────
  "seriesId": "uuid-v4",
  "seriesIndex": 1,            // 1-based
  "seriesTotalCount": 5,
  "seriesIntervalMs": 60000,
  "seriesStartedAt": "2026-06-10T09:58:00Z"
}
```

The executor ignores unknown payload keys, so this is safe.

### 4. Use the same `source_*` columns as one-shot scheduled jobs

Populate `source_author_id`, `source_author_username`, `source_tweet_id`
exactly like `discord-bot/src/handlers/scheduleHandler.js` and
`telegram-bot/src/handlers/schedule.js` already do. The executor's
sender-resolution fallback relies on `source_author_id`.

### 5. Respect the executor cadence and look-ahead

- pg_cron invokes the executor every minute.
- Each invocation processes at most `BATCH_LIMIT = 10` jobs.
- A 30-second look-ahead window is applied (`lookAheadMs = 30_000`).
- A job not yet due waits inline via `setTimeout` up to 30s.

Implications:
- **Minimum interval = 60 seconds.** Anything smaller will skew because
  pg_cron only ticks per minute. Reject `every 30 seconds`-style commands
  or round them up to 60s with a user-facing warning.
- For a series of 5 jobs with `every 1 minute`, expect each to execute
  within ~0–30s of its scheduled time. That's correct behavior.

### 6. Hard caps (enforce in bot, before insert)

| Cap | Value | Reason |
|---|---|---|
| Max jobs per series | **100** | Prevent abuse / runaway resource use |
| Min interval | **60 seconds** | pg_cron granularity |
| Max total horizon | **30 days** | Sanity bound |
| Balance preview | sender balance ≥ `amount × count` | Warn user before insert |

Reject (don't truncate) anything past the hard limits with a clear error.

### 7. Atomic insert

Insert all N rows in a single Supabase call:

```js
await supabase.from('scheduled_jobs').insert(rows); // array
```

If insert fails, no rows are committed (PostgREST is per-request
transactional). Do **not** loop with one insert per row — partial failure
would leave orphans.

### 8. Cancellation

To cancel a series, mark all pending rows with the matching `seriesId`
as failed (don't touch `status='running'` or `'completed'`):

```js
await supabase
  .from('scheduled_jobs')
  .update({ status: 'failed', error_message: 'Cancelled by user' })
  .eq('status', 'pending')
  .filter('payload->>seriesId', 'eq', seriesId);
```

### 9. Series-progress query

```js
await supabase
  .from('scheduled_jobs')
  .select('id, status, scheduled_at, completed_at, error_message, payload')
  .filter('payload->>seriesId', 'eq', seriesId)
  .order('scheduled_at', { ascending: true });
```

---

## Supported Command Patterns

Parser must accept all of the following and produce
`{ intervalMs, count }`:

### Numeric intervals
- `every 1 minute 5 times`
- `every 2 hours 10 times`
- `every 1 day 7 times`
- `every 30 seconds 3 times` → **upgrade to 60s, warn user**

### Duration → count conversion
- `every day for 5 days` → 5
- `every hour for 2 days` → 48
- `every minute for 10 minutes` → 10
- `every week for 1 month` → 4

### Aliases / shorthands
- `every minute` → require explicit count (be consistent across bots)
- `daily 5 times` → `every 1 day 5 times`
- `hourly for 1 day` → `every 1 hour 24 times`
- `weekly 4 times` → `every 1 week 4 times`

### NOT in v1 (do not implement)
- `every Monday`, `every 1st of month` — needs DOW/DOM scheduling
- Timezone-aware execution times

---

## Pseudocode (reference)

```js
async function scheduleRecurring({ command, parsedRecurrence, sender, ctx, basePayload }) {
  const { intervalMs, count } = parsedRecurrence;

  // Safety
  if (count > 100) throw new Error('Max 100 payments per series.');
  if (intervalMs < 60_000) throw new Error('Minimum interval is 60 seconds.');
  if (intervalMs * count > 30 * 86_400_000)
    throw new Error('Series cannot span more than 30 days.');

  const seriesId = crypto.randomUUID();
  const startedAt = Date.now();

  const rows = Array.from({ length: count }, (_, i) => ({
    type: command.type === 'p2p_multi' ? 'p2p_multi' : 'scheduled_p2p',
    status: 'pending',
    scheduled_at: new Date(startedAt + (i + 1) * intervalMs).toISOString(),
    source_author_id: ctx.platformUserId,
    source_author_username: ctx.platformUsername,
    source_tweet_id: String(ctx.messageId),
    max_attempts: 3,
    attempts: 0,
    payload: {
      ...basePayload,        // platform, chatId, senderId, command, etc.
      seriesId,
      seriesIndex: i + 1,
      seriesTotalCount: count,
      seriesIntervalMs: intervalMs,
      seriesStartedAt: new Date(startedAt).toISOString(),
      // IMPORTANT: do NOT set isRecurring / recurrenceRule
    },
  }));

  const { error } = await supabase.from('scheduled_jobs').insert(rows);
  if (error) throw error;

  return {
    seriesId,
    count,
    firstAt: rows[0].scheduled_at,
    lastAt:  rows[count - 1].scheduled_at,
  };
}
```

---

## Confirmation Message Template

```
⏰ Recurring Payment Scheduled! 🔄

🚀 First: <firstAt> UTC
🏁 Last:  <lastAt> UTC
🔄 Interval: Every <interval>
🔢 Total Payments: <count>
💰 Amount Each: $<amount>
💵 Total Amount: $<total>

✅ Status: <count> jobs queued
Series ID: <seriesId>

Cancel anytime: /cancel <seriesId>
```

---

## Database & Executor Verification Summary

| Concern | Status | Notes |
|---|---|---|
| `scheduled_jobs.payload` accepts arbitrary jsonb | ✅ | Default `'{}'::jsonb`, NOT NULL. |
| Independent execution of N rows | ✅ | Executor loops one job at a time; no inter-row deps. |
| Per-job retry budget | ✅ | `attempts` / `max_attempts` already enforced. |
| Cancellation by series | ✅ | jsonb filter on `payload->>'seriesId'`. |
| Double-scheduling risk | ⚠️ | Only if bot sets `isRecurring`+`recurrenceRule`. Rule #1 forbids it. |
| Min interval | ⚠️ | 60s floor required (pg_cron tick + 30s look-ahead). |
| Batch throughput | ⚠️ | 10 jobs/minute cap. A 100-job series all due at once drains over ~10 min. Fine for sane intervals. |

No migrations, no executor edits, no RPC changes are required to ship
this feature. The bots can land it standalone.
