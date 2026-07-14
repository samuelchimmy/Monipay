/**
 * MoniBot Discord - Recurring Payment Parser
 * Parses natural language recurring payment syntax
 */

/**
 * Time unit mappings for normalization
 */
const TIME_UNITS = {
  // Seconds
  s: 'second',
  sec: 'second',
  secs: 'second',
  second: 'second',
  seconds: 'second',
  
  // Minutes
  m: 'minute',
  min: 'minute',
  mins: 'minute',
  minute: 'minute',
  minutes: 'minute',
  
  // Hours
  h: 'hour',
  hr: 'hour',
  hrs: 'hour',
  hour: 'hour',
  hours: 'hour',
  hourly: 'hour',
  
  // Days
  d: 'day',
  day: 'day',
  days: 'day',
  daily: 'day',
  
  // Weeks
  w: 'week',
  wk: 'week',
  week: 'week',
  weeks: 'week',
  weekly: 'week',
  
  // Months
  mo: 'month',
  mos: 'month',
  month: 'month',
  months: 'month',
  monthly: 'month',
};

/**
 * Convert time units to milliseconds
 */
const UNIT_TO_MS = {
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 86400000,
  week: 604800000,
  month: 2592000000, // 30 days
};

/**
 * Brainrot-style error messages
 */
export const ERROR_MESSAGES = {
  INVALID_SYNTAX: "That syntax is giving Ohio energy 🌽 Try: 'send $5 to @alice every day 5 times'",
  MISSING_COUNT: "Yo blud, how many times tho? 🤔 Add something like '5 times' or 'for 1 week'",
  MISSING_INTERVAL: "Every what tho? 💀 Specify like 'every day' or 'every 2 hours'",
  PARSING_FAILED: "Command parsing failed. Stop being delulu with that syntax 🤡",
  SUB_60_SECONDS: "Blud tried to go sub-60 seconds 💀",
  DOW_NOT_SUPPORTED: "Day-of-week scheduling (like 'every Monday') ain't supported yet chief 🚫 Try intervals instead",
  DECIMAL_INTERVAL: "Decimal intervals? Nah fam 🙅 Rounded to nearest whole number",
};

/**
 * Normalize a time unit string to standard form
 * @param {string} unit - The time unit to normalize
 * @returns {string} - Normalized time unit
 */
export function normalizeTimeUnit(unit) {
  const normalized = TIME_UNITS[unit.toLowerCase()];
  if (!normalized) {
    throw new Error(`Unknown time unit: ${unit}`);
  }
  return normalized;
}

/**
 * Convert duration specification to count
 * @param {number} value - Duration value
 * @param {string} unit - Duration unit (day, week, etc.)
 * @param {number} intervalMs - Interval in milliseconds
 * @returns {number} - Number of occurrences
 */
export function convertDurationToCount(value, unit, intervalMs) {
  if (value <= 0) {
    throw new Error('Invalid duration value');
  }
  
  try {
    const normalizedUnit = normalizeTimeUnit(unit);
    const durationMs = value * UNIT_TO_MS[normalizedUnit];
    const count = Math.floor(durationMs / intervalMs);
    return count > 0 ? count : 1;
  } catch (error) {
    if (error.message.includes('Unknown time unit')) {
      throw new Error('Unknown duration unit');
    }
    throw error;
  }
}

/**
 * Parse recurring payment command from text
 * @param {string} text - The command text to parse
 * @returns {Object|null} - Parsed recurring parameters or null if not recurring
 */
