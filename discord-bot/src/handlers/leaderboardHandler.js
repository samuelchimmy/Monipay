/**
 * MoniBot Discord - Guild Leaderboard Handler
 */

import { EmbedBuilder } from 'discord.js';
import { getGuildLeaderboard } from '../database.js';

export async function handleLeaderboard(message) {
  if (!message.guild) {
    return message.reply("Leaderboards are only available in server guilds. Add me to your server to start competing! 🗿");
  }

  try {
    const topSigmas = await getGuildLeaderboard(message.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${message.guild.name} Aura Leaderboard`)
      .setDescription('Who has the most W Aura in the server? (Top Tip Volume) 📈')
      .setColor(0xFFD700)
      .setFooter({ text: 'Powered by MoniPay • Certified Sigma Move' });

    if (topSigmas.length === 0) {
      embed.setDescription("The leaderboard is currently empty. Start sliding guap to claim your spot as the Top G! 💸");
    } else {
      const list = topSigmas.map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        return `${medal} **<@${entry.userId}>**: $${entry.volume.toFixed(2)}`;
      }).join('\n');

      embed.addFields({ name: 'Top Sigmas', value: list });
    }

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Leaderboard error:', error);
    await message.reply("Failed to fetch leaderboard. Please try again later.");
  }
}
