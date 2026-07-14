/**
 * MoniBot Discord - Database Module
 * Handles profile lookups, command deduplication, and transaction logging
 */

import { createClient } from '@supabase/supabase-js';

let supabase;

export function initSupabase() {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  console.log('✅ Supabase initialized [Discord Bot]');
}

export function getSupabase() {
  return supabase;
}

// ============ Profile Lookups ============

/**
 * Normalize profile data from different sources
 */
function normalizeProfile(data, source) {
  if (!data) return null;

  const addresses = {
    base: source === 'profile' ? data.wallet_address : null,
    bsc: source === 'profile' ? data.wallet_address : null,
    celo: data.wallet_address, // common for both
    tempo: source === 'profile' ? data.wallet_address : null,
    solana: data.solana_address || null
  };

  return {
    id: data.id,
    source,
    pay_tag: data.pay_tag,
    preferred_network: (source === 'wallet_profile' && !data.preferred_network) ? 'celo' : data.preferred_network,
    bot_allowance_amount: data.bot_allowance_amount,
    discord_id: data.discord_id,
    telegram_id: data.telegram_id,
    x_user_id: data.x_user_id,
    x_username: data.x_username,
    addresses
  };
}

/**
 * Find a profile by Discord ID
 */
export async function getProfileByDiscordId(discordId) {
  // 1. Query profiles first
  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (data) return normalizeProfile(data, 'profile');

  // 2. Fallback to wallet_profiles
  ({ data, error } = await supabase
    .from('wallet_profiles')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle());

  if (error) {
    console.error(`❌ Error fetching profile by Discord ID ${discordId}:`, error.message);
    return null;
  }

  return normalizeProfile(data, 'wallet_profile');
}

/**
 * Find a profile by MoniTag
 */
export async function getProfileByMonitag(payTag) {
  const cleanTag = payTag.replace('@', '').toLowerCase();

  // 1. Query profiles first
  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('pay_tag', cleanTag)
    .maybeSingle();

  if (data) return normalizeProfile(data, 'profile');

  // 2. Fallback to wallet_profiles
  ({ data, error } = await supabase
    .from('wallet_profiles')
    .select('*')
    .ilike('pay_tag', cleanTag)
    .maybeSingle());

  if (error) {
    console.error(`❌ Error fetching profile by PayTag ${payTag}:`, error.message);
    return null;
  }

  return normalizeProfile(data, 'wallet_profile');
}

// ============ Command Deduplication ============

/**
 * Check if a command has already been processed
 */
export async function isCommandProcessed(platform, messageId) {
  const { data, error } = await supabase
    .from('platform_commands')
    .select('id')
    .eq('platform', platform)
    .eq('platform_message_id', messageId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Log a platform command
 */
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
      platform_message_id: platformMessageId,
      platform_user_id: platformUserId,
      platform_channel_id: platformChannelId,
      platform_server_id: platformServerId,
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

  if (error) {
    console.error('❌ Failed to log command:', error.message);
    return null;
  }
  return data;
}

/**
 * Update command status
 */
export async function updateCommandStatus(commandId, status, txHash = null, errorReason = null) {
  const update = { status, processed_at: new Date().toISOString() };
  if (txHash) update.result_tx_hash = txHash;
  if (errorReason) update.error_reason = errorReason;

  const { error } = await supabase
    .from('platform_commands')
    .update(update)
    .eq('id', commandId);

  if (error) {
    console.error(`❌ Failed to update command ${commandId}:`, error.message);
  }
}

/**
 * Mark command as replied
 */
export async function markCommandReplied(commandId) {
  const { error } = await supabase
    .from('platform_commands')
    .update({ replied_at: new Date().toISOString() })
    .eq('id', commandId);

  if (error) {
    console.error(`❌ Failed to mark command replied:`, error.message);
  }
}

// ============ Transaction Logging (shared ledger) ============

/**
 * Log to monibot_transactions for unified history.
 * Supports MagicPay (Social Escrow) transactions for unlinked users.
 */
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
}) {
  const isError = txHash?.startsWith('ERROR_');
  const status = isError ? 'failed' : 'completed';

  // --- MagicPay Branching Logic ---
  let finalType = type;
  let finalRecipientPayTag = recipientPayTag;
  let finalReceiverId = receiverId;

  const isMagicPay = type === 'magicpay' || type === 'magicpay_command';

  if (isMagicPay) {
    finalType = 'magicpay';
    finalReceiverId = null; // recipient is unlinked

    // Format: MagicPay:[Discord_User_ID]
    if (recipientPayTag?.startsWith('discord:')) {
      const discordId = recipientPayTag.split(':')[1];
      finalRecipientPayTag = `MagicPay:${discordId}`;
    } else if (recipientPayTag && !recipientPayTag.startsWith('MagicPay:')) {
      finalRecipientPayTag = `MagicPay:${recipientPayTag}`;
    }
  }

  const { error } = await supabase
    .from('monibot_transactions')
    .insert({
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
    });

  if (error) {
    console.error('❌ Failed to log monibot transaction:', error.message);
  }
}

