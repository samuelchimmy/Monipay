/**
 * MoniBot Discord Bot v3.0
 *
 * Refactored Architecture:
 * - Modular handlers (src/handlers/)
 * - Payment service with cross-chain fallback (src/services/)
 * - Nonce manager with per-chain transaction queues (src/nonceManager.js)
 * - Input validation & AI result schema checking (src/validation.js)
 * - Structured JSON logging (src/logger.js)
 * - Constants/enums replace magic strings (src/constants.js)
 * - Welcome messages with 24h cooldown (prevents restart spam)
 * - RPC failover that actually rotates on failure
 * - Parallelized multi-send with concurrency limits
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, Events, Partials } from 'discord.js';
import express from 'express';

// Core modules
import logger from './src/logger.js';
import { RATE_LIMIT, INTERVALS, COMMAND_TYPES, DEFAULT_CHAIN } from './src/constants.js';
import { validateAICommand, validateParsedCommand } from './src/validation.js';
import { getQueueStats } from './src/nonceManager.js';

// Database
import { initSupabase, getSupabase, getProfileByDiscordId, isCommandProcessed, upsertDiscordServer, markServerInactive, getCompletedScheduledJobs, getPendingScheduledJobs, getServerConfig } from './database.js';

// Command parsing
import { parseCommand, parseScheduleViaEdge } from './commands.js';
import { aiParseCommand, aiChat } from './ai.js';

// Middleware
import { checkRateLimit, startRateLimitCleanup } from './src/middleware/rateLimiter.js';
import { agentFeedbackMiddleware } from './src/middleware/agentFeedback.js';

// Handlers
import { handleHelp, handleSetup, handleLink } from './src/handlers/helpHandler.js';
import { sendFeedbackPrompt, getFeedbackUrlIfEligible } from './src/services/feedbackService.js';
import { buildSeriesCompletion } from './src/embeds/recurringEmbeds.js';
import { handleBalance } from './src/handlers/balanceHandler.js';
import { handleP2P } from './src/handlers/p2pHandler.js';
import { handleP2PMulti } from './src/handlers/multiSendHandler.js';
import { handleGiveaway } from './src/handlers/giveawayHandler.js';
import { handleSetChain } from './src/handlers/chainHandler.js';
import { handleChat } from './src/handlers/chatHandler.js';
import { handleInfo } from './src/handlers/infoHandler.js';
import { handleHistory, handleClaimable } from './src/handlers/historyHandler.js';
import { handleLeaderboard } from './src/handlers/leaderboardHandler.js';
import { handleScheduledCommand, handleCancel } from './src/handlers/scheduleHandler.js';
import { sendWelcomeMessage } from './src/handlers/welcomeHandler.js';
import { handleRecurringPayment, getSeriesProgress, cancelPendingSeries, listUserSeries } from './src/handlers/recurringHandler.js';

// Chains (for poller)
import { getExplorerUrl } from './chains.js';

const log = logger.child({ module: 'main' });

const PORT = process.env.PORT || 3000;

// ============ Express Health Check ============

const app = express();
app.use(agentFeedbackMiddleware);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'discord',
    guilds: client?.guilds?.cache?.size || 0,
    uptime: process.uptime(),
    queues: getQueueStats(),
  });
});
app.listen(PORT, () => log.info('🚀 Health server started', { port: PORT }));

// ============ Discord Client ============

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

// ============ Initialization ============

log.info('MoniBot Discord Bot v3.0 starting...');
initSupabase();
startRateLimitCleanup();

// ============ Event: Ready ============

client.once(Events.ClientReady, async (c) => {
  log.info('📡 Logged in', { tag: c.user.tag, guilds: c.guilds.cache.size });

  // Track all guilds on startup
  for (const guild of c.guilds.cache.values()) {
    upsertDiscordServer(guild.id, guild.name, guild.ownerId, guild.memberCount);
  }

  // Notify users with pending scheduled jobs that bot is back online
  await notifyScheduledJobRecovery();

  // Start scheduled job notification poller
  setInterval(pollScheduledJobResults, INTERVALS.JOB_POLL_MS);
  log.info('📡 Scheduled job poller started', { intervalMs: INTERVALS.JOB_POLL_MS });

  // Clean up notified set
  setInterval(() => { notifiedJobIds.clear(); }, INTERVALS.NOTIFIED_CLEANUP_MS);
});

// ============ Event: Guild Join/Leave ============

client.on(Events.GuildCreate, async (guild) => {
  log.info('📥 Joined server', { guild: guild.name, guildId: guild.id });
  upsertDiscordServer(guild.id, guild.name, guild.ownerId, guild.memberCount);

  try {
    const fullGuild = await guild.fetch();
    await sendWelcomeMessage(fullGuild);
  } catch (err) {
    log.error('Welcome/GuildCreate error', { guild: guild.name, error: err.message });
  }
});

client.on(Events.GuildDelete, (guild) => {
  log.info('📤 Left server', { guild: guild.name, guildId: guild.id });
  markServerInactive(guild.id);
});

// ============ Event: Message ============

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('info_')) {
    await handleInfo(interaction);
  } else if (interaction.customId === 'history_view') {
    await handleHistory(interaction);
  } else if (interaction.customId === 'history_claimable') {
    await handleClaimable(interaction);
  } else if (interaction.customId === 'magicpay_claim') {
    await handleInfo(interaction, 'info_get_started');
  } else if (interaction.customId.startsWith('cancel_series_')) {
    const seriesId = interaction.customId.replace('cancel_series_', '');
    await interaction.deferReply({ ephemeral: true });
    await cancelPendingSeries(interaction, seriesId);
  } else if (interaction.customId.startsWith('view_series_')) {
    const seriesId = interaction.customId.replace('view_series_', '');
    await interaction.deferReply({ ephemeral: true });
    await getSeriesProgress(interaction, seriesId);
  }
});

function detectInfoTopic(text) {
  const lower = text.toLowerCase();
  if (
    /\b(sports?|world\s*cup|football|soccer|bets?|match|prediction)\b/i.test(lower) ||
    (/\bif\b/i.test(lower) && /\b(wins|beats|draws|ties)\b/i.test(lower))
  ) {
    return 'info_sports_p2p';
  }
  if (lower.includes('casualpay') || lower.includes('casual pay')) {
    return 'info_casualpay';
  }
  if (lower.includes('magicpay') || lower.includes('magic pay') || lower.includes('escrow')) {
    return 'info_magicpay';
  }
  if (lower.includes('scheduling') || lower.includes('schedule') || lower.includes('tomorrow') || lower.includes('in 5 mins') || lower.includes('at 3pm')) {
    return 'info_scheduling';
  }
  if (lower.includes('recurring') || lower.includes('every') || lower.includes('autopay') || lower.includes('series')) {
    return 'info_recurring';
  }
  if (lower.includes('minipay') || lower.includes('difference') || lower.includes('monipay vs minipay') || lower.includes('minipay vs monipay')) {
    return 'info_minipay_vs_monipay';
  }
  if (lower.includes('get started') || lower.includes('how to start') || lower.includes('setup') || lower.includes('how do i start')) {
    return 'info_get_started';
  }
  if (lower.includes('ai') || lower.includes('agent') || lower.includes('autonomous') || lower.includes('how it works')) {
    return 'info_how_ai_works';
  }
  if (lower.includes('what is monipay') || (lower.includes('monipay') && (lower.includes('what') || lower.includes('explain')))) {
    return 'info_what_is_monipay';
  }
  if (lower.includes('faq') || lower.includes('questions')) {
    return 'info_faq';
  }
  return null;
}

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  const isDM = !message.guild;
  const content = message.content.trim();
  const botMention = `<@${client.user.id}>`;

  // In guilds, require prefix or mention. In DMs, allow anything.
  if (!isDM && !content.toLowerCase().startsWith('!monibot') && !content.startsWith(botMention)) return;

  // Remove prefix/mention to get the actual message
  let cleaned = content;
  if (content.toLowerCase().startsWith('!monibot')) {
    cleaned = content.replace(/^!monibot\s*/i, '');
  } else if (content.startsWith(botMention)) {
    cleaned = content.replace(/<@!?\d+>\s*/g, '');
  }
  cleaned = cleaned.trim();
  if (!cleaned) return;

  // Rate limit check
  const rateCheck = checkRateLimit(message.author.id);
  if (!rateCheck.allowed) {
    await message.reply(
      `**Slow down!** You're sending commands too fast. Please wait **${rateCheck.retryAfter}s** before trying again.\n` +
      `_(Limit: ${RATE_LIMIT.MAX_COMMANDS} commands per minute)_`
    );
    return;
  }

  // Check if this is a follow-up to a pending recurring command
  if (pendingRecurringCommands.has(message.author.id)) {
    const session = pendingRecurringCommands.get(message.author.id);
    const countMatch = content.match(/^(\d+)(?:\s*times)?$/i);
    const durationMatch = content.match(/^(\d+)\s*(minute|min|hour|hr|day|week|month)s?$/i);

    if (countMatch || durationMatch) {
      const scheduleResult = session.scheduleResult;
      if (countMatch) {
        scheduleResult.recurringCount = parseInt(countMatch[1]);
      } else {
        scheduleResult.recurringDuration = { value: parseInt(durationMatch[1]), unit: durationMatch[2].toLowerCase() };
      }
      pendingRecurringCommands.delete(message.author.id);
      await handleScheduledCommand(message, scheduleResult, scheduleResult.command);
      return;
    }

    // If it's not a valid answer, maybe they want to cancel or something else.
    // If it's another command, we'll clear the session and proceed.
    if (!content.match(/^\d+/)) {
      pendingRecurringCommands.delete(message.author.id);
    }
  }

  // Check for time-aware scheduling via edge function
  const scheduleResult = await parseScheduleViaEdge(content, getSupabase());
  if (scheduleResult?.hasSchedule && scheduleResult.scheduledAt && scheduleResult.command) {
    // If recurring but missing count/duration, it will be handled inside handleScheduledCommand
    const result = await handleScheduledCommand(message, scheduleResult, cleaned);
    if (result === 'AWAITING_RECURRING_INFO') {
      pendingRecurringCommands.set(message.author.id, { scheduleResult, createdAt: Date.now() });
    }
    return;
  }

  // Try regex parsing first (fast path)
  let command = parseCommand(content);
  let isAI = false;

  // Validate regex-parsed command
  if (command) {
    const validation = validateParsedCommand(command);
    if (!validation.valid) {
      const isDM = !message.guild;
      const dmHint = isDM ? "\n\n🤫 **Note:** You can talk to me directly in this chat without any prefix!" : "";
      await message.reply(`**Invalid command:** ${validation.reason}${dmHint}`);
      return;
    }
  }

  // If regex fails, try AI parsing (smart path)
  if (!command) {
    log.debug('Regex miss, trying NLP', { text: cleaned.substring(0, 80) });

    // Quick check for info keywords before hitting AI
    const lowerCleaned = cleaned.toLowerCase();
    const infoKeywords = ['faq', 'what is', 'how does', 'who are', 'info', 'about', 'how to', 'get started', 'explain', 'tell me', 'difference between', 'casualpay', 'magicpay', 'scheduling', 'recurring', 'minipay', 'sports', 'sport', 'world cup', 'worldcup', 'football', 'soccer', 'bet', 'match', 'prediction', 'if'];
    if (infoKeywords.some(kw => lowerCleaned.includes(kw))) {
      const topic = detectInfoTopic(cleaned);
      await handleInfo(message, topic);
      return;
    }

    const aiResult = await aiParseCommand(cleaned, 'discord');

    if (aiResult) {
      if (aiResult.type === 'chat' || aiResult.type === null) {
        await handleChat(message, cleaned);
        return;
      }

      // Validate AI result before trusting it
      const validatedAI = validateAICommand(aiResult);
      if (!validatedAI) {
        log.warn('AI result failed validation, falling back to chat', { aiResult });
        await handleChat(message, cleaned);
        return;
      }

      isAI = true;
      command = {
        type: validatedAI.type,
        amount: validatedAI.amount,
        recipients: validatedAI.recipients || aiResult.recipients || [],
        chain: validatedAI.chain || DEFAULT_CHAIN,
        maxParticipants: validatedAI.maxParticipants,
        raw: cleaned,
      };
      log.info('AI resolved command', { type: command.type, amount: command.amount, recipients: command.recipients?.join(', ') });
    }
  }

  // Still nothing? Try conversational AI
  if (!command) {
    await handleChat(message, cleaned);
    return;
  }

  // Deduplication
  const alreadyProcessed = await isCommandProcessed('discord', message.id);
  if (alreadyProcessed) return;

  log.info('📨 Processing command', {
    user: message.author.tag,
    type: command.type,
    content: content.substring(0, 80),
  });

  try {
    // Check for recurring payment first
    if (command.type === 'recurring') {
      await handleRecurringPayment(message, cleaned);
      return;
    }

    // Check for series management commands
    if (command.type === COMMAND_TYPES.CANCEL) {
      // Check if it's a series cancellation
      const seriesCancelMatch = cleaned.match(/cancel\s+series\s+([a-f0-9-]{8,})/i);
      if (seriesCancelMatch) {
        await cancelPendingSeries(message, seriesCancelMatch[1]);
        return;
      }
      // Otherwise, it's a regular scheduled job cancel
      await handleCancel(message);
      return;
    }

    // Series status command
    const seriesStatusMatch = cleaned.match(/(?:series\s+status|status\s+series)\s+([a-f0-9-]{8,})/i);
    if (seriesStatusMatch) {
      await getSeriesProgress(message, seriesStatusMatch[1]);
      return;
    }

    // My series list command
    if (cleaned.match(/my\s+series|list\s+series/i)) {
      await listUserSeries(message);
      return;
    }

    switch (command.type) {
      case COMMAND_TYPES.HELP:
        await handleHelp(message);
        break;
      case COMMAND_TYPES.SETUP:
        await handleSetup(message);
        break;
      case COMMAND_TYPES.LINK:
        await handleLink(message, getProfileByDiscordId);
        break;
      case COMMAND_TYPES.BALANCE:
        await handleBalance(message, command);
        break;
      case COMMAND_TYPES.P2P:
        await handleP2P(message, command, isAI, client);
        break;
      case COMMAND_TYPES.P2P_MULTI:
        await handleP2PMulti(message, command, client);
        break;
      case COMMAND_TYPES.GIVEAWAY:
        await handleGiveaway(message, command);
        break;
      case COMMAND_TYPES.SET_CHAIN:
        await handleSetChain(message, command);
        break;
      case COMMAND_TYPES.LEADERBOARD:
        await handleLeaderboard(message);
        break;
      case COMMAND_TYPES.CANCEL:
        await handleCancel(message);
        break;
      case COMMAND_TYPES.CHAT: {
        // Check if chat command might be an info request
        const lowerCleaned = cleaned.toLowerCase();
        const infoKeywords = ['faq', 'what is', 'how does', 'who are', 'info', 'about', 'how to', 'get started', 'explain', 'tell me', 'difference between', 'casualpay', 'magicpay', 'scheduling', 'recurring', 'minipay', 'sports', 'sport', 'world cup', 'worldcup', 'football', 'soccer', 'bet', 'match', 'prediction', 'if'];
        if (infoKeywords.some(kw => lowerCleaned.includes(kw))) {
          const topic = detectInfoTopic(cleaned);
          await handleInfo(message, topic);
        } else {
          await handleChat(message, cleaned);
        }
        break;
      }
      default:
        await handleChat(message, cleaned);
    }
  } catch (error) {
    log.error('Command handler error', { type: command.type, error: error.message });
    await message.reply('Something went wrong processing your command. Please try again.');
  }
});

