/**
 * MoniBot VP-Social - Social Queue Processor (v6.0)
 *
 * FIX B4: This file was split out of database.js to break the circular import.
 *
 * Previously database.js imported from gemini.js and twitter-oauth2.js,
 * while twitter-oauth2.js imported supabase from database.js. This caused
 * supabase to be undefined on cold start.
 *
 * Now:
 *   database.js       -> pure Supabase reads/writes (no Twitter, no Gemini)
 *   twitter-oauth2.js -> pure Twitter posting (imports database.js for token storage only)
 *   gemini.js         -> pure AI reply generation
 *   socialQueue.js    -> imports ALL THREE cleanly, no cycle
 *
 * index.js imports processSocialQueue and processScheduledJobs from HERE,
 * not from database.js.
 */

import {
  getSupabase,
  getUnrepliedTransactions,
  getJobsPendingSocialPost,
  isTweetAlreadyReplied,
  markTransactionReplied,
  markTweetTransactionsReplied,
  incrementTransactionRetry,
  cleanupExceededRetries,
  checkUserQualifiesForFeedback,
  logFeedbackPrompt,
  markScheduledJobSocialPosted,
  skipScheduledJob,
  updateMissionStats,
} from './database.js';
import { generateReplyWithBackoff, generateWinnerAnnouncement } from './gemini.js';
import { replyToTweet, postTweet, myUserId, myUsername, getTweetMetadata } from './twitter-oauth2.js';
import { generateUniqueCampaignTweet } from './campaigns.js';

const MAX_RETRY_COUNT = 3;

// ── Command Intentionality Check ─────────────────────────────────────────────
const COMMAND_VERBS = [
  'send', 'sent', 'tip', 'give', 'gave', 'drop', 'pay', 'paid', 'transfer', 'grant',
  'claim', 'slide', 'bless', 'hookup', 'deposit', 'withdraw', 'balance', 'vault',
  'settings', 'link', 'register', 'signup', 'help', 'allowance', 'faucet', 'airdrop',
  'ape', 'shill', 'sweep', 'gas', 'bridge', 'mint', 'cancel', 'stop', 'bet', 'status', 'series', 'my', 'setup', 'set-chain', 'set', 'leaderboard', 'top', 'about', 'command', 'commands',
  'win', 'wins', 'beat', 'beats', 'draw', 'draws', 'drew', 'lose', 'loses', 'lost',

  // Nigerian Pidgin & Slang Commands
  'dash', 'wire', 'sama', 'nak', 'vasa', 'splash', 'bundle', 'load', 'show', 'hammer',
  'slap', 'settle', 'spray', 'buss'
];

/**
 * Verifies if a tweet is likely an intentional command by checking for the
 * bot's handle and at least one command verb in the tweet text.
 */
function isLikelyIntentionalCommand(text, botUsername) {
  if (!text || !botUsername) return false;
  const lowerText = text.toLowerCase();
  const lowerHandle = `@${botUsername.toLowerCase()}`;

  // 1. Must explicitly contain the bot's handle in the text
  // (Twitter's "in_reply_to" metadata doesn't count as being in the text)
  const handleRegex = new RegExp(`${lowerHandle}\\b`, 'i');
  const handleMatch = lowerText.match(handleRegex);
  if (!handleMatch) return false;

  // 2. Must contain at least one command verb (with word boundaries)
  const hasVerb = COMMAND_VERBS.some(verb => {
    // If the verb ends in 'e', we handle 'ing' by dropping 'e' (e.g. give -> giving)
    const pattern = verb.endsWith('e')
      ? `\\b(${verb}(s|d)?|${verb.slice(0, -1)}ing)\\b`
      : `\\b${verb}(s|ed|ing)?\\b`;
    const regex = new RegExp(pattern, 'i');

    const verbMatch = lowerText.match(regex);
    if (!verbMatch) return false;

    // Command heuristic: verb should be AFTER the handle OR at the very start of the tweet.
    // This avoids replying to "I'm giving @monibot a high five"
    if (verbMatch.index > handleMatch.index) return true;
    if (verbMatch.index < 3) return true;

    return false;
  });

  return hasVerb;
}
const FRESHNESS_THRESHOLD_MS = parseInt(process.env.SOCIAL_FRESHNESS_THRESHOLD_MS) || (30 * 60 * 1000); // 30 minutes

