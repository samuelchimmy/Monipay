/**
 * Parse Schedule Edge Function — HYBRID MODE
 *
 * 1. Advanced Regex (instant, zero cost) — handles 90%+ of cases
 * 2. Gemini AI fallback (via Google AI) — handles edge cases
 *
 * Supports:
 * - Relative: "in 2 mins", "in 1 hour", "in 30 seconds", "in 3 days"
 * - Absolute: "tomorrow at 3pm", "today at 5:30pm"
 * - Day-of-week: "next monday", "this friday", "on wednesday at 2pm"
 * - Date: "feb 20 at 5pm", "march 15", "jan 1 at noon"
 * - Special: "tonight at 9pm", "tomorrow morning", "noon", "midnight"
 * - Timezone: "at 3pm EST", "tomorrow 5pm WAT" (via AI fallback)
 * - Natural language: "after lunch", "end of day" (via AI fallback)
 * - Recurring: "every 1 minute", "every 2 hours", "every Friday", "every month"
 *
 * Also parses full commands to extract recipients, amounts, and distribution type.
 *
 * TIMING NOTE:
 * The executor is invoked by pg_cron every minute, so scheduling precision is
 * ~1 minute.  The minimum enforced delay is 60 seconds to avoid misleading users
 * into thinking sub-minute scheduling is possible.  The executor uses a 30-second
 * look-ahead window to compensate for cron tick jitter.
 *
 * RECURRING PAYMENT FLOW:
 * This function returns isRecurring, recurrenceRule, recurrenceInterval,
 * repeatCount, and recurringDuration. The bot handler is responsible for:
 *   1. Asking the user "how many times or for how long?" if both repeatCount
 *      and recurringDuration are null.
 *   2. Mapping repeatCount → remainingCount in the job payload.
 *   3. Computing endAt from recurringDuration before inserting the job.
 *   4. Generating a recurringGroupId (crypto.randomUUID()) for the series.
 *   5. Sending a confirmation summary back to the user.
 */

import { corsHeaders } from "../_shared/security.ts";

