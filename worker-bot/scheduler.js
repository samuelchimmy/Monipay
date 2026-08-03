/**
 * MoniBot Worker - Scheduler v5.0
 *
 * Handles Twitter scheduled jobs without posting to Twitter directly.
 * Every execution outcome is logged to monibot_transactions so VP-Social
 * can reply through the normal DB handshake.
 */

import { getSupabase, getProfileByMonitag, getProfileByXUsername, logTransaction, syncToMainLedger } from './database.js';
import { executeP2PViaRouter, executeMagicPay, getChainConfig } from './blockchain.js';
import { normalizeChain } from './chains.js';
import { determineMagicPayClaimMode } from './minipay.js';

function parseJobError(error) {
  const message = error?.message || 'Scheduled job failed.';
  const errorCode = message.startsWith('ERROR_')
    ? message.split(':')[0]
    : 'ERROR_SCHEDULER';
  const errorReason = message.includes(':')
    ? message.split(':').slice(1).join(':').trim() || message
    : message;

  return { message, errorCode, errorReason };
}

function getJobContext(job) {
  const payload = job.payload || {};
  const command = payload.command || {};
  const chain = normalizeChain(command.chain || payload.chain || 'celo');
  const rawAmount = command.amount ?? payload.amount;
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
  const tweetId = payload.tweetId || job.source_tweet_id || null;
  const platform = payload.platform || job.platform || 'twitter';

  return {
    payload,
    command,
    chain,
    amount,
    tweetId,
    senderId: payload.senderId || process.env.MONIBOT_PROFILE_ID,
    senderPayTag: payload.senderPayTag || 'unknown',
    senderWallet: payload.senderWallet,
    platform,
  };
}

function buildCompletedResult(job, extra = {}) {
  return {
    ...(job.result || {}),
    ...extra,
    ready_for_social: true,
    social_posted: false,
  };
}

async function logScheduledOutcome({
  job,
  type,
  amount,
  fee = 0,
  txHash,
  receiverId = null,
  recipientPayTag = null,
  chain,
  senderSource = 'profile',
  magicpayClaimMode = null,
  errorReason = null,
  language = 'english',
}) {
  const { tweetId, senderId, senderPayTag, platform } = getJobContext(job);

  // Normalize type for database check constraint
  let finalType = type;
  if (type === 'scheduled_p2p' || type === 'cross_chain_p2p' || type === 'scheduled_giveaway') {
    finalType = 'p2p_command';
  } else if (type === 'scheduled_magicpay') {
    finalType = 'magicpay';
  }
  let recipientUsername = null;
  const payload = job.payload || {};
  if (recipientPayTag) {
    if (recipientPayTag.startsWith('MagicPay:')) {
      const val = recipientPayTag.split(':')[1] || '';
      if (/^\d+$/.test(val)) {
        recipientUsername = payload.recipientPayTag ? payload.recipientPayTag.replace('@', '') : null;
      } else {
        recipientUsername = val;
      }
    } else {
      recipientUsername = recipientPayTag.replace('@', '');
    }
  } else if (payload.recipientPayTag) {
    recipientUsername = payload.recipientPayTag.replace('@', '');
  }

  await logTransaction({
    sender_id: senderId,
    receiver_id: receiverId,
    amount,
    fee,
    tx_hash: txHash,
    type: finalType,
    tweet_id: tweetId,
    payer_pay_tag: senderPayTag,
    recipient_pay_tag: recipientPayTag,
    recipient_username: recipientUsername,
    chain,
    sender_source: senderSource,
    magicpay_claim_mode: magicpayClaimMode,
    error_reason: errorReason,
    language,
    platform,
  });

}

async function resolveScheduledRecipient(payload, command) {
  if (payload.receiverWallet) {
    return {
      walletAddress: payload.receiverWallet,
      receiverId: payload.receiverId || null,
      recipientPayTag: command.recipients?.[0] || payload.recipientPayTag || null,
    };
  }

  const recipientTag = command.recipients?.[0];
  if (!recipientTag) {
    throw new Error('ERROR_TARGET_NOT_FOUND:Scheduled P2P is missing a recipient pay tag.');
  }

  const recipient = await getProfileByMonitag(recipientTag) || await getProfileByXUsername(recipientTag);
  if (!recipient) {
    throw new Error(`ERROR_TARGET_NOT_FOUND:@${recipientTag} is not a registered MoniPay tag.`);
  }

  return {
    walletAddress: recipient.wallet_address,
    receiverId: recipient.id,
    recipientPayTag: recipient.pay_tag,
  };
}

