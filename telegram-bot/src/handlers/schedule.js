import crypto from 'crypto';
import { escapeMd } from '../utils/replies.js';
import { aiParseCommand, aiParseSchedule } from '../../shared/ai.js';
import { getBalance } from '../../shared/blockchain.js';
import { getExplorerUrl, resolveChainName } from '../../shared/chains.js';
import { enqueueMessage } from '../utils/botQueue.js';
import {
  createScheduledJob,
  getCompletedScheduledJobs,
  getProfileByPlatformId,
  getProfileByMonitag,
  isCommandProcessed,
  getSupabase
} from '../../shared/database.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { checkAllowance } from '../utils/allowance.js';
import { parseCommand } from './p2p.js';
import { sendFeedbackPrompt } from '../utils/feedback.js';
import {
  parseRecurringCommand,
  parseSimpleSchedule,
  validateRecurringParams,
  validateRecurringAmount,
  needsClarification,
  formatInterval
} from '../utils/recurringPayments.js';
import {
  createJobSeries,
  formatSeriesMetadata
} from '../utils/seriesCalculator.js';
import {
  createRecurringSeries,
  cancelRecurringSeries,
  getSeriesStatus,
  formatSeriesStatus,
  getUserSeries,
  formatUserSeriesList
} from '../utils/seriesManager.js';

const notifiedJobIds = new Set();
const notifiedSeriesIds = new Set();

// ============================================================================
// RECURRING PAYMENT HANDLER (New System)
// ============================================================================

/**
 * Handle recurring payment creation using the new pre-calculation system
 */
