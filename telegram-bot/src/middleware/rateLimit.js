const userCommandTimestamps = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = (userCommandTimestamps.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - timestamps[0])) / 1000);
    return { allowed: false, retryAfter };
  }

  timestamps.push(now);
  userCommandTimestamps.set(userId, timestamps);
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of userCommandTimestamps.entries()) {
    const fresh = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) userCommandTimestamps.delete(userId);
    else userCommandTimestamps.set(userId, fresh);
  }
}, 5 * 60 * 1000);
