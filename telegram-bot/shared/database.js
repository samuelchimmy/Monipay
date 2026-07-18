/**
 * DATABASE MIGRATIONS
 *
 * -- Add chain_locked column to discord_servers table
 * ALTER TABLE discord_servers ADD COLUMN IF NOT EXISTS chain_locked BOOLEAN DEFAULT FALSE;
 *
 * -- Ensure guild_name column exists
 * ALTER TABLE discord_servers ADD COLUMN IF NOT EXISTS guild_name TEXT;
 */

import { createClient } from '@supabase/supabase-js';

let supabase;

export function initSupabase() {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    realtime: { enabled: false },
  });
}

export function getSupabase() {
  return supabase;
}

function normalizeProfile(row, source) {
  if (!row) return null;

  const addresses = {
    base: source === 'wallet_profile' ? null : row.wallet_address,
    bsc: source === 'wallet_profile' ? null : row.wallet_address,
    celo: row.wallet_address,
    tempo: source === 'wallet_profile' ? null : row.wallet_address,
    ink: source === 'wallet_profile' ? null : row.wallet_address,
    solana: row.solana_address,
  };

  return {
    id: row.id,
    source,
    pay_tag: row.pay_tag,
    preferred_network: source === 'wallet_profile' ? (row.preferred_network || 'celo') : row.preferred_network,
    bot_allowance_amount: row.bot_allowance_amount,
    telegram_id: row.telegram_id,
    discord_id: row.discord_id,
    x_user_id: row.x_user_id,
    x_username: row.x_username,
    addresses,
  };
}

