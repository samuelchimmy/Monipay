/**
 * MoniBot Worker - Twitter Module (v5.1)
 *
 * FIX B3: pollCommands() uses userMentionTimeline() instead of v2.search().
 * FIX B2: MagicPay pre-flight checks magicPayAddress allowance, not router.
 * FIX B6: All chain values stored lowercase via normalizeChain().
 * FIX RPC: Removed redundant pre-flight balance/allowance/calculateFee calls
 *          from processP2PCommand. All pre-flight is now inside executeP2PViaRouter
 *          and executeMagicPay which loop through all RPCs before failing.
 *          processP2PCommand now goes straight to executeAndLog after identity
 *          resolution, letting the execution layer handle RPC rotation and
 *          cross-chain fallback consistently.
 *
 * REROUTE DECISION TREE (per payment):
 *   1. Resolve recipient: MoniTag profile -> CasualPay | unregistered -> MagicPay
 *   2. Attempt execution on requested/detected chain
 *   3. On ERROR_BALANCE or ERROR_ALLOWANCE: findAlternateChain() checks all
 *      other non-testnet chains in parallel (balance + correct allowance context)
 *   4. On RPC failure: blockchain.js rotates through all RPCs for that chain
 *      before throwing ERROR_RPC_EXHAUSTED
 *   5. If alternate chain found with balance + allowance: retry on that chain
 *   6. If alternate chain found with balance but needs allowance: log specific error
 *   7. If no chain has funds: log ERROR_BALANCE with full detail for VP-Social
 */

import { TwitterApi } from 'twitter-api-v2';
import {
  getProfileByXUsername,
  getProfileByMonitag,
  getSupabase,
  checkIfAlreadyGranted,
  checkIfCommandProcessed,
  markAsGranted,
  logTransaction,
  getCampaignByTweetId,
  incrementCampaignParticipants,
  getActiveCampaigns,
  syncToMainLedger,
} from './database.js';
import {
  executeP2PViaRouter,
  executeGrantViaRouter,
  executeMagicPay,
  getUSDCBalance,
  getChainConfig,
  isTweetProcessed,
  isGrantAlreadyIssued,
  MONIBOT_ROUTER_ADDRESS,
  getRecipientId,
} from './blockchain.js';
import { findAlternateChain } from './crossChainCheck.js';
import {
  isMultiRecipientCommand,
  parseMultiRecipientCommand,
  executeMultiRecipientP2P,
} from './multiRecipient.js';
import { normalizeChain } from './chains.js';
import {
  PIDGIN_COMMAND_VERBS,
  PIDGIN_BALANCE_VERBS,
  PIDGIN_GREETINGS_CONFIRMATIONS,
  PIDGIN_MONEY_SLANG,
  ALL_RESERVED_WORDS,
  detectLanguage
} from './pidgin.js';
import { enforceMiniPayChainRestriction, determineMagicPayClaimMode } from './minipay.js';
import {
  isRecurringCommand,
  isRecurringManagementCommand,
  handleRecurringCreation,
  handleRecurringManagement,
  isOneTimeScheduleCommand,
  handleOneTimeScheduleCreation,
  handleHelpSetupLink,
  handleSetChainCommand,
  handleLeaderboardCommand,
  isSportsConditionCommand,
  handleSportsConditionCreation,
  isSportsBetManagementCommand,
  handleSportsBetManagement
} from './recurring.js';

let twitterClient;

// FIX B3: stored once at init
let MONIBOT_USER_ID = process.env.MONIBOT_USER_ID || '';
let lastMentionId = null;

const MONIBOT_WALLET_ADDRESS = process.env.MONIBOT_WALLET_ADDRESS || '';

const COMMAND_VERBS = [
  ...new Set([
    'bless', 'slide', 'tip', 'give', 'transfer', 'pay', 'send',
    'balance', 'drop', 'airdrop', 'claim',
    'cancel', 'stop', 'bet', 'status', 'help', 'setup', 'link', 'about', 'command', 'commands',
    'set-chain', 'use chain', 'set chain', 'leaderboard',
    ...PIDGIN_COMMAND_VERBS,
    ...PIDGIN_BALANCE_VERBS,
  ])
].sort((a, b) => b.length - a.length); // Sort by length descending to match longer phrases first

const VERB_REGEX = new RegExp(`\\b(${COMMAND_VERBS.join('|')})\\b`, 'i');

/**
 * Pre-flight: only process tweets that @mention monibot AND contain a command verb.
 */
function passesPreFlight(text) {
  const lower = text.toLowerCase();
  if (!lower.includes('@monibot')) return false;

  // Check for greetings at the start and strip them for cleaner verb detection if needed
  const greetingsPipe = PIDGIN_GREETINGS_CONFIRMATIONS.join('|');
  const greetingRegex = new RegExp(`^\\s*(?:${greetingsPipe}|hey|hi|hello)\\b`, 'i');
  const cleanedText = text.replace(greetingRegex, '').trim();

  return VERB_REGEX.test(cleanedText) || VERB_REGEX.test(text);
}