async function executeScheduledTransfer(job) {
  const { payload, command, chain, amount, tweetId, senderWallet, senderPayTag } = getJobContext(job);
  const isMagicPay = job.type === 'scheduled_magicpay' || command.isMagicPay;
  const language = payload.language || 'english';

  const senderProfile = await getProfileByMonitag(senderPayTag) || await getProfileByXUsername(senderPayTag);
  const senderSource = senderProfile?.source || 'profile';

  if (!senderWallet) {
    throw new Error('ERROR_SCHEDULER:Scheduled job is missing senderWallet.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('ERROR_SCHEDULER:Scheduled job is missing a valid amount.');
  }

  if (isMagicPay) {
    const recipientId = command.recipientId || payload.recipientId;
    if (!recipientId) {
      throw new Error('ERROR_TARGET_NOT_FOUND:Scheduled MagicPay is missing a recipient Twitter ID.');
    }

    const res = await executeMagicPay(senderWallet, recipientId, amount, chain);
    const fee = res.fee || 0;

    const magicpayClaimMode = determineMagicPayClaimMode(senderProfile, chain);

    await logScheduledOutcome({
      job,
      type: 'magicpay',
      amount,
      fee,
      txHash: res.hash,
      receiverId: null,
      recipientPayTag: recipientId,
      chain,
      senderSource,
      magicpayClaimMode,
      language,
    });

    const config = getChainConfig(chain);
    await syncToMainLedger({
      senderWalletAddress: senderWallet,
      receiverWalletAddress: null,
      senderPayTag: senderPayTag,
      receiverPayTag: `MagicPay:${recipientId}`,
      amount,
      fee,
      txHash: res.hash,
      monibotType: 'magicpay',
      tweetId: tweetId,
      chain: chain,
      symbol: config.symbol,
      language,
    });

    return {
      txHash: res.hash,
      fee,
      results: [{ tag: recipientId, status: 'success', hash: res.hash }],
    };
  }

  const recipient = await resolveScheduledRecipient(payload, command);
  const referenceId = tweetId || `${job.id}_scheduled_p2p`;
  const res = await executeP2PViaRouter(
    senderWallet,
    recipient.walletAddress,
    amount,
    referenceId,
    chain
  );
  const fee = res.fee || 0;

  await logScheduledOutcome({
    job,
    type: job.type,
    amount,
    fee,
    txHash: res.hash,
    receiverId: recipient.receiverId,
    recipientPayTag: recipient.recipientPayTag,
    chain,
    senderSource,
    language,
  });

  const config = getChainConfig(chain);
  await syncToMainLedger({
    senderWalletAddress: senderWallet,
    receiverWalletAddress: recipient.walletAddress,
    senderPayTag: senderPayTag,
    receiverPayTag: recipient.recipientPayTag,
    amount,
    fee,
    txHash: res.hash,
    monibotType: 'p2p_command',
    tweetId: tweetId,
    chain: chain,
    symbol: config.symbol,
    language,
  });

  return {
    txHash: res.hash,
    fee,
    results: [{ tag: recipient.recipientPayTag, status: 'success', hash: res.hash }],
  };
}

async function executeScheduledGiveaway(job) {
  const { payload, command, chain, amount, tweetId, senderWallet, senderPayTag } = getJobContext(job);
  const language = payload.language || 'english';

  const senderProfile = await getProfileByMonitag(senderPayTag) || await getProfileByXUsername(senderPayTag);
  const senderSource = senderProfile?.source || 'profile';

  if (!senderWallet) {
    throw new Error('ERROR_SCHEDULER:Scheduled giveaway is missing senderWallet.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('ERROR_SCHEDULER:Scheduled giveaway is missing a valid amount.');
  }
  if (!Array.isArray(command.recipients) || command.recipients.length === 0) {
    throw new Error('ERROR_TARGET_NOT_FOUND:Scheduled giveaway is missing recipients.');
  }

  const results = [];
  let txHash = null;
  let totalFee = 0;

  for (const tag of command.recipients) {
    const recipient = await getProfileByMonitag(tag);

    if (!recipient) {
      const errorReason = `@${tag} is not a registered MoniPay tag.`;
      results.push({ tag, status: 'failed', reason: errorReason });

      await logScheduledOutcome({
        job,
        type: 'scheduled_giveaway',
        amount,
        fee: 0,
        txHash: 'ERROR_TARGET_NOT_FOUND',
        receiverId: null,
        recipientPayTag: tag,
        chain,
        senderSource,
        errorReason,
        language,
      });
      continue;
    }

    try {
      const res = await executeP2PViaRouter(
        senderWallet,
        recipient.wallet_address,
        amount,
        `${tweetId || job.id}_giveaway_${tag}`,
        chain
      );
      const fee = res.fee || 0;

      txHash = txHash || res.hash;
      totalFee += fee;
      results.push({ tag: recipient.pay_tag, status: 'success', hash: res.hash });

      await logScheduledOutcome({
        job,
        type: 'scheduled_giveaway',
        amount,
        fee,
        txHash: res.hash,
        receiverId: recipient.id,
        recipientPayTag: recipient.pay_tag,
        chain,
        senderSource,
        language,
      });

      const config = getChainConfig(chain);
      await syncToMainLedger({
        senderWalletAddress: senderWallet,
        receiverWalletAddress: recipient.wallet_address,
        senderPayTag: senderPayTag,
        receiverPayTag: recipient.pay_tag,
        amount,
        fee,
        txHash: res.hash,
        monibotType: 'p2p_command',
        tweetId: tweetId,
        chain: chain,
        symbol: config.symbol,
        language,
      });
    } catch (error) {
      const { errorCode, errorReason } = parseJobError(error);
      results.push({ tag, status: 'failed', reason: errorReason });

      await logScheduledOutcome({
        job,
        type: 'scheduled_giveaway',
        amount,
        fee: 0,
        txHash: errorCode,
        receiverId: null,
        recipientPayTag: tag,
        chain,
        senderSource,
        errorReason,
        language,
      });
    }
  }

  return {
    txHash,
    fee: totalFee,
    results,
  };
}

let lastSchedulerCheck = 0;
export async function processScheduledJobs() {
  const nowMs = Date.now();
  if (nowMs - lastSchedulerCheck < 30000) return;
  lastSchedulerCheck = nowMs;

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: rawJobs, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .limit(20);

  if (error) {
    console.error('❌ Scheduled job fetch failed:', error.message);
    return;
  }

  const jobs = (rawJobs || [])
    .filter(job => (!job.payload?.platform || job.payload.platform === 'twitter') && job.type !== 'conditional_sports_p2p')
    .slice(0, 5);

  if (jobs.length === 0) return;
  console.log(`⏰ ${jobs.length} scheduled Twitter job(s) due.`);

  for (const job of jobs) {
    try {
      await supabase.from('scheduled_jobs')
        .update({ status: 'processing', started_at: now })
        .eq('id', job.id);

      let result;
      if (job.type === 'scheduled_p2p' || job.type === 'cross_chain_p2p' || job.type === 'scheduled_magicpay') {
        result = await executeScheduledTransfer(job);
      } else if (job.type === 'scheduled_giveaway') {
        result = await executeScheduledGiveaway(job);
      } else {
        throw new Error(`ERROR_SCHEDULER:Unknown job type: ${job.type}`);
      }

      await supabase.from('scheduled_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: buildCompletedResult(job, result),
      }).eq('id', job.id);

      console.log(`✅ Scheduled Job ${job.id.substring(0, 8)} (${job.type}) completed.`);
    } catch (error) {
      const { message, errorCode, errorReason } = parseJobError(error);
      const { chain, amount, command } = getJobContext(job);
      const recipientPayTag = command.recipients?.[0] || command.recipientId || null;

      console.error(`❌ Scheduled Job ${job.id} failed:`, message);

      await supabase.from('scheduled_jobs').update({
        status: 'failed',
        error_message: message,
        result: {
          ...(job.result || {}),
          error_reason: errorReason,
          social_posted: false,
          ready_for_social: false,
        },
      }).eq('id', job.id);

      await logScheduledOutcome({
        job,
        type: job.type,
        amount: Number.isFinite(amount) ? amount : 0,
        fee: 0,
        txHash: errorCode,
        receiverId: null,
        recipientPayTag,
        chain,
        senderSource: 'profile', // Default for overall job failure
        errorReason,
        language: job.payload?.language || 'english',
      });
    }
  }
}
