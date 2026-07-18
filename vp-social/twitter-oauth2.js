/**
 * MoniBot VP-Social - Twitter OAuth 2.0 Module (v5.0)
 *
 * FIX B4: No longer imports from database.js directly.
 *         getStoredRefreshToken / updateStoredRefreshToken are passed in
 *         or imported from the pure database.js (which has no Twitter imports).
 *
 * FIX B5: myUserId is resolved ONCE during initTwitterOAuth2() and cached
 *         at module level. The previous code called twitterClient.v2.me()
 *         inside shouldSkipSelfReply() on every queue item — burning through
 *         the 25 req/15min rate limit in under 3 minutes of active processing.
 *         Now it's called exactly once per bot lifetime / 90-min restart cycle.
 */

import { TwitterApi } from 'twitter-api-v2';
import { getStoredRefreshToken, updateStoredRefreshToken } from './database.js';

export let twitterClient;

// FIX B5: cached once at init, reused everywhere
export let myUserId = null;
export let myUsername = null;

// ============ Rate Limit Logging ============

function logRateLimits(endpoint, rateLimit) {
  if (!rateLimit) return;
  const { remaining, limit, reset } = rateLimit;
  const resetIn = reset ? Math.round((new Date(reset * 1000) - Date.now()) / 60000) : '?';
  const emoji   = remaining <= 5 ? '🔴' : remaining <= 15 ? '🟡' : '🟢';
  console.log(`📊 [${endpoint}] ${emoji} ${remaining}/${limit} remaining | resets in ${resetIn}min`);
  if (remaining <= 5) console.warn(`⚠️ Very low rate limit on ${endpoint}!`);
}

function logTwitterError(operation, error, text = '') {
  console.error(`\n❌ Twitter API Error [${operation}]: ${error.message}`);
  if (text) console.error(`   Tweet Length: ${text.length} chars`);
  if (error.code) console.error(`   Code: ${error.code}`);

  if (error.data) {
    console.error(`   Data:`, JSON.stringify(error.data, null, 2));
    if (error.data.detail) console.error(`   Detail: ${error.data.detail}`);
    if (error.data.reason) console.error(`   Reason: ${error.data.reason}`);
    if (error.data.errors) {
      error.data.errors.forEach((err, i) => {
        console.error(`   Error[${i}]: ${err.message} (${err.code || 'no code'})`);
      });
    }
  }

  if (error.rateLimit) {
    const { remaining, limit, reset } = error.rateLimit;
    const resetIn = reset ? Math.round((new Date(reset * 1000) - Date.now()) / 60000) : '?';
    console.error(`   📊 Rate Limits: ${remaining}/${limit} | Resets in ${resetIn}m`);
  } else if (error.headers) {
    // Log relevant headers if rateLimit object is missing
    const h = error.headers;
    const rem = h['x-rate-limit-remaining'] || h['x-app-limit-24hour-remaining'];
    const lim = h['x-rate-limit-limit'] || h['x-app-limit-24hour-limit'];
    if (rem) console.error(`   📊 Raw Limits: ${rem}/${lim}`);
  }

  if (error.code === 429 || error.data?.status === 429) {
    console.error(`   🚫 RATE LIMITED.`);
  }

  if (error.code === 401 || error.code === 403) {
    console.error('   🔐 Auth issue or Forbidden. Check credentials, token expiry, or API limits.');
  }
}

// ============ Initialization ============

/**
 * Initializes the Twitter client with OAuth 2.0 token refresh.
 * FIX B5: Also fetches and caches myUserId so shouldSkipSelfReply()
 *         doesn't need to call me() on every queue item.
 */
export async function initTwitterOAuth2() {
  console.log('🔑 Initializing Twitter OAuth 2.0...');
  const refreshToken = await getStoredRefreshToken();

  if (!refreshToken) {
    console.error('❌ Twitter Refresh Token missing in bot_settings. Cannot authenticate.');
    return;
  }

  const tempClient = new TwitterApi({
    clientId:     process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  });

  try {
    console.log('   Refreshing token...');
    const { client: refreshedClient, refreshToken: newRefreshToken } = await tempClient.refreshOAuth2Token(refreshToken);
    twitterClient = refreshedClient;
    await updateStoredRefreshToken(newRefreshToken);
    console.log('✅ Twitter OAuth 2.0 initialized and token refreshed.');

    // FIX B5: resolve once, cache, never call again in loops
    console.log('   Fetching bot identity...');
    const me = await twitterClient.v2.me();
    myUserId   = me.data.id;
    myUsername = me.data.username;
    console.log(`✅ Bot identity cached: @${myUsername} (${myUserId})`);

  } catch (error) {
    console.error('❌ Failed to refresh Twitter token:', error.message);
  }
}

// ============ Utility ============

/**
 * Ensures tweet text is unique and fits within 280 characters.
 */
export function finalizeTweetText(text) {
  if (!text) return '';

  const timestamp = `[${new Date().toLocaleTimeString('en-GB', { hour12: false })}]`;
  const suffix = ` ${timestamp}`;
  const MAX_LEN = 280;

  if (text.length + suffix.length <= MAX_LEN) {
    return text + suffix;
  }

  // Truncate to fit text + ellipsis + suffix
  const availableLen = MAX_LEN - suffix.length - 3; // 3 for "..."
  return text.substring(0, availableLen) + '...' + suffix;
}

// ============ Posting ============

export async function postTweet(text) {
  if (!twitterClient) throw new Error('Twitter client not initialized.');
  const finalText = finalizeTweetText(text);
  console.log(`📤 Posting tweet (${finalText.length} chars): ${finalText.substring(0, 50)}...`);

  try {
    const result = await twitterClient.v2.tweet(finalText);
    logRateLimits('POST /tweets', result.rateLimit);
    return result.data.id;
  } catch (error) {
    logTwitterError('postTweet', error, finalText);
    throw error;
  }
}

export async function replyToTweet(tweetId, text) {
  if (!twitterClient) throw new Error('Twitter client not initialized.');
  const finalText = finalizeTweetText(text);
  console.log(`📤 Replying to ${tweetId} (${finalText.length} chars): ${finalText.substring(0, 50)}...`);

  try {
    const result = await twitterClient.v2.tweet(finalText, { reply: { in_reply_to_tweet_id: tweetId } });
    logRateLimits('POST /tweets (reply)', result.rateLimit);
    return result.data.id;
  } catch (error) {
    logTwitterError('replyToTweet', error, finalText);
    throw error;
  }
}

/**
 * Fetch a single tweet for self-reply detection.
 * Uses cached myUserId — no extra me() call needed.
 */
/**
 * Fetch a single tweet's metadata (author and creation time).
 */
export async function getTweetMetadata(tweetId) {
  if (!twitterClient) return null;
  try {
    const tweet = await twitterClient.v2.singleTweet(tweetId, {
      'tweet.fields': ['author_id', 'created_at', 'text'],
    });
    return tweet.data || null;
  } catch (e) {
    if (e.code === 403 || e.data?.status === 403) return { id: tweetId, restricted: true };
    console.warn(`⚠️ Could not fetch tweet ${tweetId}: ${e.message}`);
    return null;
  }
}

/**
 * Fetch a single tweet for self-reply detection.
 * Uses cached myUserId — no extra me() call needed.
 */
export async function isSelfTweet(tweetId) {
  if (!twitterClient || !myUserId) return false;
  const data = await getTweetMetadata(tweetId);
  if (!data) return false;
  if (data.restricted) return true; // treat unavailable as skip
  return data.author_id === myUserId;
}
