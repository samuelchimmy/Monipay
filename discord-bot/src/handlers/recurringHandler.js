/**
 * MoniBot Discord - Recurring Payment Handler
 * Main orchestrator for recurring payment workflow
 */

import { getSupabase, getProfileByDiscordId, getServerConfig, getProfileByMonitag } from '../database.js';
import { sendOnboarding } from './onboardingHandler.js';
import { parseRecurringCommand, extractBaseCommand, validateSyntax, convertDurationToCount } from '../parsers/recurringParser.js';
import { getIntervalMs } from './scheduleHandler.js';
import { 
  validateRecurringPayment, 
  performSafetyChecks,
  calculateSeriesCost 
} from '../validators/recurringValidator.js';
import {
  buildRecurringConfirmation,
  buildSeriesStatus,
  buildCancellationConfirmation,
  buildBalanceWarning,
} from '../embeds/recurringEmbeds.js';
import { parseCommand, detectChain } from '../../commands.js';
import { aiParseCommand } from '../../ai.js';
import logger from '../logger.js';
import { randomUUID } from 'crypto';
import { resolveActiveChain, resolveChainName } from '../chains.js';
import { findAlternateChain } from '../crossChainCheck.js';
import { getAllBalances } from '../blockchain.js';

const log = logger.child({ module: 'recurringHandler' });

/**
 * Helper to reply to either a Message or Interaction object safely
 */
async function sendReply(target, content) {
  if (target.deferred) {
    return await target.editReply(content);
  } else if (typeof target.reply === 'function') {
    return await target.reply(content);
  } else if (typeof target.send === 'function') {
    return await target.send(content);
  }
}

/**
 * Handle recurring payment command
 * @param {Object} message - Discord message object
 * @param {string|Object} commandTextOrParsed - Full command text or scheduleResult object
 * @param {Object} options - Options containing startTime, etc.
 */