// ============ Scheduled Job Recovery Notifier ============

async function notifyScheduledJobRecovery() {
  try {
    const pendingJobs = await getPendingScheduledJobs();
    if (!pendingJobs || pendingJobs.length === 0) {
      log.info('📋 No pending scheduled jobs to notify');
      return;
    }

    log.info('📋 Sending recovery notices', { count: pendingJobs.length });

    for (const job of pendingJobs) {
      const channelId = job.payload?.channelId;
      if (!channelId) continue;

      const channel = client.channels.cache.get(channelId);
      if (!channel) continue;

      const senderTag = job.payload?.senderPayTag || 'Unknown';
      const amount = job.payload?.command?.amount || job.payload?.amount || '?';
      const recipients = job.payload?.command?.recipients || job.payload?.recipients || [];
      const scheduledAt = job.scheduled_at ? new Date(job.scheduled_at) : null;
      const unixTs = scheduledAt ? Math.floor(scheduledAt.getTime() / 1000) : null;

      const embed = new EmbedBuilder()
        .setTitle('MoniBot is Back Online!')
        .setDescription(
          `Hey **@${senderTag}** — MoniBot just restarted, but don't worry: your scheduled payment is **still queued** and will execute as planned.`
        )
        .addFields(
          { name: 'Amount', value: `$${amount}`, inline: true },
          { name: 'To', value: recipients.map(r => `@${r}`).join(', ') || 'N/A', inline: true },
          { name: 'Scheduled For', value: unixTs ? `<t:${unixTs}:F> (<t:${unixTs}:R>)` : 'Unknown', inline: false },
          { name: 'Status', value: 'Queued — no action needed', inline: false },
        )
        .setColor(0x0052FF)
        .setFooter({ text: `Job ID: ${job.id} | Powered by MoniPay` });

      try {
        await channel.send({ embeds: [embed] });
        log.info('📬 Recovery notice sent', { channelId, jobId: job.id });
      } catch (sendErr) {
        log.error('Recovery notice failed', { channelId, jobId: job.id, error: sendErr.message });
      }
    }
  } catch (err) {
    log.error('Failed to fetch pending scheduled jobs', { error: err.message });
  }
}