// ============ Initialization ============

export async function initTwitterClient() {
  twitterClient = new TwitterApi({
    appKey:       process.env.TWITTER_API_KEY,
    appSecret:    process.env.TWITTER_API_SECRET,
    accessToken:  process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  if (!MONIBOT_USER_ID) {
    try {
      const me = await twitterClient.v2.me();
      MONIBOT_USER_ID = me.data.id;
      console.log(`✅ Resolved MONIBOT_USER_ID: ${MONIBOT_USER_ID}`);
    } catch (e) {
      console.error('❌ Could not resolve MONIBOT_USER_ID. Set it manually in .env.');
    }
  }

  console.log('✅ Twitter Silent Worker initialized. 🤫');
}

export function getTwitterClient() { return twitterClient; }

// ============ Network Detection ============

const NETWORK_KEYWORDS = {
  celo:   ['on celo', 'celo', 'minipay'],
};

function detectRequestedNetwork(text) {
  const lower = text.toLowerCase();
  for (const [chain, keywords] of Object.entries(NETWORK_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return chain;
  }
  return null;
}

// ============ Utilities ============

export async function fetchTwitterNumericId(username) {
  try {
    const clean = username.replace('@', '').trim();
    const user = await twitterClient.v2.userByUsername(clean);
    return user.data?.id || null;
  } catch (e) {
    console.warn(`  ⚠️ Could not resolve numeric ID for @${username}: ${e.message}`);
    return null;
  }
}

function extractFirstPayTag(text) {
  const matches = (text.match(/@([a-zA-Z0-9_-]+)/g) || [])
    .map(m => m.slice(1).toLowerCase())
    .filter(m => m !== 'monibot' && m !== 'monipay');
  return matches[0] || null;
}


// ============ Poll via userMentionTimeline ============

export async function pollCommands() {
  try {
    if (!MONIBOT_USER_ID) {
      console.warn('⚠️ MONIBOT_USER_ID not set — cannot poll mentions. Add it to .env.');
      return;
    }

    console.log('💬 Polling mentions via userMentionTimeline...');

    const params = {
      max_results: 100,
      'tweet.fields': ['author_id', 'created_at', 'referenced_tweets', 'text'],
      'user.fields':  ['username'],
      expansions:     ['author_id'],
    };

    if (lastMentionId) params.since_id = lastMentionId;

    const timeline = await twitterClient.v2.userMentionTimeline(MONIBOT_USER_ID, params);

    const tweets = timeline.data?.data;
    if (!tweets || tweets.length === 0) {
      console.log('   No new mentions.');
      return;
    }

    console.log(`🔎 ${tweets.length} new mention(s) to process.`);

    if (timeline.data?.meta?.newest_id) {
      lastMentionId = timeline.data.meta.newest_id;
    }

    for (const tweet of tweets) {
      const author = timeline.data?.includes?.users?.find(u => u.id === tweet.author_id);
      if (author) await processP2PCommand(tweet, author);
    }

  } catch (error) {
    if (error.code === 429) {
      console.warn('⚠️ Twitter rate limit on mentions. Will retry next cycle.');
    } else {
      console.error('❌ Error polling commands:', error.message);
    }
  }
}

// ============ P2P Command Processing ============

async function processP2PCommand(tweet, author) {
  try {
    // ── 0. Pre-flight Check ────────────────────────────────────────────────
    if (!passesPreFlight(tweet.text)) return;

    // ── 1. DB Deduplication ────────────────────────────────────────────────
    const alreadyInDb = await checkIfCommandProcessed(tweet.id);
    if (alreadyInDb) return;

    // ── 2. Quote Tweet Guard ───────────────────────────────────────────────
    const isQuote = tweet.referenced_tweets?.some(r => r.type === 'quoted');
    if (isQuote) {
      const hasDirectCommand = new RegExp(`(?:${COMMAND_VERBS.join('|')})\\s+(?:\\$?\\d|@)`, 'i').test(tweet.text);
      if (!hasDirectCommand) {
        await logSkip({
          tweetId: tweet.id,
          authorUsername: author.username,
          hash: 'SKIP_QUOTE_NOT_COMMAND',
          detail: 'This quote tweet mentioned MoniBot but did not include a direct payment command.',
          language: 'english',
        });
        return;
      }
    }

    // ── 3.1 Detect Language ───────────────────────────────────────────────
    const language = detectLanguage(tweet.text);

    // ── 3. On-chain Deduplication (soft — never blocks on RPC error) ───────
    try {
      const alreadyOnChain = await isTweetProcessed(tweet.id);
      if (alreadyOnChain) {
        await logSkip({
          tweetId: tweet.id,
          authorUsername: author.username,
          hash: 'SKIP_ALREADY_ONCHAIN',
          detail: 'This tweet was already processed on-chain.',
          language,
        });
        return;
      }
    } catch (rpcErr) {
      // Soft fail — DB dedup above already protects us
      console.warn(`   ⚠️ On-chain dedup check failed (${rpcErr.message?.split('\n')[0]}). Proceeding with DB guard.`);
    }

    console.log(`\n⚡ @${author.username}: "${tweet.text.substring(0, 70)}..."`);

    const lower = tweet.text.toLowerCase();

    // ── 3.2 Help/Setup/Link/About/Command Commands ──────────────────────────────
    if (lower.includes('help') || lower.includes('setup') || lower.includes('link') || lower.includes('about') || lower.includes('command')) {
      await handleHelpSetupLink(tweet, author, language);
      return;
    }

    // ── 3.3 Set Chain Preference Command ──────────────────────────────────
    if (lower.includes('set-chain') || lower.includes('use chain') || lower.includes('set chain') || lower.includes('use network') || lower.includes('set network')) {
      await handleSetChainCommand(tweet, author, language);
      return;
    }

    // ── 3.4 Leaderboard Command ───────────────────────────────────────────
    if (lower.includes('leaderboard') || lower.includes('top sigmas') || lower.includes('aura leaderboard')) {
      await handleLeaderboardCommand(tweet, author, language);
      return;
    }

    // ── 3.45 Sports Bet Management & Sports Condition Creation Checks ──────
    if (isSportsBetManagementCommand(tweet.text)) {
      await handleSportsBetManagement(tweet, author, language);
      return;
    }

    if (isSportsConditionCommand(tweet.text)) {
      await handleSportsConditionCreation(tweet, author, language);
      return;
    }

    // ── 3.5 One-Time Schedule Creation Check ──────────────────────────────
    if (isOneTimeScheduleCommand(tweet.text)) {
      await handleOneTimeScheduleCreation(tweet, author, language);
      return;
    }

    // ── 3.6 Series Management Commands ──────────────────────────────────────
    if (isRecurringManagementCommand(tweet.text)) {
      await handleRecurringManagement(tweet, author, language);
      return;
    }

    // ── 3.7 Recurring Creation Check ────────────────────────────────────────
    if (isRecurringCommand(tweet.text)) {
      await handleRecurringCreation(tweet, author, language);
      return;
    }

    // ── 4. Unified Profile Lookup (Sender) ────────────────────────────────
    const senderProfile = await getProfileByXUsername(author.username);

    // ── 5. Starting Chain Selection + MiniPay Override ────────────────────
    const requestedNetwork = detectRequestedNetwork(tweet.text);
    let startingChain = requestedNetwork 
      ? normalizeChain(requestedNetwork) 
      : (senderProfile?.preferred_network || 'celo');

    if (senderProfile && senderProfile.source === 'wallet_profile') {
      startingChain = 'celo';
    }

    // ── 6. Multi-Recipient Detection ──────────────────────────────────────
    if (isMultiRecipientCommand(tweet.text)) {
      const parsed = parseMultiRecipientCommand(tweet.text);
      if (parsed) {
        if (!senderProfile) {
          await logTransaction({
            sender_id: process.env.MONIBOT_PROFILE_ID,
            receiver_id: process.env.MONIBOT_PROFILE_ID,
            amount: parsed.amount * parsed.recipients.length,
            fee: 0,
            tx_hash: 'ERROR_SENDER_NOT_FOUND',
            type: 'p2p_command',
            tweet_id: tweet.id,
            payer_pay_tag: author.username,
            recipient_pay_tag: parsed.recipients.join(','),
            chain: startingChain,
            sender_source: 'profile',
            error_reason: `@${author.username} is not registered on MoniPay. They need to create an account at monipay.xyz and link their X account first.`,
            language,
          });
          return;
        }

        await executeMultiRecipientP2P({
          senderProfile,
          amount: parsed.amount,
          recipientTags: parsed.recipients,
          tweetId: tweet.id,
          fetchNumericId: fetchTwitterNumericId,
          chain: startingChain,
          language,
        });
        return;
      }
    }

    // ── 6. Parse Single P2P ───────────────────────────────────────────────
    const verbsPipe = COMMAND_VERBS.join('|');
    const slangPipe = PIDGIN_MONEY_SLANG.join('|');

    // Enhanced pattern to handle Pidgin:
    // 1. Optional greetings/noise at the start
    // 2. Verb
    // 3. Optional "to", "help me" or "help" noise
    // 4. Amount with optional $ or money slang
    // 5. Recipient with mandatory "@"
    // Note: Pronouns like "me" in "dash me" are part of COMMAND_VERBS due to sorting.
    // Updated with flexible (?:[^@$]*?) to handle intermediate words like "give" in "wire $15 give @recipient".
    const P2P_PATTERN = new RegExp(
      `(?:${verbsPipe})(?:[^@$]*?)@([a-zA-Z0-9_-]+)(?:[^@$]*?)\\$?([\\d.]+)(?:\\s*(?:usdc|usdt|${slangPipe}))?|` +
      `(?:${verbsPipe})(?:[^@$]*?)\\$?([\\d.]+)(?:\\s*(?:usdc|usdt|${slangPipe}))?(?:[^@$]*?)@([a-zA-Z0-9_-]+)`,
      'i'
    );

    const match = tweet.text.match(P2P_PATTERN);

    // ── 6.1 Handle Balance Check (Pidgin or English) ──────────────────────────
    const balancePipe = PIDGIN_BALANCE_VERBS.join('|');
    const BALANCE_PATTERN = new RegExp(`\\b(${balancePipe}|balance)\\b`, 'i');
    if (!match && BALANCE_PATTERN.test(tweet.text)) {
      console.log(`   🔍 Balance check requested by @${author.username}`);
      const senderProfile = await getProfileByXUsername(author.username);
      if (!senderProfile) {
        await logTransaction({
          sender_id: process.env.MONIBOT_PROFILE_ID,
          receiver_id: process.env.MONIBOT_PROFILE_ID,
          amount: 0, fee: 0,
          tx_hash: 'ERROR_SENDER_NOT_FOUND',
          type: 'p2p_command',
          tweet_id: tweet.id,
          payer_pay_tag: author.username,
          recipient_pay_tag: null,
          chain: startingChain,
          error_reason: `@${author.username} is not registered. Sign up at monipay.xyz to check your balance.`,
          language,
        });
        return;
      }

      const balResult = await getUSDCBalance(senderProfile.wallet_address, startingChain);
      await logTransaction({
        sender_id: senderProfile.id,
        receiver_id: senderProfile.id,
        amount: balResult.balance,
        fee: 0,
        tx_hash: 'BALANCE_CHECK',
        type: 'p2p_command',
        tweet_id: tweet.id,
        payer_pay_tag: senderProfile.pay_tag,
        recipient_pay_tag: senderProfile.pay_tag,
        chain: startingChain,
        language,
      });
      return;
    }

    if (!match) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID,
        receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0,
        tx_hash: 'SKIP_INVALID_SYNTAX',
        type: 'p2p_command',
        tweet_id: tweet.id,
        payer_pay_tag: author.username,
        recipient_pay_tag: null,
        chain: startingChain,
        error_reason: `Could not parse command from @${author.username}. Expected format: @monibot send $5 to @username`,
        language,
      });
      return;
    }

    let amount, targetTag;
    if (match[1] !== undefined) {
      targetTag = match[1].toLowerCase();
      amount    = parseFloat(match[2]);
    } else {
      amount    = parseFloat(match[3]);
      targetTag = match[4].toLowerCase();
    }

    if (targetTag === 'monibot' || targetTag === 'monipay') return;
    if (ALL_RESERVED_WORDS.includes(targetTag)) {
      console.log(`   ⏭️ Recipient @${targetTag} is a reserved word. Skipping.`);
      return;
    }
    if (isNaN(amount) || amount <= 0) return;

    console.log(`   💰 $${amount} → @${targetTag}`);

    // ── 7. Verify Sender ──────────────────────────────────────────────────
    if (!senderProfile) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID,
        receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount, fee: 0,
        tx_hash: 'ERROR_SENDER_NOT_FOUND',
        type: 'p2p_command',
        tweet_id: tweet.id,
        payer_pay_tag: author.username,
        recipient_pay_tag: targetTag,
        chain: startingChain,
        sender_source: 'profile',
        error_reason: `@${author.username} does not have a MoniPay account linked to this X account. Sign up at monipay.xyz and link X in Settings.`,
        language,
      });
      return;
    }

    // ── 7.1. MiniPay Sender Enforcement ──────────────────────────────────
    const senderValidation = enforceMiniPayChainRestriction(senderProfile, null, startingChain);
    if (!senderValidation.valid) {
      await logTransaction({
        sender_id: senderProfile.id,
        receiver_id: null,
        amount,
        fee: 0,
        tx_hash: senderValidation.error,
        type: 'p2p_command',
        tweet_id: tweet.id,
        payer_pay_tag: senderProfile.pay_tag,
        recipient_pay_tag: targetTag,
        recipient_username: `@${targetTag}`,
        chain: startingChain,
        sender_source: senderProfile.source,
        error_reason: 'MiniPay wallets can only send on Celo. Retry with "on celo".',
        language,
      });
      return;
    }

    // ── 8. Self-send Guard ────────────────────────────────────────────────
    if (
      targetTag === senderProfile.pay_tag?.toLowerCase() ||
      targetTag === senderProfile.x_username?.toLowerCase()
    ) {
      console.log('   ⏭️ Self-send. Skipping.');
      return;
    }

    // ── 9. Identity Bridge: MoniTag profile OR MagicPay ──────────────────
    let recipientProfile = await getProfileByMonitag(targetTag) || await getProfileByXUsername(targetTag);
    let isMagicPay = false;
    let recipientIdentifier = targetTag;

    if (!recipientProfile) {
      console.log(`   🪄 @${targetTag} not on MoniPay. Fetching Twitter numeric ID for MagicPay...`);
      const numericId = await fetchTwitterNumericId(targetTag);
      if (!numericId) {
        await logTransaction({
          sender_id: senderProfile.id,
          receiver_id: senderProfile.id,
          amount, fee: 0,
          tx_hash: 'ERROR_TARGET_NOT_FOUND',
          type: 'p2p_command',
          tweet_id: tweet.id,
          payer_pay_tag: senderProfile.pay_tag,
          recipient_pay_tag: targetTag,
          chain: startingChain,
          sender_source: senderProfile.source,
          error_reason: `@${targetTag} doesn't exist on Twitter. Double-check the username.`,
          language,
        });
        return;
      }
      isMagicPay = true;
      recipientIdentifier = numericId;
    } else {
      recipientIdentifier = recipientProfile.pay_tag;

      // ── 9.1. MiniPay Recipient Enforcement ──────────────────────────────
      const recipientValidation = enforceMiniPayChainRestriction(null, recipientProfile, startingChain);
      if (!recipientValidation.valid) {
        await logTransaction({
          sender_id: senderProfile.id,
          receiver_id: recipientProfile.id,
          amount,
          fee: 0,
          tx_hash: recipientValidation.error,
          type: 'p2p_command',
          tweet_id: tweet.id,
          payer_pay_tag: senderProfile.pay_tag,
          recipient_pay_tag: recipientProfile.pay_tag,
          recipient_username: `@${recipientProfile.x_username}`,
          chain: startingChain,
          sender_source: senderProfile.source,
          error_reason: `Recipient is a MiniPay user and only receives on Celo. Retry with "on celo".`,
          language,
        });
        return;
      }
    }

    // ── 10. Execute ───────────────────────────────────────────────────────
    let magicpayClaimMode = null;
    if (isMagicPay) {
      magicpayClaimMode = determineMagicPayClaimMode(senderProfile, startingChain);
    }

    // No pre-flight balance/allowance checks here.
    // executeP2PViaRouter and executeMagicPay handle all pre-flight internally
    // with full RPC failover. executeAndLog handles cross-chain rerouting.
    await executeAndLog({
      senderProfile,
      recipientProfile,
      isMagicPay,
      recipientIdentifier,
      recipientUsername: isMagicPay ? `@${targetTag}` : null,
      amount,
      fee: 0, // actual fee returned from execution
      tweet,
      txContext: isMagicPay ? 'magicpay' : 'p2p_command',
      chain: startingChain,
      language,
      magicpayClaimMode,
    });

  } catch (e) {
    console.error('❌ Command processing exception:', e.message);
  }
}