async function handleRecurringPayment(bot, msg, sender, recurringCommand, originalText) {
  console.log('[RecurringPayment] Processing recurring payment request');

  // Check for clarification needs
  const clarification = needsClarification(recurringCommand);
  if (clarification) {
    await bot.sendMessage(msg.chat.id, clarification.message, { parse_mode: 'Markdown' });
    return;
  }

  // Validate recurring parameters
  const paramValidation = validateRecurringParams(recurringCommand);
  if (!paramValidation.isValid) {
    await bot.sendMessage(msg.chat.id, paramValidation.message, { parse_mode: 'Markdown' });
    return;
  }

  // Parse the base payment command
  const regexCmd = parseCommand(recurringCommand.baseCommand);
  let aiCmd = null;
  if (!regexCmd) {
    try {
      aiCmd = await aiParseCommand(recurringCommand.baseCommand, 'telegram');
    } catch (error) {
      console.error('❌ Recurring AI command parse error:', error.message);
      await bot.sendMessage(msg.chat.id, 
        `⚠️ *MoniBot AI is temporarily offline, blud!* 💀\n\nI couldn't parse the payment details in your recurring command. Please use direct commands (e.g., \`send $5 to @username every week 4 times\`) to keep securing the bag! 🗿`, 
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }
  const cmd = regexCmd || aiCmd;

  if (!cmd || !['p2p', 'p2p_multi', 'giveaway'].includes(cmd.type)) {
    await bot.sendMessage(msg.chat.id,
      `❌ I can only schedule payment commands.\n\nTry: \`send $5 to @alice every 1 minute 5 times\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Validate amount
  const amountValidation = validateRecurringAmount(cmd.amount, recurringCommand.repeatCount);
  if (!amountValidation.isValid) {
    await bot.sendMessage(msg.chat.id, amountValidation.message, { parse_mode: 'Markdown' });
    return;
  }

  const { totalAmount, perPaymentAmount } = amountValidation;

  // Get chain and sender address
  const chain = cmd.chain || sender.preferred_network || 'base';
  const senderAddr = sender.addresses 
    ? (sender.addresses[chain] || sender.addresses.celo) 
    : sender.wallet_address;

  // Check allowance and balance
  const [allowancePreview, balanceResult] = await Promise.all([
    checkAllowance(senderAddr, totalAmount, chain, 'p2p', null, sender.source),
    senderAddr ? getBalance(senderAddr, chain).catch(() => null) : Promise.resolve(null),
  ]);

  const warnings = [];

  if (!allowancePreview.ok) {
    warnings.push(allowancePreview.message);
  }

  if (balanceResult && balanceResult.balance < totalAmount) {
    const shortfall = (totalAmount - balanceResult.balance).toFixed(2);
    warnings.push(
      `⚠️ *Low balance warning:* Your current ${chain.toUpperCase()} balance is *$${balanceResult.balance.toFixed(2)}* but the total recurring amount is *$${totalAmount.toFixed(2)}*.\n` +
      `You're short *$${shortfall}*. Top up before the payments start or some will fail.`
    );
  }

  if (warnings.length > 0) {
    await bot.sendMessage(msg.chat.id,
      `⚠️ *Heads up before scheduling recurring payments:*\n\n${warnings.join('\n\n')}`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
  }

  // Create job series
  const messageContext = {
    platform: 'telegram',
    chatId: msg.chat.id,
    senderPlatformId: String(msg.from.id),
    sourceAuthorId: String(msg.from.id),
    sourceAuthorUsername: msg.from.username || msg.from.first_name,
    sourceTweetId: String(msg.message_id),
  };

  let jobSeriesResult;
  try {
    jobSeriesResult = createJobSeries({
      recurringCommand,
      parsedPaymentCommand: cmd,
      sender,
      messageContext,
      originalText
    });
  } catch (error) {
    console.error('[RecurringPayment] Error creating job series:', error.message);
    await bot.sendMessage(msg.chat.id, 
      `❌ Error creating recurring payment series: ${escapeMd(error.message)}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Insert jobs into database
  const createResult = await createRecurringSeries(jobSeriesResult.jobs);

  if (!createResult.success) {
    console.error('[RecurringPayment] Failed to insert jobs:', createResult.error);
    await bot.sendMessage(msg.chat.id,
      '❌ Failed to schedule recurring payments. Please try again.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  console.log(`[RecurringPayment] Successfully created series ${createResult.seriesId} with ${createResult.jobsCreated} jobs`);

  const senderLabel = msg.from.username ? `@${msg.from.username}` : `@${sender.pay_tag}`;
  const recipientTag = cmd.recipients?.[0];
  let recipientLabel = 'Unknown';
  if (recipientTag) {
    const cleanRecipient = recipientTag.replace('@', '').toLowerCase();
    const recipientProfile = await getProfileByMonitag(cleanRecipient);
    if (recipientProfile) {
      const db = getSupabase();
      let tgUsername = null;
      if (recipientProfile.telegram_id) {
        const { data: cached } = await db
          .from('telegram_user_cache')
          .select('username')
          .eq('telegram_id', recipientProfile.telegram_id)
          .maybeSingle();
        if (cached?.username) {
          tgUsername = cached.username;
        }
      }
      recipientLabel = tgUsername ? `@${tgUsername}` : `@${recipientProfile.pay_tag}`;
    } else {
      recipientLabel = recipientTag.startsWith('@') ? recipientTag : `@${recipientTag}`;
    }
  }

  // Format and send confirmation
  const formatted = formatSeriesMetadata(jobSeriesResult.metadata);
  const summary = 
    `⏰ *Recurring Payment Scheduled!* 🔄\n\n` +
    `👤 *Sender:* \`${senderLabel}\`\n` +
    `👤 *Recipient:* \`${recipientLabel}\`\n` +
    `🚀 *First:* ${formatted.firstExecutionFormatted} UTC\n` +
    `🏁 *Last:* ${formatted.lastExecutionFormatted} UTC\n` +
    `🔄 *Interval:* ${formatted.intervalFormatted}\n` +
    `🔢 *Total Payments:* ${formatted.totalJobs}\n` +
    `💰 *Amount Each:* $${formatted.perPaymentAmount}\n` +
    `💵 *Total Amount:* $${formatted.totalAmount}\n\n` +
    `✅ *Status:* ${formatted.totalJobs} jobs queued\n` +
    `Series ID: \`${createResult.seriesId}\``;

  await bot.sendMessage(msg.chat.id, summary, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Cancel Payment', callback_data: `cancel_series_${createResult.seriesId}` }]
      ]
    }
  });
}

// ============ Schedule Detection (moved from index.js) ============

function parseSimpleScheduleFallback(text) {
  console.log(`[RecurringParser] Parsing schedule: "${text}"`);
  
  // Try new recurring payment parser first
  const recurringCommand = parseRecurringCommand(text);
  if (recurringCommand) {
    console.log(`[RecurringParser] Detected recurring payment:`, recurringCommand);
    return {
      hasSchedule: true,
      isRecurring: true,
      recurringCommand: recurringCommand,
      command: recurringCommand.baseCommand
    };
  }

  // Fallback to simple one-time schedule parser
  const simpleSchedule = parseSimpleSchedule(text);
  if (simpleSchedule) {
    console.log(`[RecurringParser] Detected one-time schedule:`, simpleSchedule);
    return simpleSchedule;
  }

  console.log(`[RecurringParser] No schedule pattern matched`);
  return null;
}

function formatRecurrenceTg(r) {
  if (!r) return null;
  if (r === 'detected') return 'Every [period] (auto-detected)';
  const match = r.match(/^(\d+)([smhdw])$/);
  if (!match) return r;
  const val = parseInt(match[1]);
  const unit = match[2];
  const units = {
    s: 'second',
    m: 'minute',
    h: 'hour',
    d: 'day',
    w: 'week'
  };
  const label = units[unit] || unit;
  return `Every ${val} ${label}${val !== 1 ? 's' : ''}`;
}

/**
 * Format a UTC Date into a human-readable clock time string.
 * e.g. "3:45 PM UTC"
 */
function formatClockTime(date) {
  let h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  const mm = m > 0 ? `:${String(m).padStart(2, '0')}` : ':00';
  return `${h}${mm} ${ampm} UTC`;
}

export async function handleScheduledCommand(bot, msg, scheduleResult, originalText) {
  const rl = checkRateLimit(String(msg.from.id));
  if (!rl.allowed) {
    await bot.sendMessage(msg.chat.id, `⏳ Slow down! Try again in ${rl.retryAfter}s.\n\n_Your command wasn't lost — just retry in a moment._`, { parse_mode: 'Markdown' });
    return;
  }

  if (await isCommandProcessed('telegram', String(msg.message_id))) return;

  // Typing indicator — instant feedback
  await bot.sendChatAction(msg.chat.id, 'typing');

  const sender = await getProfileByPlatformId('telegram', String(msg.from.id));
  if (!sender) {
    const isGroup = msg.chat.type !== 'private';
    const linkMsg = isGroup
      ? `🔗 *Link your account to schedule payments.*\n\nDM @monipaybot privately to set up, or go to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI → Link Telegram.\n\n_MiniPay users: open the MiniPay app → Monipay miniapp → Link Telegram._`
      : `🔗 *Link your account to schedule payments.*\n\n1️⃣ Go to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI → Link Telegram\n2️⃣ Enter your Telegram ID: \`${msg.from.id}\`\n\n_MiniPay users: open the MiniPay app → Monipay miniapp → Link Telegram._`;
    await bot.sendMessage(msg.chat.id, linkMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECURRING PAYMENT PATH (New System)
  // ═══════════════════════════════════════════════════════════════════════════
  if (scheduleResult.isRecurring && scheduleResult.recurringCommand) {
    await handleRecurringPayment(bot, msg, sender, scheduleResult.recurringCommand, originalText);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ONE-TIME SCHEDULED PAYMENT (non-recurring) - Backward Compatible Path
  // ═══════════════════════════════════════════════════════════════════════════

  const scheduledAt = new Date(scheduleResult.scheduledAt);
  if (scheduledAt <= new Date()) {
    await bot.sendMessage(msg.chat.id, '⏰ That time is in the past. Please specify a future time.\n\nExample: `send $5 to @alice in 2 hours`', { parse_mode: 'Markdown' });
    return;
  }

  // Sanitize the command to remove scheduling keywords that confuse sub-parsers
  const cleanCommand = scheduleResult.command
    .replace(/\bin\s+\d+\s*\w+\b/gi, '')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .trim();

  const regexCmd = parseCommand(cleanCommand);
  let aiCmd = null;
  if (!regexCmd) {
    try {
      aiCmd = await aiParseCommand(cleanCommand, 'telegram');
    } catch (error) {
      console.error('❌ Scheduled AI command parse error:', error.message);
      await bot.sendMessage(msg.chat.id,
        `⚠️ *MoniBot AI is temporarily offline, blud!* 💀\n\nI couldn't parse the payment details in your scheduled command. Please use direct commands (e.g., \`send $5 to @username in 2 hours\`) to keep securing the bag! 🗿`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }
  const cmd = regexCmd || aiCmd;

  if (!cmd || !['p2p', 'p2p_multi', 'giveaway'].includes(cmd.type)) {
    await bot.sendMessage(msg.chat.id,
      `❌ I can only schedule payment commands.\n\nTry: \`send $5 to @alice in 2 hours\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const chain = cmd.chain || sender.preferred_network || 'base';
  const senderAddr = sender.addresses ? (sender.addresses[chain] || sender.addresses.celo) : sender.wallet_address;

  // Run allowance check and balance check in parallel
  const [allowancePreview, balanceResult] = await Promise.all([
    checkAllowance(senderAddr, Number(cmd.amount || 0), chain, 'p2p', null, sender.source),
    senderAddr ? getBalance(senderAddr, chain).catch(() => null) : Promise.resolve(null),
  ]);

  const warnings = [];

  if (!allowancePreview.ok) {
    warnings.push(allowancePreview.message);
  }

  if (balanceResult && balanceResult.balance < Number(cmd.amount || 0)) {
    const shortfall = (Number(cmd.amount) - balanceResult.balance).toFixed(2);
    const execTime = formatClockTime(scheduledAt);
    warnings.push(
      `⚠️ *Low balance warning:* Your current ${chain.toUpperCase()} balance is *$${balanceResult.balance.toFixed(2)}* but the scheduled amount is *$${cmd.amount}*.\n` +
      `You're short *$${shortfall}*. Top up before *${execTime}* or the payment will fail.`
    );
  }

  if (warnings.length > 0) {
    await bot.sendMessage(msg.chat.id,
      `⚠️ *Heads up before scheduling:*\n\n${warnings.join('\n\n')}`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
  }

  const job = await createScheduledJob({
    type: cmd.type === 'giveaway' ? 'scheduled_giveaway' : 'scheduled_p2p',
    scheduledAt: scheduledAt.toISOString(),
    payload: {
      platform: 'telegram',
      chatId: msg.chat.id,
      // Store the profile UUID so the executor can look it up by primary key
      // in both profiles and wallet_profiles tables (covers MiniPay users).
      senderId: sender.id,
      senderPlatformId: String(msg.from.id),
      senderSource: sender.source || 'profile',
      senderPayTag: sender.pay_tag,
      senderWallet: senderAddr,
      command: cmd,
      originalText,
    },
    sourceAuthorId: String(msg.from.id),
    sourceAuthorUsername: msg.from.username || msg.from.first_name,
    sourceTweetId: String(msg.message_id),
  });

  // Show both relative description AND exact clock time
  const timeDesc = scheduleResult.timeDescription || 'scheduled';
  const clockTime = formatClockTime(scheduledAt);
  const msUntil = scheduledAt.getTime() - Date.now();
  const minsUntil = Math.round(msUntil / 60000);
  const timeDisplay = minsUntil < 60
    ? `${timeDesc} _(${clockTime})_`
    : `${timeDesc} _(${clockTime})_`;

  await bot.sendMessage(
    msg.chat.id,
    `⏰ *Command Scheduled!*\n\n` +
    `📋 *Command:* ${scheduleResult.command}\n` +
    `🕐 *When:* ${timeDisplay}\n` +
    `✅ *Status:* ${job ? 'Queued' : 'Failed to queue'}\n\n` +
    `_Job ID: ${job?.id || 'N/A'}_`,
    { parse_mode: 'Markdown' }
  );
}

export async function pollScheduledJobResults(bot) {
  try {
    const jobs = await getCompletedScheduledJobs();
    for (const job of jobs) {
      if (notifiedJobIds.has(job.id)) continue;
      notifiedJobIds.add(job.id);

      const chatId = job.payload?.chatId;
      if (!chatId) continue;

      const senderTag = job.payload?.senderPayTag || 'Unknown';
      const amount = job.payload?.command?.amount || '?';
      const chain = job.payload?.command?.chain || 'base';

      if (job.status === 'completed') {
        const activeChain = job.payload?.command?.chain || 'base';
        const txHash = job.result?.txHash || job.result?.results?.[0]?.txHash;
        let explorerUrl = null;
        try {
          explorerUrl = txHash ? getExplorerUrl(activeChain, txHash) : null;
        } catch {}
        let text = `⏰ *Scheduled Payment Complete!*\n\n@${escapeMd(senderTag)}'s payment executed.\n💸 $${amount}`;
        if (explorerUrl) text += `\n🔗 [View TX](${explorerUrl})`;
        if (job.result?.results) {
          text += '\n\n' + job.result.results
            .map(r => r.status === 'success' ? `✅ @${escapeMd(r.tag)}` : `❌ @${escapeMd(r.tag)}: ${escapeMd(r.reason)}`)
            .join('\n');
        }
        await enqueueMessage(bot, chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });

        // Prompt sender for feedback if eligible
        if (job.payload?.senderId && txHash) {
          await sendFeedbackPrompt(bot, chatId, job.payload.senderId, txHash, activeChain, getSupabase());
        }
      } else if (job.status === 'failed') {
        await enqueueMessage(
          bot,
          chatId,
          `❌ *Scheduled Payment Failed*\n@${escapeMd(senderTag)}: $${amount}\n${escapeMd(job.error_message?.substring(0, 200) || 'Unknown error')}`,
          { parse_mode: 'Markdown' }
        );
      }

      const seriesId = job.payload?.seriesId;
      if (seriesId) {
        await checkAndNotifySeriesCompletion(bot, seriesId, chatId);
      }
    }
  } catch (err) {
    console.error('❌ Job poll error:', err.message);
  }
}

// Schedule-related keywords — AI parser is ONLY invoked when these are present.
// Plain commands (balance, send $5 to @alice, help, etc.) skip AI entirely.
const SCHEDULE_SIGNAL = /\b(in\s+\d+|tomorrow|tonight|next\s+\w+|at\s+\d{1,2}|every|daily|weekly|monthly|hourly|repeat|recurring|\d+\s*(?:min(?:ute)?s?|hours?|days?|weeks?|months?))\b/i;

export async function tryScheduleFromMessage(bot, msg, cleanedText) {
  // Step 1: fast regex — no AI, no latency
  let scheduleResult = parseSimpleScheduleFallback(cleanedText);

  // Step 2: AI fallback — ONLY if regex missed AND text has schedule keywords.
  // Without this guard, AI was called on every single message (balance, help,
  // send $5 to @alice, etc.), causing cold-start latency that made Telegram
  // re-deliver messages and trip the rate limiter on the second delivery.
  if (!scheduleResult?.hasSchedule && SCHEDULE_SIGNAL.test(cleanedText)) {
    try {
      scheduleResult = await aiParseSchedule(cleanedText, 'telegram');
    } catch (error) {
      console.error('❌ AI parse schedule error:', error.message);
      // Fail silently — fall through to normal command handling
    }
  }

  if (scheduleResult?.hasSchedule) {
    try {
      await handleScheduledCommand(bot, msg, scheduleResult, cleanedText);
    } catch (error) {
      console.error('❌ Handle scheduled command error:', error.message);
      await bot.sendMessage(
        msg.chat.id,
        `⚠️ *Scheduler AI crashed while setting up your payment, blud!* 💀\n\nMake sure your command format is correct. Try: \`send $5 to @user in 2 hours\` or \`send $5 to @user every week 4 times\`.`,
        { parse_mode: 'Markdown' }
      );
    }
    return true;
  }
  return false;
}

async function checkAndNotifySeriesCompletion(bot, seriesId, chatId) {
  if (notifiedSeriesIds.has(seriesId)) return;

  try {
    const status = await getSeriesStatus(seriesId);
    if (status && status.progress.remaining === 0) {
      notifiedSeriesIds.add(seriesId);

      const firstRunDate = new Date(status.metadata.firstRun);
      const lastRunDate = new Date(status.metadata.lastRun);
      
      const formatDate = (date) => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = months[date.getUTCMonth()];
        const d = date.getUTCDate();
        const y = date.getUTCFullYear();
        const hh = String(date.getUTCHours()).padStart(2, '0');
        const mm = String(date.getUTCMinutes()).padStart(2, '0');
        const ss = String(date.getUTCSeconds()).padStart(2, '0');
        return `${m} ${d}, ${y} ${hh}:${mm}:${ss}`;
      };

      const interval = status.metadata.interval || '1m';
      const match = interval.match(/^(\d+)([smhdw])$/);
      let intervalText = interval;
      if (match) {
        const value = parseInt(match[1]);
        const unitMap = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week' };
        const unit = unitMap[match[2]] || match[2];
        const unitLabel = value > 1 ? `${unit}s` : unit;
        intervalText = `Every ${value} ${unitLabel}`;
      }

      const totalAmount = status.metadata.amount * status.statusCounts.total;
      
      let statusText = '';
      if (status.statusCounts.failed === 0) {
        statusText = `✅ *Status:* ${status.statusCounts.completed} jobs completed, bag secured no cap 🗿`;
      } else if (status.statusCounts.completed === 0) {
        statusText = `❌ *Status:* Cooked! All ${status.statusCounts.failed} jobs failed, zero bags secured blud 💀`;
      } else {
        statusText = `⚠️ *Status:* Partial success! ${status.statusCounts.completed} completed, ${status.statusCounts.failed} failed, not all bags secured blud 💀`;
      }

      const summary = 
        `⏰ *Recurring Payment Completed!* 🔄\n\n` +
        `🚀 *Started:* ${formatDate(firstRunDate)} UTC\n` +
        `🏁 *Finished:* ${formatDate(lastRunDate)} UTC\n` +
        `🔄 *Interval:* ${intervalText}\n` +
        `🔢 *Total Payments:* ${status.statusCounts.total}\n` +
        `💰 *Amount Each:* $${status.metadata.amount.toFixed(2)}\n` +
        `💵 *Total Amount:* $${totalAmount.toFixed(2)}\n\n` +
        `${statusText}\n` +
        `Series ID: ${seriesId}`;

      await enqueueMessage(bot, chatId, summary, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('[RecurringCompletion] Error checking completion status:', err.message);
  }
}
