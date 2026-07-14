/**
 * MoniBot Discord - Constants & Enums
 * Single source of truth for all magic strings, limits, and configuration values.
 */

// ============ Platforms ============
export const PLATFORMS = {
  DISCORD: 'discord',
  TWITTER: 'twitter',
};

// ============ Command Types ============
export const COMMAND_TYPES = {
  HELP: 'help',
  SETUP: 'setup',
  LINK: 'link',
  BALANCE: 'balance',
  P2P: 'p2p',
  P2P_MULTI: 'p2p_multi',
  GIVEAWAY: 'giveaway',
  SET_CHAIN: 'set_chain',
  LEADERBOARD: 'leaderboard',
  CANCEL: 'cancel',
  CHAT: 'chat',
  RECURRING: 'recurring',
};

// ============ Chains (canonical lowercase keys) ============
export const CHAINS = {
  BASE: 'base',
  BSC: 'bsc',
  CELO: 'celo',
  INK: 'ink',
  TEMPO: 'tempo',
  SOLANA: 'solana',
};

export const DEFAULT_CHAIN = CHAINS.BASE;

// ============ Transaction Types ============
export const TX_TYPES = {
  P2P: 'p2p_command',
  MAGICPAY: 'magicpay',
  GRANT: 'grant',
};

// ============ Command Statuses ============
export const COMMAND_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  PARTIALLY_COMPLETED: 'partially_completed',
  FAILED: 'failed',
};

// ============ Amount Validation Limits ============
export const AMOUNT_LIMITS = {
  MIN: 0.01,
  MAX: 10000,
};

// ============ Giveaway Limits ============
export const GIVEAWAY_LIMITS = {
  MIN_PARTICIPANTS: 1,
  MAX_PARTICIPANTS: 100,
  TIMEOUT_MS: 600000, // 10 minutes
};

// ============ Rate Limiting ============
export const RATE_LIMIT = {
  MAX_COMMANDS: 5,
  WINDOW_MS: 60 * 1000, // 1 minute
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
};

// ============ Polling & Intervals ============
export const INTERVALS = {
  JOB_POLL_MS: 30000, // 30 seconds
  NOTIFIED_CLEANUP_MS: 10 * 60 * 1000, // 10 minutes
  WELCOME_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 hours
};

// ============ Supported Chains List (for validation) ============
export const SUPPORTED_CHAINS = Object.values(CHAINS);

// ============ Valid Command Types (for AI validation) ============
export const VALID_AI_COMMAND_TYPES = [
  COMMAND_TYPES.P2P,
  COMMAND_TYPES.P2P_MULTI,
  COMMAND_TYPES.GIVEAWAY,
  COMMAND_TYPES.BALANCE,
  COMMAND_TYPES.HELP,
  COMMAND_TYPES.SETUP,
  COMMAND_TYPES.LINK,
  COMMAND_TYPES.SET_CHAIN,
  COMMAND_TYPES.LEADERBOARD,
  COMMAND_TYPES.CHAT,
];

// ============ Fun Phrases ============
export const SUCCESS_PHRASES = [
  "Boom!", "Bullseye!", "Done deal!", "W!", "Straight Bussin'!",
  "No Cap!", "Sheesh!", "Absolute Cinema!", "Locked In!", "Big Dub!",
  "Payment Secured!", "Sent & Sorted!", "Chef's Kiss!", "Mission Accomplished!",
  "W Aura +1000!", "Bussin transaction!", "Certified Sigma move.",
  "No cap, funds sent.", "Skibidi payments activated."
];

export const MAGIC_PAY_PHRASES = [
  "MagicPay Activated!", "Social Escrow to the Rescue!", "MagicPay Goated!",
  "Aura +1000!", "MagicPay Secured!", "Funds Locked & Loaded!",
  "Social Escrow Mode: ON!", "MagicPay Magic!", "Social Escrow Power!",
  "W Aura +1000!", "Bussin MagicPay!", "Certified Sigma Magic move."
];

export const ERROR_PHRASES = [
  "You're cooked (Low balance)", "Total NPC energy", "L Aura",
  "Your balance is Ohio", "Stop being delulu (No funds)"
];

// ============ Helpers ============
export function getRandomPhrase(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ============ Promo (June 1–30 2026) ============
export const PROMO = {
  START: new Date('2026-06-01T00:00:00Z'),
  END: new Date('2026-06-30T23:59:59Z'),
  DEMO_GIVEAWAY_AMOUNT: 10,
  DEMO_GIVEAWAY_SPOTS: 5,
};

/**
 * Returns true while the June promo is active.
 */
export function isPromoActive() {
  const now = new Date();
  return now >= PROMO.START && now <= PROMO.END;
}

/**
 * Returns a short promo footer line, or empty string outside the promo window.
 */
export function getPromoFooter() {
  if (!isPromoActive()) return '';
  return '🎉 June Promo: Zero fees on Celo · Fee rebates on other chains · monipay.xyz';
}

/**
 * Returns the full promo banner text for embeds.
 */
export function getPromoBanner() {
  if (!isPromoActive()) return null;
  return [
    '## 🎉 June Celo Promo',
    'To celebrate winning the **Celo Proof of Ship AI Track:**',
    '',
    'All fees on Celo are waived through June 30.',
    '_(CasualPay users: request fee refunds via **[monipay.xyz/support](https://monipay.xyz/support)** with your tx hash.)_',
    '',
    'We\'re also running a **$10 demo giveaway** for the first 5 communities that add MoniBot to their server.',
    'Add **@MoniBot** and message us via **[monipay.xyz/support](https://monipay.xyz/support)** to claim.',
    '',
    '_Promo runs June 1–30, 2026._',
  ].join('\n');
}
