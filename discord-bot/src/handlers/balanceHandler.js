/**
 * MoniBot Discord - Balance Command Handler
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getBalance, getAllBalances } from '../blockchain.js';
import { resolveToken, resolveChainName } from '../chains.js';
import { getProfileByDiscordId, getServerConfig, getPendingScheduledJobsForUser } from '../database.js';
import { DEFAULT_CHAIN, isPromoActive } from '../constants.js';
import { sendOnboarding } from './onboardingHandler.js';

export async function handleBalance(message, command) {
  const senderProfile = await getProfileByDiscordId(message.author.id);
  if (!senderProfile) {
    await sendOnboarding(message);
    return;
  }

  const serverConfig = message.guild ? await getServerConfig(message.guild.id) : { default_chain: DEFAULT_CHAIN, chain_locked: false };
  // MiniPay wallets are Celo-only — default to celo regardless of server config
  const miniPayDefault = senderProfile.source === 'wallet_profile' ? 'celo' : null;
  const chain = command.chain || miniPayDefault || senderProfile.preferred_network || serverConfig.default_chain || DEFAULT_CHAIN;

  const walletAddress = senderProfile.addresses[chain];
  if (!walletAddress) {
    await message.reply(`Your wallet address for ${resolveChainName(chain)} is missing.`);
    return;
  }

  const allBalances = await getAllBalances(senderProfile.addresses);
  const totalBalance = allBalances.reduce((sum, b) => sum + b.balance, 0);

  const embed = new EmbedBuilder()
    .setTitle('Your Sigma Portfolio 🗿')
    .setDescription(`Total Aura Value: **$${totalBalance.toFixed(2)}**`)
    .setColor(isPromoActive() ? 0xFFD700 : 0x0052FF)
    .setFooter({
      text: isPromoActive()
        ? `@${senderProfile.pay_tag} · 🎉 June Promo: Zero Celo fees · Fee rebates on all chains`
        : `@${senderProfile.pay_tag}`,
    });

  // Add asset breakdown
  const breakdown = allBalances
    .map(b => `• **${b.balance.toFixed(2)} ${b.symbol}** on ${resolveChainName(b.chain)}`)
    .join('\n');

  embed.addFields({ name: '💰 Asset Breakdown', value: breakdown || 'No funds found. Top up to stop being an NPC. 🤖' });

  // Add Scheduled Payments if any
  const scheduledJobs = await getPendingScheduledJobsForUser(message.author.id);
  if (scheduledJobs && scheduledJobs.length > 0) {
    const jobList = scheduledJobs
      .slice(0, 5)
      .map(j => {
        const date = new Date(j.scheduled_at);
        const amount = j.payload?.command?.amount || j.payload?.amount || '?';
        const recipients = j.payload?.command?.recipients || j.payload?.recipients || [];
        const frequency = j.payload?.recurrenceRule ? ` (every ${j.payload.recurrenceRule})` : '';
        return `• **$${amount}** to ${recipients.map(r => `@${r}`).join(', ')} on <t:${Math.floor(date.getTime() / 1000)}:d>${frequency}`;
      })
      .join('\n');

    const more = scheduledJobs.length > 5 ? `\n_...and ${scheduledJobs.length - 5} more_` : '';
    embed.addFields({ name: '⏳ Active Scheduled Payments', value: jobList + more });
  }

  if (isPromoActive()) {
    embed.addFields({
      name: '� June Celo Promo',
      value: chain === 'celo'
        ? 'All fees on Celo are waived through June 30 — celebrating our Celo Proof of Ship AI Track win!'
        : 'CasualPay users: request fee refunds at monipay.xyz/support with your tx hash. Valid through June 30.',
      inline: false,
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('history_view')
        .setLabel('📜 History')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('history_claimable')
        .setLabel('🪄 Claimable')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('info_get_started')
        .setLabel('➕ Top Up')
        .setStyle(ButtonStyle.Success)
    );

  await message.reply({ embeds: [embed], components: [row] });
}