const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Minimum scheduling delay in milliseconds.
// pg_cron fires at most once per minute, so anything under 60s is unreliable.
const MIN_SCHEDULE_MS = 60_000;
const MAX_SCHEDULE_MS = 30 * 86_400_000; // 30 days

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, platform = "discord" } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 1: Try advanced regex (fast, free) ===
    const regexResult = parseFullCommandRegex(text);
    if (regexResult.hasSchedule) {
      console.log(`[parse-schedule] Regex hit: "${regexResult.timeDescription}"`);
      return new Response(JSON.stringify(regexResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 2: Check if text MIGHT contain a time expression ===
    if (!mightContainTimeExpression(text)) {
      const parsed = parseCommandDetails(text);
      return new Response(
        JSON.stringify({
          hasSchedule: false,
          scheduledAt: null,
          timeDescription: null,
          command: null,
          parsed,
          isRecurring: false,
          recurrenceRule: null,
          recurrenceInterval: 1,
          repeatCount: null,
          recurringDuration: null,
          method: "regex",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === STEP 3: Gemini AI fallback for complex expressions ===
    console.log(`[parse-schedule] Regex miss, trying Gemini AI for: "${text}"`);
    const aiResult = await parseWithGeminiAI(text, platform);
    if (aiResult) {
      console.log(`[parse-schedule] AI hit: "${aiResult.timeDescription}"`);
      return new Response(JSON.stringify(aiResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 4: No schedule found ===
    const parsed = parseCommandDetails(text);
    return new Response(
      JSON.stringify({
        hasSchedule: false,
        scheduledAt: null,
        timeDescription: null,
        command: null,
        parsed,
        isRecurring: false,
        recurrenceRule: null,
        recurrenceInterval: 1,
        repeatCount: null,
        recurringDuration: null,
        method: "none",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Parse error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════════════════════
// HEURISTIC: Does the text likely contain a time expression?
// ═══════════════════════════════════════════════════════

const TIME_HINT_WORDS =
  /\b(every|in\s+\d|tomorrow|today|tonight|next\s|this\s(monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night)|at\s+\d|noon|midnight|after\s+(lunch|dinner|work)|end\s+of\s+(day|week)|later|schedule|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am\b|pm\b|\d{1,2}:\d{2})\b/i;

function mightContainTimeExpression(text: string): boolean {
  return TIME_HINT_WORDS.test(text);
}

// ═══════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════

interface ParseResult {
  hasSchedule: boolean;
  scheduledAt: string | null;
  timeDescription: string | null;
  command: string | null;
  parsed: {
    action: string | null;
    amount: number | null;
    recipients: string[];
    amountType: "each" | "total";
    chain: string;
  } | null;
  // Recurring fields — always present so bot handlers can check without optional chaining
  isRecurring: boolean;
  recurrenceRule: string | null;       // "minute"|"hour"|"day"|"week"|"month"|"monday"… (English)
  recurrenceInterval: number;          // the N in "every N minutes"; defaults to 1
  repeatCount: number | null;          // from "5 times"; null = open-ended → bot must ask
  recurringDuration: { value: number; unit: string } | null; // from "for 2 hours"
  method: string;
}

interface TimeResult {
  scheduledAt: Date;
  description: string;
  cleanedText: string;
  // Recurring fields bubble up through extractTimeExpression
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceInterval?: number;
  repeatCount?: number;
  recurringDuration?: { value: number; unit: string };
}

// ═══════════════════════════════════════════════════════
// REGEX ENGINE
// ═══════════════════════════════════════════════════════

function parseFullCommandRegex(text: string): ParseResult {
  const now = new Date();
  const timeResult = extractTimeExpression(text, now);
  const commandText = timeResult ? timeResult.cleanedText : text;
  const parsed = parseCommandDetails(commandText);

  const isRecurring = timeResult?.isRecurring ?? false;

  return {
    hasSchedule: !!timeResult,
    scheduledAt: timeResult?.scheduledAt?.toISOString() || null,
    timeDescription: timeResult?.description || null,
    command: timeResult
      ? timeResult.cleanedText
          .replace(/^!monibot\s*/i, "")
          .replace(/^\/(?:send|pay|monibot)\s*/i, "")
          .replace(/^monibot\s*/i, "")
          .trim()
      : null,
    parsed,
    isRecurring,
    recurrenceRule: timeResult?.recurrenceRule ?? null,
    recurrenceInterval: timeResult?.recurrenceInterval ?? 1,
    repeatCount: timeResult?.repeatCount ?? null,
    recurringDuration: timeResult?.recurringDuration ?? null,
    method: timeResult ? "regex" : "none",
  };
}

// ═══════════════════════════════════════════════════════
// TIME EXPRESSION EXTRACTION
// ═══════════════════════════════════════════════════════

// Maps unit abbreviations/words to a canonical recurrenceRule string
function canonicalRule(unit: string): string {
  const u = unit.toLowerCase();
  if (/^s/.test(u)) return "second";   // kept for completeness; executor min is 60s
  if (/^mi?n/.test(u)) return "minute";
  if (/^h/.test(u)) return "hour";
  if (/^d/.test(u)) return "day";
  if (/^w/.test(u)) return "week";
  if (/^mo/.test(u)) return "month";
  // day-of-week names pass through unchanged
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const found = days.find(d => u.startsWith(d.substring(0, 3)));
  return found || u;
}

// Converts a recurrenceRule + interval to milliseconds for the first-run offset
function ruleToMs(rule: string, interval: number): number {
  const msMap: Record<string, number> = {
    second: 1_000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 30 * 86_400_000, // approximate; executor uses calendar math
  };
  return (msMap[rule] ?? 86_400_000) * interval;
}

function extractTimeExpression(text: string, now: Date): TimeResult | null {

  // ── 0. RECURRING: "every 1 minute", "every 2 hours", "every Friday" ──────
  // Must run before one-time patterns so "every 1 min" doesn't get swallowed
  // by the relative "in X" pattern on a following recursive call.
  const recurringPattern =
    /\bevery\s+(?:(\d+)\s+)?(second|minute|min|hour|hr|day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/i;
  const recurringMatch = text.match(recurringPattern);

  if (recurringMatch) {
    const interval = recurringMatch[1] ? parseInt(recurringMatch[1]) : 1;
    const rule = canonicalRule(recurringMatch[2]);

    // Strip the "every …" clause and look for limit/duration phrases
    let cleaned = text.replace(recurringPattern, "").trim();

    // "for 5 times" or "5 times"
    let repeatCount: number | undefined;
    const timesPattern = /\b(?:for\s+)?(\d+)\s*times?\b/i;
    const timesMatch = cleaned.match(timesPattern);
    if (timesMatch) {
      repeatCount = parseInt(timesMatch[1]);
      cleaned = cleaned.replace(timesPattern, "").trim();
    }

    // "for 2 hours", "for 30 minutes", "for 3 days"
    let recurringDuration: { value: number; unit: string } | undefined;
    const durationPattern = /\bfor\s+(\d+)\s*(second|minute|min|hour|hr|day|week|month)s?\b/i;
    const durationMatch = cleaned.match(durationPattern);
    if (durationMatch) {
      recurringDuration = {
        value: parseInt(durationMatch[1]),
        unit: canonicalRule(durationMatch[2]),
      };
      cleaned = cleaned.replace(durationPattern, "").trim();
    }

    // Check whether a specific start time is also mentioned (e.g. "every day at 9am")
    const startTimeResult = extractTimeExpression(cleaned, now);

    let scheduledAt: Date;
    let description: string;

    if (startTimeResult) {
      // Use the explicitly stated start time
      scheduledAt = startTimeResult.scheduledAt;
      description = `every ${interval > 1 ? interval + " " : ""}${rule}${interval > 1 ? "s" : ""} starting ${startTimeResult.description}`;
      cleaned = startTimeResult.cleanedText;
    } else {
      // Default: first run = now + one interval
      const ms = ruleToMs(rule, interval);
      scheduledAt = new Date(now.getTime() + ms);
      description = `every ${interval > 1 ? interval + " " : ""}${rule}${interval > 1 ? "s" : ""}`;
      if (repeatCount) description += ` for ${repeatCount} times`;
      else if (recurringDuration) description += ` for ${recurringDuration.value} ${recurringDuration.unit}s`;
    }

    return {
      scheduledAt,
      description,
      cleanedText: cleaned,
      isRecurring: true,
      recurrenceRule: rule,
      recurrenceInterval: interval,
      repeatCount,
      recurringDuration,
    };
  }

  // ── 1. RELATIVE (trailing): "send $5 to @alice in 2 mins" ─────────────────
  const relative =
    /\b(?:in\s+(\d+)\s*(s(?:ec(?:ond)?s?)?|m(?:in(?:ute)?s?)?|h(?:(?:ou)?rs?)?|d(?:ays?)?|w(?:eeks?)?))?\s*$/i;
  let match = text.match(relative);
  if (match && match[1]) {
    const result = buildRelativeResult(text, match, relative);
    if (result) return result;
  }

  // ── 1b. RELATIVE (leading): "in 2 mins send $5 to @alice" ─────────────────
  const relativeAnywhere =
    /\b(?:in\s+(\d+)\s*(s(?:ec(?:ond)?s?)?|m(?:in(?:ute)?s?)?|h(?:(?:ou)?rs?)?|d(?:ays?)?|w(?:eeks?)?))?\s+/i;
  match = text.match(relativeAnywhere);
  if (match && match[1] && text.indexOf(match[0]) < text.length / 2) {
    const result = buildRelativeResult(text, match, relativeAnywhere);
    if (result) return result;
  }

  // ── 2. "tomorrow at 3pm", "tomorrow at 15:00" ─────────────────────────────
  const tomorrowAt = /\btomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i;
  match = text.match(tomorrowAt);
  if (match) {
    const scheduledAt = parseAbsoluteTime(now, 1, parseInt(match[1]), parseInt(match[2] || "0"), match[3]);
    if (scheduledAt) {
      return {
        scheduledAt,
        description: `tomorrow at ${formatTime(scheduledAt)}`,
        cleanedText: text.replace(tomorrowAt, "").trim(),
      };
    }
  }

  // "tomorrow morning/afternoon/evening/night"
  const tomorrowPeriod = /\btomorrow\s+(morning|afternoon|evening|night)\s*$/i;
  match = text.match(tomorrowPeriod);
  if (match) {
    const hours: Record<string, number> = { morning: 9, afternoon: 14, evening: 18, night: 21 };
    const h = hours[match[1].toLowerCase()] || 9;
    const scheduledAt = parseAbsoluteTime(now, 1, h, 0, null);
    if (scheduledAt) {
      return {
        scheduledAt,
        description: `tomorrow ${match[1].toLowerCase()}`,
        cleanedText: text.replace(tomorrowPeriod, "").trim(),
      };
    }
  }

  // Plain "tomorrow"
  const tomorrowPlain = /\btomorrow\s*$/i;
  match = text.match(tomorrowPlain);
  if (match) {
    const scheduledAt = parseAbsoluteTime(now, 1, 9, 0, null);
    if (scheduledAt) {
      return {
        scheduledAt,
        description: "tomorrow at 9:00 AM",
        cleanedText: text.replace(tomorrowPlain, "").trim(),
      };
    }
  }

  // ── 3. "today at 5pm", "today at 17:30" ───────────────────────────────────
  const todayAt = /\btoday\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i;
  match = text.match(todayAt);
  if (match) {
    const scheduledAt = parseAbsoluteTime(now, 0, parseInt(match[1]), parseInt(match[2] || "0"), match[3]);
    if (scheduledAt && scheduledAt > now) {
      return {
        scheduledAt,
        description: `today at ${formatTime(scheduledAt)}`,
        cleanedText: text.replace(todayAt, "").trim(),
      };
    }
  }

  // ── 4. "next monday", "next friday at 3pm", "on wednesday at 2pm" ─────────
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayPattern =
    /\b(?:next|this|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\s*$/i;
  match = text.match(dayPattern);
  if (match) {
    const targetDay = dayNames.indexOf(match[1].toLowerCase());
    const currentDay = now.getUTCDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    const hour = match[2] ? parseInt(match[2]) : 9;
    const minute = match[3] ? parseInt(match[3]) : 0;
    const scheduledAt = parseAbsoluteTime(now, daysAhead, hour, minute, match[4] || null);
    if (scheduledAt && scheduledAt > now) {
      return {
        scheduledAt,
        description: `${match[1].toLowerCase()} at ${formatTime(scheduledAt)}`,
        cleanedText: text.replace(dayPattern, "").trim(),
      };
    }
  }

  // ── 5. "feb 20 at 5pm", "march 15", "jan 1 at noon" ──────────────────────
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const datePattern =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\s*$/i;
  match = text.match(datePattern);
  if (match) {
    const monthStr = match[1].toLowerCase().substring(0, 3);
    const month = monthNames.indexOf(monthStr);
    const day = parseInt(match[2]);
    const hour = match[3] ? parseInt(match[3]) : 9;
    const minute = match[4] ? parseInt(match[4]) : 0;
    const ampm = match[5] || null;
    if (month >= 0) {
      let h = hour;
      if (ampm) {
        const ap = ampm.toLowerCase();
        if (ap === "pm" && h < 12) h += 12;
        if (ap === "am" && h === 12) h = 0;
      }
      const scheduledAt = new Date(Date.UTC(now.getUTCFullYear(), month, day, h, minute, 0));
      if (scheduledAt <= now) {
        scheduledAt.setUTCFullYear(scheduledAt.getUTCFullYear() + 1);
      }
      if (scheduledAt.getTime() - now.getTime() > MAX_SCHEDULE_MS) return null;
      return {
        scheduledAt,
        description: `${monthNames[month]} ${day} at ${formatTime(scheduledAt)}`,
        cleanedText: text.replace(datePattern, "").trim(),
      };
    }
  }

  // ── 6. "at noon", "at midnight" ───────────────────────────────────────────
  const specialTime = /\b(?:at\s+)?(noon|midnight)\s*$/i;
  match = text.match(specialTime);
  if (match) {
    const hour = match[1].toLowerCase() === "noon" ? 12 : 0;
    let scheduledAt = parseAbsoluteTime(now, 0, hour, 0, null);
    if (!scheduledAt || scheduledAt <= now) {
      scheduledAt = parseAbsoluteTime(now, 1, hour, 0, null);
    }
    if (scheduledAt) {
      return {
        scheduledAt,
        description: match[1].toLowerCase() === "noon" ? "at noon" : "at midnight",
        cleanedText: text.replace(specialTime, "").trim(),
      };
    }
  }

  // ── 7. "tonight at 9pm", "tonight" ────────────────────────────────────────
  const tonight = /\btonight(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\s*$/i;
  match = text.match(tonight);
  if (match) {
    const hour = match[1] ? parseInt(match[1]) : 21;
    const minute = match[2] ? parseInt(match[2]) : 0;
    let scheduledAt = parseAbsoluteTime(now, 0, hour, minute, match[3] || "pm");
    if (!scheduledAt || scheduledAt <= now) {
      scheduledAt = parseAbsoluteTime(now, 1, hour, minute, match[3] || "pm");
    }
    if (scheduledAt) {
      return {
        scheduledAt,
        description: `tonight at ${formatTime(scheduledAt)}`,
        cleanedText: text.replace(tonight, "").trim(),
      };
    }
  }

  // ── 8. Standalone "at Xpm/am" ─────────────────────────────────────────────
  const standaloneAt = /\b(?:at\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i;
  match = text.match(standaloneAt);
  if (match) {
    let scheduledAt = parseAbsoluteTime(now, 0, parseInt(match[1]), parseInt(match[2] || "0"), match[3]);
    if (!scheduledAt || scheduledAt <= now) {
      scheduledAt = parseAbsoluteTime(now, 1, parseInt(match[1]), parseInt(match[2] || "0"), match[3]);
    }
    if (scheduledAt) {
      return {
        scheduledAt,
        description: `at ${formatTime(scheduledAt)}`,
        cleanedText: text.replace(standaloneAt, "").trim(),
      };
    }
  }

  return null;
}

function buildRelativeResult(
  text: string,
  match: RegExpMatchArray,
  pattern: RegExp
): TimeResult | null {
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  let ms = 0;
  let unitLabel = "";

  if (unit.startsWith("s")) { ms = value * 1_000; unitLabel = "second"; }
  else if (unit.startsWith("m")) { ms = value * 60_000; unitLabel = "minute"; }
  else if (unit.startsWith("h")) { ms = value * 3_600_000; unitLabel = "hour"; }
  else if (unit.startsWith("d")) { ms = value * 86_400_000; unitLabel = "day"; }
  else if (unit.startsWith("w")) { ms = value * 604_800_000; unitLabel = "week"; }
  else return null;

  if (ms < MIN_SCHEDULE_MS) return null;
  if (ms > MAX_SCHEDULE_MS) return null;

  const scheduledAt = new Date(Date.now() + ms);
  const plural = value !== 1 ? "s" : "";

  return {
    scheduledAt,
    description: `in ${value} ${unitLabel}${plural}`,
    cleanedText: text.replace(pattern, "").trim(),
  };
}

// ═══════════════════════════════════════════════════════
// GEMINI AI FALLBACK
// ═══════════════════════════════════════════════════════

async function parseWithGeminiAI(text: string, platform: string): Promise<ParseResult | null> {
  if (!GOOGLE_AI_API_KEY) {
    console.warn("[parse-schedule] No GOOGLE_AI_API_KEY — AI fallback unavailable");
    return null;
  }

  const now = new Date().toISOString();

  const prompt = `You are a precise time expression parser for a payment bot. Parse this ${platform} message for time/scheduling info.
Current UTC: ${now}
Message: "${text}"

RULES:
- Extract the scheduled time as ISO 8601 UTC
- "in X mins/hours/days" = now + X (minimum 60 seconds from now)
- "tomorrow" = next day, default 9am UTC
- "at Xpm/am" = today if future, tomorrow if past
- "next monday" = upcoming Monday, default 9am UTC
- "tonight" = today 9pm UTC (or tomorrow if already past)
- "after lunch" = today 1pm, "end of day" = today 5pm, "this evening" = today 6pm
- Timezone offsets: EST=-5, CST=-6, PST=-8, WAT=+1, EAT=+3, IST=+5.5
- Min 60 sec in future, max 30 days
- "every X mins/hours/days/weeks/months" = recurring. Set isRecurring=true.
- recurrenceRule must be one of: "minute","hour","day","week","month","monday","tuesday","wednesday","thursday","friday","saturday","sunday"
- recurrenceInterval is the N in "every N minutes" (default 1)
- repeatCount: number from "5 times" or null
- recurringDuration: {value, unit} from "for 2 hours" or null
- Remove ALL time and recurrence portions from command text
- Also parse recipients (@tags), amount ($X), amountType (each/total), chain (base/bsc/tempo)

OUTPUT (JSON only, no markdown):
{"hasSchedule": true|false, "scheduledAt": "ISO8601"|null, "timeDescription": "human-friendly"|null, "command": "command without time/recurrence part"|null, "parsed": {"action": "send"|null, "amount": number|null, "recipients": ["tag1"]|[], "amountType": "each"|"total", "chain": "base"|"bsc"|"tempo"}, "isRecurring": boolean, "recurrenceRule": "minute"|"hour"|"day"|"week"|"month"|"monday"|...|null, "recurrenceInterval": number, "repeatCount": number|null, "recurringDuration": {"value": number, "unit": "minute"|"hour"|"day"|"week"|"month"}|null}`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[parse-schedule] Gemini error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[parse-schedule] AI returned no JSON:", content);
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!result.hasSchedule) return null;

    const scheduledAt = new Date(result.scheduledAt);
    const nowDate = new Date();
    if (isNaN(scheduledAt.getTime())) return null;
    if (scheduledAt.getTime() - nowDate.getTime() < MIN_SCHEDULE_MS) return null;
    if (scheduledAt.getTime() - nowDate.getTime() > MAX_SCHEDULE_MS) return null;

    return {
      hasSchedule: true,
      scheduledAt: scheduledAt.toISOString(),
      timeDescription: result.timeDescription || null,
      command: result.command || null,
      parsed: result.parsed || null,
      isRecurring: result.isRecurring || false,
      recurrenceRule: result.recurrenceRule || null,
      recurrenceInterval: result.recurrenceInterval ?? 1,
      repeatCount: result.repeatCount ?? null,
      recurringDuration: result.recurringDuration ?? null,
      method: "ai",
    };
  } catch (e: any) {
    console.error("[parse-schedule] AI exception:", e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// COMMAND DETAIL PARSER
// ═══════════════════════════════════════════════════════

function parseCommandDetails(text: string) {
  const cleaned = text
    .replace(/^!monibot\s*/i, "")
    .replace(/^\/(?:send|pay|monibot)\s*/i, "")
    .replace(/^monibot\s*/i, "")
    .trim();

  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  let chain = "base";
  if (["on tempo", "tempo", "alphausd", "αusd", "ausd"].some((k) => lower.includes(k))) chain = "tempo";
  else if (["usdt", "bnb", "bsc"].some((k) => lower.includes(k))) chain = "bsc";

  // Multi-send: "send $1 each to @alice, @bob"
  const multiMatch = cleaned.match(/(?:send|pay)\s+\$?([\d.]+)\s*(?:\w*\s+)?each\s+to\s+(.*)/i);
  if (multiMatch) {
    const recipients = extractMoniTags(multiMatch[2]);
    if (recipients.length > 0) {
      return { action: "send", amount: parseFloat(multiMatch[1]), recipients, amountType: "each" as const, chain };
    }
  }

  // Total split: "send $10 total to @alice and @bob"
  const totalMatch = cleaned.match(/(?:send|pay)\s+\$?([\d.]+)\s*(?:\w*\s+)?total\s+to\s+(.*)/i);
  if (totalMatch) {
    const recipients = extractMoniTags(totalMatch[2]);
    if (recipients.length > 0) {
      return { action: "send", amount: parseFloat(totalMatch[1]), recipients, amountType: "total" as const, chain };
    }
  }

  // Single: "send $5 to @alice"
  const singleMatch = cleaned.match(/(?:send|pay)\s+\$?([\d.]+)\s*(?:\w*\s+)?(?:to\s+)?@(\w[\w-]*)/i);
  if (singleMatch) {
    return {
      action: "send",
      amount: parseFloat(singleMatch[1]),
      recipients: [singleMatch[2].toLowerCase()],
      amountType: "each" as const,
      chain,
    };
  }

  // Reverse: "pay @alice $5"
  const reverseMatch = cleaned.match(/(?:send|pay)\s+@(\w[\w-]*)\s+\$?([\d.]+)/i);
  if (reverseMatch) {
    return {
      action: "send",
      amount: parseFloat(reverseMatch[2]),
      recipients: [reverseMatch[1].toLowerCase()],
      amountType: "each" as const,
      chain,
    };
  }

  return null;
}

function extractMoniTags(text: string): string[] {
  const matches = text.match(/@(\w[\w-]*)/g) || [];
  return matches
    .map((m) => m.slice(1).toLowerCase())
    .filter((m) => !["monibot", "monipay", "everyone", "here"].includes(m));
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function parseAbsoluteTime(
  now: Date,
  daysAhead: number,
  hour: number,
  minute: number,
  ampm: string | null
): Date | null {
  let h = hour;
  if (ampm) {
    const ap = ampm.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  }
  if (h < 0 || h > 23 || minute < 0 || minute > 59) return null;

  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(h, minute, 0, 0);
  return d;
}

function formatTime(d: Date): string {
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return m > 0 ? `${h}:${String(m).padStart(2, "0")} ${ampm}` : `${h}:00 ${ampm}`;
}
