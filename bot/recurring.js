import { getSupabase, logTransaction } from './database.js';
import { fetchTwitterNumericId } from './twitter.js';
import { getProfileByXUsername, getProfileByMonitag } from './database.js';
import { randomUUID } from 'crypto';
import { normalizeChain } from './chains.js';

const TIME_UNITS = {
  s: 'second', sec: 'second', secs: 'second', second: 'second', seconds: 'second',
  m: 'minute', min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute',
  h: 'hour', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour', hourly: 'hour',
  d: 'day', day: 'day', days: 'day', daily: 'day',
  w: 'week', wk: 'week', week: 'week', weeks: 'week', weekly: 'week',
  mo: 'month', mos: 'month', month: 'month', months: 'month', monthly: 'month',
};

const UNIT_TO_MS = {
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 86400000,
  week: 604800000,
  month: 2592000000,
};

export const ERROR_MESSAGES = {
  INVALID_SYNTAX: "That syntax is giving Ohio energy 🌽 Try: '@monibot send $5 to @alice every day 5 times'",
  MISSING_COUNT: "Yo blud, how many times tho? 🤔 Add something like '5 times' or 'for 1 week'",
  MISSING_INTERVAL: "Every what tho? 💀 Specify like 'every day' or 'every 2 hours'",
  PARSING_FAILED: "Command parsing failed. Stop being delulu with that syntax 🤡",
  SUB_60_SECONDS: "Blud tried to go sub-60 seconds 💀",
  DOW_NOT_SUPPORTED: "Day-of-week scheduling (like 'every Monday') ain't supported yet chief 🚫 Try intervals instead",
  DECIMAL_INTERVAL: "Decimal intervals? Nah fam 🙅 Rounded to nearest whole number",
};

export const VALIDATION_ERRORS = {
  MAX_COUNT_EXCEEDED: "Whoa there sigma! 🛑 Max 100 payments per series. That's already mad rizz! 🤫",
  MIN_INTERVAL_TOO_LOW: "Minimum interval is 60 seconds due to executor granularity 🕐",
  MAX_DURATION_EXCEEDED: "30-day max span, chief. That's already generational wealth behavior 📈",
  INSUFFICIENT_BALANCE: (required, available) => 
    `Heads up! 💰 Total series costs $${required} but you've got $${available}. Series queued but might fail at execution time 📉`,
  INVALID_INTERVAL: "Interval must be a positive number, stop the cap 🧢",
  INVALID_COUNT: "Count must be a positive integer, no cap 🚫",
  EXTREME_VALUES: "Those numbers looking sus fam 👀 Keep it reasonable",
};

const RECURRING_PATTERN = /\bevery\s+(?:(\d+(?:\.\d+)?)\s*)?(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?\s*,?\s*(?:(?:for\s+)?(\d+)\s*times?|for\s+(\d+|(?:an|a)(?=\s))\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?)\b/i;
const RECURRING_ALIAS = /\b(daily|hourly|weekly|monthly)\s*,?\s*(?:(?:for\s+)?(\d+)\s*times?|for\s+(\d+|(?:an|a)(?=\s))\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?)\b/i;

export function normalizeTimeUnit(unit) {
  const normalized = TIME_UNITS[unit.toLowerCase()];
  if (!normalized) throw new Error(`Unknown time unit: ${unit}`);
  return normalized;
}

export function convertDurationToCount(value, unit, intervalMs) {
  if (value <= 0) throw new Error('Invalid duration value');
  const normalizedUnit = normalizeTimeUnit(unit);
  const durationMs = value * UNIT_TO_MS[normalizedUnit];
  const count = Math.floor(durationMs / intervalMs);
  return count > 0 ? count : 1;
}

export function parseRecurringCommand(text) {
  if (!text) return null;
  const cleanedOriginal = text.trim();
  
  const dowPattern = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  if (dowPattern.test(cleanedOriginal)) {
    throw new Error('DOW scheduling not supported in v1');
  }
  
  let processed = preprocessRecurringText(text);
  if (!processed) return null;
  
  const match1 = processed.match(RECURRING_PATTERN);
  if (match1) {
    const [fullMatch, intervalNum, unit, countStr, durationNum, durationUnit] = match1;
    const interval = intervalNum ? parseFloat(intervalNum) : 1;
    
    try {
      const normalizedUnit = normalizeTimeUnit(unit);
      let intervalMs = Math.round(interval * UNIT_TO_MS[normalizedUnit]);
      
      let count;
      if (countStr) {
        count = parseInt(countStr, 10);
      } else if (durationNum && durationUnit) {
        const durStr = durationNum.toLowerCase();
        const duration = (durStr === 'a' || durStr === 'an') ? 1 : parseInt(durationNum, 10);
        count = convertDurationToCount(duration, durationUnit, intervalMs);
      } else {
        return { error: ERROR_MESSAGES.MISSING_COUNT, pattern: 'numeric_interval_incomplete' };
      }
      
      const warnings = [];
      if (interval % 1 !== 0) warnings.push(ERROR_MESSAGES.DECIMAL_INTERVAL);
      if (intervalMs < 60000) {
        warnings.push(ERROR_MESSAGES.SUB_60_SECONDS);
        intervalMs = 60000;
      }
      
      const baseCommand = processed.replace(fullMatch, '').trim();
      return {
        intervalMs, count, warnings, originalText: text, pattern: 'numeric_interval',
        baseCommand, intervalValue: interval, intervalUnit: normalizedUnit
      };
    } catch (e) { return null; }
  }
  
  const match2 = processed.match(RECURRING_ALIAS);
  if (match2) {
    const [fullMatch, alias, countStr, durationNum, durationUnit] = match2;