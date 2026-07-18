/**
 * MoniBot Worker - Multi-Recipient P2P Module (v4.1)
 *
 * Handles: "@monibot send $1 each to @alice, @bob, @charlie"
 *
 * Mixed routing:
 * - Linked MoniPay profile → P2P via Router
 * - Unlinked Twitter user → MagicPay Escrow (numeric ID resolved via Twitter API)
 *
 * Sequential execution prevents nonce collisions.
 * fetchNumericId is injected from twitter.js to avoid circular imports.
 */

import {
  PIDGIN_COMMAND_VERBS,
  PIDGIN_EACH_EQUIVALENTS,
  PIDGIN_MONEY_SLANG,
  ALL_RESERVED_WORDS
} from './pidgin.js';
import {
  getProfileByMonitag,
  getProfileByXUsername,
  logTransaction,
  syncToMainLedger,
} from './database.js';
import {
  executeP2PViaRouter,
  executeMagicPay,
  getOnchainAllowance,
  getUSDCBalance,
  getChainConfig,
} from './blockchain.js';
import { enforceMiniPayChainRestriction, determineMagicPayClaimMode } from './minipay.js';

// ============ Detection & Parsing ============

/**
 * Detect if a tweet is a multi-recipient command.
 * Requires 2+ @mentions (excluding bot) and a send/pay verb.
 */
export function isMultiRecipientCommand(text) {
  const cleaned = text.toLowerCase();
  const verbs = [...new Set(['send', 'pay', 'bless', 'slide', 'tip', 'give', 'transfer', 'balance', 'drop', 'airdrop', 'claim', ...PIDGIN_COMMAND_VERBS])];
  const hasVerb = new RegExp(`\\b(${verbs.join('|')})\\b`).test(cleaned);
  if (!hasVerb) return false;

  const mentions = (text.match(/@([a-zA-Z0-9_-]+)/g) || [])
    .map(m => m.slice(1).toLowerCase())
    .filter(m => m !== 'monibot' && m !== 'monipay' && !ALL_RESERVED_WORDS.includes(m));

  return mentions.length >= 2;
}

/**
 * Parse multi-recipient command.
 * Returns { amount, recipients[] } or null if unparseable.
 */
export function parseMultiRecipientCommand(text) {
  const slangPipe = PIDGIN_MONEY_SLANG.join('|');
  const eachPipe = PIDGIN_EACH_EQUIVALENTS.join('|');

  // Support $5, 5usdc, 5 raba, etc.
  const amountRegex = new RegExp(`\\$?(\\d+\\.?\\d*)\\s*(?:usdc|usdt|${slangPipe})?`, 'i');
  const amountMatch = text.match(amountRegex);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  // Check for "each" or Pidgin equivalents
  const hasEach = new RegExp(`\\b(${eachPipe})\\b`, 'i').test(text);
  if (!hasEach) return null;

  const mentions = (text.match(/@([a-zA-Z0-9_-]+)/g) || [])
    .map(m => m.slice(1).toLowerCase())
    .filter(m => m !== 'monibot' && m !== 'monipay' && !ALL_RESERVED_WORDS.includes(m));

  if (mentions.length < 2) return null;

  return { amount, recipients: [...new Set(mentions)] };
}

// ============ Batch Execution ============

/**
 * Execute a multi-recipient batch.
 * fetchNumericId is passed in from twitter.js to resolve Twitter @handles
 * to numeric IDs for MagicPay — avoids circular import.
 *
 * @param {object} params
 * @param {object} params.senderProfile
 * @param {number} params.amount
 * @param {string[]} params.recipientTags
 * @param {string} params.tweetId
 * @param {Function} params.fetchNumericId - async (username: string) => string|null
 * @param {string} [params.chain='base']
 * @param {string} [params.language='english']
 */