// ============ Scheduled Job Notification Poller ============

const notifiedJobIds = new Set();
const notifiedSeriesIds = new Set();
const pendingRecurringCommands = new Map();

async function pollScheduledJobResults() {
  try {
    const jobs = await getCompletedScheduledJobs();
    for (const job of jobs) {
      if (notifiedJobIds.has(job.id)) continue;
      notifiedJobIds.add(job.id);

      const channelId = job.payload?.channelId;
      if (!channelId) continue;

      const channel = client.channels.cache.get(channelId);
      if (!channel) continue;

      const senderTag = job.payload?.senderPayTag || 'Unknown';
      const recipients = job.payload?.command?.recipients || job.payload?.recipients || [];
      const amount = job.payload?.command?.amount || job.payload?.amount || '?';

      const command = job.payload?.command;
      const isPayment = command && ['p2p', 'p2p_multi', 'giveaway'].includes(command.type);

      if (job.status === 'completed' && job.result) {
        if (command && !isPayment) {
          // Construct mockMessage
          const mockMessage = {
            author: {
              id: job.payload.senderDiscordId || job.source_author_id,
              tag: job.source_author_username || 'Unknown',
            },
            guild: job.payload.guildId && job.payload.guildId !== 'DM' ? { id: job.payload.guildId } : null,
            channel: channel,
            reply: async (content) => {
              if (typeof content === 'string') {
                return await channel.send({ content: `<@${mockMessage.author.id}> ${content}` });
              }
              if (content.embeds || content.components) {
                return await channel.send({
                  content: `<@${mockMessage.author.id}>`,
                  ...content
                });
              }
              return await channel.send(content);
            }
          };

          // Route to the appropriate handler
          try {
            switch (command.type) {
              case COMMAND_TYPES.HELP:
                await handleHelp(mockMessage);
                break;
              case COMMAND_TYPES.SETUP:
                await handleSetup(mockMessage);
                break;
              case COMMAND_TYPES.LINK:
                await handleLink(mockMessage, getProfileByDiscordId);
                break;
              case COMMAND_TYPES.BALANCE:
                await handleBalance(mockMessage, command);
                break;
              case COMMAND_TYPES.SET_CHAIN:
                await handleSetChain(mockMessage, command);
                break;
              case COMMAND_TYPES.LEADERBOARD:
                await handleLeaderboard(mockMessage);
                break;
              case COMMAND_TYPES.CANCEL:
                await handleCancel(mockMessage);
                break;
              case COMMAND_TYPES.CHAT: {
                const lowerCleaned = cleanedText.toLowerCase();
                const infoKeywords = ['faq', 'what is', 'how does', 'who are', 'info', 'about', 'how to', 'get started', 'explain', 'tell me', 'difference between', 'casualpay', 'magicpay', 'scheduling', 'recurring', 'minipay'];
                if (infoKeywords.some(kw => lowerCleaned.includes(kw))) {
                  const topic = detectInfoTopic(cleanedText);
                  await handleInfo(mockMessage, topic);
                } else {
                  await handleChat(mockMessage, cleanedText);
                }
                break;
              }
              default:
                await handleChat(mockMessage, command.raw || '');
            }
          } catch (execErr) {
            log.error('Failed to execute scheduled non-payment command', { jobId: job.id, error: execErr.message });
          }
        } else {
          const txHash = job.result.txHash || job.result.results?.[0]?.txHash;
          const chain = job.payload?.command?.chain || job.payload?.chain || DEFAULT_CHAIN;
          const explorerUrl = getExplorerUrl(chain, txHash || '');

          const embed = new EmbedBuilder()
            .setTitle('Scheduled Payment Complete!')
            .setDescription(`**@${senderTag}**'s scheduled payment has been executed.`)
            .addFields(
              { name: 'Amount', value: `$${amount}`, inline: true },
              { name: 'To', value: recipients.map(r => `@${r}`).join(', ') || 'N/A', inline: true },
            )
            .setColor(0x00FF00)
            .setFooter({ text: `Job ID: ${job.id}` });

          if (txHash) {
            embed.addFields({ name: 'TX', value: `[View on Explorer](${explorerUrl})\n\`${txHash}\``, inline: false });
          }

          if (job.result.results) {
            const summary = job.result.results.map(r =>
              r.status === 'success' ? `@${r.tag}` : `@${r.tag}: ${r.reason}`
            ).join('\n');
            embed.addFields({ name: 'Results', value: summary, inline: false });
          }

          // Feedback prompt (inline if eligible)
          if (job.payload?.senderId && txHash) {
            const feedbackUrl = await getFeedbackUrlIfEligible(job.payload.senderId, txHash, chain);
            if (feedbackUrl) {
              embed.addFields({
                name: '📈 Aura Boost',
                value: `Enjoying the Sigma speed? [Leave a quick rating for this transaction](${feedbackUrl}) to boost your Aura!`,
                inline: false,
              });
              embed.setFooter({ text: `Job ID: ${job.id} | MoniBot: The Most Sigma Payment AI 🗿` });
            }
          }

          await channel.send({ embeds: [embed] });
        }
      } else if (job.status === 'failed') {
        const embed = new EmbedBuilder()
          .setTitle(isPayment ? 'Scheduled Payment Failed' : 'Scheduled Command Failed')
          .setDescription(isPayment 
            ? `**@${senderTag}**'s scheduled payment could not be executed.`
            : `**@${senderTag}**'s scheduled command could not be executed.`)
          .setColor(0xFF0000)
          .setFooter({ text: `Job ID: ${job.id} | Attempts: ${job.attempts}/${job.max_attempts}` });

        if (isPayment) {
          embed.addFields(
            { name: 'Amount', value: `$${amount}`, inline: true },
            { name: 'To', value: recipients.map(r => `@${r}`).join(', ') || 'N/A', inline: true }
          );
        } else if (command?.raw) {
          embed.addFields(
            { name: 'Command', value: command.raw, inline: false }
          );
        }
        
        embed.addFields(
          { name: 'Error', value: job.error_message?.substring(0, 200) || 'Unknown error', inline: false }
        );

        await channel.send({ embeds: [embed] });
      }

      // Check for series completion
      const seriesId = job.payload?.seriesId;
      if (seriesId) {
        const supabase = getSupabase();
        const { data: seriesJobs } = await supabase
          .from('scheduled_jobs')
          .select('status, scheduled_at, completed_at, error_message')
          .eq('payload->>seriesId', seriesId);

        if (seriesJobs && seriesJobs.length > 0) {
          const completedCount = seriesJobs.filter(j => j.status === 'completed').length;
          const failedCount = seriesJobs.filter(j => j.status === 'failed').length;
          const totalCount = seriesJobs.length;

          if (completedCount + failedCount === totalCount) {
            if (!notifiedSeriesIds.has(seriesId)) {
              notifiedSeriesIds.add(seriesId);
              const completionEmbed = buildSeriesCompletion(seriesJobs, job.payload, seriesId);
              await channel.send(completionEmbed);
            }
          }
        }
      }
    }
  } catch (err) {
    log.error('Job notification poll error', { error: err.message });
  }
}

// ============ Graceful Shutdown ============

process.on('SIGTERM', () => { log.info('🛑 SIGTERM received'); client.destroy(); process.exit(0); });
process.on('SIGINT', () => { log.info('🛑 SIGINT received'); client.destroy(); process.exit(0); });

// ============ Login ============

client.login(process.env.DISCORD_BOT_TOKEN);
