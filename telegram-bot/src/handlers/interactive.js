import { getSupabase, getProfileByPlatformId } from '../../shared/database.js';
import { escapeMd } from '../utils/replies.js';
import { handleBalance } from './balance.js';
import { cancelRecurringSeries } from '../utils/seriesManager.js';

export const MAIN_MENU_KEYBOARD = {
  inline_keyboard: [
    [{ text: '🚀 Get Started', callback_data: 'menu_start' }, { text: '⚙️ How it Works', callback_data: 'menu_how' }],
    [{ text: '📜 Command List', callback_data: 'menu_commands' }, { text: '📊 My Status', callback_data: 'menu_status' }],
    [{ text: '⚙️ Settings', callback_data: 'menu_settings' }, { text: '❓ FAQ', callback_data: 'menu_faq' }],
    [{ text: '🔗 Link Account', callback_data: 'menu_link' }, { text: '➕ Add to Group', url: 'https://t.me/monipaybot?startgroup=true' }]
  ]
};

export const LINK_KEYBOARD = {
  inline_keyboard: [
    [{ text: '🔗 How to Link', callback_data: 'menu_link' }],
    [{ text: '📖 Learn More', callback_data: 'menu_main' }]
  ]
};

const BACK_TO_MENU_BUTTON = { text: '⬅️ Back to Menu', callback_data: 'menu_main' };

export const GET_STARTED_KEYBOARD = {
  inline_keyboard: [
    [{ text: '🔗 How to Link', callback_data: 'menu_link' }],
    [BACK_TO_MENU_BUTTON]
  ]
};

export const HOW_IT_WORKS_KEYBOARD = {
  inline_keyboard: [
    [{ text: '🤖 About the AI', callback_data: 'menu_ai' }],
    [{ text: '🪄 MagicPay vs CasualPay', callback_data: 'menu_magic' }],
    [BACK_TO_MENU_BUTTON]
  ]
};

export const FAQ_KEYBOARD = {
  inline_keyboard: [
    [BACK_TO_MENU_BUTTON]
  ]
};

export const SETTINGS_KEYBOARD = {
  inline_keyboard: [
    [{ text: '⛓ Change Preferred Chain', callback_data: 'settings_chain' }],
    [BACK_TO_MENU_BUTTON]
  ]
};

export const CHAIN_SELECT_KEYBOARD = {
  inline_keyboard: [
    [{ text: 'Base', callback_data: 'set_chain_base' }, { text: 'BSC', callback_data: 'set_chain_bsc' }],
    [{ text: 'Celo', callback_data: 'set_chain_celo' }, { text: 'Ink', callback_data: 'set_chain_ink' }],
    [{ text: 'Solana', callback_data: 'set_chain_solana' }],
    [{ text: '⬅️ Back to Settings', callback_data: 'menu_settings' }]
  ]
};

