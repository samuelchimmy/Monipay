import { getPromoBanner, getCommunityGiveawayBanner } from '../utils/promo.js';
import { MAIN_MENU_KEYBOARD } from './interactive.js';

export async function handleStart(bot, msg) {
  const isPrivate = msg.chat.type === 'private';
  const prefixNote = isPrivate ? `\n\n💡 *Note:* In this DM, you don't need the \`/\` prefix. Just type what you want to do!` : '';
  const text = `🤖 *MoniPay Interactive Assistant*

Welcome! I'm your AI-powered financial agent. I can help you send, tip, and schedule payments across multiple blockchains using just Telegram usernames.${prefixNote}

How can I help you today? Select an option below to get started.`;

  await bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: MAIN_MENU_KEYBOARD
  });
}

export async function handleHelp(bot, msg) {
  const promoBanner = getPromoBanner();
  const communityBanner = getCommunityGiveawayBanner();

  const helpText = `🔨 *MoniBot Setup Guide*
_MoniPay: The Hammer. Send crypto like you're texting._${promoBanner}

━━━━━━━━━━━━━━━━━━━━━━━━
*🟢 MoniPay Users (Base · BSC · Celo · Ink · Solana · Tempo (testnet))*

*Step 1 — Create Your MoniPay Account*
1. Go to [monipay.xyz](https://monipay.xyz)
2. Claim your unique *MoniTag* (your payment identity — like @yourname)
3. Set a *PIN* to secure your wallet
4. Your non-custodial wallet is created instantly. No seed phrases. No gas.

*Step 2 — Activate Your Wallet*
1. Go to monipay.xyz and open *Wallet*
2. Tap the *Activate* button in your Wallet Balance section
3. This activates your account on-chain (one-time, gasless)

*Step 3 — Link Your Telegram*
1. Open [monipay.xyz](https://monipay.xyz) → *Settings* → *MoniBot AI*
2. Tap *Link Telegram* and enter your Telegram ID: \`${msg.from.id}\`

*Step 4 — Approve Spending Allowance*
MoniBot needs your approval to move funds on your behalf.

🔵 *CasualPay* (sending to registered MoniPay users)
→ Settings → MoniBot AI → Set Allowance → *CasualPay*

🪄 *MagicPay* (sending to anyone, even unregistered)
→ Settings → MoniBot AI → Set Allowance → *MagicPay*
→ Funds held in escrow until recipient claims (180-day window)

━━━━━━━━━━━━━━━━━━━━━━━━
*🔵 MiniPay Users (Celo only)*

1. Open the *MiniPay* mobile app
2. Find the *Monipay* miniapp inside MiniPay
3. Go to *Link Telegram* → enter your Telegram ID: \`${msg.from.id}\`
4. Tap *Approve Spending Allowance* inside the miniapp
5. Done — start tipping on Telegram 🗿

_MiniPay wallets send on Celo by default. Add "on base/bsc/solana" to override (recipient must also be on that chain)._

━━━━━━━━━━━━━━━━━━━━━━━━
*Step 5 — Claim a MagicPay*
If someone sent you funds before you were registered:
1. Sign up / link your Telegram (steps above)
2. Go to *Wallet → Pending Claims*
3. Your funds release automatically

━━━━━━━━━━━━━━━━━━━━━━━━
*🧠 MoniBot Auto-Reroute Intelligence*
MoniBot doesn't just fail — it *thinks*. When a payment can't go through on the requested chain, MoniBot automatically checks all other supported networks and reroutes to wherever you have sufficient balance AND allowance. You will always be notified which chain was used.

━━━━━━━━━━━━━━━━━━━━━━━━
*💬 How to Use MoniBot*
Just text naturally in this chat or mention @monipaybot in groups:

Send to someone: \`send $5 to @alice\`
Multi-send: \`slide $1 each to @alice and @bob\`
MagicPay (unregistered): \`tip $10 to @jade\` — goes to escrow
Check balance: \`balance\` or \`balance on celo\`
Giveaway: \`giveaway $2 to the first 5\`
Scheduled: \`send $5 to @alice in 2 hours\`
*Recurring:* \`send $1 to @alice every 1 minute 5 times\`
*Sports P2P (on X):* \`send $10 to @user if Germany wins Curacao\`

*🔄 Recurring Payment Commands*
Create recurring: \`send $X to @user every [interval] [N times | for duration]\`
Examples:
• \`send $5 to @alice every 1 hour 24 times\`
• \`send $2 to @bob every day for 7 days\`
• \`tip $1 to @charlie every 2 minutes 10 times\`

Manage recurring:
• \`/my_series\` — list your recurring payments
• \`/series_status <id>\` — check series status
• \`/cancel_series <id>\` — cancel a series

Supported chains: *Base · BSC · Celo · Ink · Solana · Tempo (testnet)*${communityBanner}`;

  await bot.sendMessage(msg.chat.id, helpText, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}