export function parseRecurringCommand(text) {
  if (!text) return null;
  const cleanedOriginal = text.trim();
  
  // Pattern 4: "every <day-of-week>" (NOT SUPPORTED in v1)
  const dowPattern = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  if (dowPattern.test(cleanedOriginal)) {
    throw new Error('DOW scheduling not supported in v1');
  }
  
  const cleaned = preprocessRecurringText(text);
  if (!cleaned) return null;
  
  // Pattern 1: "every [N] <unit> <count> times"
  // Examples: "every 1 minute 5 times", "every day 10 times", "every 1 minute, 5 times"
  const pattern1 = /\bevery\s+(?:(\d+(?:\.\d+)?)\s*)?(\w+?)s?\s*,?\s*(?:for\s+)?(\d+)\s*times?\b/i;
  const match1 = cleaned.match(pattern1);
  
  if (match1) {
    const [fullMatch, intervalNum, unit, countStr] = match1;
    const interval = intervalNum ? parseFloat(intervalNum) : 1;
    const count = parseInt(countStr, 10);
    
    try {
      const normalizedUnit = normalizeTimeUnit(unit);
      let intervalMs = Math.round(interval * UNIT_TO_MS[normalizedUnit]);
      
      const warnings = [];
      
      // Handle decimal intervals
      if (interval % 1 !== 0) {
        warnings.push(ERROR_MESSAGES.DECIMAL_INTERVAL);
      }
      
      // Enforce minimum 60-second interval
      if (intervalMs < 60000) {
        warnings.push(ERROR_MESSAGES.SUB_60_SECONDS);
        intervalMs = 60000;
      }
      
      // Extract base command by removing recurring pattern
      const baseCommand = cleaned.replace(fullMatch, '').trim();
      
      return {
        intervalMs,
        count,
        warnings,
        originalText: text,
        pattern: 'numeric_interval',
        baseCommand,
        intervalValue: interval,
        intervalUnit: normalizedUnit,
      };
    } catch (error) {
      return null;
    }
  }
  
  // Pattern 2: "every [N] <unit> for <duration> <unit>"
  // Examples: "every day for 1 week", "every hour for 2 days", "every 1 minute, for 5 minutes"
  const pattern2 = /\bevery\s+(?:(\d+(?:\.\d+)?)\s*)?(\w+?)s?\s*,?\s*for\s+(\d+|(?:an|a)(?=\s))\s*(\w+?)s?\b/i;
  const match2 = cleaned.match(pattern2);
  
  if (match2) {
    const [fullMatch, intervalNum, intervalUnit, durationNum, durationUnit] = match2;
    const interval = intervalNum ? parseFloat(intervalNum) : 1;
    const durationStr = durationNum.toLowerCase();
    const duration = (durationStr === 'a' || durationStr === 'an') ? 1 : parseInt(durationNum, 10);
    
    try {
      const normalizedIntervalUnit = normalizeTimeUnit(intervalUnit);
      let intervalMs = Math.round(interval * UNIT_TO_MS[normalizedIntervalUnit]);
      
      const warnings = [];
      
      // Handle decimal intervals
      if (interval % 1 !== 0) {
        warnings.push(ERROR_MESSAGES.DECIMAL_INTERVAL);
      }
      
      // Enforce minimum 60-second interval
      if (intervalMs < 60000) {
        warnings.push(ERROR_MESSAGES.SUB_60_SECONDS);
        intervalMs = 60000;
      }
      
      const count = convertDurationToCount(duration, durationUnit, intervalMs);
      
      // Extract base command by removing recurring pattern
      const baseCommand = cleaned.replace(fullMatch, '').trim();
      
      return {
        intervalMs,
        count,
        warnings,
        originalText: text,
        pattern: 'duration_conversion',
        baseCommand,
        intervalValue: interval,
        intervalUnit: normalizedIntervalUnit,
      };
    } catch (error) {
      return null;
    }
  }
  
  // Pattern 3: Aliases like "daily 5 times", "hourly for 2 days"
  const pattern3 = /\b(daily|hourly|weekly|monthly)\s*,?\s*(?:(?:for\s+)?(\d+)\s*times?|for\s+(\d+|(?:an|a)(?=\s))\s*(\w+?)s?)\b/i;
  const match3 = cleaned.match(pattern3);
  
  if (match3) {
    const [fullMatch, alias, countStr, durationNum, durationUnit] = match3;
    
    try {
      const normalizedUnit = normalizeTimeUnit(alias);
      const intervalMs = UNIT_TO_MS[normalizedUnit];
      
      let count;
      if (countStr) {
        count = parseInt(countStr, 10);
      } else if (durationNum && durationUnit) {
        const durStr = durationNum.toLowerCase();
        const duration = (durStr === 'a' || durStr === 'an') ? 1 : parseInt(durationNum, 10);
        count = convertDurationToCount(duration, durationUnit, intervalMs);
      } else {
        return {
          error: ERROR_MESSAGES.MISSING_COUNT,
          pattern: 'alias_incomplete',
        };
      }
      
      // Extract base command by removing recurring pattern
      const baseCommand = cleaned.replace(fullMatch, '').trim();
      
      return {
        intervalMs,
        count,
        warnings: [],
        originalText: text,
        pattern: 'alias',
        baseCommand,
        intervalValue: 1,
        intervalUnit: normalizedUnit,
      };
    } catch (error) {
      return null;
    }
  }
  
  // Pattern 5: "every <unit>" without count (requires clarification)
  const incompletePattern = /\bevery\s+(?:\d+\s+)?(\w+?)s?\b/i;
  if (incompletePattern.test(cleaned)) {
    return {
      error: ERROR_MESSAGES.MISSING_COUNT,
      pattern: 'incomplete',
    };
  }
  
  // No recurring pattern detected
  return null;
}

/**
 * Validate parsed recurring syntax with constraint enforcement
 * @param {Object} parsed - Parsed recurring parameters
 * @returns {Object} - Validated parameters with warnings
 */
