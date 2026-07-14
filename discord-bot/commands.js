/**
 * MoniBot Discord - Command Parser
 * 
 * Parses Discord messages into structured commands.
 * Supports:
 * - !monibot send $5 to @alice
 * - !monibot send $1 each to @alice, @bob, @charlie
 * - !monibot giveaway $5 to the first 5 people who drop their monitag
 * - !monibot balance
 * - !monibot help
 * - !monibot link (show linking instructions)
 */

// ============ Command Patterns ============

// P2P: "send $5 to @alice" or "pay $5 to @alice" or "slide $5 to @alice" or "bless <@123> with $5"
// Supporting variations like "send to @user $5" and plain "@user $5"
const P2P_SINGLE = /(?:bless|slide|tip|give|transfer|pay|send)\s+(?:to\s+)?(?:@(\w[\w-]*)|<@!?(\d+)>)\s*(?:with\s+)?\$?([\d.]+)|(?:bless|slide|tip|give|transfer|pay|send)\s+\$?([\d.]+)\s+(?:usdc|usdt|alphausd|αusd)?\s*(?:to\s+)?(?:@(\w[\w-]*)|<@!?(\d+)>)|(?:@(\w[\w-]*)|<@!?(\d+)>)\s+\$?([\d.]+)/i;

// Multi-send: "send $1 each to @alice, @bob, @charlie" or "send $1 each to @alice and @bob"
const P2P_MULTI = /(?:bless|slide|tip|give|transfer|pay|send)\s+\$?([\d.]+)\s*(?:usdc|usdt|alphausd|αusd)?\s*each\s+to\s+(.*)/i;

// Giveaway: "giveaway $5 to the first 5 people who drop their monitag"
const GIVEAWAY = /giveaway\s+\$?([\d.]+)\s*(?:usdc|usdt|alphausd|αusd)?\s*(?:to\s+)?(?:the\s+)?(?:first\s+)?(\d+)\s*(?:people|users|tags|monitags)?/i;

// Drop: "send $1 to the first 5 people who drop their monitag" (giveaway via send command)
const DROP = /(?:send|pay)\s+\$?([\d.]+)\s*(?:usdc|usdt|alphausd|αusd)?\s*(?:to\s+)?(?:the\s+)?first\s+(\d+)?\s*(?:person|people|users?|tags?|monitags?)?(?:\s+(?:who|to)\s+)?/i;

// Balance check
const BALANCE = /balance/i;

// Help
const HELP = /help/i;

// Setup
const SETUP = /setup/i;

// Link
const LINK = /link/i;

// FAQ/Info
const INFO = /^(?:faq|what is|how does|who are|info|about|how to|help)/i;

// Leaderboard
const LEADERBOARD = /^(?:leaderboard|top sigmas|aura leaderboard|top g)/i;

// Cancel Scheduled Jobs
const CANCEL = /^(?:cancel|stop|delete|remove)\s+(?:scheduled|recurring|payment|job)/i;

