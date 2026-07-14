/**
 * MoniBot Discord - Multi-Send Handler
 * Parallelized multi-send with concurrency limits using Promise pool.
 */

import { getProfileByDiscordId, getProfileByMonitag, logCommand, updateCommandStatus, getServerConfig } from '../database.js';
import { checkAllowance } from '../middleware/allowanceCheck.js';
import { executeSinglePayment } from '../services/paymentService.js';
import { buildMultiSendResultsEmbed } from '../embeds/paymentEmbeds.js';
import { resolveChainName, resolveActiveChain } from '../chains.js';
import { sendFeedbackPrompt } from '../services/feedbackService.js';
import { sendOnboarding } from './onboardingHandler.js';
import { DEFAULT_CHAIN, COMMAND_STATUS } from '../constants.js';
import logger from '../logger.js';

const log = logger.child({ module: 'multiSendHandler' });

// Concurrency limiter for parallel sends
const MAX_CONCURRENT_SENDS = 3;

/**
 * Promise pool: Execute async functions with a concurrency limit.
 */
async function promisePool(tasks, concurrency) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task().then(result => {
      executing.delete(p);
      return result;
    });
    results.push(p);
    executing.add(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

export async function handleP2PMulti(message, command, client) {
  const senderProfile = await getProfileByDiscordId(message.author.id);
  if (!senderProfile) {
    await sendOnboarding(message);
    return;
  }

  // Identify all recipients
  const allRecipients = [];
  const seenProfileIds = new Set();
  const seenDiscordIds = new Set();

  // 1. Filter out mentioned IDs from tags to prevent double-processing
  const mentionedIds = Array.from(message.mentions.users.keys());
  const cleanTags = (command.recipients || []).filter(tag => !mentionedIds.some(id => tag.includes(id)));

  // 2. Process Tags (Pure MoniTags)
  for (const tag of cleanTags) {
    const profile = await getProfileByMonitag(tag);
    if (profile) {
      if (!seenProfileIds.has(profile.id)) {
        allRecipients.push({ type: 'p2p', profile, label: `@${profile.pay_tag}` });
        seenProfileIds.add(profile.id);
        if (profile.discord_id) seenDiscordIds.add(profile.discord_id);
      }
    } else {
      allRecipients.push({ type: 'failed', label: `@${tag}`, reason: 'Not found' });
    }
  }

  // 3. Process Mentions
  const mentionedUsers = message.mentions.users.filter(u => u.id !== client.user.id);
  for (const user of mentionedUsers.values()) {
    if (seenDiscordIds.has(user.id)) continue;

    const profile = await getProfileByDiscordId(user.id);
    if (profile) {
      if (!seenProfileIds.has(profile.id)) {
        allRecipients.push({ type: 'p2p', profile, label: `@${profile.pay_tag}` });
        seenProfileIds.add(profile.id);
        seenDiscordIds.add(user.id);
      }
    } else {
      allRecipients.push({ type: 'magicpay', user, label: `<@${user.id}>` });
      seenDiscordIds.add(user.id);
    }
  }

  if (allRecipients.length === 0) {
    await message.reply('No valid recipients found.');
    return;
  }

  const serverConfig = message.guild ? await getServerConfig(message.guild.id) : { default_chain: DEFAULT_CHAIN, chain_locked: false };
  let baseChain;
  try {
    baseChain = resolveActiveChain(command.chain, senderProfile, serverConfig);
  } catch (err) {
    if (err.message.startsWith('CHAIN_LOCKED:')) {
      await message.reply(err.message.split(':')[1]);
      return;
    }
    throw err;
  }

  // MiniPay sender restriction — auto-route to Celo instead of hard-rejecting
  let miniPayRerouted = false;
  if (senderProfile.source === 'wallet_profile' && baseChain !== 'celo') {
    baseChain = 'celo';
    miniPayRerouted = true;
  }

  // Recipient chain availability check — flag MiniPay recipients with a helpful hint
  const unreachable = allRecipients.filter(r => r.type === 'p2p' && !r.profile.addresses[baseChain]);
  if (unreachable.length > 0) {
    const list = unreachable.map(r => r.label).join(', ');
    const allMiniPay = unreachable.every(r => r.profile.source === 'wallet_profile');
    await message.reply(
      allMiniPay
        ? `${list} use MiniPay and only receive on Celo. Retry with \`on celo\` added to your command.`
        : `${list} don't have wallets on ${resolveChainName(baseChain)}. Try adding \`on celo\` or check their supported chains.`
    );
    return;
  }

  const senderAddress = senderProfile.addresses[baseChain];
  if (!senderAddress) {
    await message.reply(`Your wallet address for ${resolveChainName(baseChain)} is missing.`);
    return;
  }

  // Allowance sanity check (total = per-person x valid recipient count)
  const validRecipients = allRecipients.filter(r => r.type !== 'failed');
  const totalAmount = command.amount * validRecipients.length;

  const firstContext = validRecipients[0]?.type === 'magicpay' ? 'magicpay' : 'p2p';
  const allowanceCheck = await checkAllowance(senderAddress, totalAmount, baseChain, firstContext, senderProfile);
  if (!allowanceCheck.ok) {
    await message.reply(allowanceCheck.message);
    return;
  }

  // Log command
  const cmd = await logCommand({
    platform: 'discord',
    platformMessageId: message.id,
    platformUserId: message.author.id,
    platformChannelId: message.channel.id,
    platformServerId: message.guild?.id || 'DM',
    commandType: 'p2p_multi',
    commandText: message.content,
    parsedAmount: command.amount,
    parsedRecipients: validRecipients.map(r => r.type === 'magicpay' ? r.user.id : r.profile.pay_tag),
    chain: baseChain,
    status: COMMAND_STATUS.PROCESSING,
    profileId: senderProfile.id,
  });

  const processingMsg = await message.reply(
    `Sending **$${command.amount}** each to **${validRecipients.length}** recipients on **${resolveChainName(baseChain)}**${miniPayRerouted ? ' _(MiniPay wallet — routed to Celo)_' : ''}...`
  );

  // Build task list for parallel execution
  const tasks = allRecipients.map(target => () => processMultiSendTarget({
    target,
    senderProfile,
    amount: command.amount,
    baseChain,
    messageId: message.id,
  }));

  // Execute with concurrency limit
  const settled = await promisePool(tasks, MAX_CONCURRENT_SENDS);
  const results = settled.map(s => s.status === 'fulfilled' ? s.value : { status: 'failed', label: '?', reason: 'Internal error' });

  const successCount = results.filter(r => r.status === 'success').length;
  const finalStatus = successCount === results.length
    ? COMMAND_STATUS.COMPLETED
    : COMMAND_STATUS.PARTIALLY_COMPLETED;
  await updateCommandStatus(cmd?.id, finalStatus);

  const hasMagicPay = results.some(r => r.isMagicPay);
  const successPayload = buildMultiSendResultsEmbed({
    results,
    totalRecipients: results.length,
    hasMagicPay,
    chain: baseChain,
    senderSource: senderProfile.source,
  });

  const magicPayMentions = results
    .filter(r => r.status === 'success' && r.isMagicPay)
    .map(r => r.label)
    .join(' ');

  await processingMsg.edit({
    content: magicPayMentions || null,
    embeds: successPayload.embeds,
    components: successPayload.components
  });

  // Feedback prompt for multi-send (use first successful tx hash)
  const firstSuccess = results.find(r => r.status === 'success');
  if (firstSuccess) {
    await sendFeedbackPrompt(message, firstSuccess.hash, firstSuccess.chain || baseChain, senderProfile.id);
  }
}

/**
 * Process a single target in a multi-send batch.
 */
async function processMultiSendTarget({ target, senderProfile, amount, baseChain, messageId }) {
  if (target.type === 'failed') {
    return { label: target.label, status: 'failed', reason: target.reason };
  }

  const isMagicPay = target.type === 'magicpay';
  const commandId = `${messageId}_${isMagicPay ? target.user.id : target.profile.id}`;

  const result = await executeSinglePayment({
    senderProfile,
    recipientProfile: isMagicPay ? null : target.profile,
    recipientUser: isMagicPay ? target.user : null,
    amount,
    chain: baseChain,
    commandId,
    isMagicPay,
  });

  if (result.success) {
    return {
      label: target.label,
      status: 'success',
      hash: result.hash,
      chain: result.chain,
      rerouted: result.rerouted,
      originalChain: result.originalChain,
      isMagicPay,
    };
  } else {
    return {
      label: target.label,
      status: 'failed',
      reason: result.sigmaError || result.error,
    };
  }
}