// ============ Discord Server Tracking ============

/**
 * Track a Discord server
 */
export async function upsertDiscordServer(guildId, guildName, ownerId, memberCount) {
  const { error } = await supabase
    .from('discord_servers')
    .upsert({
      guild_id: guildId,
      guild_name: guildName,
      owner_id: ownerId,
      member_count: memberCount,
      is_active: true,
    }, { onConflict: 'guild_id' });

  if (error) {
    console.error('❌ Failed to upsert Discord server:', error.message);
  }
}

/**
 * Mark server as inactive (bot was removed)
 */
export async function markServerInactive(guildId) {
  const { error } = await supabase
    .from('discord_servers')
    .update({ is_active: false })
    .eq('guild_id', guildId);

  if (error) {
    console.error('❌ Failed to mark server inactive:', error.message);
  }
}

/**
 * Fetch server configuration
 */
export async function getServerConfig(guildId) {
  const { data, error } = await supabase
    .from('discord_servers')
    .select('default_chain, chain_locked')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error || !data?.default_chain) return { default_chain: 'base', chain_locked: false };
  return data;
}

/**
 * Update server's default chain
 */
export async function updateServerChain(guildId, chain) {
  const { error } = await supabase
    .from('discord_servers')
    .update({ default_chain: chain })
    .eq('guild_id', guildId);

  if (error) {
    console.error(`❌ Failed to update server chain for ${guildId}:`, error.message);
    return false;
  }
  return true;
}

/**
 * Update a user's preferred network.
 */
/**
 * Fetch recent transaction history for a user.
 */