// Recurring Payment Detection
const RECURRING_PATTERN = /\bevery\s+(?:(\d+(?:\.\d+)?)\s*)?(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?\s*,?\s*(?:(?:for\s+)?(\d+)\s*times?|for\s+(\d+|(?:an|a)(?=\s))\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?)\b/i;
const RECURRING_ALIAS = /\b(daily|hourly|weekly|monthly)\s*,?\s*(?:(?:for\s+)?(\d+)\s*times?|for\s+(\d+|(?:an|a)(?=\s))\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?)\b/i;

// Set Default Chain
const SET_CHAIN = /(?:set-chain|change network to|change preferred network to|change chain to|change preferred chain to|switch to|use network|set network to|on)\s+(\w+)/i;

// Network detection
const BSC_KEYWORDS = ['usdt', 'bnb', 'bsc'];
const TEMPO_KEYWORDS = ['on tempo', 'tempo', 'alphausd', 'αusd'];
const SOLANA_KEYWORDS = ['on solana', 'solana', 'sol', 'spl'];
const CELO_KEYWORDS = ['on celo', 'celo', 'minipay'];
const INK_KEYWORDS = ['on ink', 'ink chain', 'ink network', 'inkonchain'];
const BASE_KEYWORDS = ['on base', 'base chain', 'base network'];

// Token symbols that unambiguously map to a single chain
const TOKEN_CHAIN_MAP = {
  'g$': 'celo',
  'gooddollar': 'celo',
  'usdm': 'celo',
  'αusd': 'tempo',
  'alphausd': 'tempo',
  'usdt0': 'ink',
  'spl': 'solana',
};

// Detect explicit token symbol from raw message text
export function detectToken(text) {
  const l = (text || '').toLowerCase();
  if (l.includes('g$') || l.includes('gooddollar')) return 'G$';
  if (l.includes('usdm')) return 'USDm';
  if (l.includes('usdc')) return 'USDC';
  if (l.includes('usdt0')) return 'USDT0';
  if (l.includes('usdt')) return 'USDT';
  if (l.includes('αusd') || l.includes('alphausd')) return 'αUSD';
  return null;
}

/**
 * Detect which chain the command targets.
 * Returns null if no network keyword is found to allow hierarchy fallbacks.
 */
export function detectChain(text) {
  const lower = text.toLowerCase();
  // Token-first detection (e.g. "send 5 G$ to @alice")
  for (const [token, chain] of Object.entries(TOKEN_CHAIN_MAP)) {
    if (lower.includes(token)) return chain;
  }
  if (CELO_KEYWORDS.some(kw => lower.includes(kw))) return 'celo';
  if (INK_KEYWORDS.some(kw => lower.includes(kw))) return 'ink';
  if (SOLANA_KEYWORDS.some(kw => lower.includes(kw))) return 'solana';
  if (TEMPO_KEYWORDS.some(kw => lower.includes(kw))) return 'tempo';
  if (BSC_KEYWORDS.some(kw => lower.includes(kw))) return 'bsc';
  if (BASE_KEYWORDS.some(kw => lower.includes(kw))) return 'base';
  return null;
}

/**
 * Extract @mentions from text
 */
function extractMoniTags(text) {
  const matches = text.match(/@(\w[\w-]*)|<@!?(\d+)>/g) || [];
  return matches
    .map(m => {
      if (m.startsWith('<')) return m.replace(/[<@!>]/g, '');
      return m.slice(1).toLowerCase();
    })
    .filter(m => m !== 'monibot' && m !== 'monipay' && m !== 'everyone' && m !== 'here');
}

// ============ Schedule Detection via Edge Function ============

/**
 * Parse time expressions via the parse-schedule edge function.
 * Falls back to simple regex if edge function is unavailable.
 * Returns { hasSchedule, scheduledAt, command, timeDescription } or null
 */
export async function parseScheduleViaEdge(text, supabase) {
  const sanitized = sanitizeUserInput(text);
  if (!sanitized.safe) {
    console.warn(`[Security] Injection blocked: ${sanitized.threatCategory}`);
    throw new Error("⚠️ That message can't be processed, fam.");
  }
  const cleanText = sanitized.cleaned;

  // Try local fallback parsing first (Regex-First approach)
  try {
    const localMatch = parseSimpleScheduleFallback(cleanText);
    if (localMatch) {
      return localMatch;
    }
  } catch (e) {
    // Bubbled errors (like DOW scheduling not supported) should throw immediately
    throw e;
  }

  try {
    const { data, error } = await supabase.functions.invoke('parse-schedule', {
      body: { text: cleanText, platform: 'discord' },
      headers: getAgentHeaders(),
    });

    if (error) {
      console.error('[Schedule] Edge function error:', error.message);
      return parseSimpleScheduleFallback(cleanText);
    }

    if (data?.hasSchedule && data.scheduledAt) {
      return {
        hasSchedule: true,
        scheduledAt: data.scheduledAt,
        command: data.command,
        timeDescription: data.timeDescription,
        parsed: data.parsed,
        isRecurring: data.recurring?.isRecurring || false,
        recurrenceRule: data.recurring?.recurrenceRule || null,
        recurrenceInterval: data.recurring?.recurrenceInterval || 1,
        recurringCount: data.recurring?.recurringCount || null,
        recurringDuration: data.recurring?.recurringDuration || null,
      };
    }

    return null;
  } catch (e) {
    console.error('[Schedule] Edge function exception:', e.message);
    try {
      return parseSimpleScheduleFallback(cleanText);
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  }
}

// Inline regex fallback for when edge function is unavailable
const NUM_WORD_MAP = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

const NUM_OR_WORD = `(\\d+|${Object.keys(NUM_WORD_MAP).join('|')})`;

function textToNumber(text) {
  if (!text) return 1;
  const lower = text.toLowerCase();
  if (NUM_WORD_MAP[lower]) return NUM_WORD_MAP[lower];
  const num = parseInt(text);
  return isNaN(num) ? 1 : num;
}

const SIMPLE_SCHEDULE = new RegExp(`\\b(?:in\\s+${NUM_OR_WORD}\\s*(s(?:ec(?:ond)?s?)?|m(?:in(?:ute)?s?)?|h(?:(?:ou)?rs?)?|d(?:ays?)?))`, 'i');

function parseSimpleScheduleFallback(text) {
  // Try parsing recurring payments first using the robust parser
  try {
    const recurringParsed = parseRecurringCommand(text);
    if (recurringParsed && !recurringParsed.error) {
      const intervalMs = recurringParsed.intervalMs;
      const scheduledAt = new Date(Date.now() + intervalMs);
      
      return {
        hasSchedule: true,
        scheduledAt: scheduledAt.toISOString(),
        command: recurringParsed.baseCommand.replace(/^!monibot\s*/i, '').trim(),
        timeDescription: `every ${recurringParsed.intervalValue > 1 ? recurringParsed.intervalValue + ' ' : ''}${recurringParsed.intervalUnit}${recurringParsed.intervalValue > 1 ? 's' : ''}`,
        isRecurring: true,
        recurrenceRule: recurringParsed.intervalUnit,
        recurrenceInterval: recurringParsed.intervalValue,
        recurringCount: recurringParsed.count || null,
        recurringDuration: null,
      };
    }
  } catch (err) {
    // If DOW check threw "DOW scheduling not supported in v1", let it bubble up
    // so the command is rejected correctly instead of going to AI and failing silently.
    if (err.message.includes('DOW')) {
      throw err;
    }
  }

  // Fallback to simple one-time schedule regex
  const match = text.match(SIMPLE_SCHEDULE);
  if (match) {
    const value = textToNumber(match[1]);
    const unit = match[2].toLowerCase();
    let ms = 0, unitLabel = '';
    if (unit.startsWith('s')) { ms = value * 1000; unitLabel = 'second'; }
    else if (unit.startsWith('m')) { ms = value * 60000; unitLabel = 'minute'; }
    else if (unit.startsWith('h')) { ms = value * 3600000; unitLabel = 'hour'; }
    else if (unit.startsWith('d')) { ms = value * 86400000; unitLabel = 'day'; }

    if (ms > 0) {
      const scheduledAt = new Date(Date.now() + ms);
      const commandText = text.replace(match[0], '').trim();
      const plural = value !== 1 ? 's' : '';
      return {
        hasSchedule: true,
        scheduledAt: scheduledAt.toISOString(),
        command: commandText.replace(/^!monibot\s*/i, '').trim(),
        timeDescription: `in ${value} ${unitLabel}${plural}`,
        isRecurring: false,
        recurrenceRule: null,
        recurrenceInterval: 1,
        recurringCount: null,
        recurringDuration: null,
      };
    }
  }

  return null;
}

import { getAgentHeaders } from './src/middleware/agentFeedback.js';
import { parseRecurringCommand } from './src/parsers/recurringParser.js';
import { sanitizeUserInput } from './src/security/inputSanitizer.js';

// Keep legacy export for backward compat
export function parseSimpleSchedule(text) {
  return parseSimpleScheduleFallback(text);
}

/**
 * Parse a Discord message into a structured command
 * @param {string} text - Message content
 * @returns {object|null} Parsed command or null
 */
export function parseCommand(text) {
  // Remove the !monibot prefix (or @MoniBot mention)
  const cleaned = text.replace(/^!monibot\s*/i, '').replace(/<@!\d+>\s*/g, '').trim();

  if (!cleaned) return null;

  // Check for recurring payment patterns FIRST (before other parsing)
  const recurringMatch = cleaned.match(RECURRING_PATTERN);
  const recurringAliasMatch = cleaned.match(RECURRING_ALIAS);
  
  if (recurringMatch || recurringAliasMatch) {
    return {
      type: 'recurring',
      raw: cleaned,
      fullText: text,
    };
  }

  // Check giveaway first (most specific)
  const giveawayMatch = cleaned.match(GIVEAWAY);
  if (giveawayMatch) {
    return {
      type: 'giveaway',
      amount: parseFloat(giveawayMatch[1]),
      maxParticipants: parseInt(giveawayMatch[2]),
      chain: detectChain(cleaned),
      raw: cleaned,
    };
  }

  // Drop: "send $1 to the first 5 people who drop their monitag"
  const dropMatch = cleaned.match(DROP);
  if (dropMatch) {
    return {
      type: 'giveaway',
      amount: parseFloat(dropMatch[1]),
      maxParticipants: dropMatch[2] ? parseInt(dropMatch[2]) : 1, // default to 1 if "first person" (no number)
      chain: detectChain(cleaned),
      raw: cleaned,
    };
  }

  // Multi-send
  const multiMatch = cleaned.match(P2P_MULTI);
  if (multiMatch) {
    const recipients = extractMoniTags(multiMatch[2]);
    if (recipients.length > 0) {
      return {
        type: 'p2p_multi',
        amount: parseFloat(multiMatch[1]),
        recipients,
        chain: detectChain(cleaned),
        raw: cleaned,
      };
    }
  }

  // Single P2P
  const singleMatch = cleaned.match(P2P_SINGLE);
  if (singleMatch) {
    // Group logic based on regex branching
    let amount, recipient;
    if (singleMatch[3] !== undefined) {
      // First branch: verb [to] recipient [with] amount
      amount = parseFloat(singleMatch[3]);
      recipient = singleMatch[1] ? singleMatch[1].toLowerCase() : singleMatch[2];
    } else {
      // Second branch: verb amount [to] recipient
      amount = parseFloat(singleMatch[4]);
      recipient = singleMatch[5] ? singleMatch[5].toLowerCase() : singleMatch[6];
    }

    // Check third branch: recipient amount
    if (amount === undefined || isNaN(amount)) {
      recipient = singleMatch[7] ? singleMatch[7].toLowerCase() : singleMatch[8];
      amount = parseFloat(singleMatch[9]);
    }

    return {
      type: 'p2p',
      amount,
      recipients: [recipient],
      chain: detectChain(cleaned),
      raw: cleaned,
    };
  }

  // Balance
  if (BALANCE.test(cleaned)) {
    return { type: 'balance', chain: detectChain(cleaned), raw: cleaned };
  }

  // Help
  if (HELP.test(cleaned)) {
    return { type: 'help', raw: cleaned };
  }

  // Setup
  if (SETUP.test(cleaned)) {
    return { type: 'setup', raw: cleaned };
  }

  // Link
  if (LINK.test(cleaned)) {
    return { type: 'link', raw: cleaned };
  }

  // Info/FAQ
  if (INFO.test(cleaned)) {
    return { type: 'chat', raw: cleaned }; // We'll route chat type to handleInfo if it matches keywords
  }

  // Leaderboard
  if (LEADERBOARD.test(cleaned)) {
    return { type: 'leaderboard', raw: cleaned };
  }

  // Cancel
  if (CANCEL.test(cleaned)) {
    return { type: 'cancel', raw: cleaned };
  }

  // Set Chain
  const setChainMatch = cleaned.match(SET_CHAIN);
  if (setChainMatch) {
    return { type: 'set_chain', chain: setChainMatch[1].toLowerCase(), raw: cleaned };
  }

  return null;
}

/**
 * Generate time-aware greeting based on UTC
 */
export function getTimeGreeting() {
  const hour = new Date().getUTCHours();
  if (hour < 12) return '🌅 GM';
  if (hour < 17) return '☀️ Good afternoon';
  if (hour < 21) return '🌆 Good evening';
  return '🌙 Late night';
}

/**
 * Build help embed content
 */
export function getHelpContent() {
  return {
    title: '🤖 MoniBot: The Most Sigma Payment AI 🗿',
    description: [
      'Instant crypto payments to increase your W Aura. Use `!monibot setup` to stop being an NPC. 📈',
      '',
      '🤫 **Pro Tip:** In our **Direct Message (DM)** chat, you can just talk to me! No prefix or mentions needed. Just text me like a homie. 🤜🤛'
    ].join('\n'),
    fields: [
      {
        name: '💸 Slide some Cash',
        value: '`!monibot slide $5 to @alice`\n`!monibot bless @bob with $10`\n`!monibot tip $2 to @charlie` 🤫🧏‍♂️',
      },
      {
        name: '🔄 Recurring Payments (Sigma AutoPay)',
        value: [
          '`!monibot send $1 to @alice every minute 5 times` — Rapid fire rizz ⚡',
          '`!monibot send $5 to @bob every day for 1 week` — Weekly W distribution 📈',
          '`!monibot send $2 each to @a, @b every hour 10 times` — Group automation 🤫',
          '**Min interval**: 60 seconds | **Max series**: 100 payments | **Max duration**: 30 days',
          '`!monibot cancel series <ID>` — Stop a series (Stay in control 🗿)',
          '`!monibot series status <ID>` — Check progress',
          '`!monibot my series` — List all your series',
        ].join('\n'),
      },
      {
        name: '📤 Multi-Send (Big Rizz)',
        value: '`!monibot slide $1 each to @alice, @bob, @charlie` ⚡',
      },
      {
        name: '🎁 Skibidi Giveaway',
        value: '`!monibot giveaway $5 to the first 10 Sigmas who drop their monitag` 🚽',
      },
      {
        name: '🪄 MagicPay (Social Escrow)',
        value: 'Send funds to anyone, even if they aren\'t on MoniPay yet! Just @mention them and MagicPay parks the cash in the Shadow Realm until they claim it. 🪄',
      },
      {
        name: '💰 Aura Check (Balance)',
        value: '`!monibot balance` — No cap, check your funds. 🧢',
      },
      {
        name: '🔗 Link Account',
        value: '`!monibot link` — Don\'t be delulu, link your Discord. 🤡',
      },
      {
        name: '⚙️ Server Settings (Owners Only)',
        value: '`!monibot set-chain <network>` — Change the default chain for this server. 🗿',
      },
      {
        name: '🌐 Certified Goated Networks',
        value: 'Base (USDC) · BSC (USDT) · Ink (USDT0) · Celo (USDT) · Solana (USDC) · Tempo (αUSD)\nAdd `usdt` for BSC/Celo, `on ink`, `on solana` for maximum rizz. 📈',
      },
      {
        name: '🤫 DM-Only Rizz (No Prefix)',
        value: [
          'In our private DMs, just talk to me! No `!monibot` prefix needed.',
          '• `Balance` — Check your Aura',
          '• `@alice $5` — Quick slide',
          '• `Send $10 each to @a, @b` — Multi-send',
          '• `Switch chain to base` — Change preference',
        ].join('\n'),
      },
      {
        name: '⏳ Other Goated Features',
        value: [
          '• **Scheduling**: Add `in 5 mins` or `at 3pm` to any send command.',
          '• **Natural Language**: I understand "slide", "bless", "tip", and more.',
          '• **Social Escrow**: Mention unlinked users to use MagicPay. 🪄',
        ].join('\n'),
      },
      {
        name: '🏆 Conditional Sports P2P (on X)',
        value: 'Set automatic stablecoin rewards based on real-time World Cup match outcomes! Just tweet/reply on X: `Hey @monibot send $10 to @user if Germany wins England`. Settled by a 3-Source Consensus Sports Oracle. ⚽',
      },
    ],
    footer: 'MoniBot: Certified Sigma Energy • monipay.xyz',
  };
}

/**
 * Build setup/onboarding embed content
 */
export function getSetupContent() {
  return {
    title: '📖 How to get W Aura (Setup Guide)',
    description: 'Get started with MoniBot in 4 steps. Once set up, you can rizz up anyone with instant payments. ⚡',
    fields: [
      {
        name: '━━━━ Step 1: Create Your Sigma Account ━━━━',
        value: [
          '1. Visit **[monipay.xyz](https://monipay.xyz)**',
          '2. Claim your unique **MoniTag** (your payment identity)',
          '3. Set a **PIN** to keep your funds safe from NPCs 🤖',
          '4. Your wallet is generated instantly, no cap.',
        ].join('\n'),
      },
      {
        name: '━━━━ Step 2: Rizz your Discord (Linking) ━━━━',
        value: [
          '1. Log in at monipay.xyz and open **Settings**',
          '2. Find the **MoniBot AI** section',
          '3. Click **Link Discord** to sync your Aura. 📈',
          '4. **Required** to send funds and for unlinked friends to claim MagicPay! 🪄',
        ].join('\n'),
      },
      {
        name: '━━━━ Step 3: Fill the Vault ━━━━',
        value: [
          '1. Tap **Fund Wallet** in the app',
          '2. Copy your address (Base/BSC/Solana/Ink/Celo)',
          '3. Send **USDC** or **USDT** from any exchange. Bussin! ⚡',
          '4. Use the **Cross-Chain Bridge** if you\'re from Ohio. 🌽',
        ].join('\n'),
      },
      {
        name: '━━━━ Step 4: Authorize the Bot ━━━━',
        value: [
          '1. Go to **Settings → MoniBot AI**',
          '2. Click **Set Allowance** for the goated networks',
          '3. Approve the spending limit so the bot can slide funds for you.',
          '4. You\'re now a Certified Sigma. 🤫🧏‍♂️',
        ].join('\n'),
      },
      {
        name: '━━━━ Stop Being Cooked! Try These ━━━━',
        value: [
          '`!monibot slide $5 to @alice` — Direct payment',
          '`!monibot bless $1 each to @a, @b` — Multi-send',
          '`!monibot giveaway $5 to the first 10` — Start giveaway',
          '`!monibot balance` — Aura check',
        ].join('\n'),
      },
    ],
    footer: 'Need help? Don\'t be delulu, visit monipay.xyz/support',
  };
}

/**
 * Build welcome embed for when bot joins a new server
 */
export function getWelcomeContent() {
  return {
    title: '👋 MoniBot is here to Rizz your server! ⚡',
    description: 'I\'m MoniBot, the most Sigma payment agent on Discord. Slide stablecoins to anyone with a MoniTag or just @mention them! 🗿',
    fields: [
      {
        name: '⚡ Why I\'m Goated:',
        value: [
          '• **Slide payments** to any MoniPay user instantly',
          '• **Recurring payments** — Set it and forget it autopay 🔄',
          '• **MagicPay** unlinked users and @mentions 🪄',
          '• **Multi-send** to the whole squad at once',
          '• **Run giveaways** to boost your server\'s Aura',
          '• **Certified Networks**: Base · Solana · Ink · Celo · BSC · Tempo',
        ].join('\n'),
      },
      {
        name: '🚀 Start Your Journey',
        value: 'Type `!monibot setup` for the guide to get W Aura, or `!monibot help` to see all Sigma commands. 📈',
      },
    ],
    footer: 'Powered by MoniPay — monipay.xyz • No Cap 🧢',
  };
}