export async function handleCallbackQuery(bot, query) {
  const { data, message } = query;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  const editMessage = async (text, keyboard) => {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: keyboard
      });
    } catch (e) {
      // If content is same, it throws error. Handle gracefully.
      if (!e.message.includes('message is not modified')) {
        console.error('[Interactive] Edit error:', e.message);
      }
    }
  };

  switch (data) {
    case 'menu_main':
      await editMessage(`🤖 *MoniPay Interactive Assistant*\n\nHow can I help you today? Select an option below to learn more about MoniPay and how I can help you move money with AI.`, MAIN_MENU_KEYBOARD);
      break;

    case 'menu_commands':
      await editMessage(
        `📜 *MoniBot Command Guide*

Select a style below to see how to talk to me!

🏠 *Prefixless (DMs only)*
Just talk to me naturally. No \`/\` or mentions needed.
• Single Pay: \`send $5 to @alice\`
• Multisend: \`send $1 each to @alice and @bob\`
• Scheduling: \`send $5 to @alice in 2 hours\`
• Recurring: \`send $2 to @bob every day for 7 days\`
• Balance: \`check my balance on base\`
• Status: \`what is my status?\`

⚡ *Slash Commands (DMs & Groups)*
Standard bot commands that work everywhere.
• Single Pay: \`/send $10 to @bob\`
• Multisend: \`/send $1 each to @alice and @bob\`
• Scheduling: \`/send $5 to @alice tomorrow at 3pm\`
• Recurring: \`/send $5 to @bob every week 4 times\`
• Balance: \`/balance celo\`
• Status: \`/status\`
• Manage: \`/my_series\` or \`/cancel_series <id>\`

🗣 *Mentions (Groups only)*
Call me into the conversation.
• Single Pay: \`@monipaybot send $5 to @alice\`
• Multisend: \`@monipaybot send $1 each to @alice and @bob\`
• Scheduling: \`@monipaybot send $5 to @alice in 2 hours\`
• Recurring: \`@monipaybot send $2 to @bob every day for 7 days\`
• Balance: \`@monipaybot what is my balance?\`

💡 *Tip:* You can also reply to a message with just a dollar amount (e.g., \`$5\`) to send it instantly to that person!`,
        { inline_keyboard: [[BACK_TO_MENU_BUTTON]] }
      );
      break;

    case 'menu_start':
      await editMessage(
        `🚀 *Get Started with MoniPay*\n\n*MoniPay Users:*\n1️⃣ Go to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI\n2️⃣ Click *Link Telegram* and approve\n\n*MiniPay Users:*\n1️⃣ Open MiniPay app → Monipay miniapp\n2️⃣ Click *Link Telegram* and approve\n\n*Final Step (All):*\n3️⃣ Approve a *Spending Allowance* for CasualPay (P2P) or MagicPay.\n\n💡 *Pro Tip:* In this DM, you can send commands like \`send $5 to @alice\` *without* the \`/\` prefix!`,
        GET_STARTED_KEYBOARD
      );
      break;

    case 'menu_how':
      await editMessage(
        `⚙️ *How MoniPay Works*\n\nMoniPay is a decentralized payment rail that lets you send stablecoins using social identifiers (like @usernames) instead of long wallet addresses.\n\nI act as your *Financial AI Agent*. You tell me what to do in plain English, and I execute the on-chain transactions for you.`,
        HOW_IT_WORKS_KEYBOARD
      );
      break;

    case 'menu_ai':
      await editMessage(
        `🤖 *The MoniBot AI*\n\nI use advanced language models to understand your intent. You don't need to remember specific commands or prefixes in DMs.\n\n*Examples:* \n• "yo send 5 bucks to @bob"\n• "tip @alice $1 each day for a week"\n• "what is my balance on base?"\n• "check my status"\n\nI'm designed to be autonomous, finding the best chain for your payment and even rerouting if one chain has low funds.`,
        HOW_IT_WORKS_KEYBOARD
      );
      break;

    case 'menu_magic':
      await editMessage(
        `🪄 *MagicPay vs CasualPay*\n\n🔵 *CasualPay:* Instant transfer between two registered MoniPay users. 1% fee.\n\n🪄 *MagicPay:* Send money to *anyone* on Telegram, even if they don't have a MoniPay account yet. Funds are held in a secure social escrow for 180 days. They claim by linking their account. 2% fee.`,
        HOW_IT_WORKS_KEYBOARD
      );
      break;

    case 'menu_faq':
      await editMessage(
        `❓ *Frequently Asked Questions*

*Q: CasualPay vs MagicPay?*
🔵 *CasualPay:* Direct P2P to other MoniPay users (1% fee).
🪄 *MagicPay:* Send to *anyone* on Telegram. I hold the funds in a secure escrow until they link their account to claim (2% fee).

*Q: MoniPay vs MiniPay users?*
🟢 *MoniPay:* Users on [monipay.xyz](https://monipay.xyz) using their own wallets (MetaMask, etc) across multiple chains.
🔵 *MiniPay:* Mobile-first users using the MiniPay wallet on Celo.

*Q: Is it safe?*
Yes! I am non-custodial. You only authorize me to move funds up to the *Allowance* you set in your settings.`,
        FAQ_KEYBOARD
      );
      break;

    case 'menu_link':
      await editMessage(
        `🔗 *How to Link Your Account*

1️⃣ Go to [monipay.xyz](https://monipay.xyz) (or the Monipay miniapp in MiniPay).
2️⃣ Open *Settings* → *MoniBot AI*.
3️⃣ Click *Link Telegram*.
4️⃣ Approve the connection in the pop-up.

_No manual ID entry required. Once linked, you can use MoniBot in any group!_`,
        { inline_keyboard: [[BACK_TO_MENU_BUTTON]] }
      );
      break;

    case 'menu_status':
      // Handled in index.js to access database/clients
      break;

    case 'menu_settings':
      await editMessage(
        `⚙️ *Settings*

Manage your MoniBot preferences here.

• *Preferred Chain:* The default blockchain I use when you don't specify one in a command.`,
        SETTINGS_KEYBOARD
      );
      break;

    case 'settings_chain':
      await editMessage(
        `⛓ *Change Preferred Chain*

Select the default network for your payments:`,
        CHAIN_SELECT_KEYBOARD
      );
      break;

    default:
      await bot.answerCallbackQuery(query.id);
  }
}

