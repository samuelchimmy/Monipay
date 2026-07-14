/**
 * MoniBot Discord - Rate Limiter Middleware
 * Tracks command timestamps per user. Configurable limits.
 */

import { RATE_LIMIT } from '../constants.js';

const userCommandTimestamps = new Map();

/**
 * Returns { allowed: true } if the user is within the rate limit.
 * Returns { allowed: false, retryAfter } (seconds) if they are over it.
 * @param {string} userId
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
export function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = (userCommandTimestamps.get(userId) || [])
    .filter(t => now - t < RATE_LIMIT.WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT.MAX_COMMANDS) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((RATE_LIMIT.WINDOW_MS - (now - oldest)) / 1000);
    return { allowed: false, retryAfter };
  }

  timestamps.push(now);
  userCommandTimestamps.set(userId, timestamps);
  return { allowed: true };
}

/**
 * Clean up stale rate limit entries to prevent memory leaks.
 * Call this on an interval.
 */
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [userId, timestamps] of userCommandTimestamps.entries()) {
    const fresh = timestamps.filter(t => now - t < RATE_LIMIT.WINDOW_MS);
    if (fresh.length === 0) {
      userCommandTimestamps.delete(userId);
    } else {
      userCommandTimestamps.set(userId, fresh);
    }
  }
}

/**
 * Start the cleanup interval. Returns the interval ID.
 */
export function startRateLimitCleanup() {
  return setInterval(cleanupRateLimits, RATE_LIMIT.CLEANUP_INTERVAL_MS);
}
