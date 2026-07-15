/**
 * MoniBot Discord - Info & FAQ Handler
 * Provides non-technical, Sigma-themed explanations.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export async function handleInfo(messageOrInteraction, topic = null) {
  // If topic is null, it's a general help/faq request
  const customId = messageOrInteraction.customId || topic;

  let embed = new EmbedBuilder().setColor(0x0052FF);

  switch (customId) {
    case 'info_what_is_monipay':
      embed
        .setTitle('🤔 What is MoniPay?')
        .setDescription(
          "MoniPay is a **non-custodial social payment layer**. With its AI agents, MoniPay enables username-based, gasless stablecoin transfers via natural language commands, allowing you to act on financial intents directly inside your conversations! 🗿\n\n" +
          "With MoniPay, you can send stablecoins to **any social identity** (MagicPay — no wallet needed) or **any MoniTag** (CasualPay — to MoniPay users across MoniPay and MiniPay). 🚀\n\n" +
          "**Core Promises:**\n" +
          "• 🪄 **MagicPay**: Send stablecoins to any social handle, even if they don't have a wallet yet!\n" +
          "• 🧠 **Natural Language Processing**: Talk to us naturally, no complex hexadecimal addresses or Web3 jargon needed.\n" +
          "• 🆓 **Gasless Multi-Chain**: Transact across Base, Solana, Ink, Celo, BSC, and Tempo (testnet) with zero gas fees.\n\n" +
          "No NPC bureaucracy, pure W Aura. No cap! 🤫🧏‍♂️"
        );
      break;

    case 'info_casualpay':
      embed
        .setTitle('💸 What is CasualPay?')
        .setDescription(
          "Imagine you and your homie Bob just finished a legendary session of gaming. Bob clutched the win, and you owe him $5 for the bet. 🎮\n\n" +
          "In the old days, you'd have to ask for his address, open a sketchy exchange, pay crazy gas fees, and wait 10 minutes. Absolute NPC behavior. 🤡\n\n" +
          "With **CasualPay**, you just tell me `slide $5 to @bob` and BOOM! The AI wakes up, initiates an on-chain transfer directly from your wallet to Bob's, and the transaction is settled in seconds. No cap, it's the fastest way to distribute wealth, bless the homies, and keep your Aura high! 📈"
        );
      break;

    case 'info_magicpay':
      embed
        .setTitle('🪄 What is MagicPay?')
        .setDescription(
          "Picture this: you want to tip Karen for a good meme, but Karen is completely unlinked and has no idea what MoniPay is. She is a total Web3 NPC. 🤷\n\n" +
          "Does that stop a Sigma? Absolutely not. You type `send $10 to @karen`. MoniBot doesn't crash; instead, I activate **MagicPay** mode! 🪄\n\n" +
          "I securely park the $10 in a smart escrow vault (the **Social Escrow**). Then, I ping Karen: *\"Yo Karen, you got $10 waiting for you. Stop being delulu and link your Discord to claim it!\"* Once Karen links her profile, the vault unlocks and slides the guap to her wallet. Pure magic, zero loss, infinite rizz! ⚡"
        );
      break;

    case 'info_scheduling':
      embed
        .setTitle('⏳ How does Scheduling work?')
        .setDescription(
          "You are a busy Sigma with a lot of moves to make, but you're forgetful. You want to bless your friend Alice with $5 tomorrow at 3 PM, but you know you'll be sleeping or working out. 🏋️\n\n" +
          "Enter **Scheduling**. You just text me `send $5 to @alice tomorrow at 3pm`. The AI grabs the instruction, writes it down in our database ledger (the scheduler queue), and schedules it. 🕐\n\n" +
          "When 3 PM hits tomorrow, the background scheduler executor triggers automatically, executes the transaction, and posts the receipt in your channel. You secured the bag while doing absolutely nothing. Peak passive Aura! 🤫"
        );
      break;

    case 'info_recurring':
      embed
        .setTitle('🔄 How do Recurring Payments work?')
        .setDescription(
          "You want to pay your editor $2 every hour for a 10-hour shift, or maybe you want to schedule a daily rent payout. Doing this manually is a massive Aura drain. 📉\n\n" +
          "That's why we built **Sigma AutoPay (Recurring Payments)**. You type `send $2 to @editor every hour 10 times`. MoniBot takes this single request and immediately expands it into 10 separate scheduled jobs in our queue, all spaced exactly 1 hour apart. ⏰\n\n" +
          "They execute one by one automatically. You can check the progress anytime with `!monibot series status <ID>`, or cancel it with the goated **CANCEL RECURRING PAYMENT** button if things get sus. Autopilot activated! 🚀"
        );
      break;

    case 'info_minipay_vs_monipay':
      embed
        .setTitle('⚔️ MiniPay vs MoniPay Users')
        .setDescription(
          "This is the battle of the wallets! 🥊\n\n" +
          "• **MoniPay Users**: The ultimate power-users. They have linked their profiles, set up allowances, and have multi-chain capabilities. They can hop between Base, Solana, Ink, BSC, Celo, and Tempo (testnet). They're routing stablecoins across networks like absolute wizards. 🧙‍♂️\n\n" +
          "• **MiniPay Users**: Our mobile-first homies using Opera Mini on Celo. They only live on Celo with sub-cent gas fees. They don't need to configure complex chains. When a MiniPay user is detected, MoniBot automatically routes their payments to Celo so everything stays gasless and smooth. It's plug-and-play rizz for mobile users! 🤳"
        );
      break;

    case 'info_how_ai_works':
      embed
        .setTitle('🤖 How the AI works')
        .setDescription(
          "I'm not just a bot, I'm a **highly autonomous payment agent** powered by natural language processing. 🧠\n\n" +
          "When you talk to me, I parse your intent (even if you speak in heavy brainrot or slang). I verify your balance, check your allowance, find the cheapest and fastest blockchain route, resolve your recipient's address, handle all the technical gas fee estimation, and broadcast the transaction. ⛽\n\n" +
          "I do all the heavy lifting while you just sit back and watch your Aura grow! 📈"
        );
      break;

    case 'info_faq':
      embed
        .setTitle('📖 MoniBot FAQ')
        .addFields(
          { name: '💸 Is it free?', value: 'Fees are super low (pennies), and Celo fees are **completely waived**! 🆓', inline: false },
          { name: '🪙 What tokens are supported?', value: 'Stablecoins! **USDC** on Base/Solana, **USDT** on BSC/Celo/Ink, and **αUSD** on Tempo (testnet). 💵', inline: false },
          { name: '🔐 Is it safe?', value: 'Your funds are secured by your PIN and on-chain smart contracts. Non-custodial rizz. 🔒', inline: false },
          { name: '🛑 Can I cancel scheduled payments?', value: 'Yes! Type `!monibot cancel scheduled` to stop them, or click the cancel button. 🗿', inline: false }
        );
      break;

    case 'info_get_started':
      embed
        .setTitle('🚀 How to Get Started')
        .setDescription(
          "Stop being an NPC and join the Sigma squad in 3 easy steps: 📈\n\n" +
          "1. **Claim your MoniTag**: Head to **[monipay.xyz](https://monipay.xyz)** and set up your profile.\n" +
          "2. **Link Discord**: In Settings → MoniBot AI, click **Link Discord**. This is how I know who you are! 🔗\n" +
          "3. **Approve AI**: Click **Set Allowance** so I have permission to slide funds for you. Allowance keeps your vault locked from external hacks. 🤫\n\n" +
          "Once you're set, try `!monibot balance` to check your Aura! 💰"
        )
        .addFields({
          name: '🎯 Command Examples (No Prefix in DMs!)',
          value:
            "• `Balance` — Check your guap 💰\n" +
            "• `@alice $5` — Quick slide 💸\n" +
            "• `Send $10 to @bob every day for 1 week` — AutoPay! 🔄\n" +
            "• `Switch chain to base` — Change network preference 🛣️"
        });
      break;

    case 'info_sports_p2p':
      embed
        .setTitle('🏆 Conditional Sports P2P')
        .setDescription(
          "Your follower on the timeline is claiming Germany is going to absolutely rinse England. They say \"no cap, bet $10 on it.\"\n\n" +
          "Instead of locking up your funds in escrow or trusting a double-dealing NPC, you trigger **Conditional Sports P2P** via MoniBot on X (Twitter)! ⚽\n\n" +
          "Simply post a tweet or reply on X tagging `@monibot`:\n" +
          "`Hey @monibot send $10 to @jade if Germany wins England ⚽`\n\n" +
          "**How it works:**\n" +
          "• MoniBot registers the job and monitors the match.\n" +
          "• It uses a custom **3-Source Consensus Sports Oracle** (football-data.org, API-Football, and openfootball) to settle results automatically when the game ends.\n" +
          "• If their team wins, the funds move from your wallet to the recipient. If they lose or draw, the job is cancelled. No locked funds, no escrow friction, pure W Aura! 🗿\n\n" +
          "**Supported Commands:**\n" +
          "• Win/Loss: `send $10 to @username if Germany wins Spain`\n" +
          "• Draw: `pay @username $5 if Nigeria draws Canada`\n" +
          "• Exact Score: `slide $15 to @username if France wins England 2-1`\n\n" +
          "*MagicPay is fully integrated, so the recipient doesn't even need a MoniPay account to receive their rewards!* 🪄"
        );
      break;

    default:
      embed
        .setTitle('🤖 MoniBot Information Center')
        .setDescription("I'm here to help you rizz up your server with instant social payments. Choose a topic below or type `!monibot help`. 🗿");
      break;
  }

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('info_what_is_monipay')
        .setLabel('MoniPay')
        .setStyle(customId === 'info_what_is_monipay' ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_casualpay')
        .setLabel('CasualPay')
        .setStyle(customId === 'info_casualpay' ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_magicpay')
        .setLabel('MagicPay')
        .setStyle(customId === 'info_magicpay' ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_scheduling')
        .setLabel('Scheduling')
        .setStyle(customId === 'info_scheduling' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('info_recurring')
        .setLabel('Recurring')
        .setStyle(customId === 'info_recurring' ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('info_minipay_vs_monipay')
        .setLabel('MiniPay vs MoniPay')
        .setStyle(customId === 'info_minipay_vs_monipay' ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_how_ai_works')
        .setLabel('AI Agent')
        .setStyle(customId === 'info_how_ai_works' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('info_sports_p2p')
        .setLabel('Sports P2P')
        .setStyle(customId === 'info_sports_p2p' ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_faq')
        .setLabel('FAQ')
        .setStyle(customId === 'info_faq' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('info_get_started')
        .setLabel('Get Started')
        .setStyle(customId === 'info_get_started' ? ButtonStyle.Success : ButtonStyle.Success)
    );

  const components = [row1, row2];

  if (customId === 'info_sports_p2p') {
    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('🐦 Try on X/Twitter')
          .setStyle(ButtonStyle.Link)
          .setURL('https://x.com/intent/tweet?text=Hey%20%40monibot%20send%20%2410%20to%20%40username%20if%20Germany%20wins%20Curacao'),
        new ButtonBuilder()
          .setLabel('📖 Learn More')
          .setStyle(ButtonStyle.Link)
          .setURL('https://blog.monipay.xyz/introducing-conditional-sports-p2p-smart-world-cup-2026-rewards')
      );
    components.push(row3);
  }

  const payload = { embeds: [embed], components };

  try {
    if (messageOrInteraction.isButton?.()) {
      await messageOrInteraction.update(payload);
    } else if (messageOrInteraction.reply) {
      await messageOrInteraction.reply(payload);
    } else {
      await messageOrInteraction.send(payload);
    }
  } catch (e) {
    console.error('Info handler error:', e.message);
  }
}