export async function handleRecurringPayment(message, commandTextOrParsed, options = {}) {
  try {
    // Get sender profile
    const senderProfile = await getProfileByDiscordId(message.author.id);
    if (!senderProfile) {
      await sendOnboarding(message);
      return;
    }

    let parsed;
    let baseCommandText;

    if (typeof commandTextOrParsed === 'object') {
      const scheduleResult = commandTextOrParsed;
      const intervalMs = getIntervalMs(scheduleResult.recurrenceInterval || 1, scheduleResult.recurrenceRule);
      
      let count = scheduleResult.recurringCount;
      if (!count && scheduleResult.recurringDuration) {
        const { value, unit } = scheduleResult.recurringDuration;
        count = convertDurationToCount(value, unit, intervalMs);
      }

      parsed = {
        intervalMs,
        count,
        warnings: [],
        originalText: scheduleResult.command,
        baseCommand: scheduleResult.command,
      };
      baseCommandText = scheduleResult.command;
    } else {
      parsed = parseRecurringCommand(commandTextOrParsed);
      baseCommandText = extractBaseCommand(commandTextOrParsed, parsed);
    }

    // Validate syntax
    let syntaxValidation;
    try {
      syntaxValidation = validateSyntax(parsed);
    } catch (syntaxError) {
      await sendReply(message, `❌ **Validation Error:** ${syntaxError.message}`);
      return;
    }

    // Accumulate all warnings and pro tips
    const allWarnings = [...(parsed?.warnings || []), ...(syntaxValidation.warnings || [])];

    // Parse the base payment command
    const baseCommand = parseCommand(`!monibot ${baseCommandText}`);
    let finalCommand = baseCommand;
    
    // Try AI parsing if standard parsing failed
    if (!finalCommand || !finalCommand.type || finalCommand.type === 'chat') {
      const aiResult = await aiParseCommand(baseCommandText, 'discord');
      if (aiResult && aiResult.type && aiResult.type !== 'chat') {
        finalCommand = aiResult;
      }
    }

    if (!finalCommand || !finalCommand.type) {
      await sendReply(message, "Could not parse base command, blud is delulu 🤡");
      return;
    }

    // Extract payment details
    const { amount, recipients = [], type: commandType } = finalCommand;
    const isPayment = ['p2p', 'p2p_multi', 'giveaway'].includes(commandType);

    if (isPayment) {
      if (!amount || amount <= 0) {
        await sendReply(message, "Amount must be greater than 0, no cap 🧢");
        return;
      }
    }

    // Resolve active chain using resolveActiveChain
    const serverConfig = message.guild ? await getServerConfig(message.guild.id) : { default_chain: 'base', chain_locked: false };
    let activeChain;
    try {
      activeChain = resolveActiveChain(finalCommand.chain, senderProfile, serverConfig);
    } catch (err) {
      if (err.message.startsWith('CHAIN_LOCKED:')) {
        await sendReply(message, err.message.split(':')[1]);
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

    // Fetch all user balances first
    let allBalances = [];
    try {
      allBalances = await getAllBalances(senderProfile.addresses);
    } catch (balErr) {
      log.warn('Failed to fetch balances for recurring payment check', balErr);
    }
    const balancesMap = {};
    allBalances.forEach(b => {
      balancesMap[b.chain.toLowerCase()] = b.balance;
    });
    senderProfile.balance = balancesMap;

    // Persistent auto-routing check:
    // If the sender's balance on the primary chain is less than the total cost of the series,
    // look for an alternate chain with sufficient balance.
    let executionChain = activeChain;
    let autoRouted = false;
    const originalChain = activeChain;

    const totalCost = isPayment ? calculateSeriesCost(amount, syntaxValidation.count, recipients) : 0;
    const primaryBalance = senderProfile.balance[activeChain] || 0;

    if (isPayment && primaryBalance < totalCost) {
      const senderAddress = senderProfile.addresses[activeChain] || senderProfile.addresses.celo;
      const alt = await findAlternateChain(senderAddress, totalCost, activeChain, 'p2p');
      if (alt && !alt.needsAllowance) {
        executionChain = alt.chain;
        autoRouted = true;
      }
    }

    // Validate recurring payment constraints
    const validation = validateRecurringPayment({
      intervalMs: syntaxValidation.intervalMs,
      count: syntaxValidation.count,
      amount: isPayment ? amount : undefined,
      recipients,
      senderProfile,
      chain: executionChain,
    });

    if (!validation.ok) {
      await sendReply(message, `**Validation Failed:**\n${validation.errors.join('\n')}`);
      return;
    }

    // Accumulate validation warnings (e.g. low balance warning)
    if (validation.warnings && validation.warnings.length > 0) {
      allWarnings.push(...validation.warnings);
    }

    // Perform safety checks
    const safetyChecks = performSafetyChecks({
      intervalMs: syntaxValidation.intervalMs,
      count: syntaxValidation.count,
      amount: isPayment ? amount : undefined,
    });

    const allProTips = [...(safetyChecks.warnings || [])];
    if (miniPayRerouted) {
      allProTips.push("MiniPay wallet detected ⚡ Auto-routed to Celo no cap 🧢");
    }

    // Filter out low balance warnings if they don't apply based on:
    // "only include that warning if user has low balance on all chains or the specified chain"
    const userSpecifiedChain = detectChain(baseCommandText) || (finalCommand && finalCommand.chain);
    
    let shouldShowBalanceWarning = isPayment;
    if (isPayment) {
      if (userSpecifiedChain) {
        const specChainBal = senderProfile.balance?.[userSpecifiedChain.toLowerCase()] || 0;
        shouldShowBalanceWarning = specChainBal < totalCost;
      } else {
        const hasLowBalanceOnAll = !senderProfile.balance || 
                                   Object.keys(senderProfile.balance).length === 0 || 
                                   Object.values(senderProfile.balance).every(bal => bal < totalCost);
        shouldShowBalanceWarning = hasLowBalanceOnAll;
      }
    }

    const filteredWarnings = !shouldShowBalanceWarning
      ? allWarnings.filter(w => !w.includes("Total series costs") && !w.includes("might fail at execution time"))
      : allWarnings;

    // Create recurring series
    const seriesResult = await createRecurringSeries({
      message,
      senderProfile,
      command: {
        ...finalCommand,
        chain: executionChain,
      },
      intervalMs: syntaxValidation.intervalMs,
      count: syntaxValidation.count,
      originalText: typeof commandTextOrParsed === 'object' ? (commandTextOrParsed.originalText || baseCommandText) : commandTextOrParsed,
      chain: executionChain,
      startTime: options.startTime || Date.now(),
    });

    if (!seriesResult.success) {
      let failReply = `❌ **Failed to create series:**\n${seriesResult.error}`;
      if (filteredWarnings.length > 0) {
        const uniqueWarns = [...new Set(filteredWarnings)];
        failReply += `\n\n⚠️ **Warnings:**\n${uniqueWarns.join('\n')}`;
      }
      if (allProTips.length > 0) {
        const uniqueTips = [...new Set(allProTips)];
        failReply += `\n\n💡 **Pro Tips:**\n${uniqueTips.join('\n')}`;
      }
      await sendReply(message, failReply);
      return;
    }

    // Resolve sender and recipient labels
    const senderLabel = message.author ? message.author.username : `@${senderProfile.pay_tag}`;
    const recipientLabels = [];
    if (isPayment && recipients && recipients.length > 0) {
      for (const tag of recipients) {
        const cleanTag = tag.replace('@', '').toLowerCase();
        const profile = await getProfileByMonitag(cleanTag);
        if (profile && profile.discord_id) {
          try {
            const user = await message.client.users.fetch(profile.discord_id);
            if (user) {
              recipientLabels.push(user.username);
            } else {
              recipientLabels.push(`<@${profile.discord_id}>`);
            }
          } catch (e) {
            recipientLabels.push(`<@${profile.discord_id}>`);
          }
        } else {
          recipientLabels.push(tag.startsWith('@') ? tag : `@${tag}`);
        }
      }
    }

    // Send confirmation message
    const confirmationMsg = buildRecurringConfirmation({
      seriesId: seriesResult.seriesId,
      count: syntaxValidation.count,
      firstAt: seriesResult.firstAt,
      lastAt: seriesResult.lastAt,
      amount: isPayment ? amount : undefined,
      totalAmount: totalCost,
      intervalMs: syntaxValidation.intervalMs,
      recipients,
      chain: executionChain.toUpperCase(),
      warnings: filteredWarnings,
      proTips: allProTips,
      autoRouted,
      originalChain,
      originalText: baseCommandText,
      senderLabel,
      recipientLabels,
    });

    await sendReply(message, confirmationMsg);

    // Log series creation
    log.info('Recurring series created', {
      seriesId: seriesResult.seriesId,
      userId: message.author.id,
      count: syntaxValidation.count,
      intervalMs: syntaxValidation.intervalMs,
      totalCost: totalCost,
    });

  } catch (error) {
    log.error('Error handling recurring payment:', error);
    await sendReply(
      message,
      "Unexpected L while scheduling recurring payments. The dev team is cooking a fix, fr fr 🗿"
    );
  }
}

/**
 * Create recurring payment series (N scheduled jobs)
 * @param {Object} config - Series configuration
 * @returns {Object} - Result with success flag and series data
 */
async function createRecurringSeries(config) {
  const {
    message,
    senderProfile,
    command,
    intervalMs,
    count,
    originalText,
    chain,
    startTime = Date.now(),
  } = config;

  try {
    const supabase = getSupabase();
    const seriesId = randomUUID();

    // Determine job type
    const jobType = command.type === 'p2p_multi' || (command.recipients && command.recipients.length > 1)
      ? 'p2p_multi'
      : 'scheduled_p2p';

    // Generate series jobs
    const jobs = Array.from({ length: count }, (_, i) => ({
      type: jobType,
      status: 'pending',
      scheduled_at: new Date(startTime + (i + 1) * intervalMs).toISOString(),
      source_author_id: message.author.id,
      source_author_username: message.author.tag,
      source_tweet_id: message.id,
      max_attempts: 3,
      attempts: 0,
      payload: {
        // Platform identifiers
        platform: 'discord',
        channelId: message.channel.id,
        guildId: message.guild?.id || 'DM',
        
        // Sender info
        senderId: senderProfile.id,
        senderDiscordId: message.author.id,
        senderPayTag: senderProfile.pay_tag,
        senderSource: senderProfile.source,
        senderWallet: senderProfile.addresses[chain] || senderProfile.addresses.base,
        
        // Command details
        command: command,
        originalText: originalText,
        
        // Series metadata
        seriesId: seriesId,
        seriesIndex: i + 1,
        seriesTotalCount: count,
        seriesIntervalMs: intervalMs,
        seriesStartedAt: new Date(startTime).toISOString(),
        
        // CRITICAL: Do NOT set these to prevent executor double-scheduling
        isRecurring: false,
        recurrenceRule: null,
      },
    }));

    // Atomic insert of all jobs
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .insert(jobs)
      .select();

    if (error) {
      log.error('Database insertion failed:', error);
      return {
        success: false,
        error: 'Database insertion failed. Series not created. Try again.',
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'No jobs were created. Please try again.',
      };
    }

    log.info(`Created ${data.length} jobs for series ${seriesId}`);

    return {
      success: true,
      seriesId,
      jobCount: data.length,
      firstAt: jobs[0].scheduled_at,
      lastAt: jobs[count - 1].scheduled_at,
    };

  } catch (error) {
    log.error('Error creating recurring series:', error);
    return {
      success: false,
      error: 'Unexpected error creating series.',
    };
  }
}

/**
 * Get series progress/status
 * @param {Object} message - Discord message or interaction
 * @param {string} seriesId - Series UUID
 */
export async function getSeriesProgress(message, seriesId) {
  try {
    const supabase = getSupabase();

    // Query all jobs for this series
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('payload->>seriesId', seriesId)
      .order('scheduled_at', { ascending: true });

    if (error) {
      log.error('Error fetching series progress:', error);
      await sendReply(message, "Failed to fetch series status from the vault, L Aura 📉");
      return;
    }

    if (!jobs || jobs.length === 0) {
      await sendReply(message, "Series ID not found in the database, blud is delulu 👻");
      return;
    }

    // Verify ownership
    const firstJob = jobs[0];
    const authorId = message.author?.id || message.user?.id;
    if (String(firstJob.source_author_id) !== String(authorId)) {
      await sendReply(message, "That's not your series, chief 🚫");
      return;
    }

    // Build and send status embed
    const statusMsg = buildSeriesStatus(jobs, seriesId);
    await sendReply(message, statusMsg);

  } catch (error) {
    log.error('Error in getSeriesProgress:', error);
    await sendReply(message, "Fatal crash trying to check that series status 💀");
  }
}

/**
 * Cancel pending jobs in a series
 * @param {Object} message - Discord message or interaction
 * @param {string} seriesId - Series UUID
 */
export async function cancelPendingSeries(message, seriesId) {
  try {
    const supabase = getSupabase();

    // First, verify ownership by checking if any job in this series belongs to the user
    const { data: checkJobs, error: checkError } = await supabase
      .from('scheduled_jobs')
      .select('id, source_author_id')
      .eq('payload->>seriesId', seriesId)
      .limit(1);

    if (checkError || !checkJobs || checkJobs.length === 0) {
      await sendReply(message, "Series ID not found in the vault, blud is delulu 👻");
      return;
    }

    const checkJob = checkJobs[0];
    const authorId = message.author?.id || message.user?.id;
    if (String(checkJob.source_author_id) !== String(authorId)) {
      await sendReply(message, "That's not your series, chief 🚫");
      return;
    }

    // Cancel all pending jobs
    const { data: cancelledJobs, error } = await supabase
      .from('scheduled_jobs')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user',
      })
      .eq('payload->>seriesId', seriesId)
      .eq('status', 'pending')
      .select();

    if (error) {
      log.error('Error cancelling series:', error);
      await sendReply(message, "Failed to cancel that series, database acting sus 📉");
      return;
    }

    const cancelledCount = cancelledJobs?.length || 0;

    // Build and send cancellation confirmation
    const confirmMsg = buildCancellationConfirmation(cancelledCount, seriesId);
    await sendReply(message, confirmMsg);

    log.info('Series cancelled', {
      seriesId,
      userId: authorId,
      cancelledCount,
    });

  } catch (error) {
    log.error('Error in cancelPendingSeries:', error);
    await sendReply(message, "Fatal crash trying to cancel that series 💀");
  }
}

