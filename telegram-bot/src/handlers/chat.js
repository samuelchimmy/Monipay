import { aiChat, aiParseCommand, aiParseSchedule } from '../../shared/ai.js';
import { isCommandProcessed, getProfileByPlatformId } from '../../shared/database.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { handleBalance } from './balance.js';
import { handleGiveaway } from './giveaway.js';
import { handleHelp } from './help.js';
import { handleAbout } from './about.js';
import { handleLink } from './link.js';
import { handleSetChain } from './setChain.js';
import { handleP2P } from './p2p.js';
import { parseCommand } from '../utils/parseCommand.js';
import { handleRecurringManagementNL } from './recurring.js';
import { handleScheduledCommand, tryScheduleFromMessage } from './schedule.js';
import { handleFeatureExplanationNL } from './featureExplanation.js';
import { sanitizeUserInput } from '../security/inputSanitizer.js';
import { buildParseError } from '../utils/replies.js';


function generateBrainrotReply() {
  const template = `🦁 *[GREETING], [ADDRESS]!* You're [STATUS] on MoniPay, [EMPHASIS]. 💀\n\nIf you want to [ACTION] and send guap with AI, you gotta [ONBOARD]!\n\nChoose your setup below to link your account or MiniPay wallet, no cap:`;

  const dict = {
    GREETING: ['Hold up', 'Ayo', 'Wait up', 'Listen close'],
    ADDRESS: ['blud', 'fam', 'homie', 'cuz'],
    STATUS: ['not linked yet', 'completely unlinked', 'unregistered', 'absent from the database'],
    EMPHASIS: ['no cap', 'on god', 'certified cooked', 'major L'],
    ACTION: ['secure the bag', 'collect the bags', 'secure the vault', 'stack your bags'],
    ONBOARD: ['get hooked up', 'get active', 'tap in', 'stop slacking']
  };

  let reply = template;
  for (const [key, list] of Object.entries(dict)) {
    const randomWord = list[Math.floor(Math.random() * list.length)];
    reply = reply.replace(new RegExp(`\\[${key}\\]`, 'g'), randomWord);
  }
  return reply;
}

