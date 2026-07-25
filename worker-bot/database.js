/**
 * MoniBot Worker - Database Module (v5.0)
 *
 * FIX B6: chain stored as lowercase everywhere (normalizeChain).
 * NEW: logTransaction accepts error_reason — a human-readable explanation
 *      of exactly what went wrong. VP-Social reads this to generate specific
 *      replies instead of generic error templates.
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeChain } from './chains.js';

let supabase;

export function initSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class {};
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  console.log('✅ Supabase initialized (Worker) 🗿');
}

export function getSupabase() {
  if (!supabase) throw new Error('Supabase not initialized');
  return supabase;
}

// ============ Profile Lookups ============

/**
 * Normalizes a profile row from either 'profiles' or 'wallet_profiles' table.
 */
function normalizeProfile(row, source) {
  if (!row) return null;

  // Initialize address mapping
  const addresses = {
    base: null,
    bsc: null,
    celo: row.wallet_address, // Both tables use wallet_address for Celo
    tempo: null,
    ink: null,
    solana: row.solana_address
  };

  // Populate multi-chain addresses for standard users
  if (source === 'profile') {
    addresses.base = row.wallet_address;
    addresses.bsc = row.wallet_address;
    addresses.tempo = row.wallet_address;
    addresses.ink = row.wallet_address;
  }

  // Set preferred network default for MiniPay
  const preferredNetwork = (source === 'wallet_profile' && !row.preferred_network)
    ? 'celo'
    : row.preferred_network;

  return {
    id: row.id,
    source: source,
    pay_tag: row.pay_tag,
    wallet_address: row.wallet_address,
    solana_address: row.solana_address,
    preferred_network: preferredNetwork,
    bot_allowance_amount: row.bot_allowance_amount,
    x_user_id: row.x_user_id,
    x_username: row.x_username,
    telegram_id: row.telegram_id,
    discord_id: row.discord_id,
    addresses: addresses
  };
}

export async function getProfileByXUsername(xUsername) {
  const clean = xUsername.replace('@', '').toLowerCase();

  // 1. Query profiles table first
  const { data: profile, error: pError } = await supabase
    .from('profiles').select('*')
    .ilike('x_username', clean).eq('x_verified', true).maybeSingle();

  if (pError) console.error('❌ Profile lookup (X):', pError.message);
  if (profile) return normalizeProfile(profile, 'profile');

  // 2. Fallback to wallet_profiles (MiniPay)
  const { data: walletProfile, error: wError } = await supabase
    .from('wallet_profiles').select('*')
    .ilike('x_username', clean).maybeSingle();

  if (wError) console.error('❌ Wallet Profile lookup (X):', wError.message);
  if (walletProfile) return normalizeProfile(walletProfile, 'wallet_profile');

  return null;
}

export async function getProfileByMonitag(payTag) {
  const clean = payTag.replace('@', '').toLowerCase();

  // 1. Query profiles table first
  const { data: profile, error: pError } = await supabase
    .from('profiles').select('*').ilike('pay_tag', clean).maybeSingle();

  if (pError) console.error('❌ Profile lookup (tag):', pError.message);
  if (profile) return normalizeProfile(profile, 'profile');

  // 2. Fallback to wallet_profiles (MiniPay)
  const { data: walletProfile, error: wError } = await supabase
    .from('wallet_profiles').select('*').ilike('pay_tag', clean).maybeSingle();

  if (wError) console.error('❌ Wallet Profile lookup (tag):', wError.message);
  if (walletProfile) return normalizeProfile(walletProfile, 'wallet_profile');

  return null;
}

export async function getProfileByWallet(walletAddress) {
  // 1. Query profiles table first
  const { data: profile } = await supabase
    .from('profiles').select('*').ilike('wallet_address', walletAddress).maybeSingle();

  if (profile) return normalizeProfile(profile, 'profile');

  // 2. Fallback to wallet_profiles (MiniPay)
  const { data: walletProfile } = await supabase
    .from('wallet_profiles').select('*').ilike('wallet_address', walletAddress).maybeSingle();

  if (walletProfile) return normalizeProfile(walletProfile, 'wallet_profile');

  return null;
}

// ============ Deduplication ============

export async function checkIfCommandProcessed(tweetId) {
  const { data } = await supabase
    .from('monibot_transactions').select('id').eq('tweet_id', tweetId).limit(1);
  return data && data.length > 0;
}

export async function checkIfAlreadyGranted(campaignId, profileId) {
  const { data } = await supabase
    .from('campaign_grants').select('id')
    .eq('campaign_id', campaignId).eq('profile_id', profileId).maybeSingle();
  return !!data;
}

export async function markAsGranted(campaignId, profileId) {
  await supabase.from('campaign_grants').insert({
    campaign_id: campaignId, profile_id: profileId, granted_at: new Date().toISOString(),
  });
}

// ============ Transaction Logging ============

/**
 * Logs a transaction to monibot_transactions.
 *
 * error_reason: plain-English explanation of what went wrong. VP-Social reads
 * this field to generate a specific reply (e.g. "you have $2.50 but tried to
 * send $5") instead of a generic "something went wrong" message.
 *
 * FIX B6: chain always stored lowercase.
 */
