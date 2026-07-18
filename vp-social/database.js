/**
 * MoniBot VP-Social - Database Module (v5.0)
 *
 * FIX B4: Circular import eliminated.
 *
 * The previous version imported from gemini.js and twitter-oauth2.js:
 *   import { generateReplyWithBackoff } from './gemini.js'
 *   import { replyToTweet, twitterClient } from './twitter-oauth2.js'
 *
 * And twitter-oauth2.js imported back:
 *   import { supabase } from './database.js'
 *
 * In Node.js ESM this creates a cycle where one module gets an empty
 * object at init time. The symptom: supabase is undefined inside
 * twitter-oauth2.js when getStoredRefreshToken() is called on cold start,
 * crashing the bot before any tweets are ever processed.
 *
 * Fix: database.js is now a pure data layer — no Twitter, no Gemini.
 * All queue processing logic has moved to socialQueue.js which imports
 * from all three modules cleanly with no cycle.
 */

import { createClient } from '@supabase/supabase-js';

export let supabase;

export function initSupabase() {
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class {};
  }
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  console.log('✅ Supabase initialized [VP-Social] 🗿');
}

export function getSupabase() {
  return supabase;
}

// ============ Raw DB Reads ============

/**
 * Fetch unreplied transactions that haven't hit the retry cap.
 * VP-Social reads these to generate and post replies.
 */
