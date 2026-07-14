/**
 * MoniBot Discord - Scheduled Command Handler
 */

import { EmbedBuilder } from 'discord.js';
import { getProfileByDiscordId, createScheduledJob, getServerConfig, cancelScheduledJobs } from '../database.js';
import { checkAllowance } from '../middleware/allowanceCheck.js';
import { parseCommand } from '../../commands.js';
import { aiParseCommand } from '../../ai.js';
import { sendOnboarding } from './onboardingHandler.js';
import { DEFAULT_CHAIN } from '../constants.js';
import { handleRecurringPayment } from './recurringHandler.js';
import logger from '../logger.js';

const log = logger.child({ module: 'scheduleHandler' });

export async function handleScheduledCommand(message, scheduleResult, originalText) {
  const senderProfile = await getProfileByDiscordId(message.author.id);
  if (!senderProfile) {
    await sendOnboarding(message);
    return;
  }

  const scheduledAt = new Date(scheduleResult.scheduledAt);
  const now = new Date();

  if (scheduledAt <= now) {
    await message.reply('That time is in the past. Please specify a future time.');
    return;
  }

  // Parse the underlying command from the schedule result
  const innerCommand = parseCommand(`!monibot ${scheduleResult.command}`);
  let aiCommand = null;
  if (!innerCommand) {
    const aiResult = await aiParseCommand(scheduleResult.command, 'discord');
    if (aiResult && aiResult.type) {
      aiCommand = aiResult;
    }
  }

  const cmd = innerCommand || aiCommand;
  if (!cmd || !cmd.type) {
    await message.reply('Could not parse that command, stop being delulu 🤡');
    return;
  }

  // Allowance pre-check (warning only)
  if (cmd.amount && cmd.chain) {
    const senderAddress = senderProfile.addresses[cmd.chain];
    const allowanceCheck = senderAddress
      ? await checkAllowance(senderAddress, cmd.amount, cmd.chain, 'p2p', senderProfile)
      : { ok: false, message: 'Wallet address missing for this chain.' };

    if (!allowanceCheck.ok) {
      await message.reply(
        `**Heads up!** Your command has been queued, but:\n\n${allowanceCheck.message}\n\n` +
        `Please fix this before the scheduled time or the payment will fail.`
      );
    }
  }

  // Recurring Payment Logic: Ask for count/duration if missing
  if (scheduleResult.isRecurring && !scheduleResult.recurringCount && !scheduleResult.recurringDuration) {
    const isPayment = cmd.amount !== undefined && cmd.amount > 0;
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(isPayment ? '🔄 Recurring Payment Detected' : '🔄 Recurring Series Detected')
          .setDescription(`You've scheduled a recurring command: **"${scheduleResult.timeDescription}"**.\n\nHow many times should this repeat? (e.g., reply with \`10 times\` or \`for 1 week\`)`)
          .setColor(0x0052FF)
      ]
    });
    return 'AWAITING_RECURRING_INFO';
  }

  if (scheduleResult.isRecurring) {
    const intervalMs = getIntervalMs(scheduleResult.recurrenceInterval || 1, scheduleResult.recurrenceRule);
    await handleRecurringPayment(message, scheduleResult, {
      startTime: scheduledAt.getTime() - intervalMs
    });
    return;
  }

  const occurrences = calculateOccurrences(scheduledAt, scheduleResult);
  const jobs = [];

  for (const date of occurrences) {
    const job = await createScheduledJob({
      type: cmd.type === 'giveaway' ? 'scheduled_giveaway' : 'scheduled_p2p',
      scheduledAt: date.toISOString(),
      payload: {
        platform: 'discord',
        channelId: message.channel.id,
        guildId: message.guild?.id || 'DM',
        senderId: senderProfile.id,
        senderDiscordId: message.author.id,
        senderPayTag: senderProfile.pay_tag,
        senderSource: senderProfile.source,
        senderWallet: senderProfile.addresses[cmd.chain || 'base'],
        command: cmd,
        originalText,
        // We set isRecurring to false for pre-calculated individual jobs
        // to prevent the executor from rescheduling them and causing duplication.
        isRecurring: false,
        recurrenceRule: scheduleResult.recurrenceRule || null,
        recurrenceInterval: scheduleResult.recurrenceInterval || 1,
      },
      sourceAuthorId: message.author.id,
      sourceAuthorUsername: message.author.tag,
      sourceTweetId: message.id,
    });
    if (job) jobs.push(job);
  }

  if (jobs.length === 0) {
    await message.reply('Failed to schedule your command. Please try again.');
    return;
  }

  const timeDesc = scheduleResult.timeDescription || scheduledAt.toUTCString();
  const firstJob = jobs[0];
  const lastJob = jobs[jobs.length - 1];
  
  const isPayment = cmd.amount !== undefined && cmd.amount > 0;
  const totalAmount = isPayment ? (cmd.amount * jobs.length * (cmd.recipients?.length || 1)) : 0;

  const fields = [
    { name: 'Command', value: scheduleResult.command, inline: false },
    { name: 'Frequency', value: timeDesc, inline: true }
  ];

  if (isPayment) {
    fields.push(
      { name: 'Total Payments', value: `${jobs.length}`, inline: true },
      { name: 'Each Payment', value: `$${cmd.amount}`, inline: true },
      { name: 'Total Volume', value: `**$${totalAmount.toFixed(2)}**`, inline: true }
    );
  } else {
    fields.push(
      { name: 'Total Runs', value: `${jobs.length}`, inline: true }
    );
  }

  fields.push(
    { name: 'Starts', value: `<t:${Math.floor(new Date(firstJob.scheduled_at).getTime() / 1000)}:F>`, inline: false }
  );

  const embed = new EmbedBuilder()
    .setTitle(jobs.length > 1 ? (isPayment ? '🔄 Recurring Payments Scheduled!' : '🔄 Recurring Series Scheduled!') : '📅 Command Scheduled!')
    .setDescription(`Your command has been queued successfully.`)
    .addFields(fields)
    .setColor(0x0052FF)
    .setFooter({ text: `Series ID: ${firstJob.id} | Ends: ${new Date(lastJob.scheduled_at).toLocaleDateString()}` });

  if (jobs.length > 1) {
    embed.addFields({ name: 'Expiry', value: `<t:${Math.floor(new Date(lastJob.scheduled_at).getTime() / 1000)}:F>`, inline: false });
  }

  await message.reply({ embeds: [embed] });
}

