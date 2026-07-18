/**
 * Promotional configuration — Celo Zero-Fee Month
 * June 1 – June 30, 2026
 *
 * MagicPay on Celo: contract fee set to 0% for the promo period.
 * CasualPay on Celo: fee is charged on-chain but rebated by MoniPay.
 *   Users are shown a simple actionable message with their tx hash.
 *
 * To end the promo: set PROMO_END to a past date.
 */

import { getExplorerUrl } from '../../shared/chains.js';

const PROMO_START = new Date('2026-06-01T00:00:00Z');
const PROMO_END   = new Date('2026-06-30T23:59:59Z');

export function isPromoActive() {
  const now = new Date();
  return now >= PROMO_START && now <= PROMO_END;
}

export function promoDaysLeft() {
  const now = new Date();
  if (now > PROMO_END) return 0;
  return Math.ceil((PROMO_END - now) / 86_400_000);
}

/**
 * The main promo banner — used in /start, /help, /about, /status.
 */
export function getPromoBanner() {
  if (!isPromoActive()) return '';
  const days = promoDaysLeft();
  return (
    `\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏆 *Zero-Fee Celo Month — ${days} day${days !== 1 ? 's' : ''} left*\n\n` +
    `We won the Celo Proof of Ship AI track and we're celebrating with you.\n\n` +
    `🪄 *MagicPay on Celo:* completely free this June.\n` +
    `🔵 *CasualPay on Celo:* fees get rebated back to you.\n\n` +
    `Send on Celo this June. Keep every cent.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━`
  );
}

/**
 * Short inline promo note — appended to Celo success messages.
 * For CasualPay, includes the tx hash claim instruction.
 */
export function getCeloPromoNote(type = 'magicpay', txHash = null) {
  if (!isPromoActive()) return '';
  if (type === 'magicpay') {
    return `\n\n🏆 *Zero-fee month:* This send was completely free on Celo. Promo runs until June 30, 2026.`;
  }
  // CasualPay — fee was charged, user needs to submit tx hash to claim rebate
  // Wrap the tx hash as a [View Tx] explorer link so it's tappable
  let txPart = '';
  if (txHash) {
    try {
      const url = getExplorerUrl('celo', txHash);
      txPart = `\n[View Tx](${url}) — share this link with [support](https://monipay.xyz/support) to claim your rebate.`;
    } catch {
      txPart = `\nTx: \`${txHash.substring(0, 18)}...\` — send to [support](https://monipay.xyz/support) to claim.`;
    }
  }
  return (
    `\n\n🏆 *Zero-fee month:* Your fee on this Celo payment is on us.${txPart}`
  );
}

/**
 * Community giveaway banner — $10 demo giveaway for communities that add MoniBot.
 */
export function getCommunityGiveawayBanner() {
  if (!isPromoActive()) return '';
  return (
    `\n\n🎁 *Community Giveaway:* Add @monipaybot to your group and we'll run a *$10 demo giveaway* for your community — first 5 groups to add us this June get it. DM @monipay_xyz to claim.`
  );
}