// ============ Execution + Logging + Cross-Chain Reroute ============

async function executeAndLog({
  senderProfile,
  recipientProfile,
  isMagicPay,
  recipientIdentifier,
  recipientUsername,
  amount,
  fee,
  tweet,
  txContext,
  chain,
  language = 'english',
  magicpayClaimMode = null,
  _rerouteDepth = 0,
  originalChain = null,
}) {
  const chainNorm = normalizeChain(chain);

  // Guard against infinite reroute loops
  if (_rerouteDepth > 5) {
    console.error(`  ❌ Reroute depth exceeded for tweet ${tweet.id}. Giving up.`);
    await logTransaction({
      sender_id: senderProfile.id,
      receiver_id: isMagicPay ? null : (recipientProfile?.id || senderProfile.id),
      amount, fee: 0,
      tx_hash: 'ERROR_REROUTE_EXHAUSTED',
      type: txContext,
      tweet_id: tweet.id,
      payer_pay_tag: senderProfile.pay_tag,
      recipient_pay_tag: recipientIdentifier,
      recipient_username: recipientUsername,
      chain: chainNorm,
      sender_source: senderProfile.source,
      error_reason: 'All chains and RPCs exhausted. No viable route found.',
      language,
    });
    return;
  }

  try {
    console.log(`  🚀 Executing ${txContext} on ${chainNorm.toUpperCase()}...`);

    let res;
    if (isMagicPay) {
      res = await executeMagicPay(senderProfile.wallet_address, recipientIdentifier, amount, chainNorm);
    } else {
      res = await executeP2PViaRouter(
        senderProfile.wallet_address,
        recipientProfile.wallet_address,
        amount,
        tweet.id,
        chainNorm
      );
    }

    const actualFee = res.fee || fee || 0;

    await logTransaction({
      sender_id:         senderProfile.id,
      receiver_id:       isMagicPay ? null : recipientProfile.id,
      amount,
      fee:               actualFee,
      tx_hash:           res.hash,
      type:              txContext,
      tweet_id:          tweet.id,
      payer_pay_tag:     senderProfile.pay_tag,
      recipient_pay_tag: recipientIdentifier,
      recipient_username: recipientUsername,
      chain:             chainNorm,
      sender_source:     senderProfile.source,
      magicpay_claim_mode: magicpayClaimMode,
      language,
      error_reason:      _rerouteDepth > 0 ? `reroute:${originalChain || chainNorm}` : null,
    });

    const config = getChainConfig(chainNorm);
    await syncToMainLedger({
      senderWalletAddress:   senderProfile.wallet_address,
      receiverWalletAddress: recipientProfile?.wallet_address || null,
      senderPayTag:          senderProfile.pay_tag,
      receiverPayTag:        isMagicPay ? `MagicPay:${recipientIdentifier}` : recipientProfile.pay_tag,
      amount,
      fee:        actualFee,
      txHash:     res.hash,
      monibotType: txContext,
      tweetId:    tweet.id,
      chain:      chainNorm,
      symbol:     config.symbol,
      language,
      error_reason:          _rerouteDepth > 0 ? 'reroute' : null,
    });

    console.log(`  ✅ ${txContext.toUpperCase()} success on ${chainNorm.toUpperCase()}! Hash: ${res.hash}`);

  } catch (err) {
    console.error(`  ❌ Execution failed on ${chainNorm}: ${err.message.split('\n')[0]}`);

    const errMsg = err.message || '';

    // ── Cross-chain reroute on balance or allowance errors ────────────────
    if (
      errMsg.includes('ERROR_BALANCE') ||
      errMsg.includes('ERROR_ALLOWANCE') ||
      errMsg.includes('ERROR_MAGIC_PAY_BALANCE') ||
      errMsg.includes('ERROR_MAGIC_PAY_ALLOWANCE') ||
      errMsg.includes('ERROR_RPC_EXHAUSTED')
    ) {
      console.log(`  🔄 Attempting cross-chain reroute from ${chainNorm.toUpperCase()}...`);
      const alt = await findAlternateChain(senderProfile.wallet_address, amount, chainNorm, txContext);

      if (alt && !alt.needsAllowance) {
        console.log(`  🔀 Rerouting to ${alt.chain.toUpperCase()} (${alt.balance.toFixed(2)} ${alt.symbol})...`);
        return await executeAndLog({
          senderProfile,
          recipientProfile,
          isMagicPay,
          recipientIdentifier,
          recipientUsername,
          amount,
          fee,
          tweet,
          txContext,
          chain: alt.chain,
          language,
          _rerouteDepth: _rerouteDepth + 1,
          originalChain: originalChain || chainNorm,
        });
      }

      if (alt && alt.needsAllowance) {
        // Found balance but allowance not set — log specifically so VP-Social gives correct instructions
        const errorCode   = txContext === 'magicpay' ? 'ERROR_MAGIC_PAY_ALLOWANCE' : 'ERROR_ALLOWANCE';
        const errorReason = `Found $${alt.balance.toFixed(2)} ${alt.symbol} on ${alt.chain.toUpperCase()} but MagicPay allowance is not set. Go to MoniPay Settings > MoniBot > Set Allowance > ${txContext === 'magicpay' ? 'MagicPay' : 'CasualPay'}.`;
        await logTransaction({
          sender_id: senderProfile.id,
          receiver_id: isMagicPay ? null : (recipientProfile?.id || senderProfile.id),
          amount, fee: 0,
          tx_hash: errorCode,
          type: txContext,
          tweet_id: tweet.id,
          payer_pay_tag: senderProfile.pay_tag,
          recipient_pay_tag: recipientIdentifier,
          recipient_username: recipientUsername,
          chain: alt.chain,
          sender_source: senderProfile.source,
          error_reason: errorReason,
          language,
        });
        return;
      }

      // No chain has funds — log the original chain's error
    }

    // ── Parse structured error from blockchain.js for VP-Social ──────────
    const errorCode   = errMsg.startsWith('ERROR_') ? errMsg.split(':')[0] : 'ERROR_BLOCKCHAIN';
    const errorReason = errMsg.includes(':') ? errMsg.split(':').slice(1).join(':').trim() : errMsg;

    await logTransaction({
      sender_id:         senderProfile.id,
      receiver_id:       isMagicPay ? null : (recipientProfile?.id || senderProfile.id),
      amount, fee: 0,
      tx_hash:           errorCode,
      type:              txContext,
      tweet_id:          tweet.id,
      payer_pay_tag:     senderProfile.pay_tag,
      recipient_pay_tag: recipientIdentifier,
      recipient_username: recipientUsername,
      chain:             chainNorm,
      sender_source:     senderProfile.source,
      error_reason:      errorReason,
      language,
    });
  }
}

