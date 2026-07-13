/**
 * MoniBot Discord - AI Module
 * 
 * Uses the monibot-ai edge function for:
 * - Natural language command parsing (NLP)
 * - Conversational chat responses
 * - Temporal expression parsing (scheduling)
 * 
 * Falls back to regex parsing if AI is unavailable.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ============ Local Slang Fallbacks ============

const SLANG_FALLBACKS = {
  success: [
    "W Aura +1000! 🗿 Money teleported.",
    "Bussin transaction, no cap! ⚡",
    "Certified Sigma move. 🤫"
  ],
  error: [
    "Blud is actually cooked (Low balance). 💀",
    "L Aura. Caught in 4K with no funds. 📸",
    "Stop being delulu, you're broke. 🤡"
  ],
  magicpay: [
    "MagicPay activated! 🪄 Parking those funds in the Shadow Realm.",
    "Social Escrow is goated fr fr. 🦁"
  ],
  chat: [
    "Skibidi prompt blud. 🚽",
    "What in the Ohio is this message? 🌽",
    "Rizz levels insufficient to process that. 📉"
  ]
};

function getSlangFallback(type) {
  const list = SLANG_FALLBACKS[type] || SLANG_FALLBACKS.chat;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Parse a natural language message into a structured command using AI.
 * Returns null if AI fails (caller should fall back to regex).
 */
export async function aiParseCommand(text, platform = 'discord') {
  try {
    const { data, error } = await supabase.functions.invoke('monibot-ai', {
      body: {
        action: 'parse-command',
        context: { text, platform, persona: 'gen_alpha_slang' }
      },
    });

    if (error) {
      console.error('[AI] Parse error:', error.message);
      return null;
    }

    if (data?.parsed) {
      console.log(`[AI] Parsed: ${JSON.stringify(data.parsed)}`);
      return data.parsed;
    }

    return null;
  } catch (e) {
    console.error('[AI] Parse exception:', e.message);
    return null;
  }
}

/**
 * Generate a conversational AI response for general questions.
 */
export async function aiChat(text, username, platform = 'discord') {
  const cleaned = text.toLowerCase().trim();
  if (
    /\b(sports?|world\s*cup|football|soccer|bets?|match|prediction)\b/i.test(cleaned) ||
    (/\bif\b/i.test(cleaned) && /\b(wins|draws|ties)\b/i.test(cleaned))
  ) {
    return `Yo @${username}! Conditional Sports P2P is absolute fire but it lives on X (Twitter)! 🗿 You can set automatic payouts based on World Cup matches by tweeting/replying: "Hey @monibot send $10 to @user if Germany wins England ⚽". MoniBot monitors the match using a custom 3-Source Consensus Sports Oracle to settle it. Zero escrow friction, pure W Aura fr! 🧢`;
  }

  try {
    const { data, error } = await supabase.functions.invoke('monibot-ai', {
      body: {
        action: 'chat',
        context: { text, platform, username, persona: 'gen_alpha_slang' }
      },
    });

    if (error) {
      console.error('[AI] Chat error:', error.message);
      return getSlangFallback('chat');
    }

    let reply = data?.text || getSlangFallback('chat');
    
    // Intercept outdated recurring payment response
    if (reply.toLowerCase().includes("recurring payments aren't in the toolkit") || 
        reply.toLowerCase().includes("instant gratification") ||
        (text.toLowerCase().includes("recurring") && reply.includes("/pay"))) {
      reply = `Yo @${username}! Recurring payments are actually goated and fully in the toolkit now! 🗿 You can schedule them using \`!monibot send $1 to @user every 1 minute 5 times\` or daily/weekly. Check \`!monibot help\` for the full Sigma autopay commands. No cap! 🧢`;
    }

    // Rizz up generic replies and replace slash commands
    if (reply.toLowerCase().includes('/settings')) {
      reply = reply.replace(/\/settings\s+command/gi, '`!monibot set-chain` command')
                   .replace(/\/settings/gi, '`!monibot set-chain` settings');
    }
    if (reply.toLowerCase().includes('/pay')) {
      reply = reply.replace(/\/pay/gi, '`!monibot send`');
    }
    if (reply.toLowerCase().includes('/help')) {
      reply = reply.replace(/\/help/gi, '`!monibot help`');
    }

    // Rewrite settings/gas prompt in rich brainrot style
    if (reply.toLowerCase().includes('settings on monipay.xyz') && reply.toLowerCase().includes('handle the gas')) {
      reply = `Solid choice! Celo is lightning fast for those USDT payments. ⚡️ To lock that in, just head over to your settings on monipay.xyz or use the \`!monibot set-chain celo\` command. I'll handle the gas from there, no cap! 🤙`;
    }

    return reply;

  } catch (e) {
    console.error('[AI] Chat exception:', e.message);
    return getSlangFallback('chat');
  }
}

/**
 * Generate an AI-powered reply for a transaction result.
 */
export async function aiTransactionReply(txContext) {
  // Ensure persona hint is passed
  const context = { ...txContext, persona: 'gen_alpha_slang' };

  try {
    const { data, error } = await supabase.functions.invoke('monibot-ai', {
      body: { action: 'generate-reply', context },
    });

    if (error) {
      return getTxFallback(txContext.type);
    }
    return data?.text || getTxFallback(txContext.type);
  } catch {
    return getTxFallback(txContext.type);
  }
}

/**
 * Internal helper to map transaction type to slang category
 */
function getTxFallback(type) {
  if (type?.includes('magicpay')) return getSlangFallback('magicpay');
  if (type?.includes('success')) return getSlangFallback('success');
  if (type?.includes('error')) return getSlangFallback('error');
  return getSlangFallback('success');
}

/**
 * Parse temporal expressions from a message using AI.
 * Returns { hasSchedule, scheduledAt, command, timeDescription } or null on failure.
 */
export async function aiParseSchedule(text, platform = 'discord') {
  try {
    const { data, error } = await supabase.functions.invoke('monibot-ai', {
      body: {
        action: 'parse-schedule',
        context: { text, platform, persona: 'gen_alpha_slang' }
      },
    });

    if (error) {
      console.error('[AI] Schedule parse error:', error.message);
      return null;
    }

    return data?.parsed || null;
  } catch (e) {
    console.error('[AI] Schedule parse exception:', e.message);
    return null;
  }
}
