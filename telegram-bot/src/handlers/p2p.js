import { aiTransactionReply } from '../../shared/ai.js';
import { executeP2P, executeMagicPay } from '../../shared/blockchain.js';
import { CHAIN_CONFIGS } from '../../shared/chains.js';
import { findAlternateChain } from '../../shared/crossChainCheck.js';
import {
  getProfileByPlatformId,
  getProfileByMonitag,
  isCommandProcessed,
  logCommand,
  updateCommandStatus,
  markCommandReplied,
  logMonibotTransaction
} from '../../shared/database.js';
import { createMagicPayRecord } from '../../shared/iou.js';
import { getChainConfig } from '../../shared/chains.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { checkAllowance } from '../utils/allowance.js';
import { resolveChain, detectToken } from '../utils/chain.js';
import { extractTelegramMentions } from '../utils/mentions.js';
import { buildSuccessReply, buildErrorReply, getSigmaError, formatTxLine, escapeMd, buildParseError } from '../utils/replies.js';
import { sendFeedbackPrompt } from '../utils/feedback.js';
import { getSupabase } from '../../shared/database.js';

function isValidAmount(amount) {
  return amount > 0 && Number.isFinite(amount) && amount <= 10000;
}

// Token symbol extraction from raw message text
const TOKEN_SYMBOL_RE = /\b(G\$|gooddollar|USDm|USDC|USDT0|USDT|αUSD|alphausd)\b/i;
function extractToken(text) {
  const m = text.match(TOKEN_SYMBOL_RE);
  if (!m) return null;
  const t = m[1].toLowerCase();
  if (t === 'g$' || t === 'gooddollar') return 'G$';
  if (t === 'usdm') return 'USDm';
  if (t === 'usdc') return 'USDC';
  if (t === 'usdt0') return 'USDT0';
  if (t === 'αusd' || t === 'alphausd') return 'αUSD';
  return 'USDT';
}

export function parseCommand(text) {
  const tokenSymbol = extractToken(text);

  const giveaway = text.match(/(?:giveaway)\s+\$?([\d.]+)\s*(?:[\w$]+\s+)?(?:to\s+)?(?:the\s+)?(?:first\s+)?(\d+)/i);
  if (giveaway) {
    return { type: 'giveaway', amount: parseFloat(giveaway[1]), maxParticipants: parseInt(giveaway[2], 10), tokenSymbol };
  }

  const multi = text.match(/(?:send|pay)\s+\$?([\d.]+)\s*(?:[\w$]+\s+)?each\s+to\s+(.*)/i);
  if (multi) {
    const recipients = (multi[2].match(/@(\w[\w-]*)/g) || []).map(m => m.slice(1).toLowerCase()).filter(r => r !== 'monibot');
    if (recipients.length > 0) return { type: 'p2p_multi', amount: parseFloat(multi[1]), recipients, tokenSymbol };
  }

  const single = text.match(/(?:send|pay)\s+\$?([\d.]+)\s*(?:[\w$]+\s+)?(?:to\s+)?@(\w[\w-]*)/i);
  if (single) return { type: 'p2p', amount: parseFloat(single[1]), recipients: [single[2].toLowerCase()], tokenSymbol };
  return null;
}

async function sendPayment(bot, msg, sender, recipient, amount, chain, commandId, contextLabel = 'p2p', tokenSymbol = null) {
  const chainConfig = getChainConfig(chain, tokenSymbol);
  const senderAddr = sender.addresses[chain];
  const recipientAddr = recipient.addresses[chain];

  const allowanceCheck = await checkAllowance(senderAddr, amount, chain, contextLabel, sender.bot_allowance_amount, sender.source);
  if (!allowanceCheck.ok) {
    return { ok: false, reason: 'ERROR_ALLOWANCE', allowance: allowanceCheck.allowance };
  }

  try {
    const result = await executeP2P(senderAddr, recipientAddr, amount, commandId, chain, tokenSymbol);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, reason: error.message, error };
  }
}