export function validateSyntax(parsed) {
  if (!parsed) {
    throw new Error(ERROR_MESSAGES.INVALID_SYNTAX);
  }
  
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  
  if (!parsed.intervalMs || !parsed.count) {
    throw new Error(ERROR_MESSAGES.PARSING_FAILED);
  }
  
  let { intervalMs, count } = parsed;
  const warnings = [...(parsed.warnings || [])];
  
  // Handle decimal intervals
  if (intervalMs % 1 !== 0) {
    warnings.push(ERROR_MESSAGES.DECIMAL_INTERVAL);
    intervalMs = Math.round(intervalMs - 0.01);
  }
  
  // Enforce minimum 60-second interval
  if (intervalMs < 60000) {
    if (!warnings.includes(ERROR_MESSAGES.SUB_60_SECONDS)) {
      warnings.push(ERROR_MESSAGES.SUB_60_SECONDS);
    }
    intervalMs = 60000;
  }
  
  // Check max count (100 payments per series)
  if (count > 100) {
    throw new Error('Whoa there sigma! 🛑 Max 100 payments per series. That\'s already mad rizz! 🤫');
  }
  
  // Check max duration (30 days)
  const durationMs = intervalMs * count;
  const maxDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (durationMs > maxDurationMs) {
    throw new Error('30-day max span, chief. That\'s already generational wealth behavior 📈');
  }
  
  return {
    intervalMs,
    count,
    warnings,
    baseCommand: parsed.baseCommand,
    originalText: parsed.originalText,
    pattern: parsed.pattern,
    ok: true,
  };
}

/**
 * Extract the base command by removing recurring pattern from text
 * @param {string} text - Original command text
 * @param {Object} parsed - Parsed recurring parameters
 * @returns {string} - Base command without recurring syntax
 */
export function extractBaseCommand(text, parsed) {
  if (!parsed || !parsed.originalText) {
    return text;
  }
  
  // Remove the recurring pattern based on what was matched
  let baseCommand = text;
  
  // Remove "every X unit Y times" pattern
  baseCommand = baseCommand.replace(/\bevery\s+(?:\d+(?:\.\d+)?\s+)?\w+?s?\s*,?\s*(?:for\s+)?\d+\s*times?\b/i, '').trim();
  
  // Remove "every X unit for Y unit" pattern
  baseCommand = baseCommand.replace(/\bevery\s+(?:\d+(?:\.\d+)?\s+)?\w+?s?\s*,?\s*for\s+(\d+|a|an)\s*\w+?s?\b/i, '').trim();
  
  // Remove alias patterns
  baseCommand = baseCommand.replace(/\b(daily|hourly|weekly|monthly)\s*,?\s*(?:\d+\s*times?|for\s+(\d+|a|an)\s*\w+?s?)\b/i, '').trim();
  
  return baseCommand;
}

/**
 * Parse and validate recurring command in one step
 * @param {string} text - The command text to parse
 * @returns {Object|null} - Validated recurring parameters or null if not recurring
 */
export function parseAndValidateRecurring(text) {
  const parsed = parseRecurringCommand(text);
  
  if (!parsed) {
    return null;
  }
  
  return validateSyntax(parsed);
}

/**
 * Check if a command text contains recurring pattern
 * @param {string} text - The command text to check
 * @returns {boolean} - True if recurring pattern detected
 */
export function isRecurringCommand(text) {
  if (!text) {
    return false;
  }
  
  const parsed = parseRecurringCommand(text);
  return parsed !== null && !parsed.error;
}

/**
 * Infer implicit count by adding "times" keyword if missing
 * @param {string} text - Command text
 * @returns {string} - Text with explicit "times" keyword
 */
export function inferImplicitCount(text) {
  // Pattern: "every X unit Y" where Y is a number not followed by "times"
  const implicitPattern = /(\bevery\s+(?:\d+\s+)?\w+?s?\s+)(\d+)\b(?!\s*times?\b)/i;
  
  if (implicitPattern.test(text)) {
    return text.replace(implicitPattern, '$1$2 times');
  }
  
  return text;
}

/**
 * Resolve conflicting parameters (count vs duration)
 * Prioritizes explicit count over duration
 * @param {string} text - Command text
 * @returns {string} - Text with conflicts resolved
 */
export function resolveConflictingParams(text) {
  // Pattern: "every X unit Y times for Z unit" - remove the duration part
  const conflictPattern = /(\bevery\s+(?:\d+\s+)?\w+?s?\s+\d+\s+times?)\s+for\s+\d+\s+\w+?s?\b/i;
  
  if (conflictPattern.test(text)) {
    return text.replace(conflictPattern, '$1');
  }
  
  return text;
}

/**
 * Apply all preprocessing steps to recurring command text
 * @param {string|null} text - Command text
 * @returns {string|null} - Preprocessed text
 */
export function preprocessRecurringText(text) {
  if (!text) {
    return null;
  }
  
  let processed = text.trim();
  
  // Normalize count/repetition synonyms
  processed = processed
    .replace(/\b(\d+)\s*(?:times?|payments?|rounds?|occurrences?|x|runs?|executions?)\b/gi, '$1 times')
    .replace(/\bx(\d+)\b/gi, '$1 times');

  // Normalize duration synonyms
  processed = processed
    .replace(/\b(?:lasting|over|during|for\s+a\s+period\s+of)\s+(\d+(?:\.\d+)?)\s*(\w+)/gi, 'for $1 $2');

  // Normalize "for a/an <unit>"
  processed = processed
    .replace(/\bfor\s+(?:an|a)\s+(\w+)\b/gi, 'for 1 $1');
  
  // Step 1: Infer implicit count
  processed = inferImplicitCount(processed);
  
  // Step 2: Resolve conflicting parameters
  processed = resolveConflictingParams(processed);
  
  return processed;
}
