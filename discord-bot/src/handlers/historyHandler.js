/**
 * MoniBot Discord - History & Claimable Handler
 */

import { EmbedBuilder } from 'discord.js';
import { getTransactionHistory, getClaimableIOUs, getProfileByDiscordId } from '../database.js';
import { resolveChainName, resolveToken } from '../chains.js';

export async function handleHistory(interaction) {
  const profile = await getProfileByDiscordId(interaction.user.id);
  if (!profile) {
    return interaction.reply({ content: "You need to link your account first.", ephemeral: true });
  }

  const history = await getTransactionHistory(profile.id);

  const embed = new EmbedBuilder()
    .setTitle('📜 Recent Transaction History')
    .setColor(0x0052FF)
    .setFooter({ text: `@${profile.pay_tag}'s Aura Log` });

  if (history.length === 0) {
    embed.setDescription("No recent activity found. Start sliding guap to build your history! 💸");
  } else {
    const list = history.map(tx => {
      const isSender = tx.sender_id === profile.id;
      const typeIcon = isSender ? '📤' : '📥';
      const verb = isSender ? 'Slid' : 'Received';
      const otherPart = isSender ? tx.recipient_pay_tag : tx.payer_pay_tag;
      const amountStr = `**$${Number(tx.amount).toFixed(2)}**`;
      const date = new Date(tx.created_at).toLocaleDateString();
      const sigmaNote = isSender ? ' (W Aura)' : ' (Bussin)';

      return `${typeIcon} ${verb} ${amountStr} to/from **${otherPart}** on ${tx.chain} ${sigmaNote} _(${date})_`;
    }).join('\n');

    embed.setDescription(list);
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export async function handleClaimable(interaction) {
  const ious = await getClaimableIOUs(interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle('🪄 Pending MagicPay IOUs')
    .setColor(0x00FF00)
    .setFooter({ text: 'Claim your funds at monipay.xyz' });

  if (ious.length === 0) {
    embed.setDescription("You have no pending funds in the Shadow Realm. 🏜️");
  } else {
    const totalClaimable = ious.reduce((sum, iou) => sum + Number(iou.amount), 0);
    embed.setDescription(`You have **${ious.length}** pending payments waiting for you!\nTotal value: **$${totalClaimable.toFixed(2)}**`);

    const list = ious.map(iou => {
      return `• **$${Number(iou.amount).toFixed(2)}** from **${iou.sender_pay_tag || 'Unknown'}** on ${resolveChainName(iou.chain)}`;
    }).join('\n');

    embed.addFields({ name: 'Details', value: list });
    embed.addFields({ name: 'How to Claim', value: '1. Visit [monipay.xyz](https://monipay.xyz)\n2. Link this Discord account\n3. Your Aura will teleport to your wallet automatically. 🪄' });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
