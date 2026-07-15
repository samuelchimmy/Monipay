/**
 * MoniBot Discord - Conversational AI Chat Handler
 */

import { EmbedBuilder } from 'discord.js';
import { aiChat } from '../../ai.js';
import logger from '../logger.js';

const log = logger.child({ module: 'chatHandler' });

export async function handleChat(message, text) {
  try {
    await message.channel.sendTyping();
    const reply = await aiChat(text, message.author.username, 'discord');

    if (reply) {
      const isDM = !message.guild;
      const prefixHint = isDM ? "" : "`!monibot ` ";
      const embed = new EmbedBuilder()
        .setDescription(reply)
        .setColor(0x0052FF)
        .setFooter({ text: `MoniBot AI${isDM ? ' · No prefix needed in DMs' : ''}` });
      await message.reply({ embeds: [embed] });
    } else {
      const isDM = !message.guild;
      const prefix = isDM ? "" : "!monibot ";
      await message.reply(`I'm MoniBot! Try commands like \`${prefix}send $5 to @alice\` or \`${prefix}help\`.${isDM ? "\n\n🤫 **Note:** No prefix needed in this chat!" : ""}`);
    }
  } catch (e) {
    log.error('Chat handler error', { error: e.message });
    const isDM = !message.guild;
    const prefix = isDM ? "" : "!monibot ";
    await message.reply(`I'm MoniBot! Try \`${prefix}help\` to see what I can do.${isDM ? "\n\n🤫 **Note:** No prefix needed in this chat!" : ""}`);
  }
}