export async function executeMultiRecipientP2P({ senderProfile, amount, recipientTags, tweetId, fetchNumericId, chain = 'base', language = 'english' }) {
  const results = [];

  console.log(`  📦 Batch: $${amount} x ${recipientTags.length} recipients`);

  // ── Pre-flight balance check ───────────────────────────────────────────────
  const totalNeeded = amount * recipientTags.length;
  const [balanceResult, allowanceResult] = await Promise.all([
    getUSDCBalance(senderProfile.wallet_address, chain),
    getOnchainAllowance(senderProfile.wallet_address, chain),
  ]);
  const balance = typeof balanceResult === 'object' ? balanceResult.balance : balanceResult;
  const allowance = typeof allowanceResult === 'object' ? allowanceResult.allowance : allowanceResult;

  if (balance < amount) {
    // Can't afford even one
    console.log(`  ❌ Batch aborted: Insufficient balance ($${balance} < $${amount})`);
    for (const tag of recipientTags) {
      results.push({ tag, status: 'failed', reason: 'Insufficient balance' });
      await logTransaction({
        sender_id: senderProfile.id,
        receiver_id: senderProfile.id,
        amount, fee: 0,
        tx_hash: 'ERROR_BALANCE',
        type: 'p2p_command',
        tweet_id: tweetId,
        payer_pay_tag: senderProfile.pay_tag,
        recipient_pay_tag: tag,
        chain,
        sender_source: senderProfile.source,
        error_reason: `@${senderProfile.pay_tag} does not have enough balance on ${chain.toUpperCase()} to send $${amount} in this batch.`,
        language,
      });
    }
    return { results, summary: { total: recipientTags.length, success: 0, failed: recipientTags.length } };
  }

  // Calculate how many we can afford
  const affordableCount = Math.min(
    Math.floor(balance / amount),
    recipientTags.length
  );

  if (affordableCount < recipientTags.length) {
    console.log(`  ⚠️ Can only afford ${affordableCount}/${recipientTags.length} recipients.`);
    const skipped = recipientTags.slice(affordableCount);
    for (const tag of skipped) {
      results.push({ tag, status: 'failed', reason: 'Insufficient balance (batch limit)' });
    }
    recipientTags = recipientTags.slice(0, affordableCount);
  }

  // ── Sequential execution ───────────────────────────────────────────────────
  for (const tag of recipientTags) {
    // Self-send guard
    if (tag === senderProfile.pay_tag?.toLowerCase() || tag === senderProfile.x_username?.toLowerCase()) {
      results.push({ tag, status: 'failed', reason: 'Cannot send to yourself' });
      continue;
    }

    // MiniPay sender restriction
    const senderValidation = enforceMiniPayChainRestriction(senderProfile, null, chain);
    if (!senderValidation.valid) {
      results.push({ tag, status: 'failed', reason: 'MiniPay sender restriction' });
      await logTransaction({
        sender_id: senderProfile.id,
        receiver_id: null,
        amount,
        fee: 0,
        tx_hash: senderValidation.error,
        type: 'p2p_command',
        tweet_id: tweetId,
        payer_pay_tag: senderProfile.pay_tag,
        recipient_pay_tag: tag,
        recipient_username: `@${tag}`,
        chain,
        sender_source: senderProfile.source,
        error_reason: 'MiniPay wallets can only send on Celo. Retry with "on celo".',
        language,
      });
      continue;
    }

    try {
      // Resolve recipient type
      let recipientProfile = await getProfileByMonitag(tag) || await getProfileByXUsername(tag);
      let res;
      let txType = 'p2p_command';
      let recipientIdentifier = tag;
      let receiverId = null;

      if (recipientProfile) {
        // MiniPay recipient restriction
        const recipientValidation = enforceMiniPayChainRestriction(null, recipientProfile, chain);
        if (!recipientValidation.valid) {
          results.push({ tag, status: 'failed', reason: 'MiniPay recipient restriction' });
          await logTransaction({
            sender_id: senderProfile.id,
            receiver_id: recipientProfile.id,
            amount,
            fee: 0,
            tx_hash: recipientValidation.error,
            type: 'p2p_command',
            tweet_id: tweetId,
            payer_pay_tag: senderProfile.pay_tag,
            recipient_pay_tag: recipientProfile.pay_tag,
            recipient_username: `@${recipientProfile.x_username}`,
            chain,
            sender_source: senderProfile.source,
            error_reason: `Recipient is a MiniPay user and only receives on Celo. Retry with "on celo".`,
            language,
          });
          continue;
        }

        // ── Linked user → Router P2P ─────────────────────────────────────
        console.log(`    🔹 [P2P] @${tag} (linked)`);
        const uniqueTweetId = `${tweetId}_${tag}`;
        res = await executeP2PViaRouter(
          senderProfile.wallet_address,
          recipientProfile.wallet_address,
          amount,
          uniqueTweetId,
          chain
        );
        recipientIdentifier = recipientProfile.pay_tag;
        receiverId = recipientProfile.id;

      } else {
        // ── Unlinked user → MagicPay ─────────────────────────────────────
        console.log(`    🪄 [MagicPay] @${tag} (unlinked — fetching numeric ID)`);

        if (!fetchNumericId) {
          console.warn(`    ⚠️ No fetchNumericId resolver provided. Skipping @${tag}.`);
          results.push({ tag, status: 'failed', reason: 'Resolver unavailable' });
          continue;
        }

        const numericId = await fetchNumericId(tag);
        if (!numericId) {
          console.log(`    💀 @${tag} not found on Twitter. Skipping.`);
          results.push({ tag, status: 'failed', reason: 'Twitter user not found' });
          await logTransaction({
            sender_id: senderProfile.id,
            receiver_id: null,
            amount, fee: 0,
            tx_hash: 'ERROR_TARGET_NOT_FOUND',
            type: 'magicpay',
            tweet_id: tweetId,
            payer_pay_tag: senderProfile.pay_tag,
            recipient_pay_tag: tag,
            recipient_username: `@${tag}`,
            chain,
            sender_source: senderProfile.source,
            error_reason: `@${tag} does not exist on Twitter. Double-check the username before retrying the batch.`,
            language,
          });
          continue;
        }

        res = await executeMagicPay(senderProfile.wallet_address, numericId, amount, chain);
        txType = 'magicpay';
        recipientIdentifier = numericId;
        receiverId = null; // Unlinked — no profile ID
      }

      let magicpayClaimMode = null;
      if (txType === 'magicpay') {
        magicpayClaimMode = determineMagicPayClaimMode(senderProfile, chain);
      }

      // Log success
      await logTransaction({
        sender_id: senderProfile.id,
        receiver_id: receiverId,
        amount,
        fee: res.fee || 0,
        tx_hash: res.hash,
        type: txType,
        tweet_id: tweetId,
        payer_pay_tag: senderProfile.pay_tag,
        recipient_pay_tag: recipientIdentifier,
        recipient_username: txType === 'magicpay' ? `@${tag}` : null,
        chain,
        sender_source: senderProfile.source,
        magicpay_claim_mode: magicpayClaimMode,
        language,
      });

      // Sync to main ledger
      const config = getChainConfig(chain);
      await syncToMainLedger({
        senderWalletAddress: senderProfile.wallet_address,
        receiverWalletAddress: recipientProfile?.wallet_address || null,
        senderPayTag: senderProfile.pay_tag,
        receiverPayTag: txType === 'magicpay' ? `MagicPay:${recipientIdentifier}` : recipientIdentifier,
        amount,
        fee: res.fee || 0,
        txHash: res.hash,
        monibotType: txType === 'magicpay' ? 'magicpay' : 'p2p_command',
        tweetId,
        chain,
        symbol: config.symbol,
        language,
      });

      results.push({ tag: recipientIdentifier, status: 'success', hash: res.hash });
      console.log(`    ✅ Sent $${amount} to @${tag} (${res.hash.substring(0, 18)}...)`);

    } catch (txError) {
      console.error(`    ❌ Failed for @${tag}:`, txError.message);

      let reason = 'Transaction failed';
      if (txError.message.includes('ERROR_BALANCE')) reason = 'Insufficient balance';
      else if (txError.message.includes('ERROR_ALLOWANCE')) reason = 'Insufficient allowance';
      else if (txError.message.includes('ERROR_DUPLICATE')) reason = 'Already processed';

      const isActuallyMagicPay = !recipientProfile;
      await logTransaction({
        sender_id: senderProfile.id,
        receiver_id: null,
        amount, fee: 0,
        tx_hash: `ERROR_BATCH_${txError.message.split(':')[0] || 'UNKNOWN'}`,
        type: isActuallyMagicPay ? 'magicpay' : 'p2p_command',
        tweet_id: tweetId,
        payer_pay_tag: senderProfile.pay_tag,
        recipient_pay_tag: tag,
        recipient_username: isActuallyMagicPay ? `@${tag}` : null,
        chain,
        sender_source: senderProfile.source,
        error_reason: txError.message.includes(':')
          ? txError.message.split(':').slice(1).join(':').trim()
          : `Batch payment to @${tag} failed: ${reason}.`,
        language,
      });

      results.push({ tag, status: 'failed', reason });

      // Stop batch if balance/allowance is exhausted
      if (reason === 'Insufficient balance' || reason === 'Insufficient allowance') {
        const remaining = recipientTags.slice(recipientTags.indexOf(tag) + 1);
        for (const r of remaining) {
          results.push({ tag: r, status: 'failed', reason: `${reason} (batch stopped)` });
        }
        break;
      }
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  console.log(`  📊 Batch complete: ${successCount}/${results.length} successful`);

  return {
    results,
    summary: { total: recipientTags.length, success: successCount, failed: failedCount },
  };
}

/**
 * Build a human-readable summary reply for multi-recipient results.
 * Used by VP-Social to generate the reply tweet.
 */
export function buildMultiRecipientReply(amount, results, summary) {
  const successTags = results.filter(r => r.status === 'success').map(r => `@${r.tag}`);
  const failedEntries = results.filter(r => r.status === 'failed');

  if (summary.success === summary.total) {
    return `Sent $${amount} each to ${successTags.join(', ')} (${summary.success}/${summary.total} successful)`;
  }

  if (summary.success === 0) {
    const reason = failedEntries[0]?.reason || 'unknown error';
    return `Could not process batch: ${reason} for ${summary.total} recipient${summary.total > 1 ? 's' : ''}`;
  }

  const failedSummary = failedEntries
    .slice(0, 3)
    .map(f => `@${f.tag}: ${f.reason}`)
    .join(', ');

  return `Sent $${amount} to ${successTags.join(', ')} (${summary.success}/${summary.total}). Failed: ${failedSummary}`;
}
