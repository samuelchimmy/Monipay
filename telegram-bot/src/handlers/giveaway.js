import { executeP2P } from '../../shared/blockchain.js';
import { getProfileByPlatformId, getProfileByMonitag, logMonibotTransaction, getSupabase } from '../../shared/database.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { detectChain } from '../utils/chain.js';
import { sendFeedbackPrompt } from '../utils/feedback.js';

export async function handleGiveaway(bot, msg, amount, maxParticipants, chain = null) {
  const rl = checkRateLimit(String(msg.from.id));
  if (!rl.allowed) {
    await bot.sendMessage(msg.chat.id, `⏳ Slow down! Try again in ${rl.retryAfter}s.`);
    return;
  }

  const sender = await getProfileByPlatformId('telegram', String(msg.from.id));
  if (!sender) {
    await bot.sendMessage(msg.chat.id, '❌ Not linked. Use /link first.');
    return;
  }

  const activeChain = chain || detectChain(msg.text || '') || sender.preferred_network || 'base';

  await bot.sendMessage(
    msg.chat.id,
    `🎁 *Giveaway by @${sender.pay_tag}!*\n\n💰 *$${amount}* each to the first *${maxParticipants}* people!\n\n👇 Drop your @MoniTag below to claim!`,
    { parse_mode: 'Markdown' }
  );

  let claimed = 0;
  const claimedTelegramIds = new Set();

  const handler = async (reply) => {
    if (reply.chat.id !== msg.chat.id || claimed >= maxParticipants) return;
    if (reply.from?.is_bot || claimedTelegramIds.has(reply.from.id)) return;

    const tagMatch = reply.text?.match(/@(\w[\w-]*)/);
    if (!tagMatch) return;
    const claimTag = tagMatch[1].toLowerCase();
    if (claimTag === 'monibot') return;

    const recipient = await getProfileByMonitag(claimTag);
    if (!recipient || recipient.id === sender.id) return;

    claimedTelegramIds.add(reply.from.id);
    claimed++;

    try {
      const result = await executeP2P(
        sender.wallet_address,
        recipient.wallet_address,
        amount,
        `tg_giveaway_${msg.message_id}_${claimed}`,
        activeChain
      );

      await logMonibotTransaction({
        senderId: sender.id,
        receiverId: recipient.id,
        amount,
        fee: result.fee,
        txHash: result.hash,
        type: 'giveaway',
        chain: activeChain,
        payerPayTag: sender.pay_tag,
        recipientPayTag: recipient.pay_tag,
      });

      await bot.sendMessage(
        msg.chat.id,
        `✅ *$${amount}* sent to *@${recipient.pay_tag}*! (${claimed}/${maxParticipants})`,
        { parse_mode: 'Markdown' }
      );

      // Prompt sender for feedback after successful distribution
      await sendFeedbackPrompt(bot, msg.chat.id, sender.id, result.hash, activeChain, getSupabase());

      if (claimed >= maxParticipants) {
        await bot.sendMessage(msg.chat.id, '🎁 *Giveaway complete!* All spots filled.', { parse_mode: 'Markdown' });
        bot.removeListener('message', handler);
      }
    } catch (e) {
      claimedTelegramIds.delete(reply.from.id);
      claimed--;
      if (e.message?.includes('ERROR_BALANCE')) {
        await bot.sendMessage(msg.chat.id, '❌ Giveaway ended — insufficient funds.');
        bot.removeListener('message', handler);
      }
    }
  };

  bot.on('message', handler);
  setTimeout(() => bot.removeListener('message', handler), 10 * 60 * 1000);
}