export async function getUnrepliedTransactions(limit = 5, maxRetries = 3) {
  const { data, error } = await supabase
    .from('monibot_transactions')
    .select('*')
    .eq('replied', false)
    .eq('platform', 'twitter')
    .lt('retry_count', maxRetries)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Check if a tweet already has a reply recorded in the database.
 */
export async function isTweetAlreadyReplied(tweetId, currentTxHash) {
  if (!tweetId) return false;
  
  let query = supabase
    .from('monibot_transactions')
    .select('id')
    .eq('tweet_id', tweetId)
    .eq('replied', true);

  if (currentTxHash === 'SPORTS_CREATE') {
    // For creation transaction, look for existing replied creation transaction
    query = query.eq('tx_hash', 'SPORTS_CREATE');
  } else {
    // For resolution/other transactions, look for existing replied resolution/other transaction
    query = query.neq('tx_hash', 'SPORTS_CREATE');
  }

  const { data, error } = await query.limit(1);

  if (error) {
    console.warn(`  ⚠️ Error checking tweet ${tweetId} status: ${error.message}`);
    return false;
  }
  return data.length > 0;
}

/**
 * Fetch completed scheduled jobs that haven't had their social post yet.
 */
export async function getJobsPendingSocialPost(limit = 5) {
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(Math.max(20, limit * 2));

  if (error) throw error;

  // Filter in JS — avoids complex Supabase JSON path queries
  return (data || [])
    .filter(j => {
      const sp = j.result?.social_posted;
      return sp !== true && sp !== 'true';
    })
    .filter(j => j.result?.ready_for_social)
    .filter(j => j.payload?.platform === 'twitter')
    .slice(0, limit);
}

// ============ DB Writes ============

export async function markTransactionReplied(transactionId, skipReason = null) {
  const update = { replied: true };
  if (skipReason) update.error_reason = skipReason;
  await supabase.from('monibot_transactions').update(update).eq('id', transactionId);
}

/**
 * Mark all transactions associated with a specific tweet as replied.
 * Used to ensure we only reply once per tweet.
 */
export async function markTweetTransactionsReplied(tweetId, skipReason = null) {
  if (!tweetId) return;
  const update = { replied: true };
  if (skipReason) update.error_reason = skipReason;
  await supabase.from('monibot_transactions')
    .update(update)
    .eq('tweet_id', tweetId)
    .eq('platform', 'twitter');
}

export async function incrementTransactionRetry(transactionId) {
  try {
    const { data: tx, error: fetchError } = await supabase
      .from('monibot_transactions').select('retry_count').eq('id', transactionId).single();
    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase.from('monibot_transactions')
      .update({ retry_count: (tx?.retry_count || 0) + 1 })
      .eq('id', transactionId);
    if (updateError) throw updateError;
  } catch (err) {
    console.error(`  ❌ Failed to increment retry for ${transactionId}:`, err.message);
  }
}

export async function cleanupExceededRetries(maxRetries = 3) {
  const { data: exceeded } = await supabase
    .from('monibot_transactions')
    .select('id').eq('replied', false).gte('retry_count', maxRetries).limit(10);
  if (exceeded) {
    for (const tx of exceeded) await markTransactionReplied(tx.id, 'MAX_RETRIES_EXCEEDED');
  }
}

export async function markScheduledJobSocialPosted(jobId, tweetId = null) {
  const { data: job } = await supabase.from('scheduled_jobs').select('result').eq('id', jobId).single();
  await supabase.from('scheduled_jobs').update({
    result: {
      ...job?.result,
      social_posted:    true,
      social_tweet_id:  tweetId,
      social_posted_at: new Date().toISOString(),
    },
  }).eq('id', jobId);
}

export async function skipScheduledJob(jobId, reason) {
  const { data: job } = await supabase.from('scheduled_jobs').select('result').eq('id', jobId).single();
  await supabase.from('scheduled_jobs').update({
    result: { ...job?.result, social_posted: true, social_skipped: true, skip_reason: reason },
  }).eq('id', jobId);
}

export async function updateMissionStats(tx) {
  if (!tx.tx_hash?.startsWith('0x')) return;
  try {
    await supabase.rpc('increment_mission_stats', {
      amount_spent: tx.amount + tx.fee,
      user_id:      tx.receiver_id,
    });
  } catch (_) {
    const { data: stats } = await supabase.from('monibot_mission_stats').select('*').single();
    if (stats) {
      await supabase.from('monibot_mission_stats').update({
        spent_budget:  stats.spent_budget + tx.amount + tx.fee,
        current_users: stats.current_users + 1,
      }).eq('id', 1);
    }
  }
}

// ============ Token Management ============

export async function getStoredRefreshToken() {
  const { data } = await supabase
    .from('bot_settings').select('value').eq('key', 'twitter_refresh_token').maybeSingle();
  return data?.value;
}

export async function updateStoredRefreshToken(newToken) {
  const { error } = await supabase
    .from('bot_settings').upsert({ key: 'twitter_refresh_token', value: newToken }, { onConflict: 'key' });
  if (error) console.error('❌ Failed to update refresh token:', error.message);
}

// ============ Feedback Prompts ============

/**
 * Check if a user qualifies for a feedback prompt.
 * Criteria:
 * 1. Lifetime volume >= $10 OR last 5 transactions were successful (have tx_hash).
 * 2. User hasn't been prompted in the last 7 days.
 */
export async function checkUserQualifiesForFeedback(senderId) {
  if (!senderId) return false;

  try {
    // 1. Check for prompt in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPrompt, error: promptError } = await supabase
      .from('feedback_prompts')
      .select('id')
      .eq('user_id', senderId)
      .gt('prompted_at', sevenDaysAgo)
      .limit(1);

    if (promptError) {
      // If table doesn't exist or other error, we log and skip for safety
      console.warn(`  ⚠️ Error checking feedback_prompts: ${promptError.message}`);
      return false;
    }
    if (recentPrompt && recentPrompt.length > 0) return false;

    // 2. Check lifetime volume (sum of amount >= 10 for successful txs)
    const { data: volumeData, error: volumeError } = await supabase
      .from('monibot_transactions')
      .select('amount, tx_hash')
      .eq('sender_id', senderId)
      .not('tx_hash', 'is', null);

    if (volumeError) throw volumeError;

    const totalVolume = (volumeData || []).reduce((sum, tx) => {
      // Ensure we only sum actual successful hashes
      if (tx.tx_hash === 'LIMIT_REACHED' || tx.tx_hash?.startsWith('ERROR')) return sum;
      return sum + (parseFloat(tx.amount) || 0);
    }, 0);
    if (totalVolume >= 10) return true;

    // 3. Check if last 5 txs were successful
    const { data: lastTxs, error: lastTxsError } = await supabase
      .from('monibot_transactions')
      .select('tx_hash')
      .eq('sender_id', senderId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (lastTxsError) throw lastTxsError;

    if (lastTxs && lastTxs.length === 5) {
      const allSuccessful = lastTxs.every(tx => tx.tx_hash && tx.tx_hash.startsWith('0x'));
      if (allSuccessful) return true;
    }

    return false;
  } catch (error) {
    console.error(`  ❌ checkUserQualifiesForFeedback error for ${senderId}:`, error.message);
    return false;
  }
}

/**
 * Record that a feedback prompt was sent to a user.
 */
export async function logFeedbackPrompt(userId, txHash) {
  const { error } = await supabase
    .from('feedback_prompts')
    .insert({
      user_id: userId,
      tx_hash: txHash,
      prompted_at: new Date().toISOString()
    });
  if (error) console.error(`  ❌ Failed to log feedback prompt: ${error.message}`);
}
