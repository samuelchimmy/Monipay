import { getPromoBanner, getCommunityGiveawayBanner } from '../utils/promo.js';

export async function handleAbout(bot, msg) {
  const promoBanner = getPromoBanner();
  const communityBanner = getCommunityGiveawayBanner();

  const aboutText = `🔨 *MoniPay — Social Payment Layer*

_"No NPC blockchain bureaucracy, just straight bags."_

MoniPay is a *non-custodial social payment layer*. With its AI agents, MoniPay enables username-based, gasless stablecoin transfers via natural language commands, allowing users to act on financial intents directly inside conversations. 🗿

*The core promises:*
- *MagicPay:* Send stablecoins to any social identity — no wallet needed! 🪄
- *CasualPay:* Slide funds to any MoniTag across MoniPay and MiniPay. 💸
- *Natural Language Processing:* Text us naturally, no complex hexadecimal addresses. 🧠
- *Gasless Multi-Chain:* Base, Celo, Solana, BSC, Ink, and Tempo (testnet) with zero gas fees. 🆓${promoBanner}

━━━━━━━━━━━━━━━━━━━━━━━━
*🤖 MoniBot — Agentic Commerce*

MoniBot is not a chatbot with a wallet. It is a *financial agent* — it lives on Telegram, X, and Discord, thinks with AI, and executes on-chain without you touching an app.

Two payment rails:
🔵 *CasualPay* — instant P2P between registered MoniPay users
🪄 *MagicPay* — Social Escrow for anyone. Send to someone who hasn't signed up yet. Money waits. 180 days. On-chain.

*MoniPay passes the Walkaway Test:*
Even if MoniPay the company disappears —
→ Your funds stay accessible
→ Your keys stay in your device
→ The protocol stays on-chain

Not a bank. The *Uniswap of Payments*.

[monipay.xyz](https://monipay.xyz) · [@monipay_xyz](https://x.com/monipay_xyz)${communityBanner}

MiniPay users: your sends default to Celo (USDm). Open the MiniPay mobile app → Monipay miniapp → Link Telegram → Approve Spending Allowance. Add "on base/bsc/solana" to override chain (recipient must also be on that chain).`;

  await bot.sendMessage(msg.chat.id, aboutText, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}
