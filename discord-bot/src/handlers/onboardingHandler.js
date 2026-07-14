/**
 * MoniBot Discord - Onboarding Handler
 * Provides interactive guidance for unlinked users.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Sends the onboarding interactive message to unlinked users.
 * @param {import('discord.js').Message|import('discord.js').CommandInteraction} messageOrInteraction
 */
export async function sendOnboarding(messageOrInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('👋 MoniBot is here to Rizz your server! ⚡')
    .setDescription(
      "It looks like you're not linked to a MoniPay account yet. No cap, you're missing out on the most Sigma way to slide guap on Discord. 🗿\n\n" +
      "**MoniBot** is your autonomous AI payment agent. Just tell me who to pay, and I handle the boring crypto stuff for you. 🪄\n\n" +
      "💡 **Sigma Move:** You can use me in **Direct Messages**! Just slide into my DMs and send commands like `@alice $5` or `Balance` without any prefix. No cap, it's goated. 🤫"
    )
    .setColor(0x0052FF)
    .setFooter({ text: 'MoniBot: Certified Sigma Energy • monipay.xyz' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('info_what_is_monipay')
        .setLabel('🤔 What is MoniPay?')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_how_ai_works')
        .setLabel('🤖 How the AI works')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_faq')
        .setLabel('📖 FAQ')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('info_more_features')
        .setLabel('✨ More Features')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('info_get_started')
        .setLabel('🚀 Get Started')
        .setStyle(ButtonStyle.Success)
    );

  const payload = { embeds: [embed], components: [row] };

  if (messageOrInteraction.reply) {
    // If we've already replied or it's an interaction, we might need a different method
    // but for MessageCreate it's fine.
    try {
      await messageOrInteraction.reply(payload);
    } catch (e) {
      // Fallback for interactions that might be expired or already deferred
      if (messageOrInteraction.channel) {
        await messageOrInteraction.channel.send(payload);
      }
    }
  } else if (messageOrInteraction.send) {
    await messageOrInteraction.send(payload);
  }
}
