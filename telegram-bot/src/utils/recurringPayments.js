import crypto from 'crypto';

/**
 * Recurring Payments Parser
 * 
 * This module provides comprehensive natural language parsing for recurring payment commands.
 * It detects all recurring payment patterns, supports interchangeable parameter placement,
 * handles synonyms/aliases, and extracts base commands with high accuracy.
 */

// ============================================================================
// CANONICAL UNITS & CONVERSIONS
// ============================================================================

const CANONICAL_UNITS = {
  s: 's', sec: 's', secs: 's', second: 's', seconds: 's',
  m: 'm', min: 'm', mins: 'm', minute: 'm', minutes: 'm',
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h', hourly: 'h',
  d: 'd', day: 'd', days: 'd', daily: 'd',
  w: 'w', wk: 'w', wks: 'w', week: 'w', weeks: 'w', weekly: 'w',
  mo: 'mo', mos: 'mo', mth: 'mo', mths: 'mo', month: 'mo', months: 'mo', monthly: 'mo',
  yr: 'yr', yrs: 'yr', year: 'yr', years: 'yr', yearly: 'yr'
};

const UNIT_TO_MS = {
  s: 1000,
  m: 60000,
  h: 3600000,
  d: 86400000,
  w: 604800000,
  mo: 2592000000, // 30 days
  yr: 31536000000 // 365 days
};

const DOW_MAP = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6
};

const DOW_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ============================================================================
// UNIT CONVERSION UTILITIES
// ============================================================================

/**
 * Convert time unit string to standard character representation
 */
function normalizeUnit(unitStr) {
  if (!unitStr) return null;
  const u = unitStr.toLowerCase();
  if (u.startsWith('mo') || u.startsWith('mth')) return 'mo';
  if (u.startsWith('s') || u === 's') return 's';
  if (u.startsWith('m') || u === 'm') return 'm';
  if (u.startsWith('h') || u === 'h') return 'h';
  if (u.startsWith('d') || u === 'd') return 'd';
  if (u.startsWith('w') || u === 'w') return 'w';
  if (u.startsWith('y') || u === 'y') return 'yr';
  return null;
}

/**
 * Convert unit character to milliseconds multiplier
 */
function unitToMs(unitChar) {
  return UNIT_TO_MS[unitChar] || 0;
}

/**
 * Convert unit character to human-readable label
 */
function unitToLabel(unitChar, value = 1) {
  const units = {
    s: 'second',
    m: 'minute',
    h: 'hour',
    d: 'day',
    w: 'week',
    mo: 'month',
    yr: 'year'
  };
  const label = units[unitChar] || unitChar;
  return value !== 1 ? `${label}s` : label;
}

// ============================================================================
// VALIDATION CONSTANTS & LIMITS
// ============================================================================

const VALIDATION_LIMITS = {
  MIN_INTERVAL_MS: 60000,        // 60 seconds (pg_cron minimum)
  MAX_JOB_COUNT: 100,            // Maximum jobs per series
  MAX_DURATION_MS: 2592000000,   // 30 days
  MIN_INTERVAL_VALUE: 1,
  MAX_TOTAL_AMOUNT: 10000        // $10,000 per job maximum
};

// ============================================================================
// SERIES ID GENERATION
// ============================================================================

/**
 * Generate a unique UUID v4 series identifier
 */
export function generateSeriesId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate that a string is a valid UUID format
 */