// ── Rate limit state ─────────────────────────────────────────────────────────
const RL = {
  lastReplyAt: 0,
  minSpacingMs: 30 * 1000,
  consecutive403s: 0,
  pausedUntil: 0,
};

function checkRateLimit() {
  const now = Date.now();

  if (RL.pausedUntil > now) {
    const remainingMin = Math.ceil((RL.pausedUntil - now) / 60000);
    console.log(`  🛑 Circuit Breaker: Paused for ${remainingMin}m due to consecutive 403s.`);
    return { allowed: false, reason: 'CIRCUIT_BREAKER' };
  }

  const elapsed = now - RL.lastReplyAt;
  if (elapsed < RL.minSpacingMs) {
    const waitSec = Math.ceil((RL.minSpacingMs - elapsed) / 1000);
    console.log(`  ⏳ Spacing replies. ${waitSec}s remaining.`);
    return { allowed: false, reason: 'SPACING' };
  }

  return { allowed: true };
}

function recordReply() {
  RL.lastReplyAt = Date.now();
  console.log('📊 Reply recorded. 30s cooldown started.');
}

function isSportsTransaction(tx) {
  if (tx.tx_hash === 'SPORTS_CONDITION_CANCELLED' || tx.tx_hash === 'SPORTS_CREATE' || tx.tx_hash === 'SPORTS_CANCEL') {
    return true;
  }
  if (tx.error_reason) {
    try {
      const parsed = JSON.parse(tx.error_reason);
      if (parsed && (parsed.event === 'SPORTS_CONDITION_MET' || parsed.match)) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

// ============ Social Queue: Transaction Replies ============

export async function processSocialQueue() {
  try {
    console.log('📬 Checking Social Queue...');
    const queue = await getUnrepliedTransactions(5, MAX_RETRY_COUNT);

    if (!queue.length) {
      console.log('  Queue empty.');
      return;
    }
    console.log(`  ${queue.length} unreplied transaction(s).`);

    for (const tx of queue) {
      // ── Freshness check ───────────────────────────────────────────────────
      const ageMs = Date.now() - new Date(tx.created_at).getTime();
      const isSports = isSportsTransaction(tx);
      if (!isSports && ageMs > FRESHNESS_THRESHOLD_MS) {
        console.log(`  ⏭️ Skipping old transaction: ${tx.id.substring(0, 8)} (${Math.round(ageMs / 60000)}m old)`);
        await markTransactionReplied(tx.id, 'SKIPPED_TOO_OLD');
        continue;
      }

      if (!tx.tweet_id) {
        console.log(`  ⏭️ No tweet_id on ${tx.id.substring(0, 8)} — skipping (non-Twitter tx).`);
        await markTransactionReplied(tx.id, 'SKIPPED_NO_TWEET_ID');
        continue;
      }

      // ── Optimization: Skip Read if Retrying Generic 403 ────────────────────
      // If we've already tried this before and hit a 403, we know it's unreplied
      // in our DB. Re-fetching metadata burns 1 Read credit.
      // We only fetch for fresh items (retry_count === 0).
      let tweetMeta = null;
      if (tx.retry_count > 0) {
        console.log(`  🔄 Retry ${tx.retry_count} for ${tx.id.substring(0, 8)}. Skipping metadata read to save quota.`);
        // Synthetic meta: assume it's still intentional if we got this far
        tweetMeta = { id: tx.tweet_id, text: tx.payload?.text || 'Intentional payment command', retry: true };
      } else {
        tweetMeta = await getTweetMetadata(tx.tweet_id);
      }

      if (!tweetMeta) {
        console.warn(`  ⚠️ Could not verify tweet ${tx.tweet_id} (API error). Retrying later.`);
        await incrementTransactionRetry(tx.id);
        continue;
      }

      // ── Intentionality Check ──────────────────────────────────────────────
      // Skip check if it's a retry, as we already validated it once.
      const outcome = tx.tx_hash || '';
      const isBypass = 
        outcome.startsWith('0x') ||
        outcome.startsWith('ERROR_') ||
        [
          'HELP_SHOW', 'SETUP_SHOW', 'LINK_SHOW', 'ABOUT_SHOW', 'COMMANDS_LIST_SHOW',
          'SET_CHAIN_SUCCESS', 'LEADERBOARD_SHOW', 'SKIP_NO_PAYTAG', 'SKIP_INVALID_SYNTAX',
          'SKIP_CAMPAIGN_INACTIVE', 'SPORTS_CONDITION_CANCELLED', 'SPORTS_CREATE',
          'SPORTS_CANCEL', 'RECURRING_CREATE', 'RECURRING_STATUS', 'RECURRING_CANCEL',
          'RECURRING_LIST', 'SCHEDULE_CREATE'
        ].includes(outcome);

      if (!tweetMeta.retry && !isBypass && !isLikelyIntentionalCommand(tweetMeta.text, myUsername)) {
        console.log(`  ⏭️ Skipping unintentional tweet: ${tx.id.substring(0, 8)} | Text: "${tweetMeta.text?.replace(/\n/g, ' ')}"`);
        await markTweetTransactionsReplied(tx.tweet_id, 'SKIPPED_UNINTENTIONAL_REPLY');
        continue;
      }

      if (await shouldSkipSelfReply(tx, tweetMeta)) {
        console.log(`  ⏭️ Skipping self-reply: ${tx.id.substring(0, 8)}`);
        await markTransactionReplied(tx.id, 'SKIPPED_SELF_REPLY_PROTECTION');
        continue;
      }

      const processed = await processQueueItem(tx, tweetMeta);
      // If we successfully sent a reply, we stop the loop to maintain 30s spacing
      // since the loop itself is called every 30s.
      if (processed) {
        console.log('  ⏹️ One reply sent this cycle. Stopping queue processing.');
        break;
      }
    }

    await cleanupExceededRetries(MAX_RETRY_COUNT);
  } catch (error) {
    console.error('❌ processSocialQueue error:', error.message);
  }
}

/**
 * FIX B5: shouldSkipSelfReply no longer calls twitterClient.v2.me() — it uses
 * the cached myUserId from twitter-oauth2.js (resolved once at init).
 * Saves ~5 me() calls per minute at default polling interval.
 */
async function shouldSkipSelfReply(tx, tweetMeta) {
  if (!tx.tweet_id) return false;
  if (!myUserId) return false;

  if (tweetMeta.restricted) return true;
  return tweetMeta.author_id === myUserId;
}

async function processQueueItem(tx, tweetMeta) {
  try {
    const rl = checkRateLimit();
    if (!rl.allowed) return false;

    // ── Database-level Already Replied Check ──────────────────────────────
    const alreadyReplied = await isTweetAlreadyReplied(tx.tweet_id, tx.tx_hash);
    if (alreadyReplied) {
      console.log(`  ⏭️ Tweet ${tx.tweet_id} already replied — skipping duplicate.`);
      await markTweetTransactionsReplied(tx.tweet_id, 'SKIPPED_ALREADY_REPLIED');
      return false;
    }

    // ── Twitter-level Freshness Check ───────────────────────────────────────
    if (tweetMeta) {
      if (tweetMeta.restricted) {
        console.log(`  ⏭️ Tweet ${tx.tweet_id} is restricted/deleted — skipping.`);
        await markTweetTransactionsReplied(tx.tweet_id, 'SKIPPED_TWEET_RESTRICTED');
        return false;
      }

      if (tweetMeta.created_at) {
        const tweetAgeMs = Date.now() - new Date(tweetMeta.created_at).getTime();
        const isSports = isSportsTransaction(tx);
        if (!isSports && tweetAgeMs > FRESHNESS_THRESHOLD_MS) {
          console.log(`  ⏭️ Skipping old tweet: ${tx.tweet_id} (${Math.round(tweetAgeMs / 60000)}m old)`);
          await markTweetTransactionsReplied(tx.tweet_id, 'SKIPPED_TOO_OLD_TWEET');
          return false;
        }
      }
    }

    console.log(`\n💬 Reply: ${tx.id.substring(0, 8)} | ${tx.type} | ${tx.tx_hash?.substring(0, 20)}`);

    let replyText = await generateReplyWithBackoff(tx);

    // ── Duplicate Protection: Variation ───────────────────────────────────
    const variations = ['🗿', '✨', '🫡', '🔥', '💎', '🚀', '🤝', '✅', '🗿🗿', '🍷', '📈', '⚡'];
    const randomSigma = variations[Math.floor(Math.random() * variations.length)];

    // Add a randomized emoji and a sequence of zero-width characters for uniqueness
    // \u200B = Zero Width Space, \u200C = Zero Width Non-Joiner, \u200D = Zero Width Joiner
    const stealth = ['\u200B', '\u200C', '\u200D'];
    const randomStealth = Array.from({ length: 3 }, () => stealth[Math.floor(Math.random() * stealth.length)]).join('');

    replyText = `${replyText.trim()} ${randomSigma}${randomStealth}`;

    console.log(`   Text: ${replyText.substring(0, 100)}...`);

    try {
      const replyTweetId = await replyToTweet(tx.tweet_id, replyText);
      // Mark ALL transactions for this tweet as replied IMMEDIATELY after posting
      // to minimize race conditions.
      await markTweetTransactionsReplied(tx.tweet_id);
      recordReply();
      RL.consecutive403s = 0; // Reset on success
      console.log(`   ✅ Replied to ${tx.tweet_id}`);

      // ── Optional Feedback Prompt ──────────────────────────────────────────
      await maybeSendFeedbackPrompt(tx, replyTweetId);

    } catch (twitterError) {
      // ── Refined 403 Error Handling ─────────────────────────────────────
      const is403 = twitterError.code === 403 || twitterError.data?.status === 403 || twitterError.message?.includes('403');

      if (is403) {
        RL.consecutive403s++;
        if (RL.consecutive403s >= 3) {
          const pauseDuration = 60 * 60 * 1000; // 1 hour
          RL.pausedUntil = Date.now() + pauseDuration;
          console.warn(`  🚨 3 consecutive 403s! Pausing social queue for 1 hour.`);
        }

        const errorData = twitterError.data || {};
        const errorDetail = (errorData.detail || '').toLowerCase();
        const errorReason = (errorData.reason || '').toLowerCase();
        const errorMessages = (errorData.errors || []).map(e => (e.message || '').toLowerCase()).join(' ');

        const isDeleted = errorDetail.includes('deleted') ||
                          errorDetail.includes('not found') ||
                          errorDetail.includes('unavailable') ||
                          errorReason.includes('deleted') ||
                          errorMessages.includes('not found') ||
                          errorMessages.includes('deleted');

        // If it's explicitly deleted or hidden, skip it.
        if (isDeleted) {
          console.log('   ⚠️ 403: Tweet deleted/hidden. Marking all related transactions as done.');
          await markTweetTransactionsReplied(tx.tweet_id, 'SKIPPED_403_TWEET_UNAVAILABLE');
          return false;
        } else {
          // If it's a generic 403 (could be daily limit or temporary block),
          // increment retry and DON'T skip yet.
          console.log('   ⚠️ 403: Forbidden (Limits?). Retrying later.');
          await incrementTransactionRetry(tx.id);
          return false;
        }
      }

      await incrementTransactionRetry(tx.id);
      throw twitterError;
    }

    await updateMissionStats(tx);
    return true;
  } catch (error) {
    console.error(`   ❌ Error processing ${tx.id}:`, error.message);
    const skipPatterns = ['403', 'deleted', 'not visible', 'Tweet not found', 'blocked'];
    const isSkippable = skipPatterns.some(p => JSON.stringify(error).toLowerCase().includes(p));
    if (isSkippable) {
      await markTransactionReplied(tx.id, `SKIPPED_ERROR: ${error.message?.substring(0, 50)}`);
    } else {
      await incrementTransactionRetry(tx.id);
    }
  }
}

// ============ Scheduled Jobs: Social Announcements ============

export async function processScheduledJobs() {
  try {
    console.log('⏰ Checking Scheduled Jobs...');
    const jobs = await getJobsPendingSocialPost(5);

    if (!jobs.length) {
      console.log('  No jobs pending social post.');
      return;
    }
    console.log(`  ${jobs.length} job(s) ready for social post.`);

    for (const job of jobs) {
      // ── Freshness check ───────────────────────────────────────────────────
      const ageMs = Date.now() - new Date(job.completed_at).getTime();
      if (ageMs > FRESHNESS_THRESHOLD_MS) {
        console.log(`  ⏭️ Skipping old job: ${job.id.substring(0, 8)} (${Math.round(ageMs / 60000)}m old)`);
        await skipScheduledJob(job.id, 'SKIPPED_TOO_OLD');
        continue;
      }

      await processScheduledJob(job);
    }
  } catch (error) {
    console.error('❌ processScheduledJobs error:', error.message);
  }
}

async function processScheduledJob(job) {
  const rl = checkRateLimit();
  if (!rl.allowed) return;

  const supabase = getSupabase();
  const attempts = (job.result?.social_attempts || 0) + 1;

  if (attempts > 3) {
    await skipScheduledJob(job.id, `MAX_SOCIAL_ATTEMPTS: failed after ${attempts - 1} tries`);
    return;
  }

  const { data: current } = await supabase
    .from('scheduled_jobs')
    .select('result')
    .eq('id', job.id)
    .single();

  await supabase.from('scheduled_jobs').update({
    result: {
      ...current?.result,
      social_attempts: attempts,
    },
  }).eq('id', job.id);

  try {
    console.log(`\n📢 Social post for job: ${job.type} (${job.id.substring(0, 8)})`);
    let tweetId = null;

    // Skip campaigns if auto-campaigns are disabled
    if (job.type === 'campaign_post' && process.env.ENABLE_AUTO_CAMPAIGNS !== 'true') {
      console.log(`  ⏭️ Skipping campaign job — ENABLE_AUTO_CAMPAIGNS is not 'true'.`);
      await skipScheduledJob(job.id, 'AUTO_CAMPAIGNS_DISABLED');
      return;
    }

    switch (job.type) {
      case 'campaign_post':
        tweetId = await handleCampaignPost(job);
        break;
      case 'random_pick':
        tweetId = await handleRandomPickAnnouncement(job);
        break;
      default:
        await skipScheduledJob(job.id, `Unknown job type: ${job.type}`);
        return;
    }

    await markScheduledJobSocialPosted(job.id, tweetId);
    recordReply();
  } catch (error) {
    console.error(`   ❌ Job social post error (attempt ${attempts}):`, error.message);
  }
}

async function handleCampaignPost(job) {
  const { payload } = job;
  const { message, grant_amount, max_participants, network } = payload;

  const tweetText = message || await generateUniqueCampaignTweet({
    grantAmount: grant_amount,
    maxParticipants: max_participants,
    network: network || 'base',
  });

  return await postTweet(tweetText);
}

async function handleRandomPickAnnouncement(job) {
  const { result, source_author_username, source_tweet_id } = job;
  const { winners = [], count, grant_amount } = result;

  const announcementText = await generateWinnerAnnouncement({
    winners,
    count,
    grantAmount: grant_amount,
    originalAuthor: source_author_username,
  });

  if (source_tweet_id) {
    try {
      return await replyToTweet(source_tweet_id, announcementText);
    } catch (_) {
      return await postTweet(announcementText);
    }
  }

  return await postTweet(announcementText);
}

/**
 * Sends a follow-up reply with an ERC-8004 feedback link if the user qualifies.
 */
async function maybeSendFeedbackPrompt(tx, replyTweetId) {
  try {
    if (!replyTweetId || !tx.tx_hash?.startsWith('0x')) return;

    // Only prompt for successful P2P, MagicPay, or campaign grants
    const validTypes = ['p2p', 'p2p_multi', 'multi_send', 'magicpay', 'grant', 'campaign_grant'];
    if (!validTypes.includes(tx.type)) return;

    const senderId = tx.sender_id || tx.payer_id; // Support both just in case
    if (!senderId) return;

    const qualifies = await checkUserQualifiesForFeedback(senderId);
    if (!qualifies) return;

    // Persona-driven short copies
    const isPidgin = tx.language === 'pidgin' || tx.payload?.language === 'pidgin';
    const prompts = isPidgin
      ? [
          `Abeg, go search Agent ID 51818 on 8004Scan make you drop your review there!`,
          `How the movement be? Drop feedback on 8004Scan for Agent 51818.`,
          `Rate the bag movement sharp sharp on 8004Scan (Agent ID: 51818)!`
        ]
      : [
          `Rate this movement on 8004Scan (Agent ID: 51818) if you're a real one.`,
          `W Aura? Drop some feedback on 8004Scan for Agent ID 51818.`,
          `Help me scale this thing, leave a review on 8004Scan (Agent 51818).`,
          `How'd I do? Rate the experience on 8004Scan for Agent 51818.`
        ];

    const promptText = prompts[Math.floor(Math.random() * prompts.length)];

    console.log(`   📣 Sending feedback prompt to user ${senderId}...`);
    await replyToTweet(replyTweetId, promptText);
    await logFeedbackPrompt(senderId, tx.tx_hash);
    console.log(`   ✅ Feedback prompt sent.`);

  } catch (error) {
    console.warn(`   ⚠️ maybeSendFeedbackPrompt error: ${error.message}`);
  }
}