export async function handleNaturalLanguage(bot, msg) {
  if (!msg.text || msg.from?.is_bot) return;

  const isPrivate = msg.chat.type === 'private';
  const isMentioned = msg.text.toLowerCase().includes('monibot') || msg.text.toLowerCase().includes('monipaybot');
  const isReplyToBot = msg.reply_to_message?.from?.is_bot === true;
  const isSlash = msg.text.startsWith('/');

  if (!isPrivate && !isMentioned && !isReplyToBot && !isSlash) return;

  // Filter out registered slash commands that are handled by specific bot.onText listeners
  if (isSlash) {
    const registeredSlashCommands = [
      '/start', '/help', '/about', 
      '/cancel_series', '/cancel', '/series_status', '/my_series'
    ];
    const commandPrefix = msg.text.split(' ')[0].toLowerCase();
    if (registeredSlashCommands.includes(commandPrefix)) return;
  }

  let cleaned = msg.text
    .replace(/^\//, '') // Strip leading slash if present
    .replace(/@monipaybot/gi, '')
    .replace(/@monibot/gi, '')
    .replace(/monipaybot/gi, '')
    .replace(/monibot/gi, '')
    .trim();

  const sanitized = sanitizeUserInput(cleaned);
  if (!sanitized.safe) {
    console.warn(`[Security] Telegram injection blocked: ${sanitized.threatCategory}`);
    await bot.sendMessage(msg.chat.id, "⚠️ Can't process that one, fam.");
    return;
  }
  cleaned = sanitized.cleaned;

  // FAQ / Feature Explanations (Before profile check so unlinked users can ask!)
  if (cleaned) {
    const explanationHandled = await handleFeatureExplanationNL(bot, msg, cleaned);
    if (explanationHandled) return;
  }

  const profile = await getProfileByPlatformId('telegram', String(msg.from.id));
  if (!profile) {
    const onboardingText = generateBrainrotReply();
    await bot.sendMessage(msg.chat.id, onboardingText, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'MONIPAY', url: 'https://monipay.xyz' },
            { text: 'MINIPAY', url: 'https://monipay.xyz/minipay' }
          ]
        ]
      }
    });
    return;
  }

  const rl = checkRateLimit(String(msg.from.id));
  if (!rl.allowed) {
    await bot.sendMessage(msg.chat.id, `⏳ Try again in ${rl.retryAfter}s fam.`);
    return;
  }

  if (await isCommandProcessed('telegram', String(msg.message_id))) return;

  if (!cleaned) return;

  // 1. SCHEDULE CHECK (Must be first to capture scheduled/recurring versions of verbs)
  const scheduled = await tryScheduleFromMessage(bot, msg, cleaned);
  if (scheduled) return;

  // 2. RECURRING MANAGEMENT CHECK (cancel, status, list)
  const recurringManaged = await handleRecurringManagementNL(bot, msg, cleaned);
  if (recurringManaged) return;

  // 3. REGEX FIRST — fast path (immediate execution)
  const regexCmd = parseCommand(cleaned);
  if (regexCmd) {
    switch (regexCmd.type) {
      case 'balance':  await handleBalance(bot, msg, cleaned); return;
      case 'help':     await handleHelp(bot, msg); return;
      case 'link':     await handleLink(bot, msg); return;
      case 'about':    await handleAbout(bot, msg); return;
      case 'set_chain': await handleSetChain(bot, msg, regexCmd.chain); return;
      case 'giveaway':
        await handleGiveaway(bot, msg, regexCmd.amount, regexCmd.maxParticipants, regexCmd.chain);
        return;
      case 'p2p':
      case 'p2p_multi':
        await handleP2P(bot, msg, regexCmd);
        return;
    }
  }

  // 4. AI FALLBACK — only if regex didn't match
  let aiResult = null;
  try {
    aiResult = await aiParseCommand(cleaned, 'telegram');
  } catch (error) {
    console.error('❌ AI parse command error:', error.message);
    await bot.sendMessage(
      msg.chat.id,
      `⚠️ *MoniBot AI is temporarily offline or rate-limited, blud!* 💀\n\nI couldn't process your message. Please use direct commands (e.g. \`/send $5 to @username\` or \`/balance\`) to keep securing the bag! 🗿`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  if (aiResult?.type && aiResult.type !== 'chat') {
    switch (aiResult.type) {
      case 'balance':   await handleBalance(bot, msg, cleaned); break;
      case 'link':      await handleLink(bot, msg); break;
      case 'help':      await handleHelp(bot, msg); break;
      case 'giveaway':  await handleGiveaway(bot, msg, aiResult.amount, aiResult.maxParticipants, aiResult.chain); break;
      case 'p2p':
      case 'p2p_multi': await handleP2P(bot, msg, aiResult); break;
    }
    return;
  }

  // 5. CONVERSATIONAL AI — last resort
  // But first: if the text looks like a payment command that we simply
  // couldn't fully parse, tell the user WHY instead of chatting.
  const SEND_VERBS = /\b(send|pay|slide|tip|bless|give|transfer|shoot|drop|wire|zap|forward)\b/i;
  if (SEND_VERBS.test(cleaned)) {
    await bot.sendMessage(msg.chat.id, buildParseError(cleaned), { parse_mode: 'Markdown' });
    return;
  }

  // NOTE: AI output is free-form and may contain unmatched Markdown characters
  // (e.g. * _ ` from user input echoed back). Send as plain text to prevent
  // "Can't parse entities" crashes.
  let reply = null;
  try {
    reply = await aiChat(cleaned, msg.from.username || msg.from.first_name, 'telegram');
  } catch (error) {
    console.error('❌ Conversational AI error:', error.message);
    reply = `⚠️ MoniBot AI is temporarily sleeping, fam! 😴 My brain cells are cooked due to high volume. Try again in a moment, or type /help to see all our cool commands! 🗿`;
  }
  await bot.sendMessage(msg.chat.id,
    reply || `I'm MoniBot 💸 — type \`send $5 to @alice\` or use /help`
  );
}