export async function getProfileByPlatformId(platform, platformId) {
  const column = platform === 'telegram' ? 'telegram_id' : platform === 'discord' ? 'discord_id' : null;
  if (!column) return null;

  // 1. Query profiles first
  const { data: pData, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq(column, String(platformId))
    .maybeSingle();

  if (!pError && pData) return normalizeProfile(pData, 'profile');

  // 2. Fallback to wallet_profiles
  const { data: wpData, error: wpError } = await supabase
    .from('wallet_profiles')
    .select('*')
    .eq(column, String(platformId))
    .maybeSingle();

  if (!wpError && wpData) return normalizeProfile(wpData, 'wallet_profile');

  return null;
}

export async function getProfileByMonitag(payTag) {
  const cleanTag = payTag.replace('@', '').toLowerCase();

  // 1. Query profiles first
  const { data: pData, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('pay_tag', cleanTag)
    .maybeSingle();

  if (!pError && pData) return normalizeProfile(pData, 'profile');

  // 2. Fallback to wallet_profiles
  const { data: wpData, error: wpError } = await supabase
    .from('wallet_profiles')
    .select('*')
    .ilike('pay_tag', cleanTag)
    .maybeSingle();

  if (!wpError && wpData) return normalizeProfile(wpData, 'wallet_profile');

  return null;
}

export async function isCommandProcessed(platform, messageId) {
  const { data, error } = await supabase
    .from('platform_commands')
    .select('id')
    .eq('platform', platform)
    .eq('platform_message_id', String(messageId))
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function logCommand({
  platform,
  platformMessageId,
  platformUserId,
  platformChannelId,
  platformServerId,
  commandType,
  commandText,
  parsedAmount,
  parsedRecipients,
  chain = 'base',
  status = 'pending',
  resultTxHash = null,
  errorReason = null,
  profileId = null,
}) {
  const { data, error } = await supabase
    .from('platform_commands')
    .upsert({
      platform,
      platform_message_id: String(platformMessageId),
      platform_user_id: String(platformUserId),
      platform_channel_id: String(platformChannelId),
      platform_server_id: platformServerId ? String(platformServerId) : null,
      command_type: commandType,
      command_text: commandText,
      parsed_amount: parsedAmount,
      parsed_recipients: parsedRecipients,
      chain,
      status,
      result_tx_hash: resultTxHash,
      error_reason: errorReason,
      profile_id: profileId,
      processed_at: status !== 'pending' ? new Date().toISOString() : null,
    }, { onConflict: 'platform,platform_message_id' })
    .select()
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function updateCommandStatus(commandId, status, txHash = null, errorReason = null) {
  const update = { status, processed_at: new Date().toISOString() };
  if (txHash) update.result_tx_hash = txHash;
  if (errorReason) update.error_reason = errorReason;
  await supabase.from('platform_commands').update(update).eq('id', commandId);
}

export async function markCommandReplied(commandId) {
  await supabase
    .from('platform_commands')
    .update({ replied_at: new Date().toISOString() })
    .eq('id', commandId);
}

export async function logMonibotTransaction({
  senderId,
  receiverId,
  amount,
  fee,
  txHash,
  campaignId = null,
  type,
  tweetId = null,
  payerPayTag = null,
  recipientPayTag = null,
  chain = 'base',
  senderSource = 'profiles',
  magicpayClaimMode = 'default',
}) {
  const isError = txHash?.startsWith('ERROR_');
  const status = isError ? 'failed' : 'completed';

  let finalType = type;
  let finalRecipientPayTag = recipientPayTag;
  let finalReceiverId = receiverId;
  const isMagicPay = type === 'magicpay' || type === 'magicpay_command';

  if (isMagicPay) {
    finalType = 'magicpay';
    finalReceiverId = null;
    if (recipientPayTag?.startsWith('discord:') || recipientPayTag?.startsWith('telegram:')) {
      const id = recipientPayTag.split(':')[1];
      finalRecipientPayTag = `MagicPay:${id}`;
    } else if (recipientPayTag && !recipientPayTag.startsWith('MagicPay:')) {
      finalRecipientPayTag = `MagicPay:${recipientPayTag}`;
    }
  }

  const { data: tx, error } = await supabase.from('monibot_transactions').insert({
    sender_id: senderId,
    receiver_id: finalReceiverId,
    amount,
    fee,
    tx_hash: txHash,
    campaign_id: campaignId,
    type: finalType,
    tweet_id: tweetId,
    payer_pay_tag: payerPayTag,
    recipient_pay_tag: finalRecipientPayTag,
    chain,
    status,
    replied: false,
    retry_count: 0,
    sender_source: senderSource,
    magicpay_claim_mode: magicpayClaimMode,
  }).select().maybeSingle();

  return tx;
}

export async function getServerConfig(groupId) {
  const { data, error } = await supabase
    .from('discord_servers')
    .select('default_chain, chain_locked')
    .eq('guild_id', String(groupId))
    .maybeSingle();

  if (error || !data?.default_chain) return 'base';
  return data.default_chain;
}

export async function updateServerChain(groupId, chain, groupName = null) {
  // Check if already locked
  const { data: existing } = await supabase
    .from('discord_servers')
    .select('chain_locked, default_chain')
    .eq('guild_id', String(groupId))
    .maybeSingle();

  if (existing?.chain_locked) {
    return { success: false, locked: true, currentChain: existing.default_chain };
  }

  const { error } = await supabase
    .from('discord_servers')
    .upsert({
      guild_id: String(groupId),
      guild_name: groupName,
      default_chain: chain,
      chain_locked: true,   // LOCK immediately on first set
      is_active: true,
    }, { onConflict: 'guild_id' });

  return { success: !error, locked: false };
}

export async function createScheduledJob({
  type,
  scheduledAt,
  payload,
  sourceAuthorId = null,
  sourceAuthorUsername = null,
  sourceTweetId = null,
}) {
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .insert({
      type,
      scheduled_at: scheduledAt,
      payload,
      status: 'pending',
      source_author_id: sourceAuthorId,
      source_author_username: sourceAuthorUsername,
      source_tweet_id: sourceTweetId,
    })
    .select()
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function getPendingScheduledJobs() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now);

  if (error) return [];
  return data || [];
}

export async function getCompletedScheduledJobs() {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .in('status', ['completed', 'failed'])
    .gte('started_at', twoMinAgo)
    .order('completed_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return (data || []).filter(j => j.payload?.platform === 'telegram');
}
