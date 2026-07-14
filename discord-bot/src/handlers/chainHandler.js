/**
 * MoniBot Discord - Set Chain Command Handler
 */

import { PermissionsBitField } from 'discord.js';
import { CHAIN_CONFIGS, resolveChainName } from '../chains.js';
import { updateServerChain, getProfileByDiscordId, updateUserPreferredNetwork } from '../database.js';
import { SUPPORTED_CHAINS } from '../constants.js';
import { sendOnboarding } from './onboardingHandler.js';

export async function handleSetChain(message, command) {
  const chain = command.chain?.toLowerCase();
  if (!chain || !SUPPORTED_CHAINS.includes(chain)) {
    await message.reply(`\`${chain || 'unknown'}\` is not a supported network. Try: ${SUPPORTED_CHAINS.join(', ')}.`);
    return;
  }

  // Handle DM / User Preference
  if (!message.guild) {
    const senderProfile = await getProfileByDiscordId(message.author.id);
    if (!senderProfile) {
      await sendOnboarding(message);
      return;
    }

    const success = await updateUserPreferredNetwork(senderProfile.id, senderProfile.source, chain);
    if (success) {
      await message.reply(`Your preferred network is now set to **${resolveChainName(chain)}**.`);
    } else {
      await message.reply("Failed to update your preferred network. Please try again.");
    }
    return;
  }

  // Handle Server Config
  const isOwner = message.author.id === message.guild.ownerId;
  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  if (!isOwner && !isAdmin) {
    await message.reply("Only Server Admins can change the default chain.");
    return;
  }

  const success = await updateServerChain(message.guild.id, chain);
  if (success) {
    await message.reply(`This server's default chain is now **${resolveChainName(chain)}**.`);
  } else {
    await message.reply("Failed to update server settings. Please try again.");
  }
}
