/**
 * Story-driven, brainrot-infused explanations of all MoniBot features.
 * Non-technical and highly engaging for users.
 */
const STORIES = {
  casualpay: 
    `🔵 *The Legend of CasualPay (Direct P2P)* 💸\n\n` +
    `Once upon a time, two absolute Sigmas named Alice and Bob wanted to trade stablecoins without any NPC bureaucracy. Since both were registered in the MoniPay universe, they used *CasualPay*.\n\n` +
    `It's the ultimate direct peer-to-peer teleportation of cash. Alice tells the bot: \`send $5 to @bob\`. With a tiny 1% fee (the Fanum tax), the cash moves from Alice directly to Bob instantly. No complex wallet addresses, no waiting, just pure W Aura. 🗿`,

  magicpay: 
    `🪄 *The MagicPay Wizardry (Social Escrow)* 🔮\n\n` +
    `Picture this: you want to slide $10 to Chad, but Chad is still a basic NPC who hasn't linked his account to MoniPay yet. Are you cooked? Nah, you activate *MagicPay*!\n\n` +
    `You type: \`send $10 to @chad\`. The bot takes the funds, charges a 2% fee, and holds them safely in social escrow. You tell Chad: "Yo blud, claim your guap by linking your Telegram at monipay.xyz." Once Chad taps in and links, the bot teleports the cash straight to him. Absolute wizard rizz! 🪄`,

  scheduling: 
    `📅 *The Scheduling Time-Warp* ⏳\n\n` +
    `You want to send $5 to your homie tomorrow at 3 PM, but you plan on sleeping in or keeping up your mewing streak. You use *Scheduling*!\n\n` +
    `You tell the bot: \`send $5 to @alice tomorrow at 3pm\`. The bot schedules the payment and goes back to sleep. When the clock strikes 3:00 PM, it wakes up, slides the stablecoins to Alice automatically, and notifies both of you. You secure the bag while offline—major W Aura! 📈`,

  recurring: 
    `🔄 *Recurring Payments (Sigma AutoPay)* 🤖\n\n` +
    `Instead of manually sending money every week like a corporate wage slave, you set up *Recurring Payments* (Sigma AutoPay).\n\n` +
    `You tell the bot: \`send $5 to @bob every week 4 times\`. Every week, a payment triggers and sends the coins. You can check the progress or cancel it anytime if your mewing streak breaks. 🔄`,

  minipay: 
    `🟢 *MiniPay vs MoniPay (The Clash of Wallets)* ⚔️\n\n` +
    `In the MoniPay universe, there are two kinds of players:\n\n` +
    `📱 *MiniPay Users:* The mobile warriors! They use the native MiniPay wallet inside Opera Mini, locked exclusively to the Celo network for ultra-fast, gasless, Celo-stablecoin transactions. Highly optimized for quick social payments on the go.\n\n` +
    `🌐 *MoniPay Users:* The multi-chain desktop/web power users at [monipay.xyz](https://monipay.xyz). They link their own external wallets (like MetaMask or Rabby) and transact across all goated chains: Base, Solana, BSC, Celo, Ink, and Tempo (testnet). The bot auto-routes payments between them so nobody gets cooked! 🧢`,

  overview: 
    `🤖 *MoniBot AI Agent: Full Feature Overview* 🌟\n\n` +
    `MoniPay is a non-custodial social payment layer. With its AI agents, MoniPay enables username-based, gasless stablecoin transfers via natural language commands, letting you act on financial intents directly in conversations! 🗿\n\n` +
    `Here is all the rizz I've got:\n\n` +
    `• *MagicPay:* Send stablecoins to any social identity — no wallet needed! (2% fee) 🪄\n` +
    `• *CasualPay:* Instant P2P stablecoin transfers to any MoniTag across MoniPay and MiniPay (1% fee) 💸\n` +
    `• *Scheduling:* Set payments in the future (\`in 5 mins\`, \`tomorrow at 3pm\`) ⏳\n` +
    `• *Recurring Payments:* Auto-renewing subscription runs (\`every day 5 times\`) 🔄\n` +
    `• *Multi-Chain Support:* Base, Celo, Solana, BSC, Ink, and Tempo (testnet) with auto-rerouting protection. ⛓️\n` +
    `• *Giveaways:* Create instant social giveaway pools to boost your server's aura. 🎉\n\n` +
    `Link your Telegram at [monipay.xyz](https://monipay.xyz) and stop being an NPC! 🗿`,

  rerouting:
    `⛓ *Multi-Chain Auto-Rerouting (The Ultimate Save)* 🛡\n\n` +
    `Imagine you're trying to pay for a mewing tutorial on Base, but you've got zero gas. You're thinking you're completely cooked. L Rizz. 💀\n\n` +
    `But wait! MoniBot is a true Sigma. It automatically checks your other linked wallets on BSC, Solana, Celo, Ink, and Tempo (testnet). If it finds the stablecoins there, it auto-routes the payment from those chains instead. You secure the bag without lifting a finger. Ultimate W Aura! 🛡`,

  giveaways:
    `🎁 *Giveaways (Aura Booster)* 🎉\n\n` +
    `Want to prove you're the ultimate Chad of the group chat? You host a *Giveaway*!\n\n` +
    `You type: \`giveaway $10 to the first 5\`. The bot takes the coins and locks them in the vault. The first 5 speed-demons in the chat who click "Claim" get the bag instantly. Instant popularity multiplier, absolute W rizz! 🚀`,

  aura:
    `🦁 *Aura Leaderboard (Top G Status)* 🏆\n\n` +
    `Every time you tip or bless someone in the chat, your community Aura score goes up. Type \`/aura\` or ask the bot to show the leaderboard. The bot lists the top tappers and crowns the Top G of the week. Don't let your homies see you at the bottom, stay active! 👑`,

  link:
    `🔗 *Account Linking (The Portal)* 🌐\n\n` +
    `You can't use the bot's superpowers if your account isn't linked. You're just a ghost in the system.\n\n` +
    `Linking is how you connect your Telegram handle to your MoniPay or MiniPay wallet. Go to [monipay.xyz](https://monipay.xyz) or open the Monipay miniapp inside MiniPay, click *Link Telegram*, and approve. Once you cross the portal, your wallets are synced, and you can teleport cash anywhere. 🌀`,

  preferred_chain:
    `⚙️ *Preferred Chain Settings (The Base of Operations)* 🎛\n\n` +
    `You want to send payments, but you don't want to type "on Base" or "on Solana" every single time like a script-kiddie. You set your *Preferred Chain*!\n\n` +
    `Tell the bot: \`preferred chain to base\` or type \`/change\`. The bot configures your default network. From then on, any payment you make automatically defaults to that chain unless you specify otherwise. Max efficiency, pure Sigma behavior! ⚙️`,

  sports_p2p:
    `🏆 *Conditional Sports P2P (World Cup Sigma Spec)* ⚽\n\n` +
    `Your follower on the timeline is claiming Germany is going to absolutely rinse England. They say "no cap, bet $10 on it." Instead of locking up your funds or trusting a double-dealing NPC, you trigger *Conditional Sports P2P* via MoniBot on X (Twitter)!\n\n` +
    `Simply post a tweet or reply tagging @monibot:\n` +
    `\`Hey @monibot send $10 to @jade if Germany wins England ⚽\`\n\n` +
    `MoniBot registers the job and monitors the match. It uses a custom *3-Source Consensus Sports Oracle* (football-data.org, API-Football, and openfootball) to settle results automatically when the game ends. If their team wins, the funds automatically move from your wallet to the recipient. If they lose or draw, the job is cancelled. No locked funds, no escrow friction, pure W Aura! 🗿\n\n` +
    `*MagicPay is fully integrated*, so the recipient doesn't even need a wallet to claim their rewards! 🪄\n\n` +
    `*Supported Commands:*\n` +
    `• Win/Loss: \`send $10 to @username if Germany wins Spain\`\n` +
    `• Draw: \`pay @username $5 if Nigeria draws Canada\`\n` +
    `• Exact Score: \`slide $15 to @username if France wins England 2-1\``
};

