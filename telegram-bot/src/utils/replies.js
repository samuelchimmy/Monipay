import { getExplorerUrl } from '../../shared/chains.js';
import { isPromoActive, getCeloPromoNote } from './promo.js';

/**
 * Escapes Telegram Markdown v1 special characters in a string so it can be
 * safely embedded inside a parse_mode:'Markdown' message without breaking
 * entity parsing. Call this on any value that comes from user input, the
 * blockchain, or external services.
 */
export function escapeMd(text) {
  if (text == null) return '';
  return String(text).replace(/[_*`[\]()]/g, '\\$&');
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}


// ─── SUCCESS TEMPLATES ───────────────────────────────────────────────────────

const SUCCESS_P2P = [
  (amount, symbol, recipient, txLine) =>
    `W Aura +1000 🗿 Sent *$${amount} ${symbol}* to *@${escapeMd(recipient)}*. No cap, funds delivered.${txLine}`,
  (amount, symbol, recipient, txLine) =>
    `Certified Sigma move. *$${amount} ${symbol}* teleported to *@${escapeMd(recipient)}*. Bussin fr.${txLine}`,
  (amount, symbol, recipient, txLine) =>
    `Big dub ⚡ *@${escapeMd(recipient)}* just received *$${amount} ${symbol}*. That's how MoniPay moves.${txLine}`,
  (amount, symbol, recipient, txLine) =>
    `Skibidi payment successful 🚽 *$${amount} ${symbol}* sent to *@${escapeMd(recipient)}*. Rizz increased.${txLine}`,
  (amount, symbol, recipient, txLine) =>
    `Ohio state of mind? Nah, MoniPay state of mind. *$${amount} ${symbol}* dropped for *@${escapeMd(recipient)}*.${txLine}`,
];

const SUCCESS_MAGICPAY = [
  (amount, symbol, recipient, txLine) =>
    `🪄 MagicPay activated. *$${amount} ${symbol}* is parked in the Shadow Realm for *@${escapeMd(recipient)}*.\nThey need to link their Telegram at monipay.xyz to claim. 180 days or it bounces back.${txLine}`,
  (amount, symbol, recipient, txLine) =>
    `Social Escrow is GOATED fr 🦁 *$${amount} ${symbol}* locked on-chain for *@${escapeMd(recipient)}*.\nTell them to sign up at monipay.xyz and link Telegram — money waiting.${txLine}`,
  (amount, symbol, recipient, txLine) =>
    `Magic move 🎩 *$${amount} ${symbol}* teleported to the escrow vault for *@${escapeMd(recipient)}*. They claim at monipay.xyz or it's an L after 180 days.${txLine}`,
];

const SUCCESS_MAGICPAY_CELO_MINIPAY = [
  (amount, symbol, recipient, txLine) =>
    `🪄 MiniPay Magic! Sent *$${amount} ${symbol}* to *@${escapeMd(recipient)}* on Celo via MiniPay. 🗿\n\n*How to claim:*\n1. Install MiniPay app\n2. Open Monipay mini-app\n3. Link this Telegram\n4. Claim your bag securely.${txLine}`,
  (amount, symbol, recipient, txLine) =>
    `Certified MiniPay Sigma move. *$${amount} ${symbol}* waiting in the vault for *@${escapeMd(recipient)}*. 🦁\n\n*To claim:*\nOpen Monipay inside MiniPay, link TG, and secure the dub.${txLine}`,
];

const SUCCESS_MAGICPAY_CELO_LEGACY = [
  (amount, symbol, recipient, txLine) =>
    `🪄 MagicPay on Celo! *$${amount} ${symbol}* locked for *@${escapeMd(recipient)}*. 🎩\nThey can claim by linking Telegram on monipay.xyz, or by opening the Monipay mini-app inside MiniPay.${txLine}`,
];


// ─── ERROR TEMPLATES (randomised) ────────────────────────────────────────────

const ERROR_BALANCE = (amount, have, chain) => pick([
  () => `💀 Caught in 4K with an empty bag. You've got *$${have}* but tried to send *$${amount}* on ${chain.toUpperCase()}.\nTop up at monipay.xyz or the bag stays empty.`,
  () => `📉 L Rizz. Insufficient funds — *$${have}* available on ${chain.toUpperCase()}, needed *$${amount}*.\nFund your wallet at monipay.xyz and retry.`,
  () => `🪦 Wallet is literally Ohio rn. *$${have}* balance can't cover *$${amount}* on ${chain.toUpperCase()}.\nAdd funds at monipay.xyz.`,
  () => `🤡 No bag, no pay fam. You need *$${amount}* but only have *$${have}* on ${chain.toUpperCase()}.\nHead to monipay.xyz to top up.`,
  () => `💸 Tried to send *$${amount}* on ${chain.toUpperCase()} but you're sitting on *$${have}*. That's not the W move.\nDeposit more at monipay.xyz.`,
])();

const ERROR_CASUAL_ALLOWANCE = (amount, have, chain) => pick([
  () => `🔒 Transaction blocked — MoniBot is only cleared to move *$${have}* on ${chain.toUpperCase()} but you need *$${amount}*.\nFix: monipay.xyz → Settings → MoniBot AI → CasualPay Allowance.`,
  () => `📉 Spending cap hit. CasualPay allowance is *$${have}* but you're sending *$${amount}* on ${chain.toUpperCase()}.\nRaise it at monipay.xyz → Settings → MoniBot AI.`,
  () => `🔐 L Aura. MoniBot's clearance is *$${have}* on ${chain.toUpperCase()}, needs *$${amount}*.\nUnlock more: monipay.xyz → Settings → MoniBot AI → Set CasualPay Allowance.`,
  () => `🤖 CasualPay allowance is too low for this transaction. Bot cleared for *$${have}*, you're sending *$${amount}* on ${chain.toUpperCase()}.\nUpdate it at monipay.xyz settings.`,
])();

const ERROR_MAGIC_ALLOWANCE = (amount, chain) => pick([
  () => `🪄 MagicPay tried to go off but isn't approved for *$${amount}* on ${chain.toUpperCase()}.\nFix: monipay.xyz → Settings → MoniBot AI → MagicPay Allowance.`,
  () => `🔐 MagicPay blocked. You need to approve it for *$${amount}* on ${chain.toUpperCase()} first.\nFix: monipay.xyz → Settings → MoniBot AI → Set MagicPay Allowance.`,
  () => `🪄 Tried to activate MagicPay for *$${amount}* on ${chain.toUpperCase()} but no clearance.\nHead to monipay.xyz settings and approve MagicPay spending.`,
  () => `📵 MagicPay is locked for *$${amount}* on ${chain.toUpperCase()}. You haven't approved it yet fam.\nmonipay.xyz → Settings → MoniBot AI → Approve MagicPay.`,
])();

const ERROR_REROUTE_ALLOWANCE = (chain, fromChain) => pick([
  () => `🔀 Auto-rerouted from ${fromChain.toUpperCase()} to ${chain.toUpperCase()} but your allowance is too low there too.\nFix both at monipay.xyz → Settings → MoniBot AI → Set Allowance.`,
  () => `📉 Rerouted to ${chain.toUpperCase()} (low balance on ${fromChain.toUpperCase()}) but CasualPay/MagicPay allowance is also too low there.\nIncrease allowance at monipay.xyz settings.`,
  () => `🔐 Chain-switched ${fromChain.toUpperCase()} → ${chain.toUpperCase()} automatically but spending approval on ${chain.toUpperCase()} is too low for this amount.\nRaise it at monipay.xyz → Settings → MoniBot AI.`,
])();

const ERROR_SYNC = () => pick([
  () => `⚠️ Payment went through on-chain but failed to sync with MoniPay's database. Save your tx hash and contact [support](https://monipay.xyz/support).`,
  () => `⚠️ On-chain confirmed, database didn't catch it. Don't retry — contact [support](https://monipay.xyz/support) with your tx hash to reconcile.`,
  () => `🚨 Funds moved on-chain but database sync failed. Your money is safe — reach out to [support](https://monipay.xyz/support) with the tx hash.`,
])();

const ERROR_NOT_LINKED = (tag) => pick([
  () => `🤖 *@${escapeMd(tag)}* isn't on MoniPay yet — sending via *MagicPay* (Social Escrow).\nFunds held on-chain until they claim at monipay.xyz. 180-day window or it bounces back.`,
  () => `🪄 *@${escapeMd(tag)}* hasn't linked yet so this is going via MagicPay escrow.\nTell them to sign up at monipay.xyz to claim their bag. Expires in 180 days.`,
  () => `👻 *@${escapeMd(tag)}* is a ghost on MoniPay — MagicPay activated.\nMoney's parked on-chain. They claim at monipay.xyz or it auto-returns after 180 days.`,
])();

const ERROR_RECIPIENT_NOT_FOUND = (tag) => pick([
  () => `❌ *@${escapeMd(tag)}* not found. Either they're not on MoniPay or the username is wrong.\nCheck the handle and retry.`,
  () => `🔍 Zero results for *@${escapeMd(tag)}* fam. Wrong username or they haven't linked yet. Double-check and retry.`,
  () => `👻 *@${escapeMd(tag)}* doesn't exist in the MoniPay universe. Verify the handle or they need to sign up at monipay.xyz.`,
  () => `📭 Can't find *@${escapeMd(tag)}*. Either the tag is off or they're not registered. Fix the username and try again.`,
])();

const ERROR_SELF_SEND = () => pick([
  () => `🤡 Bro tried to pay himself 💀 Can't send to your own account fam.`,
  () => `🪞 That's literally you. Sending to yourself is not the move, no cap.`,
  () => `😭 Circular funds detected. You can't tip yourself into wealth fam.`,
  () => `🤦 Self-send is an L. Pick someone else's bag to bless.`,
])();

const ERROR_REVERTED = (chain) => pick([
  () => `💥 Transaction hit ${chain?.toUpperCase() || 'the chain'} and reverted. Likely cause: insufficient balance or allowance.\nCheck monipay.xyz settings and retry.`,
  () => `📉 Reverted on ${chain?.toUpperCase() || 'chain'}. The blockchain clapped back — usually means low balance or unapproved allowance.\nFix at monipay.xyz and retry.`,
  () => `🚫 Tx bounced on ${chain?.toUpperCase() || 'chain'}. This is a balance or allowance issue.\nHead to monipay.xyz → Settings → MoniBot AI and check your limits.`,
  () => `💀 Chain said no on ${chain?.toUpperCase() || 'chain'}. Transaction reverted — top up your balance or raise your allowance at monipay.xyz.`,
])();

const ERROR_REROUTED = (from, to, amount, symbol, recipient, txLine) => pick([
  () => `🔀 Auto-rerouted. Not enough on ${from.toUpperCase()} so sent *$${amount} ${symbol}* via ${to.toUpperCase()} to *@${escapeMd(recipient)}*. Sigma intelligence.${txLine}`,
  () => `⚡ Chain-switched. Low balance on ${from.toUpperCase()}, used ${to.toUpperCase()} instead. *$${amount} ${symbol}* landed for *@${escapeMd(recipient)}*. W move.${txLine}`,
  () => `🔀 Bag rerouted from ${from.toUpperCase()} → ${to.toUpperCase()} (insufficient funds on original). *$${amount} ${symbol}* delivered to *@${escapeMd(recipient)}*.${txLine}`,
])();


// ─── BUILD HELPERS ────────────────────────────────────────────────────────────

export function formatTxLine(txHash, chain) {
  if (!txHash || !txHash.startsWith('0x')) return '';
  const short = `${txHash.substring(0, 18)}...`;
  try {
    const url = getExplorerUrl(chain, txHash);
    return `\n🔗 [View Tx](${url})`;
  } catch {
    return `\n🔗 Tx: \`${short}\``;
  }
}

export function buildSuccessReply(type, { amount, symbol, recipient, txHash, chain, fromChain = null, senderSource = 'profile' }) {
  const txLine = formatTxLine(txHash, chain);
  const isCelo = chain?.toLowerCase() === 'celo';

  if (fromChain && fromChain.toLowerCase() !== chain.toLowerCase()) {
    return ERROR_REROUTED(fromChain, chain, amount, symbol, recipient, txLine);
  }

  if (type === 'magicpay') {
    let reply;
    if (isCelo) {
      if (senderSource === 'wallet_profile') {
        const t = pick(SUCCESS_MAGICPAY_CELO_MINIPAY);
        reply = t(amount, symbol, recipient, txLine);
      } else {
        const t = pick(SUCCESS_MAGICPAY_CELO_LEGACY);
        reply = t(amount, symbol, recipient, txLine);
      }
      reply += getCeloPromoNote('magicpay');
    } else {
      const t = pick(SUCCESS_MAGICPAY);
      reply = t(amount, symbol, recipient, txLine);
    }
    return reply;
  }

  // CasualPay
  const t = pick(SUCCESS_P2P);
  let reply = t(amount, symbol, recipient, txLine);

  if (senderSource === 'wallet_profile') {
    reply += ' via MiniPay on Celo';
  }

  if (isCelo && isPromoActive()) {
    reply += getCeloPromoNote('casualpay', txHash);
  }

  return reply;
}

export function buildErrorReply(errorCode, { amount, balance, allowance, chain, tag, context }) {
  switch (errorCode) {
    case 'ERROR_BALANCE':
      return ERROR_BALANCE(amount, (balance || 0).toFixed(2), chain);
    case 'ERROR_ALLOWANCE':
      return context === 'magicpay'
        ? ERROR_MAGIC_ALLOWANCE(amount, chain)
        : ERROR_CASUAL_ALLOWANCE(amount, (allowance || 0).toFixed(2), chain);
    case 'ERROR_MAGIC_PAY_ALLOWANCE':
      return ERROR_MAGIC_ALLOWANCE(amount, chain);
    case 'ERROR_TARGET_NOT_LINKED':
      return ERROR_NOT_LINKED(tag);
    case 'ERROR_RECIPIENT_NOT_FOUND':
      return ERROR_RECIPIENT_NOT_FOUND(tag);
    case 'ERROR_SELF_SEND':
      return ERROR_SELF_SEND();
    case 'ERROR_REVERTED':
      return ERROR_REVERTED(chain);
    case 'ERROR_REROUTE_ALLOWANCE':
      return ERROR_REROUTE_ALLOWANCE(chain, context?.fromChain || 'original chain');
    case 'ERROR_SYNC':
      return ERROR_SYNC();
    default:
      return pick([
        () => `❌ Payment didn't go — reason: *${errorCode || 'unknown error'}*.\nRetry or visit [support](https://monipay.xyz/support) if this keeps happening.`,
        () => `💀 Something went cooked: *${errorCode || 'unknown error'}*.\nTry again or hit up [support](https://monipay.xyz/support).`,
        () => `🤖 Unexpected error: *${errorCode || 'unknown'}*. Not your fault — retry or check [support](https://monipay.xyz/support).`,
      ])();
  }
}

/**
 * Called when the bot can understand the intent is a payment but couldn't
 * extract all required fields. Tells the user exactly what's missing.
 */
export function buildParseError(text) {
  const lower = (text || '').toLowerCase();
  const hasAmount = /\$?[\d]+(?:\.[\d]{1,2})?/.test(lower);
  const hasRecipient = /@[\w-]+/.test(lower) || /(?:to|for)\s+[\w-]+/.test(lower);

  if (!hasAmount && !hasRecipient) {
    return pick([
      `❌ Missing amount and recipient.\nUsage: \`send $5 to @alice\``,
      `🤦 I need both an amount AND a recipient fam.\nUsage: \`send $5 to @alice\``,
      `💀 Can't send vibes — I need the amount and who to send to.\nUsage: \`send $5 to @alice\``,
    ]);
  }
  if (!hasAmount) {
    return pick([
      `❌ Missing amount — how much do you want to send?\nUsage: \`send $5 to @alice\``,
      `🤔 How much fam? I see a recipient but no amount.\nUsage: \`send $5 to @alice\``,
      `💸 Drop the amount blud. Try: \`send $5 to @alice\``,
    ]);
  }
  if (!hasRecipient) {
    return pick([
      `❌ Missing recipient — who are you sending to?\nUsage: \`send $5 to @alice\``,
      `🤔 Who's getting the bag? I see an amount but no recipient.\nUsage: \`send $5 to @alice\``,
      `👤 Name your recipient fam. Try: \`send $5 to @alice\``,
    ]);
  }
  return pick([
    `❌ Couldn't process that payment.\nUsage: \`send $5 to @alice\``,
    `🤖 Payment command didn't parse right. Try: \`send $5 to @alice\``,
    `💀 That command is cooked. Standard format: \`send $5 to @alice\``,
  ]);
}

export function getSigmaError(error, context = 'p2p') {
  if (error?.includes('ERROR_BALANCE')) return pick(['💀 Insufficient balance.', '📉 Bag is empty fam.', '🪦 Not enough funds.']);
  if (error?.includes('ERROR_ALLOWANCE')) return pick(['🔐 Spending allowance too low.', '📵 Bot not cleared for this amount.', '🔒 Allowance cap hit.']);
  if (error?.includes('ERROR_REVERTED')) return pick(['💥 Reverted on-chain.', '🚫 Chain bounced the tx.', '📉 Transaction reverted.']);
  if (error?.includes('ERROR_RECIPIENT_NOT_FOUND')) return pick(['❓ Recipient not found.', '👻 Unknown handle.', '🔍 Can\'t find that user.']);
  if (error?.includes('ERROR_SELF_SEND')) return pick(['🤡 Can\'t send to yourself.', '🪞 That\'s you fam.', '😭 Self-send blocked.']);
  if (error?.includes('ERROR_SYNC')) return pick(['⚠️ On-chain OK, database sync failed.', '🚨 Sync error — contact support.']);
  return `❌ Failed — ${error || 'unknown error'}.`;
}
