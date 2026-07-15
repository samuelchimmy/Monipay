/**
 * MoniBot Discord - Giveaway Command Handler
 */

import { getProfileByDiscordId, getProfileByMonitag, logCommand, logMonibotTransaction, getServerConfig } from '../database.js';
import { executeP2P } from '../blockchain.js';
import { checkAllowance } from '../middleware/allowanceCheck.js';
import { withNonceQueue } from '../nonceManager.js';
import { buildGiveawayEmbed, buildGiveawayEndEmbed } from '../embeds/paymentEmbeds.js';
import { getExplorerUrl, resolveToken, resolveChainName } from '../chains.js';
import { sendFeedbackPrompt } from '../services/feedbackService.js';
import { sendOnboarding } from './onboardingHandler.js';
import { getSigmaError } from '../errors.js';
import { DEFAULT_CHAIN, COMMAND_STATUS, TX_TYPES, SUCCESS_PHRASES, getRandomPhrase, GIVEAWAY_LIMITS } from '../constants.js';
import logger from '../logger.js';

const log = logger.child({ module: 'giveawayHandler' });

export async function handleGiveaway(message, command) {
  const senderProfile = await getProfileByDiscordId(message.author.id);
  if (!senderProfile) {
    await sendOnboarding(message);
    return;
  }

  const serverConfig = message.guild ? await getServerConfig(message.guild.id) : { default_chain: DEFAULT_CHAIN, chain_locked: false };
  const activeChain = command.chain || senderProfile.preferred_network || serverConfig.default_chain || DEFAULT_CHAIN;

  const senderAddress = senderProfile.addresses[activeChain];
  if (!senderAddress) {
    await message.reply(`Your wallet address for ${resolveChainName(activeChain)} is missing.`);
    return;
  }

  const totalBudget = command.amount * command.maxParticipants;

  // Allowance sanity check (total giveaway budget)
  const allowanceCheck = await checkAllowance(senderAddress, totalBudget, activeChain, 'p2p', senderProfile);
  if (!allowanceCheck.ok) {
    await message.reply(allowanceCheck.message);
    return;
  }

  // Log the giveaway command
  await logCommand({
    platform: 'discord',
    platformMessageId: message.id,
    platformUserId: message.author.id,
    platformChannelId: message.channel.id,
    platformServerId: message.guild?.id || 'DM',
    commandType: 'giveaway',
    commandText: message.content,
    parsedAmount: command.amount,
    parsedRecipients: [],
    chain: activeChain,
    status: COMMAND_STATUS.PENDING,
    profileId: senderProfile.id,
  });

  const embed = buildGiveawayEmbed({
    senderPayTag: senderProfile.pay_tag,
    amount: command.amount,
    maxParticipants: command.maxParticipants,
    totalBudget,
  });

  await message.reply({ embeds: [embed] });

  // Create a collector for replies
  const filter = (m) => !m.author.bot && /@\w+/i.test(m.content);
  const collector = message.channel.createMessageCollector({ filter, time: GIVEAWAY_LIMITS.TIMEOUT_MS });

  let claimedCount = 0;
  const claimedUsers = new Set();

  collector.on('collect', async (reply) => {
    if (claimedCount >= command.maxParticipants) {
      collector.stop('limit');
      return;
    }

    // Prevent duplicate claims
    if (claimedUsers.has(reply.author.id)) return;

    // Extract monitag from reply
    const tagMatch = reply.content.match(/@(\w[\w-]*)/);
    if (!tagMatch) return;

    const claimTag = tagMatch[1].toLowerCase();
    if (claimTag === 'monibot' || claimTag === 'monipay') return;

    const recipientProfile = await getProfileByMonitag(claimTag);
    if (!recipientProfile) {
      await reply.reply(`@${claimTag} not found on MoniPay. Sign up at monipay.xyz first!`);
      return;
    }

    // Prevent self-giveaway
    if (recipientProfile.id === senderProfile.id) return;

    claimedUsers.add(reply.author.id);
    claimedCount++;

    try {
      const recipientAddress = recipientProfile.addresses[activeChain];
      if (!recipientAddress) {
        await reply.reply(`@${recipientProfile.pay_tag} only receives on Celo (MiniPay). Retry with "on celo".`);
        claimedUsers.delete(reply.author.id);
        claimedCount--;
        return;
      }

      const { hash, fee } = await withNonceQueue(activeChain, () =>
        executeP2P(
          senderAddress,
          recipientAddress,
          command.amount,
          `giveaway_${message.id}_${claimedCount}`,
          activeChain
        )
      );

      await logMonibotTransaction({
        senderId: senderProfile.id,
        receiverId: recipientProfile.id,
        amount: command.amount,
        fee,
        txHash: hash,
        type: TX_TYPES.P2P,
        payerPayTag: senderProfile.pay_tag,
        recipientPayTag: recipientProfile.pay_tag,
        chain: activeChain.toUpperCase(),
      });

      const explorerUrl = getExplorerUrl(activeChain, hash);
      await reply.reply(
        `${getRandomPhrase(SUCCESS_PHRASES)} **$${command.amount.toFixed(2)} ${resolveToken(activeChain)}** sent to **@${recipientProfile.pay_tag}** on **${resolveChainName(activeChain)}**! (${claimedCount}/${command.maxParticipants})\n[View TX](${explorerUrl}) | \`${hash}\``
      );

      // Feedback prompt for the person claiming the giveaway
      await sendFeedbackPrompt(reply, hash, activeChain, recipientProfile.id);

      if (claimedCount >= command.maxParticipants) {
        collector.stop('limit');
      }
    } catch (error) {
      log.error('Giveaway transfer error', { tag: claimTag, error: error.message });
      claimedUsers.delete(reply.author.id);
      claimedCount--;

      if (error.message.includes('ERROR_BALANCE')) {
        await reply.reply(`${getSigmaError('ERROR_BALANCE')}\nGiveaway ended — sender ran out of funds.`);
        collector.stop('funds');
      } else if (error.message.includes('ERROR_ALLOWANCE')) {
        await reply.reply(`${getSigmaError('ERROR_ALLOWANCE', 'p2p')}\nGiveaway paused — sender needs to set allowance.`);
        collector.stop('allowance');
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        await reply.reply('Network is busy — please try claiming again in a moment.');
      } else {
        await reply.reply('Transfer failed — please try again.');
      }
    }
  });

  collector.on('end', (collected, reason) => {
    const endEmbed = buildGiveawayEndEmbed({
      claimedCount,
      maxParticipants: command.maxParticipants,
      reason,
    });
    message.channel.send({ embeds: [endEmbed] });
  });
}
