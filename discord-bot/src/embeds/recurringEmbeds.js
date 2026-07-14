/**
 * MoniBot Discord - Recurring Payment Embeds
 * Generate brainrot-style confirmation and status messages
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Build recurring payment confirmation embed
 * @param {Object} seriesData - Series data including jobs, metadata, and command info
 * @returns {Object} - Discord message object with embed and buttons
 */
export function buildRecurringConfirmation(seriesData) {
  const {
    seriesId,
    count,
    firstAt,
    lastAt,
    amount,
    totalAmount,
    intervalMs,
    recipients = [],
    chain = 'USDC',
    warnings = [],
    proTips = [],
    autoRouted = false,
    originalChain = '',
    originalText = '',
    senderLabel = '',
    recipientLabels = [],
  } = seriesData;
  
  const recipientCount = recipients.length || 1;
  
  // Format interval in human-readable form
  const intervalStr = formatInterval(intervalMs);
  
  // Calculate duration
  const durationMs = intervalMs * count;
  const durationStr = formatDuration(durationMs);
  
  const descriptionLines = [
    'Sigma Energy Activated 🗿\n',
  ];

  if (autoRouted) {
    descriptionLines.push(`**Smart Routed to ${chain}** ⚡ (due to insufficient funds on ${originalChain})\n`);
  }

  if (senderLabel) {
    descriptionLines.push(`👤 **Sender**: ${senderLabel}`);
  }

  const isPayment = amount !== undefined && amount > 0;
  if (isPayment) {
    const recLabel = recipientLabels && recipientLabels.length > 0 
      ? recipientLabels.join(', ') 
      : (recipients.map(r => r.startsWith('@') ? r : `@${r}`).join(', ') || 'N/A');
    descriptionLines.push(`👥 **Recipient**: ${recLabel}`);
  }

  descriptionLines.push(
    `🚀 **First Payment**: <t:${Math.floor(new Date(firstAt).getTime() / 1000)}:F> No Cap 🧢`,
    `🏁 **Final Payment**: <t:${Math.floor(new Date(lastAt).getTime() / 1000)}:F> W Aura Incoming 📈`,
    `🔄 **Interval**: Every ${intervalStr}`
  );

  if (isPayment) {
    descriptionLines.push(
      `💰 **Amount Each**: $${amount.toFixed(2)}`,
      `🔢 **Times**: ${count}`,
      `💵 **Total Amount**: $${totalAmount.toFixed(2)}`,
      `⛓️ **Chain**: ${chain.toUpperCase()}`
    );
  } else {
    descriptionLines.push(
      `🔢 **Times**: ${count}`,
      `📝 **Command**: \`${originalText || 'N/A'}\``
    );
  }

  let description = descriptionLines.join('\n');

  // Add recipient info if multi-recipient
  if (isPayment && recipientCount > 1) {
    description += `\n👥 **Recipients**: ${recipientCount} recipients (Squad Goals 🎯)`;
  }

  const allTipsAndWarnings = [...warnings, ...proTips];
  if (allTipsAndWarnings.length > 0) {
    const uniqueItems = [...new Set(allTipsAndWarnings)];
    description += '\n\n' + uniqueItems.map(item => `• ${item}`).join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle('⏰ Recurring Payment Scheduled! 🔄')
    .setDescription(description)
    .setColor(0x0052FF)
    .setFooter({ 
      text: `Series ID: ${seriesId.slice(0, 8)}... | Duration: ${durationStr} | MoniBot Sigma Mode 🗿` 
    })
    .setTimestamp();
  
  // Create action buttons
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`cancel_series_${seriesId}`)
        .setLabel('CANCEL RECURRING PAYMENT')
        .setEmoji('🛑')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`view_series_${seriesId}`)
        .setLabel('View Progress')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Primary)
    );
  
  return {
    embeds: [embed],
    components: [row],
  };
}

/**
 * Build series status/progress embed
 * @param {Array} jobs - Array of job records from database
 * @param {string} seriesId - Series UUID
 * @returns {Object} - Discord embed object
 */