// ============ Helper: Log Skip ============

async function logSkip({ tweetId, authorUsername, hash, chain = 'celo', detail = null, language = 'english' }) {
  await logTransaction({
    sender_id:         process.env.MONIBOT_PROFILE_ID,
    receiver_id:       process.env.MONIBOT_PROFILE_ID,
    amount: 0, fee: 0,
    tx_hash:           hash,
    type:              'p2p_command',
    tweet_id:          tweetId,
    payer_pay_tag:     authorUsername,
    recipient_pay_tag: null,
    chain:             normalizeChain(chain),
    sender_source:     'profile',
    error_reason:      detail || `Skipped: ${hash.replace(/^SKIP_/, '').toLowerCase().replace(/_/g, ' ')}.`,
    language,
  });
}

// ============ Campaign Polling ============

export async function pollCampaigns() {
  try {
    console.log('📊 Polling campaign replies...');
    const activeCampaigns = await getActiveCampaigns();
    if (!activeCampaigns?.length) { console.log('   No active campaigns.'); return; }
    console.log(`   ${activeCampaigns.length} active campaign(s).`);
    for (const campaign of activeCampaigns) {
      if (!campaign.tweet_id) continue;
      if ((campaign.current_participants || 0) >= (campaign.max_participants || 999999)) continue;
      await processCampaignReplies(campaign);
    }
  } catch (error) {
    console.error('❌ Error polling campaigns:', error.message);
  }
}