export async function getTransactionHistory(profileId, limit = 5) {
  const { data, error } = await supabase
    .from('monibot_transactions')
    .select('*')
    .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Failed to fetch transaction history:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch claimable MagicPay IOUs for a Discord ID.
 */
/**
 * Fetch top users in a guild by transaction volume.
 */
export async function getGuildLeaderboard(guildId, limit = 10) {
  const { data, error } = await supabase
    .from('platform_commands')
    .select('platform_user_id, parsed_amount')
    .eq('platform_server_id', guildId)
    .eq('status', 'completed')
    .order('processed_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch guild leaderboard:', error.message);
    return [];
  }

  // Aggregate by user
  const aggregates = (data || []).reduce((acc, curr) => {
    const userId = curr.platform_user_id;
    acc[userId] = (acc[userId] || 0) + (Number(curr.parsed_amount) || 0);
    return acc;
  }, {});

  // Convert to array and sort
  return Object.entries(aggregates)
    .map(([userId, volume]) => ({ userId, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}

export async function getClaimableIOUs(discordId) {
  const { data, error } = await supabase
    .from('ious')
    .select('*')
    .eq('platform_user_id', discordId)
    .eq('status', 'pending');

  if (error) {
    console.error('❌ Failed to fetch claimable IOUs:', error.message);
    return [];
  }
  return data || [];
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

// ============ Feedback Prompts ============

/**
 * Check if a user is eligible for a feedback prompt.
 * Criteria:
 * 1. Not prompted in the last 7 days.
 * 2. Lifetime volume >= $10 OR last 5 transactions all succeeded.
 */
export async function checkFeedbackEligibility(profileId) {
  if (!profileId) return false;

  // 1. Check for prompt in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPrompt, error: promptError } = await supabase
    .from('feedback_prompts')
    .select('id')
    .eq('user_id', profileId)
    .gte('prompted_at', sevenDaysAgo)
    .maybeSingle();

  if (promptError) {
    console.error('❌ Error checking feedback prompts:', promptError.message);
  }
  if (recentPrompt) return false;

  // 2. Check lifetime volume
  const { data: volumeData, error: volumeError } = await supabase
    .from('monibot_transactions')
    .select('amount')
    .eq('sender_id', profileId)
    .eq('status', 'completed');

  if (volumeError) {
    console.error('❌ Error checking lifetime volume:', volumeError.message);
  } else {
    const totalVolume = volumeData.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    if (totalVolume >= 10) return true;
  }

  // 3. Check last 5 transactions
  const { data: lastTxs, error: txError } = await supabase
    .from('monibot_transactions')
    .select('status')
    .eq('sender_id', profileId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (txError) {
    console.error('❌ Error checking last transactions:', txError.message);
  } else if (lastTxs && lastTxs.length === 5) {
    const allSucceeded = lastTxs.every(tx => tx.status === 'completed');
    if (allSucceeded) return true;
  }

  return false;
}

/**
 * Log a feedback prompt send.
 */
export async function logFeedbackPrompt(profileId, txHash) {
  const { error } = await supabase
    .from('feedback_prompts')
    .insert({
      user_id: profileId,
      tx_hash: txHash,
      prompted_at: new Date().toISOString(),
    });

  if (error) {
    console.error('❌ Failed to log feedback prompt:', error.message);
  }
}

// ============ Campaign Helpers ============

/**
 * Get active campaigns for a specific network
 */
export async function getActiveCampaigns(network = 'base') {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .eq('network', network)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching campaigns:', error.message);
    return [];
  }
  return data || [];
}

// ============ Scheduled Jobs ============

/**
 * Create a scheduled job for deferred command execution
 */
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

  if (error) {
    console.error('❌ Failed to create scheduled job:', error.message);
    return null;
  }
  console.log(`✅ Scheduled job created: ${data.id} for ${scheduledAt}`);
  return data;
}

/**
 * Get pending scheduled jobs ready for execution
 */
export async function getPendingScheduledJobs() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now);

  if (error) {
    console.error('❌ Failed to fetch pending scheduled jobs:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch recently completed or failed scheduled jobs for Discord notification.
 */
export async function getCompletedScheduledJobs() {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .in('status', ['completed', 'failed'])
    .gte('started_at', twoMinAgo)
    .order('completed_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Failed to fetch completed jobs:', error.message);
    return [];
  }
  return (data || []).filter(j => j.payload?.platform === 'discord');
}

/**
 * Fetch all pending scheduled jobs for a specific user.
 */
export async function getPendingScheduledJobsForUser(discordId) {
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('source_author_id', discordId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch user scheduled jobs:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Cancel pending scheduled jobs for a user.
 */
export async function cancelScheduledJobs(discordId, jobId = null) {
  let query = supabase
    .from('scheduled_jobs')
    .update({ status: 'failed', error_message: 'Cancelled by user' })
    .eq('source_author_id', discordId)
    .eq('status', 'pending');

  if (jobId) {
    query = query.eq('id', jobId);
  }

  const { data, error } = await query.select();

  if (error) {
    console.error('❌ Failed to cancel scheduled jobs:', error.message);
    return 0;
  }
  return data?.length || 0;
}
