/**
 * MoniBot Discord - P2P Payment Handler
 * Uses PaymentService for execution with cross-chain fallback.
 */

import { getProfileByDiscordId, getProfileByMonitag, logCommand, updateCommandStatus, getServerConfig } from '../database.js';
import { checkAllowance } from '../middleware/allowanceCheck.js';
import { executeSinglePayment } from '../services/paymentService.js';
import { buildPaymentSuccessEmbed } from '../embeds/paymentEmbeds.js';
import { resolveChainName, resolveActiveChain } from '../chains.js';
import { sendFeedbackPrompt, getFeedbackUrlIfEligible } from '../services/feedbackService.js';
import { getSigmaError } from '../errors.js';
import { DEFAULT_CHAIN, COMMAND_STATUS } from '../constants.js';
import { aiTransactionReply } from '../../ai.js';
import { sendOnboarding } from './onboardingHandler.js';
import logger from '../logger.js';

const log = logger.child({ module: 'p2pHandler' });

export async function handleP2P(message, command, isAI = false, client) {
  const senderProfile = await getProfileByDiscordId(message.author.id);
  if (!senderProfile) {
    await sendOnboarding(message);
    return;
  }

  let recipientProfile = null;
  let isMagicPay = false;
  let recipientUser = message.mentions.users.filter(u => u.id !== client.user.id).first();
  const recipientTag = command.recipients[0];

  // 1. Priority: MoniTag profile
  if (recipientTag) {
    recipientProfile = await getProfileByMonitag(recipientTag);
  }

  // 2. Secondary: Discord mention
  if (!recipientProfile && recipientUser) {
    recipientProfile = await getProfileByDiscordId(recipientUser.id);
    if (!recipientProfile) {
      isMagicPay = true;
    }
  }

  if (!recipientProfile && !isMagicPay) {
    await message.reply(getSigmaError('ERROR_RECIPIENT_NOT_FOUND'));
    return;
  }

  if (!isMagicPay && senderProfile.id === recipientProfile.id) {
    await message.reply("You can't send to yourself.");
    return;
  }

  if (isMagicPay && message.author.id === recipientUser.id) {
    await message.reply("You can't send to yourself.");
    return;
  }

  const serverConfig = message.guild ? await getServerConfig(message.guild.id) : { default_chain: DEFAULT_CHAIN, chain_locked: false };
  let activeChain;
  try {
    activeChain = resolveActiveChain(command.chain, senderProfile, serverConfig);
  } catch (err) {
    if (err.message.startsWith('CHAIN_LOCKED:')) {
      await message.reply(err.message.split(':')[1]);
      return;
    }
    throw err;
  }

  // MiniPay sender restriction — auto-route to Celo instead of hard-rejecting
  let miniPayRerouted = false;
  if (senderProfile.source === 'wallet_profile' && activeChain !== 'celo') {
    activeChain = 'celo';
    miniPayRerouted = true;
  }

  // Recipient address resolution/validation
  if (!isMagicPay && !recipientProfile.addresses[activeChain]) {
    const isMiniPayRecipient = recipientProfile.source === 'wallet_profile';
    await message.reply(
      isMiniPayRecipient
        ? `**@${recipientProfile.pay_tag}** uses MiniPay and only receives on Celo. Retry with \`on celo\` — e.g. \`!monibot send $${command.amount} to @${recipientProfile.pay_tag} on celo\``
        : `**@${recipientProfile.pay_tag}** doesn't have a wallet on ${resolveChainName(activeChain)}. Try a different chain.`
    );
    return;
  }

  const senderAddress = senderProfile.addresses[activeChain];
  if (!senderAddress) {
    await message.reply(`Your wallet address for ${resolveChainName(activeChain)} is missing.`);
    return;
  }

  // Allowance pre-check
  const allowanceCheck = await checkAllowance(senderAddress, command.amount, activeChain, isMagicPay ? 'magicpay' : 'p2p', senderProfile);
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
    commandType: isMagicPay ? 'magicpay' : 'p2p',
    commandText: message.content,
    parsedAmount: command.amount,
    parsedRecipients: [isMagicPay ? recipientUser.id : (recipientProfile.pay_tag || recipientTag)],
    chain: activeChain,
    status: COMMAND_STATUS.PROCESSING,
    profileId: senderProfile.id,
  });

  const recipientLabel = isMagicPay ? `<@${recipientUser.id}>` : `@${recipientProfile.pay_tag}`;
  const chainNote = miniPayRerouted ? ` _(MiniPay wallet — routed to Celo)_` : '';
  const processingMsg = await message.reply(`Sending **$${command.amount}** to **${recipientLabel}** on ${resolveChainName(activeChain)}...${chainNote}`);

  // Execute payment via PaymentService
  const result = await executeSinglePayment({
    senderProfile,
    recipientProfile,
    recipientUser,
    amount: command.amount,
    chain: activeChain,
    commandId: cmd?.id || message.id,
    isMagicPay,
  });

  if (result.success) {
    await updateCommandStatus(cmd?.id, COMMAND_STATUS.COMPLETED, result.hash);

    // Generate AI reply if applicable
    let aiReply = null;
    if (isAI) {
      aiReply = await aiTransactionReply({
        type: isMagicPay
          ? (result.rerouted ? 'magicpay_reroute' : 'magicpay_success')
          : (result.rerouted ? 'p2p_rerouted' : 'p2p_success'),
        amount: command.amount,
        fee: result.fee,
        symbol: '',
        recipient: isMagicPay ? recipientUser.username : recipientProfile.pay_tag,
        sender: senderProfile.pay_tag,
        chain: resolveChainName(result.chain),
        final_chain: resolveChainName(result.chain),
        original_chain: resolveChainName(activeChain),
        is_rerouted: result.rerouted,
        txHash: result.hash,
      });
    }

    let feedbackUrl = null;
    if (result.hash) {
      feedbackUrl = await getFeedbackUrlIfEligible(senderProfile.id, result.hash, result.chain);
    }

    const successPayload = buildPaymentSuccessEmbed({
      amount: command.amount,
      fee: result.fee,
      chain: result.chain,
      hash: result.hash,
      recipientLabel: isMagicPay ? `<@${recipientUser.id}>` : `@${recipientProfile.pay_tag}`,
      isMagicPay,
      rerouted: result.rerouted,
      originalChain: activeChain,
      aiReply,
      senderSource: senderProfile.source,
      feedbackUrl,
    });

    const replyPayload = {
      content: isMagicPay ? `<@${recipientUser.id}>` : null,
      embeds: successPayload.embeds,
      components: successPayload.components
    };
    await processingMsg.edit(replyPayload);
  } else {
    await updateCommandStatus(cmd?.id, COMMAND_STATUS.FAILED, null, result.error?.substring(0, 200));
    await processingMsg.edit(`${result.sigmaError}`);
  }
}
