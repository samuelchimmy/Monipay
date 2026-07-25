/**
 * MoniBot BSC Worker - Scheduler Module
 * 
 * Handles scheduled jobs including cross-chain P2P (Base → BSC).
 * Same logic as Base worker scheduler, shared database tables.
 */

import * as chrono from 'chrono-node';
import { getSupabase, getProfileByMonitag, getProfileByXUsername, logTransaction, syncToMainLedger } from './database.js';
import { executeP2PViaRouter, calculateFee } from './blockchain.js';
import { evaluateTimeExpression } from './gemini.js';

// ============ Time Parsing ============

export async function parseTimeExpression(text, referenceDate = new Date()) {
  const chronoResults = chrono.parse(text, referenceDate);
  
  if (chronoResults.length > 0) {
    const result = chronoResults[0];
    return {
      scheduledAt: result.start.date(),
      confidence: 'high',
      parsed: result.text,
      source: 'chrono'
    };
  }
  
  try {
    const geminiResult = await evaluateTimeExpression(text, referenceDate);
    if (geminiResult.scheduledAt) {
      return {
        scheduledAt: new Date(geminiResult.scheduledAt),
        confidence: geminiResult.confidence || 'medium',
        parsed: geminiResult.interpreted,
        source: 'gemini'
      };
    }
  } catch (error) {
    console.error('⏰ Gemini time parsing failed:', error.message);
  }
  
  return null;
}

// ============ Job Creation ============

export async function createScheduledJob({
  type,
  scheduledAt,
  payload,
  sourceTweetId,
  sourceAuthorId,
  sourceAuthorUsername
}) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .insert({
      type,
      scheduled_at: scheduledAt.toISOString(),
      payload,
      source_tweet_id: sourceTweetId,
      source_author_id: sourceAuthorId,
      source_author_username: sourceAuthorUsername
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Failed to create scheduled job:', error.message);
    throw error;
  }
  
  console.log(`✅ Scheduled ${type} job for ${scheduledAt.toISOString()}`);
  return data;
}

// ============ Job Polling ============

export async function getDueJobs() {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .lt('attempts', 3)
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  if (error) {
    console.error('❌ Failed to fetch due jobs:', error.message);
    return [];
  }
  
  // Filter: only process cross_chain_p2p jobs targeting 'bsc' chain
  return (data || []).filter(job => {
    if (job.type === 'conditional_sports_p2p') return false; // Ignore sports oracle jobs
    if (job.type === 'cross_chain_p2p') {
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      return payload?.chain === 'bsc';
    }
    return true;
  });
}

export async function claimJob(jobId) {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: supabase.rpc ? undefined : 1
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select()
    .single();
  
  if (error || !data) {
    return null;
  }
  
  await supabase
    .from('scheduled_jobs')
    .update({ attempts: (data.attempts || 0) + 1 })
    .eq('id', jobId);
  
  return data;
}

export async function completeJob(jobId, result) {
  const supabase = getSupabase();
  
  await supabase
    .from('scheduled_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result
    })
    .eq('id', jobId);
  
  console.log(`✅ Job ${jobId} completed`);
}

export async function failJob(jobId, errorMessage) {
  const supabase = getSupabase();
  
  const { data } = await supabase
    .from('scheduled_jobs')
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .single();
  
  const attempts = data?.attempts || 1;
  const maxAttempts = data?.max_attempts || 3;
  
  const newStatus = attempts >= maxAttempts ? 'failed' : 'pending';
  
  await supabase
    .from('scheduled_jobs')
    .update({
      status: newStatus,
      error_message: errorMessage,
      started_at: null
    })
    .eq('id', jobId);
  
  if (newStatus === 'failed') {
    console.log(`❌ Job ${jobId} permanently failed after ${attempts} attempts`);
  } else {
    console.log(`⚠️ Job ${jobId} failed, will retry (attempt ${attempts}/${maxAttempts})`);
  }
}

// ============ Job Execution ============

async function executeRandomPick(job) {
  const { payload, source_tweet_id } = job;
  const { count, grant_amount } = payload;
  
  console.log(`🎲 Executing random pick: ${count} winners for tweet ${source_tweet_id}`);
  
  return {
    type: 'random_pick',
    count,
    grant_amount,
    source_tweet_id,
    winners: []
  };
}

async function executeCampaignPost(job) {
  const { payload } = job;
  const { message, budget, grant_amount, max_participants } = payload;
  
  console.log(`📢 Executing campaign post: "${message?.substring(0, 50)}..."`);
  
  return {
    type: 'campaign_post',
    message,
    budget,
    grant_amount,
    max_participants,
    ready_for_social: true
  };
}