async function processCampaignReplies(campaign) {
  try {
    const supabase = getSupabase();
    console.log(`\n🔍 Campaign: ${campaign.tweet_id} | $${campaign.grant_amount} | ${campaign.current_participants || 0}/${campaign.max_participants}`);

    const query = `conversation_id:${campaign.tweet_id} -from:monibot`;
    const options = {
      max_results: 100,
      'tweet.fields': ['author_id', 'created_at'],
      'user.fields':  ['username'],
      expansions:     ['author_id'],
    };

    if (campaign.last_checked_id) {
      options.since_id = campaign.last_checked_id;
    }

    const replies = await twitterClient.v2.search(query, options);

    if (!replies.data?.data) { console.log('   No replies.'); return; }
    console.log(`   ${replies.data.data.length} replies.`);

    for (const reply of replies.data.data) {
      const author = replies.includes?.users?.find(u => u.id === reply.author_id);
      if (author) await processReply(reply, author, campaign);
    }

    if (replies.data?.meta?.newest_id) {
      await supabase
        .from('campaigns')
        .update({ last_checked_id: replies.data.meta.newest_id })
        .eq('tweet_id', campaign.tweet_id);
    }
  } catch (error) {
    console.error(`❌ Campaign error ${campaign.tweet_id}:`, error.message);
  }
}