export async function handleP2P(bot, msg, cmd) {
  const rl = checkRateLimit(String(msg.from.id));
  if (!rl.allowed) {
    await bot.sendMessage(msg.chat.id, `⏳ Slow down! Try again in ${rl.retryAfter}s.\n\n_Tip: use \`/schedule\` to queue commands for later._`, { parse_mode: 'Markdown' });
    return;
  }

  if (await isCommandProcessed('telegram', String(msg.message_id))) return;

  // Typing indicator — instant feedback while we fetch profile
  await bot.sendChatAction(msg.chat.id, 'typing');

  const sender = await getProfileByPlatformId('telegram', String(msg.from.id));
  if (!sender) {
    // Context-aware onboarding: tell them what they were trying to do
    const intentHint = cmd.amount && cmd.recipients?.length
      ? `\n\nLooks like you're trying to send *$${cmd.amount}* to *@${cmd.recipients[0]}* — you just need to link your account first. Takes 30 seconds.`
      : '';
    const isGroup = msg.chat.type !== 'private';
    const linkMsg = isGroup
      ? `🔗 *Link your account to start sending.*${intentHint}\n\n👉 DM @monipaybot privately to set up, or go to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI → Link Telegram.\n\n_MiniPay users: open the MiniPay app → Monipay miniapp → Link Telegram._`
      : `🔗 *Link your account to start sending.*${intentHint}\n\n1️⃣ Go to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI → Link Telegram\n2️⃣ Enter your Telegram ID: \`${msg.from.id}\`\n\n_MiniPay users: open the MiniPay app → Monipay miniapp → Link Telegram._`;
    await bot.sendMessage(msg.chat.id, linkMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
    return;
  }

  // "Did you mean" guidance — detect what's missing before failing
  if (!isValidAmount(cmd.amount)) {
    if (!cmd.amount) {
      await bot.sendMessage(msg.chat.id,
        `❓ *How much did you want to send?*\n\nTry: \`send $5 to @${cmd.recipients?.[0] || 'alice'}\``,
        { parse_mode: 'Markdown' }
      );
    } else if (cmd.amount > 10000) {
      await bot.sendMessage(msg.chat.id,
        `❌ Max single transaction is *$10,000*. Did you mean *$${(cmd.amount / 100).toFixed(2)}*?\n\nRetry with the correct amount.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(msg.chat.id, '❌ Invalid amount. Use a value between $0.01 and $10,000.');
    }
    return;
  }

  if (!cmd.recipients?.length) {
    await bot.sendMessage(msg.chat.id,
      `❓ *Who are you sending to?*\n\nTry: \`send $${cmd.amount} to @alice\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const chain = await resolveChain(msg.text || '', sender, msg.chat.id);

  // MiniPay sender enforcement
  if (sender.source === 'wallet_profile' && chain !== 'celo') {
    await bot.sendMessage(msg.chat.id,
      `❌ *MiniPay wallets send on Celo only.*\n\nRetry with \`on celo\`, or sign up at monipay.xyz for multi-chain support.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const commandLog = await logCommand({
    platform: 'telegram',
    platformMessageId: String(msg.message_id),
    platformUserId: String(msg.from.id),
    platformChannelId: String(msg.chat.id),
    platformServerId: msg.chat.type !== 'private' ? String(msg.chat.id) : null,
    commandType: cmd.type,
    commandText: msg.text || '',
    parsedAmount: cmd.amount,
    parsedRecipients: cmd.recipients,
    chain,
    status: 'processing',
    profileId: sender.id,
  });

  const commandId = commandLog?.id;

  // Keep typing alive during processing
  await bot.sendChatAction(msg.chat.id, 'typing');

  const mentions = extractTelegramMentions(msg);
  const results = [];

  for (const tag of cmd.recipients) {
    // Parallel: fetch recipient profile and check allowance simultaneously
    const [byTag, allowanceCheck] = await Promise.all([
      getProfileByMonitag(tag),
      checkAllowance(
        sender.addresses[chain],
        cmd.amount,
        chain,
        'p2p',
        sender.bot_allowance_amount,
        sender.source
      ),
    ]);

    if (byTag) {
      if (byTag.id === sender.id) {
        results.push({ tag, ok: false, reason: 'ERROR_SELF_SEND' });
        continue;
      }

      // Recipient address resolution/enforcement
      if (!byTag.addresses[chain]) {
        const recipientIsMiniPay = byTag.source === 'wallet_profile';
        const msg2 = recipientIsMiniPay
          ? `❌ *@${tag}* is a MiniPay user — they only receive on Celo. Retry with \`on celo\` or they can sign up at monipay.xyz for multi-chain support.`
          : `❌ *@${tag}* doesn't have a wallet on ${chain.toUpperCase()}. Try a different chain.`;
        results.push({ tag, ok: false, reason: msg2 });
        continue;
      }

      if (!allowanceCheck.ok) {
        results.push({ tag, ok: false, reason: 'ERROR_ALLOWANCE', allowance: allowanceCheck.allowance });
        continue;
      }

      const firstTry = await sendPayment(bot, msg, sender, byTag, cmd.amount, chain, `${msg.message_id}_${tag}`);
      if (firstTry.ok) {
        results.push({ tag, ok: true, fee: firstTry.fee, netAmount: firstTry.netAmount, hash: firstTry.hash, chain });
        continue;
      }

      const senderAddr = sender.addresses[chain];
      const alt = await findAlternateChain(senderAddr, cmd.amount, chain, 'p2p');
      if (alt && !alt.needsAllowance) {
        const retry = await sendPayment(bot, msg, sender, byTag, cmd.amount, alt.chain, `${msg.message_id}_${tag}_alt`);
        if (retry.ok) {
          results.push({ tag, ok: true, fee: retry.fee, netAmount: retry.netAmount, hash: retry.hash, chain: alt.chain, rerouted: `${chain} -> ${alt.chain}` });
          continue;
        }
      }

      results.push({
        tag,
        ok: false,
        reason: (alt && alt.needsAllowance) ? 'ERROR_REROUTE_ALLOWANCE' : (firstTry.reason || 'Payment failed'),
        allowance: firstTry.allowance,
        chain: (alt && alt.needsAllowance) ? alt.chain : chain,
        context: { type: 'p2p', fromChain: chain }
      });
      continue;
    }

    const mention = mentions.find(m => m.username === tag.toLowerCase());
    if (!mention) {
      results.push({ tag, ok: false, reason: 'ERROR_RECIPIENT_NOT_FOUND' });
      continue;
    }

    const mentionProfile = mention.userId ? await getProfileByPlatformId('telegram', String(mention.userId)) : null;
    if (mentionProfile) {
      if (mentionProfile.id === sender.id) {
        results.push({ tag, ok: false, reason: 'ERROR_SELF_SEND' });
        continue;
      }

      // Recipient address resolution/enforcement
      if (!mentionProfile.addresses[chain]) {
        const recipientIsMiniPay = mentionProfile.source === 'wallet_profile';
        const msg2 = recipientIsMiniPay
          ? `❌ *@${tag}* is a MiniPay user — they only receive on Celo. Retry with \`on celo\` or they can sign up at monipay.xyz for multi-chain support.`
          : `❌ *@${tag}* doesn't have a wallet on ${chain.toUpperCase()}. Try a different chain.`;
        results.push({ tag, ok: false, reason: msg2 });
        continue;
      }

      if (!allowanceCheck.ok) {
        results.push({ tag, ok: false, reason: 'ERROR_ALLOWANCE', allowance: allowanceCheck.allowance });
        continue;
      }

      const linkedResult = await sendPayment(bot, msg, sender, mentionProfile, cmd.amount, chain, `${msg.message_id}_${tag}_linked`);
      if (linkedResult.ok) {
        results.push({ tag, ok: true, fee: linkedResult.fee, netAmount: linkedResult.netAmount, hash: linkedResult.hash, chain });
      } else {
        results.push({ tag, ok: false, reason: linkedResult.reason || 'Payment failed' });
      }
      continue;
    }

    const platformUserId = String(mention.userId || mention.username);
    const senderAddr = sender.addresses[chain];

    if (!allowanceCheck.ok) {
      results.push({ tag, ok: false, reason: 'ERROR_ALLOWANCE', allowance: allowanceCheck.allowance, context: 'magicpay' });
      continue;
    }

    try {
      const magic = await executeMagicPay(senderAddr, platformUserId, cmd.amount, chain, 'telegram');
      const chainConfig = getChainConfig(chain);
      const iou = await createMagicPayRecord({
        senderProfileId: sender.id,
        senderPayTag: sender.pay_tag,
        senderHandle: msg.from.username || msg.from.first_name || `tg_${msg.from.id}`,
        senderPlatformUserId: String(msg.from.id),
        recipientUsername: mention.username,
        platform: 'telegram',
        platformUserId,
        amount: cmd.amount,
        chain,
        token: chainConfig.tokenAddress,
        tokenSymbol: chainConfig.symbol,
        txHash: magic.hash,
        iouId: magic.iouId || `iou_telegram_${platformUserId}_${Date.now()}`,
      });
      if (!iou) {
        results.push({ tag, ok: false, reason: 'ERROR_SYNC', context: 'magicpay' });
        continue;
      }
      results.push({ tag, ok: true, fee: magic.fee, netAmount: magic.netAmount, hash: magic.hash, chain, isMagicPay: true, platformUserId });
    } catch (error) {
      const alt = await findAlternateChain(senderAddr, cmd.amount, chain, 'magicpay');
      if (alt && !alt.needsAllowance) {
        try {
          const magicAlt = await executeMagicPay(senderAddr, platformUserId, cmd.amount, alt.chain, 'telegram');
          const chainConfig = getChainConfig(alt.chain);
          const iouAlt = await createMagicPayRecord({
            senderProfileId: sender.id,
            senderPayTag: sender.pay_tag,
            senderHandle: msg.from.username || msg.from.first_name || `tg_${msg.from.id}`,
            senderPlatformUserId: String(msg.from.id),
            recipientUsername: mention.username,
            platform: 'telegram',
            platformUserId,
            amount: cmd.amount,
            chain: alt.chain,
            token: chainConfig.tokenAddress,
            tokenSymbol: chainConfig.symbol,
            txHash: magicAlt.hash,
            iouId: magicAlt.iouId || `iou_telegram_${platformUserId}_${Date.now()}`,
          });
          if (!iouAlt) {
            results.push({ tag, ok: false, reason: 'ERROR_SYNC', context: 'magicpay' });
            continue;
          }
          results.push({ tag, ok: true, fee: magicAlt.fee, netAmount: magicAlt.netAmount, hash: magicAlt.hash, chain: alt.chain, isMagicPay: true, rerouted: `${chain} -> ${alt.chain}` });
          continue;
        } catch {}
      }
      results.push({
        tag,
        ok: false,
        reason: (alt && alt.needsAllowance) ? 'ERROR_REROUTE_ALLOWANCE' : (error.message || 'MagicPay failed'),
        chain: (alt && alt.needsAllowance) ? alt.chain : chain,
        context: { type: 'magicpay', fromChain: chain }
      });
    }
  }

  const successes = results.filter(r => r.ok);
  const failures = results.filter(r => !r.ok);

  if (commandId) {
    if (successes.length > 0) {
      await updateCommandStatus(commandId, 'completed', successes[0].hash);
      await markCommandReplied(commandId);
    } else {
      await updateCommandStatus(commandId, 'failed', null, failures[0]?.reason || 'Unknown failure');
    }
  }

  for (const r of successes) {
    const isMagicPay = !!r.isMagicPay;
    let magicpayClaimMode = 'default';
    if (isMagicPay && r.chain === 'celo') {
      magicpayClaimMode = sender.source === 'wallet_profile' ? 'mandatory' : 'optional';
    }

    await logMonibotTransaction({
      senderId: sender.id,
      receiverId: null,
      amount: cmd.amount,
      fee: r.fee || 0,
      txHash: r.hash,
      type: isMagicPay ? 'magicpay_command' : 'p2p_command',
      chain: r.chain,
      payerPayTag: sender.pay_tag,
      recipientPayTag: isMagicPay ? `telegram:${r.platformUserId || r.tag}` : r.tag,
      senderSource: sender.source === 'wallet_profile' ? 'wallet_profiles' : 'profiles',
      magicpayClaimMode,
    });
  }

  if (results.length === 1 && failures.length === 1) {
    const f = failures[0];
    const errorText = buildErrorReply(f.reason?.split(':')[0], {
      amount: cmd.amount,
      chain: f.chain || chain,
      tag: f.tag,
      allowance: f.allowance,
      context: f.context
    });
    await bot.sendMessage(msg.chat.id, errorText, { parse_mode: 'Markdown' });
    return;
  }

  if (results.length === 1 && successes.length === 1) {
    const one = successes[0];
    const chainConfig = CHAIN_CONFIGS[one.chain];
    const amountText = (one.netAmount || (cmd.amount - (one.fee || 0))).toFixed(2);

    // Use Template by default to avoid AI hallucinations
    const replyText = buildSuccessReply(one.isMagicPay ? 'magicpay' : 'p2p', {
      amount: amountText,
      symbol: chainConfig.symbol,
      recipient: one.tag,
      txHash: one.hash,
      chain: one.chain,
      fromChain: one.rerouted ? one.rerouted.split(' -> ')[0] : null,
      senderSource: sender.source
    });

    await bot.sendMessage(msg.chat.id, replyText, { parse_mode: 'Markdown', disable_web_page_preview: true });
    // Follow-up with feedback prompt if eligible
    await sendFeedbackPrompt(bot, msg.chat.id, sender.id, one.hash, one.chain, getSupabase());
    return;
  }

  // Summary reply for multi-send
  let text = successes.length ? `✅ *Multi-send: ${successes.length} succeeded*\n` : '';
  for (const s of successes) {
    const route = s.rerouted ? ` _(${s.rerouted})_` : '';
    const chainConfig = CHAIN_CONFIGS[s.chain];
    const amountText = (s.netAmount || (cmd.amount - (s.fee || 0))).toFixed(2);
    const txLine = formatTxLine(s.hash, s.chain);
    text += `• @${escapeMd(s.tag)}: *${amountText} ${chainConfig.symbol}* on ${s.chain.toUpperCase()}${route} ${txLine}\n`;
  }
  if (failures.length) {
    text += '\n❌ *Failed:*\n';
    for (const f of failures) {
      text += `• @${escapeMd(f.tag)}: ${getSigmaError(f.reason, f.isMagicPay ? 'magicpay' : 'p2p')}\n`;
    }
  }

  await bot.sendMessage(msg.chat.id, text || '❌ No payments were completed.', { parse_mode: 'Markdown' });

  // Trigger feedback prompt for the first successful transaction if eligible
  if (successes.length > 0) {
    const s = successes[0];
    await sendFeedbackPrompt(bot, msg.chat.id, sender.id, s.hash, s.chain, getSupabase());
  }
}

export async function handleSend(bot, msg, text) {
  const cmd = parseCommand(text);
  if (!cmd || !['p2p', 'p2p_multi'].includes(cmd.type)) {
    await bot.sendMessage(msg.chat.id, '❓ Usage: `/send $5 to @alice`', { parse_mode: 'Markdown' });
    return;
  }
  await handleP2P(bot, msg, cmd);
}
