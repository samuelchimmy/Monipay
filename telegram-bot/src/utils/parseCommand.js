// Command verbs
const SEND_VERBS = /\b(send|pay|slide|tip|bless|give|transfer|shoot|drop|wire|zap|forward)\b/i;

// Amount patterns: $5, 5 USDC, 5 dollars, 5 bucks, five dollars
const AMOUNT_PATTERN = /\$?([\d]+(?:\.[\d]{1,2})?)\s*(?:usdc|usdt|usdt0|alphausd|αusd|dollars?|bucks?|usd)?/i;

// Multi-recipient: "each to @alice, @bob" or "to @alice and @bob"
const MULTI_PATTERN = /\beach\b/i;

// Chain keywords mapping
const CHAIN_KEYWORDS = {
  celo:   ['on celo', 'celo', 'minipay', 'celo network'],
  ink:    ['on ink', 'ink chain', 'ink network', 'inkonchain'],
  solana: ['on solana', 'solana', 'sol ', 'on sol'],
  tempo:  ['on tempo', 'tempo', 'alphausd', 'αusd', 'ausd'],
  bsc:    ['usdt', 'bnb', 'bsc', 'binance', 'on bsc', 'on bnb'],
  base:   ['on base', 'base chain', 'base network', 'usdc'],
};

export function detectChain(text) {
  const lower = text.toLowerCase();
  // Strict order: specific chains before generic token matches
  if (CHAIN_KEYWORDS.celo.some(k => lower.includes(k))) return 'celo';
  if (CHAIN_KEYWORDS.ink.some(k => lower.includes(k))) return 'ink';
  if (CHAIN_KEYWORDS.solana.some(k => lower.includes(k))) return 'solana';
  if (CHAIN_KEYWORDS.tempo.some(k => lower.includes(k))) return 'tempo';
  if (CHAIN_KEYWORDS.bsc.some(k => lower.includes(k))) return 'bsc';
  if (CHAIN_KEYWORDS.base.some(k => lower.includes(k))) return 'base';
  return null; // null = use fallback hierarchy
}

export function parseCommand(text) {
  const cleaned = text
    .replace(/@monipaybot/gi, '')
    .replace(/@monibot/gi, '')
    .replace(/monibot/gi, '')
    .trim();

  if (!cleaned) return null;

  // Balance check
  if (/\bbalance\b/i.test(cleaned)) {
    return { type: 'balance', chain: detectChain(cleaned), raw: cleaned };
  }

  // Help / link / about
  if (/\b(help|how|setup|start|guide)\b/i.test(cleaned)) return { type: 'help', raw: cleaned };
  if (/\b(link|connect|register|sign.?up)\b/i.test(cleaned)) return { type: 'link', raw: cleaned };
  if (/\b(about|what is)\b/i.test(cleaned)) return { type: 'about', raw: cleaned };

  // Set chain
  const SET_CHAIN_PATTERN = /\bset\s+(?:chain|network|default)\s+(?:to\s+)?(\w+)/i;
  const setChainMatch = cleaned.match(SET_CHAIN_PATTERN);
  if (setChainMatch) {
    return { type: 'set_chain', chain: setChainMatch[1].toLowerCase(), raw: cleaned };
  }

  // Giveaway: "giveaway $2 to the first 5"
  const giveawayMatch = cleaned.match(/(?:giveaway)\s+\$?([\d.]+)\s*(?:\w*\s+)?(?:to\s+)?(?:the\s+)?(?:first\s+)?(\d+)/i);
  if (giveawayMatch) {
    return {
      type: 'giveaway',
      amount: parseFloat(giveawayMatch[1]),
      maxParticipants: parseInt(giveawayMatch[2], 10),
      chain: detectChain(cleaned),
      raw: cleaned
    };
  }

  // Multi-send: "send $1 each to @alice, @bob"
  const BOT_NAMES_MULTI = ['monibot', 'monipaybot'];
  if (SEND_VERBS.test(cleaned) && MULTI_PATTERN.test(cleaned)) {
    const amountMatch = cleaned.match(AMOUNT_PATTERN);
    if (!amountMatch) return null;
    const amount = parseFloat(amountMatch[1]);
    const tags = [...cleaned.matchAll(/@([a-zA-Z0-9_][\w-]*)/g)]
      .map(m => m[1].toLowerCase())
      .filter(t => !BOT_NAMES_MULTI.includes(t));
    if (tags.length < 2 || isNaN(amount) || amount <= 0) return null;
    return { type: 'p2p_multi', amount, recipients: [...new Set(tags)], chain: detectChain(cleaned), raw: cleaned };
  }

  // Single send
  // Pattern A: "send $5 to @alice" / "slide $10 to alice"
  // Pattern B: "bless @alice with $5" / "send @alice $5"
  const verbMatch = cleaned.match(SEND_VERBS);
  if (!verbMatch) return null;

  const amountMatch = cleaned.match(AMOUNT_PATTERN);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1]);
  if (isNaN(amount) || amount <= 0 || amount > 10000) return null;

  // Extract recipient — @mention or bare word after "to"/"for"
  // Only exclude actual bot usernames, not 'monipay' which is a valid user handle
  const BOT_NAMES = ['monibot', 'monipaybot'];

  const allMentions = [...cleaned.matchAll(/@([a-zA-Z0-9_][\w-]*)/g)]
    .map(m => m[1].toLowerCase())
    .filter(t => !BOT_NAMES.includes(t));

  let recipient = allMentions[0] || null;

  if (!recipient) {
    // Try bare word after "to" or "for" — handles both "to alice" and "to @alice"
    const bareMatch = cleaned.match(/(?:to|for)\s+@?([a-zA-Z0-9_][\w-]{1,})/i);
    if (bareMatch) {
      const candidate = bareMatch[1].toLowerCase();
      if (!BOT_NAMES.includes(candidate)) {
        recipient = candidate;
      }
    }
  }

  if (!recipient) return null;

  return {
    type: 'p2p',
    amount,
    recipients: [recipient],
    chain: detectChain(cleaned),
    raw: cleaned,
  };
}
