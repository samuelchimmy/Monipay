import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  realtime: { enabled: false },
});

const SLANG_FALLBACKS = {
  success: [
    'W Aura +1000! 🗿 Money teleported.',
    'Bussin transaction, no cap! ⚡',
    'Certified Sigma move. 🤫'
  ],
  error: [
    'Blud is actually cooked (Low balance). 💀',
    'L Aura. Caught in 4K with no funds. 📸',
    "Stop being delulu, you're broke. 🤡"
  ],
  magicpay: [
    'MagicPay activated! 🪄 Parking those funds in the Shadow Realm.',
    'Social Escrow is goated fr fr. 🦁'
  ],
  chat: [
    'Skibidi prompt blud. 🚽',
    'What in the Ohio is this message? 🌽',
    'Rizz levels insufficient to process that. 📉'
  ]
};

function getSlangFallback(type) {
  const list = SLANG_FALLBACKS[type] || SLANG_FALLBACKS.chat;
  return list[Math.floor(Math.random() * list.length)];
}

export async function aiParseCommand(text, platform = 'telegram') {
  try {
    const { data, error } = await supabase.functions.invoke('monibot-ai', {
      body: {
        action: 'parse-command',
        context: { text, platform, persona: 'gen_alpha_slang' }
      },
    });
    if (error) return null;
    return data?.parsed || null;
  } catch {
    return null;
  }
}

export async function aiChat(text, username, platform = 'telegram') {
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
    if (error) return getSlangFallback('chat');
    return data?.text || getSlangFallback('chat');
  } catch {
    return getSlangFallback('chat');
  }
}

function getTxFallback(type) {
  if (type?.includes('magicpay')) return getSlangFallback('magicpay');
  if (type?.includes('success')) return getSlangFallback('success');
  if (type?.includes('error')) return getSlangFallback('error');
  return getSlangFallback('success');
}

export async function aiTransactionReply(txContext) {
  const context = { ...txContext, persona: 'gen_alpha_slang' };
  try {
    const { data, error } = await supabase.functions.invoke('monibot-ai', {
      body: { action: 'generate-reply', context },
    });
    if (error) return getTxFallback(txContext.type);
    return data?.text || getTxFallback(txContext.type);
  } catch {
    return getTxFallback(txContext.type);
  }
}

export async function aiParseSchedule(text, platform = 'telegram') {
  try {
    const { data, error } = await supabase.functions.invoke('monibot-ai', {
      body: {
        action: 'parse-schedule',
        context: { text, platform, persona: 'gen_alpha_slang' }
      },
    });
    if (error) return null;
    return data?.parsed || null;
  } catch {
    return null;
  }
}