export function isValidSeriesId(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

// ============================================================================
// CORE PARSING FUNCTIONS (COMPONENT EXTRACTION ENGINE)
// ============================================================================

/**
 * Escape helper for RegExp generation
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse recurring payment command using Component Extraction Parser
 */
export function parseRecurringCommand(text) {
  if (!text || typeof text !== 'string') return null;

  // Working copy for preprocessing and extraction
  let cleanedText = text;

  // 1. Normalization Stage (Synonyms & Aliases)
  cleanedText = cleanedText
    .replace(/\b(?:weekly\s+on|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)s?\b/gi, 'every $1')
    .replace(/\beach\s+and\s+every\b/gi, 'every')
    .replace(/\bevery\s+single\b/gi, 'every')
    .replace(/\beach\b/gi, 'every')
    .replace(/\bper\b/gi, 'every')
    .replace(/\b(once|twice|thrice)\s+every\b/gi, 'every')
    .replace(/\brepeat\s+every\b/gi, 'every')
    .replace(/\brepeat\s+each\b/gi, 'every')
    // Preprocess aliases/shorthands
    .replace(/\bhourly\b/gi, 'every 1 hour')
    .replace(/\bdaily\b/gi, 'every 1 day')
    .replace(/\bweekly\b/gi, 'every 1 week')
    .replace(/\bmonthly\b/gi, 'every 1 month')
    .replace(/\byearly\b/gi, 'every 1 year')
    .replace(/\bbi-?weekly\b/gi, 'every 2 weeks')
    .replace(/\bbi-?monthly\b/gi, 'every 2 months')
    .replace(/\bevery\s+(?:other|second|alternate)\s+(\w+)/gi, 'every 2 $1');

  // Count/repetition synonyms
  cleanedText = cleanedText
    .replace(/\b(\d+)\s*(?:times?|payments?|rounds?|occurrences?|x)\b/gi, '$1 times')
    .replace(/\bx(\d+)\b/gi, '$1 times')
    // Duration synonyms
    .replace(/\b(?:lasting|over|during|for\s+a\s+period\s+of)\s+(\d+(?:\.\d+)?)\s*(\w+)/gi, 'for $1 $2');

  console.log(`[RecurringParser] Preprocessed string: "${cleanedText}"`);

  let interval = null;
  let count = null;
  let duration = null;
  let startTimeInfo = null;

  // --- INTERVAL EXTRACTION ---
  // A. Check for DOW pattern: every <day>
  const dowRegex = /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)s?\b/i;
  const dowMatch = cleanedText.match(dowRegex);
  if (dowMatch) {
    const dayStr = dowMatch[1].toLowerCase();
    const dow = DOW_MAP[dayStr];
    interval = {
      value: 1,
      unit: 'w',
      ms: UNIT_TO_MS.w,
      dow,
      matchedStr: dowMatch[0]
    };
    cleanedText = cleanedText.replace(dowRegex, '');
  }

  // B. Standard interval: every <N> <unit>
  if (!interval) {
    const stdRegex = /\bevery\s+(\d+(?:\.\d+)?)\s*(\w+)s?\b/i;
    const stdMatch = cleanedText.match(stdRegex);
    if (stdMatch) {
      const val = parseFloat(stdMatch[1]);
      const unitStr = stdMatch[2].toLowerCase();
      const canonicalUnit = normalizeUnit(unitStr);
      if (canonicalUnit) {
        interval = {
          value: val,
          unit: canonicalUnit,
          ms: val * unitToMs(canonicalUnit),
          dow: null,
          matchedStr: stdMatch[0]
        };
        cleanedText = cleanedText.replace(stdRegex, '');
      }
    }
  }

  // C. Implicit interval: every <unit>
  if (!interval) {
    const implicitRegex = /\bevery\s+(\w+)s?\b/i;
    const implicitMatch = cleanedText.match(implicitRegex);
    if (implicitMatch) {
      const unitStr = implicitMatch[1].toLowerCase();
      const canonicalUnit = normalizeUnit(unitStr);
      if (canonicalUnit) {
        interval = {
          value: 1,
          unit: canonicalUnit,
          ms: unitToMs(canonicalUnit),
          dow: null,
          matchedStr: implicitMatch[0]
        };
        cleanedText = cleanedText.replace(implicitRegex, '');
      }
    }
  }

  // If no interval is detected, this is not a recurring payment
  if (!interval) {
    console.log('[RecurringParser] No recurring pattern detected');
    return null;
  }

  // --- COUNT EXTRACTION ---
  const countRegex = /\b(?:for\s+)?(\d+)\s+times\b/i;
  const countMatch = cleanedText.match(countRegex);
  if (countMatch) {
    count = {
      value: parseInt(countMatch[1], 10),
      matchedStr: countMatch[0]
    };
    cleanedText = cleanedText.replace(countRegex, '');
  }

  // --- DURATION EXTRACTION ---
  const durationRegex = /\bfor\s+(\d+(?:\.\d+)?)\s*(\w+)s?\b/i;
  const durationMatch = cleanedText.match(durationRegex);
  if (durationMatch) {
    const val = parseFloat(durationMatch[1]);
    const unitStr = durationMatch[2].toLowerCase();
    const canonicalUnit = normalizeUnit(unitStr);
    if (canonicalUnit) {
      duration = {
        value: val,
        unit: canonicalUnit,
        ms: val * unitToMs(canonicalUnit),
        matchedStr: durationMatch[0]
      };
      cleanedText = cleanedText.replace(durationRegex, '');
    }
  }

  // --- START TIME EXTRACTION ---
  // A. "starting tomorrow at 9am" or "starting tomorrow"
  const tomorrowRegex = /\b(?:starting\s+)?tomorrow(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b)?/i;
  const tomorrowMatch = cleanedText.match(tomorrowRegex);
  if (tomorrowMatch) {
    let hour = null;
    let minute = 0;
    let ampm = null;
    if (tomorrowMatch[1]) {
      hour = parseInt(tomorrowMatch[1], 10);
      minute = tomorrowMatch[2] ? parseInt(tomorrowMatch[2], 10) : 0;
      ampm = tomorrowMatch[3];
    } else {
      hour = 9; // Default starts at 9am UTC
    }
    startTimeInfo = {
      daysAhead: 1,
      hour,
      minute,
      ampm,
      matchedStr: tomorrowMatch[0]
    };
    cleanedText = cleanedText.replace(tomorrowRegex, '');
  }

  // B. "starting in 2 hours"
  if (!startTimeInfo) {
    const inRegex = /\b(?:starting\s+)?in\s+(\d+)\s*(\w+)s?\b/i;
    const inMatch = cleanedText.match(inRegex);
    if (inMatch) {
      const val = parseInt(inMatch[1], 10);
      const unitStr = inMatch[2].toLowerCase();
      const canonicalUnit = normalizeUnit(unitStr);
      if (canonicalUnit) {
        startTimeInfo = {
          relativeMs: val * unitToMs(canonicalUnit),
          matchedStr: inMatch[0]
        };
        cleanedText = cleanedText.replace(inRegex, '');
      }
    }
  }

  // C. "at 9am" or "at 17:30"
  if (!startTimeInfo) {
    const atRegex = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const atMatch = cleanedText.match(atRegex);
    if (atMatch) {
      startTimeInfo = {
        hour: parseInt(atMatch[1], 10),
        minute: atMatch[2] ? parseInt(atMatch[2], 10) : 0,
        ampm: atMatch[3],
        matchedStr: atMatch[0]
      };
      cleanedText = cleanedText.replace(atRegex, '');
    }
  }

  // D. Standalone colon time, e.g., "17:30"
  if (!startTimeInfo) {
    const colonRegex = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i;
    const colonMatch = cleanedText.match(colonRegex);
    if (colonMatch) {
      startTimeInfo = {
        hour: parseInt(colonMatch[1], 10),
        minute: parseInt(colonMatch[2], 10),
        ampm: colonMatch[3],
        matchedStr: colonMatch[0]
      };
      cleanedText = cleanedText.replace(colonRegex, '');
    }
  }

  // --- CALCULATION STAGE ---
  let firstRunTime = null;
  const now = new Date();

  if (interval.dow !== null && interval.dow !== undefined) {
    // DOW target calculation
    const nextDOW = new Date(now.getTime());
    const currentDay = nextDOW.getUTCDay();
    let daysAhead = interval.dow - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    nextDOW.setUTCDate(nextDOW.getUTCDate() + daysAhead);

    let h = now.getUTCHours();
    let m = now.getUTCMinutes();
    if (startTimeInfo) {
      h = startTimeInfo.hour ?? h;
      m = startTimeInfo.minute ?? m;
      if (startTimeInfo.ampm) {
        const ap = startTimeInfo.ampm.toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
      }
    }
    nextDOW.setUTCHours(h, m, 0, 0);
    firstRunTime = nextDOW;
  } else {
    // Relative start time calculation
    if (startTimeInfo) {
      if (startTimeInfo.relativeMs) {
        firstRunTime = new Date(now.getTime() + startTimeInfo.relativeMs);
      } else {
        const date = new Date(now.getTime());
        if (startTimeInfo.daysAhead) {
          date.setUTCDate(date.getUTCDate() + startTimeInfo.daysAhead);
        }
        let h = startTimeInfo.hour ?? date.getUTCHours();
        let m = startTimeInfo.minute ?? date.getUTCMinutes();
        if (startTimeInfo.ampm) {
          const ap = startTimeInfo.ampm.toLowerCase();
          if (ap === 'pm' && h < 12) h += 12;
          if (ap === 'am' && h === 12) h = 0;
        }
        date.setUTCHours(h, m, 0, 0);

        // Roll forward if calculated target is in the past
        if (date.getTime() <= now.getTime()) {
          date.setTime(date.getTime() + interval.ms);
        }
        firstRunTime = date;
      }
    } else {
      // Default offset is one interval
      firstRunTime = new Date(now.getTime() + interval.ms);
    }
  }

  // Repeat count calculation
  let repeatCount = count ? count.value : null;
  if (!repeatCount && duration) {
    repeatCount = Math.floor(duration.ms / interval.ms);
    if (repeatCount <= 0) repeatCount = 1;
  }

  // --- CLEAN BASE COMMAND EXTRACTION ---
  // Extract base command by starting with the normalized text,
  // which makes it trivial to replace matched normalized substrings case-sensitively.
  let baseCommand = cleanedText;

  if (interval.matchedStr) {
    baseCommand = baseCommand.replace(interval.matchedStr, '');
  }
  if (count && count.matchedStr) {
    baseCommand = baseCommand.replace(count.matchedStr, '');
  }
  if (duration && duration.matchedStr) {
    baseCommand = baseCommand.replace(duration.matchedStr, '');
  }
  if (startTimeInfo && startTimeInfo.matchedStr) {
    baseCommand = baseCommand.replace(startTimeInfo.matchedStr, '');
  }

  // Cleanup potential leftover preprocessed scheduling text
  baseCommand = baseCommand
    .replace(/\bdaily\b/gi, '')
    .replace(/\bhourly\b/gi, '')
    .replace(/\bweekly\b/gi, '')
    .replace(/\bmonthly\b/gi, '')
    .replace(/\byearly\b/gi, '')
    .replace(/\bbiweekly\b/gi, '')
    .replace(/\bbimonthly\b/gi, '')
    .replace(/\bbi-weekly\b/gi, '')
    .replace(/\bbi-monthly\b/gi, '')
    .replace(/\brepeat\s+/gi, '')
    .replace(/\bintervals?\b/gi, '')
    .replace(/\btimes?\b/gi, '')
    .replace(/\bfor\s+\d+\s*\w+\b/gi, '')
    .replace(/\bevery\s+\d*\s*\w+\b/gi, '')
    .replace(/\bin\s+\d+\s*\w+\b/gi, '')
    .replace(/hi\s+/gi, '')
    .replace(/@monipaybot/gi, '')
    .replace(/@monibot/gi, '')
    .replace(/monipaybot/gi, '')
    .replace(/monibot/gi, '')
    .replace(/^\/(?:send|pay|monibot)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean trailing commas, extra spaces, slashes
  baseCommand = baseCommand.replace(/,\s*$/, '').trim();

  const result = {
    baseCommand,
    interval: `${interval.value}${interval.unit}`,
    intervalValue: interval.value,
    intervalUnit: interval.unit,
    intervalMs: interval.ms,
    dow: interval.dow,
    repeatCount,
    totalDuration: repeatCount ? (interval.ms * repeatCount) : null,
    firstRunTime: firstRunTime ? firstRunTime.toISOString() : null,
    isRecurring: true
  };

  console.log(`[RecurringParser] Parsed successfully:`, result);
  return result;
}

/**
 * Parse simple one-time scheduled payment: "in X unit"
 */
export function parseSimpleSchedule(text) {
  if (!text || typeof text !== 'string') return null;

  const SIMPLE_SCHEDULE_IN = /\b(?:in\s+(\d+)\s*(second|minute|hour|day|sec|min|hr|s|m|h|d|w)s?)\b/i;
  const match = text.match(SIMPLE_SCHEDULE_IN);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = normalizeUnit(match[2]);
  
  if (!unit) return null;

  const ms = value * unitToMs(unit);
  
  // Validate range: min 10 seconds, max 30 days
  if (ms < 10000 || ms > VALIDATION_LIMITS.MAX_DURATION_MS) {
    return null;
  }

  const scheduledAt = new Date(Date.now() + ms);
  const commandText = text.replace(SIMPLE_SCHEDULE_IN, '').trim();

  return {
    hasSchedule: true,
    scheduledAt: scheduledAt.toISOString(),
    command: commandText.replace(/^\/(?:send|pay|monibot)\s*/i, '').trim(),
    timeDescription: `in ${value} ${unitToLabel(unit, value)}`,
    isRecurring: false
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate recurring payment parameters against system limits
 */
export function validateRecurringParams(recurringCommand) {
  if (!recurringCommand || !recurringCommand.isRecurring) {
    return { isValid: false, message: 'Not a valid recurring command' };
  }

  if (recurringCommand.intervalMs < VALIDATION_LIMITS.MIN_INTERVAL_MS) {
    return {
      isValid: false,
      message: `⏰ Interval too short. Minimum interval is 60 seconds (1 minute).\n\nTry: \`every 1 minute\` or longer.`
    };
  }

  if (!recurringCommand.repeatCount || recurringCommand.repeatCount < 1) {
    return {
      isValid: false,
      message: `🔄 Please specify how many times to repeat.\n\nExamples:\n• \`every 1 minute 5 times\`\n• \`every 1 hour for 3 hours\``
    };
  }

  if (recurringCommand.repeatCount > VALIDATION_LIMITS.MAX_JOB_COUNT) {
    return {
      isValid: false,
      message: `⚠️ Maximum ${VALIDATION_LIMITS.MAX_JOB_COUNT} payments allowed per recurring series.\n\nYour request: ${recurringCommand.repeatCount} payments.`
    };
  }

  if (recurringCommand.totalDuration > VALIDATION_LIMITS.MAX_DURATION_MS) {
    const maxDays = VALIDATION_LIMITS.MAX_DURATION_MS / 86400000;
    return {
      isValid: false,
      message: `📅 Maximum duration is ${maxDays} days.\n\nYour request would take ${Math.ceil(recurringCommand.totalDuration / 86400000)} days.`
    };
  }

  return { isValid: true };
}

/**
 * Validate payment amount for recurring series
 */
export function validateRecurringAmount(amount, repeatCount) {
  if (!amount || amount <= 0) {
    return { isValid: false, message: 'Invalid payment amount' };
  }

  if (amount > VALIDATION_LIMITS.MAX_TOTAL_AMOUNT) {
    return {
      isValid: false,
      message: `💰 Maximum $${VALIDATION_LIMITS.MAX_TOTAL_AMOUNT.toFixed(2)} per payment.\n\nYour amount: $${amount.toFixed(2)}`
    };
  }

  const totalAmount = amount * repeatCount;
  
  return {
    isValid: true,
    totalAmount,
    perPaymentAmount: amount
  };
}

// ============================================================================
// CLARIFICATION DETECTION
// ============================================================================

/**
 * Check if a recurring command needs clarification
 */
export function needsClarification(recurringCommand) {
  if (!recurringCommand || !recurringCommand.isRecurring) {
    return null;
  }

  if (!recurringCommand.repeatCount) {
    return {
      needsClarification: true,
      type: 'missing_repeat_count',
      message: `🔄 *Recurring Payment Detected!*\n\n` +
               `You've set an interval (${formatInterval(recurringCommand)}), but I need to know how many times to repeat it.\n\n` +
               `Please specify:\n` +
               `• \`${recurringCommand.intervalValue} ${unitToLabel(recurringCommand.intervalUnit, recurringCommand.intervalValue)} 10 times\`\n` +
               `• \`${recurringCommand.intervalValue} ${unitToLabel(recurringCommand.intervalUnit, recurringCommand.intervalValue)} for 2 hours\``
    };
  }

  return null;
}

/**
 * Format interval for display
 */
export function formatInterval(recurringCommand) {
  if (!recurringCommand) return '';
  
  const { intervalValue, intervalUnit, dow } = recurringCommand;
  if (dow !== undefined && dow !== null) {
    return `every ${DOW_NAMES[dow].charAt(0).toUpperCase() + DOW_NAMES[dow].slice(1)}`;
  }
  
  const label = unitToLabel(intervalUnit, intervalValue);
  
  return intervalValue > 1 
    ? `every ${intervalValue} ${label}` 
    : `every ${label}`;
}

export { VALIDATION_LIMITS };
