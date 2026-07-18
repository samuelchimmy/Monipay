import { getProfileByPlatformId } from '../../shared/database.js';

export async function handleLink(bot, msg) {
  const profile = await getProfileByPlatformId('telegram', String(msg.from.id));

  if (profile) {
    const source = profile.source === 'wallet_profile' ? ' _(MiniPay)_' : '';
    await bot.sendMessage(
      msg.chat.id,
      `✅ Your Telegram is linked to *@${profile.pay_tag}*${source}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await bot.sendMessage(
    msg.chat.id,
    `🔗 *Link Your Account to MoniBot*\n\n` +
    `*Option A — MoniPay users* (Base, BSC, Celo, Ink, Solana)\n` +
    `1️⃣ Go to [monipay.xyz](https://monipay.xyz)\n` +
    `2️⃣ Open *Settings* → *MoniBot AI*\n` +
    `3️⃣ Click *Link Telegram*\n` +
    `4️⃣ Enter your Telegram ID: \`${msg.from.id}\`\n\n` +
    `*Option B — MiniPay users* (Celo only)\n` +
    `1️⃣ Open the *MiniPay* mobile app\n` +
    `2️⃣ Find the *Monipay* miniapp\n` +
    `3️⃣ Go to *Link Telegram*\n` +
    `4️⃣ Enter your Telegram ID: \`${msg.from.id}\`\n\n` +
    '_One-time setup. Then tip and pay anyone in any group!_',
    { parse_mode: 'Markdown', disable_web_page_preview: true }
  );
}