async function processReply(reply, author, campaign) {
  try {
    const alreadyHandled = await checkIfCommandProcessed(reply.id);
    if (alreadyHandled) return;

    console.log(`\n📝 @${author.username}: "${reply.text.substring(0, 50)}..."`);

    const targetPayTag = extractFirstPayTag(reply.text);
    const language = detectLanguage(reply.text);
    if (!targetPayTag) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'SKIP_NO_PAYTAG', campaign_id: campaign.tweet_id,
        type: 'grant', tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: null, chain: 'celo',
        sender_source: 'profile',
        error_reason: `@${author.username} replied but didn't include a MoniPay tag. They need to reply with their @tag.`,
        language,
      });
      return;
    }

    console.log(`   🎯 Tag: @${targetPayTag} [${language}]`);
    await processGrantForPayTag(targetPayTag, reply, author, campaign, language);
  } catch (error) {
    console.error('❌ processReply error:', error.message);
  }
}

async function processGrantForPayTag(payTag, reply, author, campaign, language = 'english') {
  try {
    const targetProfile = await getProfileByMonitag(payTag);
    if (!targetProfile) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_TARGET_NOT_FOUND', type: 'grant',
        tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: payTag, chain: 'celo',
        sender_source: 'profile',
        error_reason: `@${payTag} is not a registered MoniPay tag. The user needs to sign up at monipay.xyz first.`,
        language,
      });
      return;
    }

    const currentCampaign = await getCampaignByTweetId(campaign.tweet_id);
    if (!currentCampaign) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: targetProfile.id,
        amount: 0, fee: 0, tx_hash: 'SKIP_CAMPAIGN_INACTIVE', campaign_id: campaign.tweet_id,
        type: 'grant', tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: targetProfile.pay_tag, chain: 'celo',
        sender_source: 'profile',
        error_reason: `Campaign ${campaign.tweet_id} is no longer active.`,
        language,
      });
      return;
    }

    const { grant_amount: grantAmount, max_participants, current_participants } = currentCampaign;

    if ((current_participants || 0) >= (max_participants || 999999)) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: targetProfile.id,
        amount: 0, fee: 0, tx_hash: 'LIMIT_REACHED', campaign_id: campaign.tweet_id,
        type: 'grant', tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: targetProfile.pay_tag, chain: 'celo',
        sender_source: 'profile',
        error_reason: `Campaign filled up. ${current_participants}/${max_participants} slots were claimed before @${targetProfile.pay_tag} replied.`,
        language,
      });
      return;
    }

    const alreadyGrantedDb = await checkIfAlreadyGranted(campaign.tweet_id, targetProfile.id);
    if (alreadyGrantedDb) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: targetProfile.id,
        amount: 0, fee: 0, tx_hash: 'SKIP_DUPLICATE_GRANT_DB', campaign_id: campaign.tweet_id,
        type: 'grant', tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: targetProfile.pay_tag, chain: 'celo',
        sender_source: 'profile',
        error_reason: `@${targetProfile.pay_tag} already received their grant from this campaign. One per account.`,
        language,
      });
      return;
    }

    const alreadyGrantedOnChain = await isGrantAlreadyIssued(campaign.tweet_id, targetProfile.wallet_address);
    if (alreadyGrantedOnChain) {
      await markAsGranted(campaign.tweet_id, targetProfile.id);
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: targetProfile.id,
        amount: 0, fee: 0, tx_hash: 'SKIP_DUPLICATE_GRANT_ONCHAIN', campaign_id: campaign.tweet_id,
        type: 'grant', tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: targetProfile.pay_tag, chain: 'celo',
        sender_source: 'profile',
        error_reason: `@${targetProfile.pay_tag} grant already recorded on-chain. DB synced.`,
        language,
      });
      return;
    }

    console.log(`   💸 Granting $${grantAmount} to @${targetProfile.pay_tag}...`);

    try {
      const { hash, fee: actualFee } = await executeGrantViaRouter(targetProfile.wallet_address, grantAmount, campaign.tweet_id);

      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: targetProfile.id,
        amount: grantAmount, fee: actualFee, tx_hash: hash, campaign_id: campaign.tweet_id,
        type: 'grant', tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: targetProfile.pay_tag, chain: 'celo',
        sender_source: 'profile',
        language,
      });

      await markAsGranted(campaign.tweet_id, targetProfile.id);
      await incrementCampaignParticipants(campaign.tweet_id, grantAmount);

      await syncToMainLedger({
        senderWalletAddress:  MONIBOT_WALLET_ADDRESS,
        receiverWalletAddress: targetProfile.wallet_address,
        senderPayTag:          'MoniBot',
        receiverPayTag:        targetProfile.pay_tag,
        amount:                grantAmount,
        fee:                   actualFee,
        txHash:                hash,
        monibotType:           'grant',
        tweetId:               reply.id,
        campaignId:            campaign.tweet_id,
        campaignName:          campaign.message?.substring(0, 50) || 'MoniBot Campaign',
        chain:                 'celo',
        symbol:                'USDC',
        language,
      });

      console.log(`   ✅ Grant sent! TX: ${hash}`);

    } catch (txError) {
      console.error('   ❌ Grant failed:', txError.message);

      let errorCode = 'ERROR_BLOCKCHAIN';
      const detail  = txError.message.includes(':') ? txError.message.split(':').slice(1).join(':').trim() : txError.message;

      if (txError.message.includes('ERROR_DUPLICATE_GRANT'))       errorCode = 'ERROR_DUPLICATE_GRANT';
      else if (txError.message.includes('ERROR_CONTRACT_BALANCE')) errorCode = 'ERROR_TREASURY_EMPTY';

      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: targetProfile.id,
        amount: 0, fee: 0, tx_hash: errorCode, type: 'grant',
        tweet_id: reply.id, payer_pay_tag: 'MoniBot', recipient_pay_tag: targetProfile.pay_tag, chain: 'celo',
        sender_source: 'profile',
        error_reason: detail,
        language,
      });
    }

  } catch (error) {
    console.error(`❌ processGrantForPayTag error for @${payTag}:`, error.message);
  }
}