export async function handleCallbackQueryListener(bot, query) {
  const supabase = getSupabase();

  if (query.data === 'menu_status') {
    const mockMsg = {
      chat: { id: query.message.chat.id },
      from: query.from,
      text: ''
    };
    await handleBalance(bot, mockMsg);
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (query.data === 'status_history') {
    const profile = await getProfileByPlatformId('telegram', query.from.id);
    if (!profile) return bot.answerCallbackQuery(query.id, { text: "Link required!" });

    const { data: txs } = await supabase.from('monibot_transactions')
      .select('*')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(5);

    let text = `📜 *Recent Activity (@${profile.pay_tag})*\n\n`;
    if (!txs || txs.length === 0) text += `_No recent transactions found._`;
    else {
      text += txs.map(t => {
        const date = new Date(t.created_at).toLocaleDateString();
        const emoji = t.sender_id === profile.id ? '📤' : '📥';
        const target = t.sender_id === profile.id ? `@${escapeMd(t.recipient_pay_tag)}` : `@${escapeMd(t.payer_pay_tag)}`;
        return `${emoji} *$${t.amount.toFixed(2)}* to ${target} (${t.chain}) _${date}_`;
      }).join('\n');
    }
    await bot.sendMessage(query.message.chat.id, text, { parse_mode: 'Markdown' });
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (query.data === 'status_magic') {
    const profile = await getProfileByPlatformId('telegram', query.from.id);
    if (!profile) return bot.answerCallbackQuery(query.id, { text: "Link required!" });

    await bot.sendMessage(query.message.chat.id,
      `🪄 *MagicPay Escrow Status*\n\n` +
      `Any MagicPay sent to your Telegram ID that hasn't been claimed yet will appear on [monipay.xyz](https://monipay.xyz) once you link your account.\n\n` +
      `_Feature note: Live claimable list coming in next update!_`,
      { parse_mode: 'Markdown' }
    );
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (query.data.startsWith('claim_guap_')) {
    const chain = query.data.replace('claim_guap_', '');
    const isCelo = chain.toLowerCase() === 'celo';

    let text = `🦁 *Secure the Bag, Blud!* 💸\n\nSomeone just sent you some guap via MagicPay! Here is how to claim it:\n\n`;

    if (isCelo) {
      text += `📱 *MiniPay Users:* (Recommended)\n1️⃣ Open MiniPay app\n2️⃣ Open the *Monipay* miniapp\n3️⃣ Click *Link Telegram*\n4️⃣ Claim your funds instantly!\n\n`;
      text += `🟢 *MoniPay Users:* Link your Telegram at [monipay.xyz](https://monipay.xyz) Settings.`;
    } else {
      text += `1️⃣ Go to [monipay.xyz](https://monipay.xyz)\n2️⃣ Open *Settings* → *MoniBot AI*\n3️⃣ Click *Link Telegram*\n4️⃣ Your funds will be waiting in your dashboard!`;
    }

    try {
      await bot.sendMessage(query.from.id, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
      await bot.answerCallbackQuery(query.id, { text: "Check your DMs for claim instructions!" });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, { text: "Please DM @monipaybot first so I can send instructions!", show_alert: true });
    }
    return;
  }

  if (query.data.startsWith('cancel_series_')) {
    const seriesId = query.data.replace('cancel_series_', '');
    const userId = String(query.from.id);
    const result = await cancelRecurringSeries(seriesId, userId, 'telegram');

    if (result.success) {
      await bot.answerCallbackQuery(query.id, { text: "Recurring series cancelled! 🚫" });
      await bot.sendMessage(query.message.chat.id, `✅ *Recurring Series Cancelled* (ID: \`${seriesId.substring(0,8)}\`). No further payments will be made for this series.`, { parse_mode: 'Markdown' });
    } else {
      await bot.answerCallbackQuery(query.id, { text: result.message || "Failed to cancel series.", show_alert: true });
    }
    return;
  }

  if (query.data.startsWith('set_chain_')) {
    const chain = query.data.replace('set_chain_', '');
    const profile = await getProfileByPlatformId('telegram', query.from.id);
    if (!profile) {
      await bot.answerCallbackQuery(query.id, { text: "Link your account first!", show_alert: true });
      return;
    }
    const { error } = await supabase.from('profiles').update({ preferred_network: chain }).eq('id', profile.id);
    if (error) {
      await bot.answerCallbackQuery(query.id, { text: "Update failed!", show_alert: true });
    } else {
      await bot.answerCallbackQuery(query.id, { text: `Success! Preferred chain: ${chain.toUpperCase()}` });
      // Refresh the settings menu
      await handleCallbackQuery(bot, { ...query, data: 'menu_settings' });
    }
    return;
  }

  await handleCallbackQuery(bot, query);
}
