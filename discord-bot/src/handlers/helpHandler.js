/**
 * MoniBot Discord - Help & Setup Command Handlers
 */

import { EmbedBuilder } from 'discord.js';
import { getHelpContent, getSetupContent } from '../../commands.js';
import { isPromoActive, getPromoFooter } from '../constants.js';

export async function handleHelp(message) {
  const helpContent = getHelpContent();
  const embed = new EmbedBuilder()
    .setTitle(helpContent.title)
    .setDescription(helpContent.description + '\n\n**MiniPay users:** your sends default to Celo (USDT).')
    .setColor(isPromoActive() ? 0xFFD700 : 0x0052FF)
    .setFooter({ text: isPromoActive() ? getPromoFooter() : helpContent.footer });

  helpContent.fields.forEach(f => embed.addFields(f));

  if (isPromoActive()) {
    embed.addFields({
      name: '🎉 June Celo Promo',
      value: [
        'To celebrate winning the **Celo Proof of Ship AI Track:**',
        '• All fees on Celo are waived through June 30',
        '• CasualPay users: request fee refunds at **monipay.xyz/support** with your tx hash',
        '• **$10 demo giveaway** for the first 5 communities that add MoniBot — message us at monipay.xyz/support to claim',
      ].join('\n'),
      inline: false,
    });
  }

  await message.reply({ embeds: [embed] });
}

export async function handleSetup(message) {
  const setupContent = getSetupContent();
  const embed = new EmbedBuilder()
    .setTitle(setupContent.title)
    .setDescription(setupContent.description)
    .setColor(0x0052FF)
    .setFooter({ text: setupContent.footer });

  setupContent.fields.forEach(f => embed.addFields(f));
  await message.reply({ embeds: [embed] });
}

export async function handleLink(message, getProfileByDiscordId) {
  const profile = await getProfileByDiscordId(message.author.id);

  if (profile) {
    const embed = new EmbedBuilder()
      .setTitle('Account Already Linked')
      .setDescription(`Your Discord is linked to **@${profile.pay_tag}**`)
      .setColor(0x00FF00);
    await message.reply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Link Your MoniPay Account')
    .setDescription('Connect your Discord to your MoniPay wallet:')
    .addFields(
      { name: 'Step 1', value: 'Go to [monipay.xyz](https://monipay.xyz)', inline: false },
      { name: 'Step 2', value: 'Open **Settings** → **MoniBot AI**', inline: false },
      { name: 'Step 3', value: 'Click **Link Discord** and authorize', inline: false },
    )
    .setColor(0x0052FF)
    .setFooter({ text: 'One-time setup. Then use MoniBot in any server!' });

  await message.reply({ embeds: [embed] });
}