/**
 * List all series for a user
 * @param {Object} message - Discord message or interaction
 */
export async function listUserSeries(message) {
  try {
    const supabase = getSupabase();
    const authorId = message.author?.id || message.user?.id;

    // Get all jobs for this user grouped by seriesId
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('source_author_id', authorId)
      .not('payload->>seriesId', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Error fetching user series:', error);
      await sendReply(message, "Failed to fetch your series from the database 📉");
      return;
    }

    if (!jobs || jobs.length === 0) {
      await sendReply(message, "You don't have any recurring payment series yet 🤷\nCreate one with: `!monibot send $5 to @alice every day 5 times`");
      return;
    }

    // Group by seriesId
    const seriesMap = {};
    jobs.forEach(job => {
      const sid = job.payload.seriesId;
      if (!seriesMap[sid]) {
        seriesMap[sid] = {
          seriesId: sid,
          jobs: [],
          completed: 0,
          pending: 0,
          failed: 0,
        };
      }
      seriesMap[sid].jobs.push(job);
      if (job.status === 'completed') seriesMap[sid].completed++;
      if (job.status === 'pending') seriesMap[sid].pending++;
      if (job.status === 'failed') seriesMap[sid].failed++;
    });

    // Build summary message
    const seriesList = Object.values(seriesMap);
    let summary = `**Your Recurring Payment Series** (${seriesList.length} total)\n\n`;

    seriesList.slice(0, 10).forEach((series, idx) => {
      const firstJob = series.jobs[0];
      const { seriesTotalCount, originalText } = firstJob.payload;
      const progress = `${series.completed}/${seriesTotalCount}`;
      const status = series.pending > 0 ? '🔄 Active' : series.completed === seriesTotalCount ? '✅ Complete' : '⏸️ Ended';
      
      summary += `**${idx + 1}.** \`${series.seriesId.slice(0, 8)}\` - ${status}\n`;
      summary += `   Progress: ${progress} | Pending: ${series.pending} | Failed: ${series.failed}\n`;
      summary += `   Command: ${originalText.slice(0, 60)}${originalText.length > 60 ? '...' : ''}\n\n`;
    });

    if (seriesList.length > 10) {
      summary += `\n...and ${seriesList.length - 10} more series`;
    }

    summary += `\n💡 Check status: \`!monibot series status <id>\``;
    summary += `\n🛑 Cancel series: \`!monibot cancel series <id>\``;

    await sendReply(message, summary);

  } catch (error) {
    log.error('Error in listUserSeries:', error);
    await sendReply(message, "Fatal error checking user series progress 💀");
  }
}