export function buildSeriesStatus(jobs, seriesId) {
  if (!jobs || jobs.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Series Not Found')
          .setDescription('Series ID not found or not yours, blud 👻')
          .setColor(0xFF0000)
      ],
    };
  }
  
  // Calculate status counts
  const completed = jobs.filter(j => j.status === 'completed').length;
  const pending = jobs.filter(j => j.status === 'pending').length;
  const running = jobs.filter(j => j.status === 'running').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const total = jobs.length;
  
  // Get series metadata from first job
  const firstJob = jobs[0];
  const payload = firstJob.payload || {};
  const { seriesIntervalMs, seriesTotalCount, seriesStartedAt, command, originalText } = payload;
  
  // Calculate progress percentage
  const progressPercent = Math.round((completed / total) * 100);
  const progressBar = createProgressBar(progressPercent);
  
  // Format next payment time
  const nextPending = jobs.find(j => j.status === 'pending');
  const nextPaymentStr = nextPending 
    ? `<t:${Math.floor(new Date(nextPending.scheduled_at).getTime() / 1000)}:R>`
    : 'N/A';
  
  const embed = new EmbedBuilder()
    .setTitle('🔄 Series Progress Update 📊')
    .setDescription(`**Series ID:** \`${seriesId.slice(0, 16)}...\`\n**Original Command:** ${originalText || 'N/A'}`)
    .addFields(
      {
        name: '📈 Progress',
        value: `${progressBar} **${progressPercent}%**\n${completed}/${total} payments completed`,
        inline: false,
      },
      {
        name: '✅ Completed',
        value: `**${completed}** payment${completed !== 1 ? 's' : ''}\n${completed > 0 ? '*W Streak 🏆*' : '*Still Cooking 🔥*'}`,
        inline: true,
      },
      {
        name: '⏳ Pending',
        value: `**${pending}** payment${pending !== 1 ? 's' : ''}\n${pending > 0 ? '*On Deck ⚡*' : '*None Left 💯*'}`,
        inline: true,
      },
      {
        name: '🔄 Running',
        value: `**${running}** payment${running !== 1 ? 's' : ''}\n${running > 0 ? '*In Progress 🚀*' : '*Chilling 😎*'}`,
        inline: true,
      },
      {
        name: '❌ Failed',
        value: `**${failed}** payment${failed !== 1 ? 's' : ''}\n${failed === 0 ? '*No Ls Here 💯*' : '*Took Some Ls 📉*'}`,
        inline: true,
      },
      {
        name: '⏰ Next Payment',
        value: nextPaymentStr,
        inline: true,
      },
      {
        name: '🔄 Status',
        value: pending > 0 
          ? `**Active Series** - ${pending} payments remaining`
          : completed === total
            ? '**Series Complete** - All payments executed'
            : '**Series Ended** - No pending payments',
        inline: true,
      }
    )
    .setColor(pending > 0 ? 0x0052FF : completed === total ? 0x00FF00 : 0xFFAA00)
    .setTimestamp()
    .setFooter({ text: 'MoniBot Series Tracker | Sigma Mode 🗿' });
  
  return { embeds: [embed] };
}

/**
 * Build cancellation confirmation embed
 * @param {number} cancelledCount - Number of jobs cancelled
 * @param {string} seriesId - Series UUID
 * @returns {Object} - Discord embed object
 */
export function buildCancellationConfirmation(cancelledCount, seriesId) {
  if (cancelledCount === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle('ℹ️ Nothing to Cancel')
          .setDescription("No pending payments found for this series, or series already completed 🤷\n*Maybe it already finished executing fr*")
          .setColor(0xFFAA00)
          .setFooter({ text: 'MoniBot Series Manager 🗿' })
      ],
    };
  }
  
  const embed = new EmbedBuilder()
    .setTitle('✅ Series Cancelled Successfully')
    .setDescription(`**${cancelledCount}** pending payment${cancelledCount !== 1 ? 's' : ''} cancelled\n*Series stopped, no cap 🧢*`)
    .addFields(
      {
        name: '🛑 Cancelled Jobs',
        value: `**${cancelledCount}** payment${cancelledCount !== 1 ? 's' : ''} removed from queue`,
        inline: true,
      },
      {
        name: '✅ Completed Jobs',
        value: 'Already executed payments remain unaffected',
        inline: true,
      },
      {
        name: '📝 Series ID',
        value: `\`${seriesId.slice(0, 16)}...\``,
        inline: false,
      }
    )
    .setColor(0x00FF00)
    .setTimestamp()
    .setFooter({ text: 'You stopped the bag, but you still got the drip 💧 | MoniBot' });
  
  return { embeds: [embed] };
}