export async function executeJob(job) {
  const { type } = job;
  
  switch (type) {
    case 'random_pick':
      return executeRandomPick(job);
    
    case 'campaign_post':
      return executeCampaignPost(job);
    
    case 'cross_chain_p2p':
      return executeCrossChainP2P(job);
    
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

/**
 * Execute a cross-chain P2P transfer that was deferred from Base to BSC.
 * The Base worker detected insufficient Base funds but the user has BSC funds.
 */
async function executeCrossChainP2P(job) {
  const { payload, source_tweet_id } = job;
  const { senderWalletAddress, senderPayTag, senderProfileId, targetPayTag, amount } = payload;
  
  console.log(`\n🔀 [Cross-Chain] Executing deferred P2P on BSC: ${senderPayTag} → @${targetPayTag} ($${amount} USDT)`);
  console.log(`   Original chain: ${payload.originalChain} | Reason: ${payload.reason}`);
  
  const receiverProfile = await getProfileByMonitag(targetPayTag) || await getProfileByXUsername(targetPayTag);
  if (!receiverProfile) {
    console.log(`   ❌ Target @${targetPayTag} not found.`);
    await logTransaction({
      sender_id: senderProfileId,
      receiver_id: senderProfileId,
      amount: amount,
      fee: 0,
      tx_hash: 'ERROR_TARGET_NOT_FOUND',
      type: 'p2p_command',
      tweet_id: source_tweet_id,
      payer_pay_tag: senderPayTag,
      recipient_pay_tag: targetPayTag
    });
    return { type: 'cross_chain_p2p', status: 'failed', reason: 'target_not_found' };
  }
  
  try {
    const { hash, fee: actualFee } = await executeP2PViaRouter(
      senderWalletAddress,
      receiverProfile.wallet_address,
      amount,
      source_tweet_id
    );
    
    const netAmountReceived = amount - actualFee;
    
    await logTransaction({
      sender_id: senderProfileId,
      receiver_id: receiverProfile.id,
      amount: netAmountReceived,
      fee: actualFee,
      tx_hash: hash,
      type: 'p2p_command',
      tweet_id: source_tweet_id,
      payer_pay_tag: senderPayTag,
      recipient_pay_tag: receiverProfile.pay_tag
    });
    
    const MONIBOT_WALLET_ADDRESS = process.env.MONIBOT_WALLET_ADDRESS || '0x...';
    await syncToMainLedger({
      senderWalletAddress,
      receiverWalletAddress: receiverProfile.wallet_address,
      senderPayTag,
      receiverPayTag: receiverProfile.pay_tag,
      amount: netAmountReceived,
      fee: actualFee,
      txHash: hash,
      monibotType: 'p2p',
      tweetId: source_tweet_id
    });
    
    console.log(`   ✅ Cross-chain P2P Success on BSC! TX: ${hash}`);
    return { type: 'cross_chain_p2p', status: 'success', hash, chain: 'bsc' };
    
  } catch (txError) {
    console.error(`   ❌ Cross-chain P2P failed:`, txError.message);
    
    let errorCode = 'ERROR_BLOCKCHAIN';
    if (txError.message.includes('ERROR_BALANCE')) errorCode = 'ERROR_BALANCE';
    else if (txError.message.includes('ERROR_ALLOWANCE')) errorCode = 'ERROR_ALLOWANCE';
    else if (txError.message.includes('ERROR_DUPLICATE_TWEET')) errorCode = 'ERROR_DUPLICATE_TWEET';
    
    await logTransaction({
      sender_id: senderProfileId,
      receiver_id: receiverProfile.id,
      amount: amount,
      fee: 0,
      tx_hash: errorCode,
      type: 'p2p_command',
      tweet_id: source_tweet_id,
      payer_pay_tag: senderPayTag,
      recipient_pay_tag: receiverProfile.pay_tag
    });
    
    return { type: 'cross_chain_p2p', status: 'failed', reason: errorCode };
  }
}

// ============ Main Scheduler Loop ============

export async function processScheduledJobs() {
  const dueJobs = await getDueJobs();
  
  if (dueJobs.length === 0) {
    return;
  }
  
  console.log(`⏰ Found ${dueJobs.length} due job(s)`);
  
  for (const job of dueJobs) {
    const claimed = await claimJob(job.id);
    if (!claimed) {
      console.log(`⏭️ Job ${job.id} already claimed, skipping`);
      continue;
    }
    
    try {
      const result = await executeJob(claimed);
      await completeJob(job.id, result);
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error.message);
      await failJob(job.id, error.message);
    }
  }
}

// ============ Command Parsing ============

export async function parseScheduledCommand(text) {
  const lowerText = text.toLowerCase();
  
  const randomPickMatch = lowerText.match(/pick\s+(\d+)\s+random.*?(in\s+.+|at\s+.+|tomorrow|tonight)/i);
  
  if (randomPickMatch) {
    const count = parseInt(randomPickMatch[1], 10);
    const timePhrase = randomPickMatch[2];
    
    const timeResult = await parseTimeExpression(timePhrase);
    if (!timeResult) return null;
    
    return {
      type: 'random_pick',
      count: Math.min(count, 50),
      scheduledAt: timeResult.scheduledAt,
      timePhrase: timeResult.parsed
    };
  }
  
  const campaignMatch = lowerText.match(/(post|tweet|announce).*?(in\s+.+|at\s+.+|tomorrow|tonight)/i);
  
  if (campaignMatch) {
    const timePhrase = campaignMatch[2];
    const timeResult = await parseTimeExpression(timePhrase);
    if (!timeResult) return null;
    
    return {
      type: 'campaign_post',
      scheduledAt: timeResult.scheduledAt,
      timePhrase: timeResult.parsed
    };
  }
  
  return null;
}