/**
 * Handle natural language questions about features
 * @returns {Promise<boolean>} True if handled, false if it doesn't match feature question regex
 */
export async function handleFeatureExplanationNL(bot, msg, text) {
  const cleaned = text.toLowerCase().trim();

  // 0. Sports P2P detection
  if (
    /\b(sports?|world\s*cup|football|soccer|bets?|match|prediction)\b/i.test(cleaned) ||
    (/\bif\b/i.test(cleaned) && /\b(wins|draws|ties)\b/i.test(cleaned))
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.sports_p2p, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🐦 Try on X/Twitter', url: 'https://x.com/intent/tweet?text=Hey%20%40monibot%20send%20%2410%20to%20%40username%20if%20Germany%20wins%20Curacao' },
            { text: '📖 Learn More', url: 'https://blog.monipay.xyz/introducing-conditional-sports-p2p-smart-world-cup-2026-rewards' }
          ]
        ]
      }
    });
    return true;
  }

  // 1. MagicPay detection
  if (
    cleaned.includes('magicpay') || 
    (cleaned.includes('magic') && cleaned.includes('pay')) ||
    cleaned.includes('escrow') ||
    cleaned.includes('shadow realm')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.magicpay, { parse_mode: 'Markdown' });
    return true;
  }

  // 2. CasualPay detection
  if (
    cleaned.includes('casualpay') || 
    (cleaned.includes('casual') && cleaned.includes('pay')) ||
    cleaned.includes('direct p2p') ||
    cleaned.includes('peer to peer')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.casualpay, { parse_mode: 'Markdown' });
    return true;
  }

  // 3. Scheduling detection
  if (
    cleaned.includes('scheduling') || 
    cleaned.includes('schedule') || 
    cleaned.includes('scheduled') ||
    cleaned.includes('how does scheduling') ||
    (cleaned.includes('schedule') && cleaned.includes('work'))
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.scheduling, { parse_mode: 'Markdown' });
    return true;
  }

  // 4. Recurring Payments detection
  if (
    cleaned.includes('recurring') || 
    cleaned.includes('recurrence') ||
    cleaned.includes('autopay') || 
    cleaned.includes('auto-pay') ||
    cleaned.includes('subscription') ||
    (cleaned.includes('recurring') && cleaned.includes('work'))
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.recurring, { parse_mode: 'Markdown' });
    return true;
  }

  // 5. MiniPay vs MoniPay detection
  if (
    cleaned.includes('minipay') || 
    cleaned.includes('monipay vs minipay') ||
    cleaned.includes('difference between minipay') ||
    cleaned.includes('minipay vs') ||
    cleaned.includes('monipay and minipay')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.minipay, { parse_mode: 'Markdown' });
    return true;
  }

  // 5.1 Auto-Rerouting detection
  if (
    cleaned.includes('reroute') || 
    cleaned.includes('rerouting') || 
    cleaned.includes('failover') ||
    cleaned.includes('routing')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.rerouting, { parse_mode: 'Markdown' });
    return true;
  }

  // 5.2 Giveaways detection
  if (
    cleaned.includes('giveaway') || 
    cleaned.includes('giveaways') || 
    cleaned.includes('airdrop')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.giveaways, { parse_mode: 'Markdown' });
    return true;
  }

  // 5.3 Aura Leaderboard detection
  if (
    cleaned.includes('aura') || 
    cleaned.includes('leaderboard') || 
    cleaned.includes('top g')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.aura, { parse_mode: 'Markdown' });
    return true;
  }

  // 5.4 Account Linking detection
  if (
    cleaned.includes('link') || 
    cleaned.includes('linking') || 
    cleaned.includes('connect')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.link, { parse_mode: 'Markdown' });
    return true;
  }

  // 5.5 Preferred Chain detection
  if (
    cleaned.includes('preferred chain') || 
    cleaned.includes('change chain') || 
    cleaned.includes('switch chain') ||
    cleaned.includes('change network') ||
    cleaned.includes('preferred network')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.preferred_chain, { parse_mode: 'Markdown' });
    return true;
  }

  // 6. MoniBot / Features Overview detection
  if (
    cleaned.includes('features') || 
    cleaned.includes('what can you do') || 
    cleaned.includes('what is monibot') || 
    cleaned.includes('who are you') || 
    cleaned.includes('explain features') ||
    cleaned.includes('how do you work') ||
    cleaned.includes('explain bot')
  ) {
    await bot.sendMessage(msg.chat.id, STORIES.overview, { parse_mode: 'Markdown' });
    return true;
  }

  return false;
}