/**
 * Build warning embed for insufficient balance
 * @param {Object} balanceInfo - Balance information
 * @returns {Object} - Discord embed object
 */
export function buildBalanceWarning(balanceInfo) {
  const { required, available, shortfall } = balanceInfo;
  
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Balance Warning')
    .setDescription('**Heads up!** Your series has been created, but there might be a funding issue')
    .addFields(
      {
        name: '💵 Required Balance',
        value: `$${required.toFixed(2)}`,
        inline: true,
      },
      {
        name: '💰 Available Balance',
        value: `$${available.toFixed(2)}`,
        inline: true,
      },
      {
        name: '📉 Shortfall',
        value: `$${shortfall.toFixed(2)}`,
        inline: true,
      },
      {
        name: '📌 What This Means',
        value: 'Series is queued, but payments might fail at execution time if you don\'t top up your balance. Consider funding your wallet before the first payment executes.',
        inline: false,
      }
    )
    .setColor(0xFFAA00)
    .setFooter({ text: 'Top up that wallet for maximum rizz 💰 | MoniBot' });
  
  return { embeds: [embed] };
}

/**
 * Format interval in human-readable form
 * @param {number} intervalMs - Interval in milliseconds
 * @returns {string} - Formatted interval
 */
function formatInterval(intervalMs) {
  const seconds = intervalMs / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const weeks = days / 7;
  
  if (weeks >= 1 && weeks % 1 === 0) return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  if (days >= 1 && days % 1 === 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hours >= 1 && hours % 1 === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes >= 1 && minutes % 1 === 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Format duration in human-readable form
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(durationMs) {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Create a progress bar visualization
 * @param {number} percent - Progress percentage (0-100)
 * @returns {string} - Progress bar string
 */
function createProgressBar(percent) {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Build series completion embed
 * @param {Array} jobs - Array of job records from database
 * @param {Object} payload - Payload from the last job
 * @param {string} seriesId - Series UUID
 * @returns {Object} - Discord embed object
 */
export function buildSeriesCompletion(jobs, payload, seriesId) {
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const totalCount = jobs.length;
  
  const { seriesIntervalMs, seriesStartedAt, command } = payload;
  
  const startedDate = new Date(seriesStartedAt || jobs[0].scheduled_at);
  let finishedDate = new Date();
  const finishedJobs = jobs.filter(j => j.completed_at);
  if (finishedJobs.length > 0) {
    finishedJobs.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
    finishedDate = new Date(finishedJobs[0].completed_at);
  }
  
  const unixStarted = Math.floor(startedDate.getTime() / 1000);
  const unixFinished = Math.floor(finishedDate.getTime() / 1000);
  const intervalStr = formatInterval(seriesIntervalMs);
  
  const amount = command?.amount || payload.amount || 0;
  const recipients = command?.recipients || payload.recipients || [];
  const recipientCount = recipients.length || 1;
  const totalCost = amount * totalCount * recipientCount;
  
  const isPayment = amount > 0;
  
  const fields = [
    { name: '🚀 Started', value: `<t:${unixStarted}:F>`, inline: false },
    { name: '🏁 Finished', value: `<t:${unixFinished}:F>`, inline: false },
    { name: '🔄 Interval', value: `Every ${intervalStr}`, inline: true },
    { name: isPayment ? '🔢 Total Payments' : '🔢 Total Tasks', value: `${totalCount}`, inline: true }
  ];
  
  if (isPayment) {
    fields.push(
      { name: '💰 Amount Each', value: `$${amount.toFixed(2)}`, inline: true },
      { name: '💵 Total Amount', value: `$${totalCost.toFixed(2)}`, inline: true }
    );
  }
  
  const statusMsg = isPayment
    ? `${completedCount} jobs completed, bag secured no cap 🗿`
    : `${completedCount} tasks completed, W execution no cap 🗿`;
    
  fields.push({ name: '✅ Status', value: statusMsg, inline: false });
  
  const embed = new EmbedBuilder()
    .setTitle(isPayment ? '⏰ Recurring Payment Completed! 🔄' : '⏰ Recurring Series Completed! 🔄')
    .addFields(fields)
    .setColor(0x00FF00)
    .setFooter({ text: `Series ID: ${seriesId} | MoniBot` })
    .setTimestamp();
    
  return { embeds: [embed] };
}