/**
 * Handle cancellation of scheduled jobs.
 */
export async function handleCancel(message) {
  const count = await cancelScheduledJobs(message.author.id);

  if (count > 0) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Payments Cancelled')
          .setDescription(`Successfully cancelled **${count}** pending scheduled payments.`)
          .setColor(0x00FF00)
          .setFooter({ text: 'MoniBot: Sigma Mode 🗿' })
      ]
    });
  } else {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('ℹ️ No Pending Payments')
          .setDescription("You don't have any pending scheduled payments to cancel.")
          .setColor(0xFFFF00)
      ]
    });
  }
}

/**
 * Calculate incremental timestamps for a recurring series.
 */
function calculateOccurrences(start, scheduleResult) {
  if (!scheduleResult.isRecurring) return [start];

  const occurrences = [];
  let current = new Date(start);
  const interval = scheduleResult.recurrenceInterval || 1;
  const rule = scheduleResult.recurrenceRule;

  let maxOccurrences = 1;
  if (scheduleResult.recurringCount) {
    maxOccurrences = scheduleResult.recurringCount;
  } else if (scheduleResult.recurringDuration) {
    const { value, unit } = scheduleResult.recurringDuration;
    const durationMs = getDurationMs(value, unit);
    const intervalMs = getIntervalMs(interval, rule);
    maxOccurrences = Math.floor(durationMs / intervalMs) + 1;
  } else {
    // Default fallback if somehow we got here without count/duration
    maxOccurrences = 1;
  }

  // Safety cap to prevent database spam
  maxOccurrences = Math.min(maxOccurrences, 50);

  for (let i = 0; i < maxOccurrences; i++) {
    occurrences.push(new Date(current));

    if (rule === 'minute') current.setUTCMinutes(current.getUTCMinutes() + interval);
    else if (rule === 'hour') current.setUTCHours(current.getUTCHours() + interval);
    else if (rule === 'day') current.setUTCDate(current.getUTCDate() + interval);
    else if (rule === 'week') current.setUTCDate(current.getUTCDate() + (7 * interval));
    else if (rule === 'month') current.setUTCMonth(current.getUTCMonth() + interval);
    else {
      // Day of week
      current.setUTCDate(current.getUTCDate() + (7 * interval));
    }
  }

  return occurrences;
}

function getDurationMs(value, unit) {
  if (unit.startsWith('m')) return value * 60000;
  if (unit.startsWith('h')) return value * 3600000;
  if (unit.startsWith('d')) return value * 86400000;
  if (unit.startsWith('w')) return value * 604800000;
  if (unit.startsWith('mon')) return value * 30 * 86400000;
  return 0;
}

export function getIntervalMs(interval, rule) {
  if (rule === 'minute') return interval * 60000;
  if (rule === 'hour') return interval * 3600000;
  if (rule === 'day') return interval * 86400000;
  if (rule === 'week') return interval * 604800000;
  if (rule === 'month') return interval * 30 * 86400000;
  return interval * 604800000; // Default weekly for day of week
}
