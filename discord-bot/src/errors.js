/**
 * MoniBot Discord - Error Messages & Formatting
 * Explicit, sigma-vocab error messages with randomised alternatives
 * so no two failures feel the same.
 */

import { TX_TYPES } from './constants.js';

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns an explicit, sigma-themed error message explaining WHY the
 * transaction failed and exactly how to fix it.
 * Randomises between variants so replies don't sound repeated.
 */
export function getSigmaError(error, context = 'p2p') {
  const message = typeof error === 'string' ? error : error?.message || '';

  // ── Insufficient balance ──────────────────────────────────────────────────
  if (message.includes('ERROR_BALANCE')) {
    return pick([
      '❌ **Transaction failed — insufficient balance.**\nYour wallet doesn\'t have enough funds for this amount. Top up at monipay.xyz and retry.',
      '💀 **Bag is cooked. Not enough funds.**\nBalance too low for this transfer. Add funds at monipay.xyz.',
      '📉 **Insufficient balance — transfer blocked.**\nYou need more than you currently hold. Top up at monipay.xyz.',
      '🪦 **Wallet is Ohio rn — balance too low.**\nDeposit more funds at monipay.xyz before retrying.',
    ]);
  }

  // ── Spending allowance ────────────────────────────────────────────────────
  if (message.includes('ERROR_ALLOWANCE') || message.includes('ERROR_IOU_ALLOWANCE') || message.includes('MagicPay Allowance')) {
    if (context === 'magicpay' || message.includes('MagicPay') || message.includes('ERROR_IOU_ALLOWANCE')) {
      return pick([
        '❌ **MagicPay spending not approved.**\nYou haven\'t cleared MoniBot to run MagicPay transactions.\nFix: monipay.xyz → Settings → MoniBot AI → Set Allowance → MagicPay.',
        '🔐 **MagicPay blocked — no approval.**\nMoniBot isn\'t authorised for MagicPay on this amount.\nFix: monipay.xyz → Settings → MoniBot AI → Approve MagicPay.',
        '🪄 **MagicPay needs your sign-off first.**\nYou haven\'t approved MagicPay spending yet.\nFix: monipay.xyz → Settings → MoniBot AI → MagicPay Allowance.',
      ]);
    }
    return pick([
      '❌ **CasualPay spending not approved.**\nMoniBot isn\'t cleared to move this amount for CasualPay.\nFix: monipay.xyz → Settings → MoniBot AI → Set Allowance → CasualPay.',
      '🔒 **CasualPay allowance too low.**\nThe bot\'s spending cap is below what you\'re trying to send.\nFix: monipay.xyz → Settings → MoniBot AI → Raise CasualPay Allowance.',
      '📵 **Spending cap hit for CasualPay.**\nMoniBot can\'t process this — allowance is too low.\nFix: monipay.xyz → Settings → MoniBot AI → Set Allowance.',
    ]);
  }

  // ── Transaction reverted ──────────────────────────────────────────────────
  if (message.includes('ERROR_REVERTED') || message.includes('revert')) {
    return pick([
      '❌ **Transaction reverted on-chain.**\nLikely cause: insufficient balance or unapproved allowance.\nCheck monipay.xyz settings and retry.',
      '💥 **Chain clapped back — tx reverted.**\nThis usually means your balance or allowance is too low.\nFix at monipay.xyz → Settings → MoniBot AI.',
      '🚫 **Reverted. The blockchain said no.**\nBalance or spending approval issue detected.\nHead to monipay.xyz → Settings and check your limits.',
      '📉 **Transaction bounced on-chain.**\nLow balance or unapproved allowance — check monipay.xyz settings.',
    ]);
  }

  // ── Invalid wallet address ────────────────────────────────────────────────
  if (message.includes('ERROR_INVALID_ADDRESS')) {
    return pick([
      '❌ **Invalid wallet address detected.**\nThe recipient\'s linked wallet address is malformed. They need to re-link at monipay.xyz.',
      '🤖 **Bad address on file for that recipient.**\nThey need to update their wallet at monipay.xyz.',
      '📭 **Wallet address is invalid.**\nAsk the recipient to re-link their wallet at monipay.xyz.',
    ]);
  }

  // ── Recipient not found ───────────────────────────────────────────────────
  if (message.includes('ERROR_RECIPIENT_NOT_FOUND')) {
    return pick([
      '❌ **Recipient not found.**\nDouble-check the username or mention. They may not be linked to MoniPay yet.',
      '🔍 **Can\'t find that user.**\nThe handle might be wrong or they haven\'t signed up. Verify and retry.',
      '👻 **Unknown recipient.**\nThey\'re either not on MoniPay or the username is off. Check and try again.',
      '📭 **Zero results for that handle.**\nWrong tag or unregistered user. Fix the username and retry.',
    ]);
  }

  // ── Self-send ─────────────────────────────────────────────────────────────
  if (message.includes('ERROR_SELF_SEND')) {
    return pick([
      '❌ **Can\'t send to yourself.**\nPick someone else to bless fam.',
      '🤡 Bro tried to pay himself 💀 Not how money works.',
      '🪞 That\'s literally you. Self-send is not the move.',
      '😭 Circular funds detected. You can\'t tip yourself into wealth.',
    ]);
  }

  // ── Solana RPC errors ─────────────────────────────────────────────────────
  if (message.includes('ERROR_SOLANA')) {
    return pick([
      '❌ **Solana RPC error.**\nThe Solana network is being difficult rn. Try again in a moment or switch to another chain.',
      '🌽 **Solana is being Ohio.** RPC issue detected.\nRetry shortly or use a different chain.',
      '📡 **Solana node not responding.**\nWait a bit and retry, or try a different chain.',
    ]);
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (message.includes('rate limit') || message.includes('429')) {
    return pick([
      '❌ **Network rate-limited — too many requests.**\nSlow down and retry in a moment.',
      '⏳ **Hit the rate limit.**\nWait a few seconds and try again.',
      '🚦 **Too many transactions too fast.**\nChill for a sec and retry.',
    ]);
  }

  // ── Sync failure ──────────────────────────────────────────────────────────
  if (message.includes('ERROR_SYNC')) {
    return pick([
      '⚠️ **Payment went through on-chain but failed to sync with MoniPay\'s database.**\nDo NOT retry. Contact [support](https://monipay.xyz/support) with your tx hash.',
      '🚨 **On-chain confirmed, database sync failed.**\nYour funds are safe — reach out to [support](https://monipay.xyz/support) with the tx hash.',
    ]);
  }

  // ── Default — surface the actual reason ──────────────────────────────────
  return pick([
    `❌ **Payment failed — reason: ${message || 'unknown error'}.**\nRetry or visit [support](https://monipay.xyz/support) if this keeps happening.`,
    `💀 **Something went wrong: ${message || 'unknown error'}.**\nTry again or hit up [support](https://monipay.xyz/support).`,
    `🤖 **Unexpected error: ${message || 'unknown'}.**\nNot your fault — retry or check [support](https://monipay.xyz/support).`,
  ]);
}

/**
 * Called when the bot understands the intent is a payment but couldn't
 * fully parse the command. Tells the user exactly what's missing.
 */
export function buildParseError(text) {
  const lower = (text || '').toLowerCase();
  const hasAmount = /\$?[\d]+(?:\.[\d]{1,2})?/.test(lower);
  const hasRecipient = /@[\w-]+/.test(lower) || /(?:to|for)\s+[\w-]+/.test(lower);

  if (!hasAmount && !hasRecipient) {
    return pick([
      '❌ Missing amount and recipient.\nUsage: `!monibot send $5 to @alice`',
      '🤦 I need both an amount AND a recipient fam.\nUsage: `!monibot send $5 to @alice`',
      '💀 Can\'t send vibes — give me the amount and who to pay.\nUsage: `!monibot send $5 to @alice`',
    ]);
  }
  if (!hasAmount) {
    return pick([
      '❌ Missing amount — how much do you want to send?\nUsage: `!monibot send $5 to @alice`',
      '🤔 How much fam? I see a recipient but no amount.\nUsage: `!monibot send $5 to @alice`',
      '💸 Drop the amount blud. Try: `!monibot send $5 to @alice`',
    ]);
  }
  if (!hasRecipient) {
    return pick([
      '❌ Missing recipient — who are you sending to?\nUsage: `!monibot send $5 to @alice`',
      '🤔 Who\'s getting the bag? I see an amount but no recipient.\nUsage: `!monibot send $5 to @alice`',
      '👤 Name your recipient fam. Try: `!monibot send $5 to @alice`',
    ]);
  }
  return pick([
    '❌ Couldn\'t process that payment.\nUsage: `!monibot send $5 to @alice`',
    '🤖 Payment command didn\'t parse right. Try: `!monibot send $5 to @alice`',
    '💀 That command is cooked. Standard format: `!monibot send $5 to @alice`',
  ]);
}

/**
 * Validation error message for invalid amounts.
 */
export function getAmountError(reason) {
  return pick([
    `❌ **Invalid amount.** ${reason}`,
    `📉 **Amount rejected.** ${reason}`,
  ]);
}