export async function logTransaction({
  sender_id,
  receiver_id,
  amount,
  fee,
  tx_hash,
  campaign_id = null,
  type,
  tweet_id = null,
  payer_pay_tag = null,
  recipient_pay_tag = null,
  recipient_username = null,
  chain = 'base',
  sender_source,              // NEW: 'profile' or 'wallet_profile'
  error_reason = null,
  language = 'english',
  magicpay_claim_mode = null, // NEW: 'mandatory' or 'default'
  platform = 'twitter',       // NEW: support telegram/discord dynamically
}) {
  const isError       = tx_hash?.startsWith('ERROR_');
  const isLimitReached = tx_hash === 'LIMIT_REACHED';
  const isCancelled   = tx_hash?.includes('CANCEL') || tx_hash?.includes('CANCELLED');
  const status        = isError ? 'failed' : isLimitReached ? 'limit_reached' : isCancelled ? 'cancelled' : 'completed';


  // Ensure MagicPay recipient tag is prefixed
  let finalRecipientTag = recipient_pay_tag;
  if (type === 'magicpay' && recipient_pay_tag && !recipient_pay_tag.startsWith('MagicPay:')) {
    finalRecipientTag = `MagicPay:${recipient_pay_tag}`;
  }

  // Map profile source to table name
  const senderSourceTable = sender_source === 'wallet_profile'
    ? 'wallet_profiles'
    : 'profiles';

  const insertData = {
    sender_id,
    receiver_id: type === 'magicpay' ? null : receiver_id,
    amount,
    fee,
    tx_hash,
    campaign_id,
    type,
    tweet_id,
    payer_pay_tag,
    recipient_pay_tag: finalRecipientTag,
    recipient_username,
    replied:    false,
    status,
    platform:   platform || 'twitter',
    chain:      normalizeChain(chain),
    sender_source: senderSourceTable,
    magicpay_claim_mode,
    created_at: new Date().toISOString(),
    error_reason: error_reason || (isError ? tx_hash : null),
    language,
  };

  const { error } = await supabase.from('monibot_transactions').insert(insertData);
  if (error) console.error('❌ logTransaction failed:', error.message);

  if (status === 'completed') await updateMissionStats(amount + (fee || 0));

  const emoji = isError ? '💀' : isLimitReached ? '⏳' : '🗿';
  console.log(`${emoji} [Tx] ${type} | ${status} | →@${finalRecipientTag}`);
}

// ============ Campaign Management ============

export async function getActiveCampaigns() {
  const { data } = await supabase.from('campaigns').select('*')
    .eq('status', 'active').order('created_at', { ascending: false }).limit(10);
  return data || [];
}

export async function getCampaignByTweetId(tweetId) {
  const { data } = await supabase.from('campaigns').select('*')
    .eq('tweet_id', tweetId).eq('status', 'active').maybeSingle();
  return data;
}

export async function incrementCampaignParticipants(tweetId, grantAmount) {
  const { data: campaign } = await supabase.from('campaigns')
    .select('id, current_participants, budget_spent, max_participants')
    .eq('tweet_id', tweetId).maybeSingle();
  if (!campaign) return;

  const newParticipants = (campaign.current_participants || 0) + 1;
  const newBudgetSpent  = (campaign.budget_spent || 0) + grantAmount;
  const shouldComplete  = campaign.max_participants && newParticipants >= campaign.max_participants;

  await supabase.from('campaigns').update({
    current_participants: newParticipants,
    budget_spent:         newBudgetSpent,
    status:               shouldComplete ? 'completed' : 'active',
    completed_at:         shouldComplete ? new Date().toISOString() : null,
  }).eq('id', campaign.id);
}

export async function checkAndCompleteCampaigns() {
  const { data: active } = await supabase.from('campaigns').select('*').eq('status', 'active');
  if (!active) return;
  for (const c of active) {
    if (c.max_participants && c.current_participants >= c.max_participants) {
      await supabase.from('campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', c.id);
    }
  }
}

// ============ Ledger Sync & Stats ============

export async function syncToMainLedger(params) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/functions/v1/monibot-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ action: 'logTransaction', ...params }),
    });
  } catch (error) {
    console.error('⚠️ Ledger sync failed:', error.message);
  }
}

async function updateMissionStats(amount) {
  try {
    const { data: stats } = await supabase.from('monibot_mission_stats').select('*').eq('id', 1).single();
    if (stats) {
      await supabase.from('monibot_mission_stats').update({
        spent_budget:  (stats.spent_budget || 0) + amount,
        last_tweet_at: new Date().toISOString(),
      }).eq('id', 1);
    }
  } catch (e) { console.error('⚠️ Mission Stats error:', e.message); }
}

export async function updateUserPreferredNetwork(profileId, source, chain) {
  const table = source === 'wallet_profile' ? 'wallet_profiles' : 'profiles';
  const { error } = await supabase
    .from(table)
    .update({ preferred_network: chain })
    .eq('id', profileId);

  if (error) {
    console.error(`❌ Failed to update user preferred network for ${profileId}:`, error.message);
    return false;
  }
  return true;
}

export async function getTwitterLeaderboard(limit = 3) {
  const { data, error } = await supabase
    .from('monibot_transactions')
    .select('payer_pay_tag, amount')
    .eq('status', 'completed')
    .eq('platform', 'twitter');

  if (error) {
    console.error('❌ Failed to fetch Twitter leaderboard:', error.message);
    return [];
  }

  const aggregates = (data || []).reduce((acc, curr) => {
    const tag = curr.payer_pay_tag;
    if (tag && tag !== 'MoniBot' && tag !== 'MoniPay') {
      acc[tag] = (acc[tag] || 0) + (Number(curr.amount) || 0);
    }
    return acc;
  }, {});

  return Object.entries(aggregates)
    .map(([tag, volume]) => ({ tag, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}
