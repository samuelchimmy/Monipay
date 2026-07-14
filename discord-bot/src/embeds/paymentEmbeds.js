/**
 * MoniBot Discord - Payment Embed Builders
 * Constructs Discord embed messages for payment results.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getExplorerUrl, getTestnetWarning, resolveToken, resolveChainName, getChainConfig } from '../chains.js';
import { CHAIN_CONFIGS } from '../blockchain.js';
import { SUCCESS_PHRASES, MAGIC_PAY_PHRASES, getRandomPhrase, isPromoActive } from '../constants.js';

/**
 * Build success embed for a single payment.
 */
export function buildPaymentSuccessEmbed({
  amount,
  fee,
  chain,
  hash,
  recipientLabel,
  isMagicPay,
  rerouted,
  originalChain,
  aiReply,
  senderSource,
  feedbackUrl = null,
}) {
  const chainConfig = getChainConfig(chain);
  const explorerUrl = getExplorerUrl(chain, hash);
  const symbol = resolveToken(chain);

  let title;
  if (rerouted) {
    title = isMagicPay
      ? getRandomPhrase(MAGIC_PAY_PHRASES)
      : `${getRandomPhrase(SUCCESS_PHRASES)} (Smart Routed)`;
  } else {
    title = isMagicPay
      ? getRandomPhrase(MAGIC_PAY_PHRASES)
      : getRandomPhrase(SUCCESS_PHRASES);
  }

  let description = aiReply || (rerouted
    ? `Smart-routed from **${resolveChainName(originalChain)}** to **${resolveChainName(chain)}**. **$${amount.toFixed(2)} ${symbol}** delivered to **${recipientLabel}**.`
    : `Sent **$${amount.toFixed(2)} ${symbol}** to **${recipientLabel}** on **${resolveChainName(chain)}**.`
  );

  if (isMagicPay) {
    if (chain === 'celo' && senderSource === 'wallet_profile') {
      description += `\n\n**They need to claim it:**\n1. Install MiniPay (Opera or standalone)\n2. Open the MoniPay mini-app\n3. Link this Discord account\n4. Funds drop into their wallet automatically.`;
    } else if (chain === 'celo' && senderSource === 'profile') {
      description += `\n\nThey can claim by linking Discord on monipay.xyz, or by opening the MoniPay mini-app inside MiniPay.`;
    } else {
      description += `\n\nSecurely claim your funds at monipay.xyz by creating a Monipay account and connecting your Discord account.`;
    }
  }

  // During promo, Celo MagicPay contract fee is waived — show $0.00
  const displayFee = (isPromoActive() && chain === 'celo') ? 0 : (fee || 0);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: 'Amount', value: `$${amount.toFixed(2)} ${chainConfig.symbol}`, inline: true },
      { name: 'Fee', value: `$${displayFee.toFixed(4)}`, inline: true },
      { name: 'To', value: isMagicPay ? `${recipientLabel} (MagicPay)` : recipientLabel, inline: true },
    )
    .setColor(0x00FF00);

  if (rerouted) {
    embed.addFields({ name: 'Route', value: `${originalChain} → ${chain.toUpperCase()}`, inline: true });
  }

  embed.addFields({ name: 'TX', value: `[View on Explorer](${explorerUrl})\n\`${hash}\``, inline: false });

  if (feedbackUrl) {
    embed.addFields({
      name: '📈 Aura Boost',
      value: `Enjoying the Sigma speed? [Leave a quick rating for this transaction](${feedbackUrl}) to boost your Aura!`,
      inline: false,
    });
    const footerText = senderSource === 'wallet_profile'
      ? 'via MiniPay on Celo | MoniBot: The Most Sigma Payment AI 🗿'
      : 'MoniBot: The Most Sigma Payment AI 🗿';
    embed.setFooter({ text: footerText });
  } else if (senderSource === 'wallet_profile') {
    embed.setFooter({ text: `via MiniPay on Celo` });
  }


  // Promo: zero fees on Celo (MagicPay contract), rebates on other chains
  if (isPromoActive()) {
    if (chain === 'celo') {
      embed.addFields({
        name: '🎉 June Celo Promo',
        value: 'All fees on Celo are waived through June 30. Celebrating our Celo Proof of Ship AI Track win!',
        inline: false,
      });
    } else if (fee && fee > 0) {
      embed.addFields({
        name: '🎉 June Celo Promo — Fee Refund',
        value: `CasualPay users: request a refund for your **$${fee.toFixed(4)}** fee at [monipay.xyz/support](https://monipay.xyz/support) with your tx hash. Valid through June 30.`,
        inline: false,
      });
    }
  }

  const testnetWarn = getTestnetWarning(chain);
  if (testnetWarn) {
    embed.addFields({ name: 'Testnet', value: testnetWarn, inline: false });
  }

  if (isMagicPay) {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('magicpay_claim')
          .setLabel('Claim My Guap 💸')
          .setStyle(ButtonStyle.Success)
      );
    return { embeds: [embed], components: [row] };
  }

  return { embeds: [embed] };
}

/**
 * Build multi-send results embed.
 */
export function buildMultiSendResultsEmbed({ results, totalRecipients, hasMagicPay, chain, senderSource }) {
  const successCount = results.filter(r => r.status === 'success').length;

  const embed = new EmbedBuilder()
    .setTitle(successCount === totalRecipients ? getRandomPhrase(SUCCESS_PHRASES) : 'Multi-Send Results')
    .setDescription(`${successCount}/${totalRecipients} transfers completed`)
    .setColor(successCount === totalRecipients ? 0x00FF00 : 0xFFA500);

  if (hasMagicPay) {
    let magicPayValue = "Securely claim your funds at monipay.xyz by creating a Monipay account and connecting your Discord account.";
    if (chain === 'celo' && senderSource === 'wallet_profile') {
      magicPayValue = "**Recipients need to claim:**\n1. Install MiniPay\n2. Open MoniPay mini-app\n3. Link Discord\n4. Funds arrive automatically.";
    } else if (chain === 'celo' && senderSource === 'profile') {
      magicPayValue = "Recipients can claim by linking Discord on monipay.xyz, or by opening the MoniPay mini-app inside MiniPay.";
    }

    embed.addFields({
      name: 'MagicPay',
      value: magicPayValue,
      inline: false,
    });
  }

  if (senderSource === 'wallet_profile') {
    embed.setFooter({ text: `via MiniPay on Celo` });
  }

  if (isPromoActive()) {
    embed.addFields({
      name: '🎉 June Promo',
      value: chain === 'celo'
        ? 'All fees on Celo are waived through June 30 — celebrating our Celo Proof of Ship AI Track win!'
        : 'CasualPay users: request fee refunds at [monipay.xyz/support](https://monipay.xyz/support) with your tx hash. Valid through June 30.',
      inline: false,
    });
  }

  results.forEach(r => {
    const reroute = r.rerouted ? ` _(${r.originalChain}→${r.chain})_` : '';
    const explorer = r.hash ? getExplorerUrl(r.chain || chain, r.hash) : '';
    embed.addFields({
      name: r.label,
      value: r.status === 'success'
        ? `[View TX](${explorer})${reroute}\n\`${r.hash}\`${r.isMagicPay ? ' (MagicPay)' : ''}`
        : `${r.reason}`,
      inline: true,
    });
  });

  if (hasMagicPay) {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('magicpay_claim')
          .setLabel('Claim My Guap 💸')
          .setStyle(ButtonStyle.Success)
      );
    return { embeds: [embed], components: [row] };
  }

  return { embeds: [embed] };
}

/**
 * Build giveaway announcement embed.
 */
export function buildGiveawayEmbed({ senderPayTag, amount, maxParticipants, totalBudget }) {
  return new EmbedBuilder()
    .setTitle('MoniBot Giveaway!')
    .setDescription(`**@${senderPayTag}** is giving away **$${amount}** each to the first **${maxParticipants}** people!`)
    .addFields(
      { name: 'Per Person', value: `$${amount}`, inline: true },
      { name: 'Spots', value: `${maxParticipants}`, inline: true },
      { name: 'Total', value: `$${totalBudget.toFixed(2)}`, inline: true },
      { name: 'How to Claim', value: 'Drop your **@MoniTag** below!', inline: false },
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'First come, first served! Must have a MoniPay account.' });
}

/**
 * Build giveaway end embed.
 */
export function buildGiveawayEndEmbed({ claimedCount, maxParticipants, reason }) {
  return new EmbedBuilder()
    .setTitle(reason === 'limit' ? `${getRandomPhrase(SUCCESS_PHRASES)} Giveaway Ended!` : 'Giveaway Ended')
    .setDescription(`**${claimedCount}/${maxParticipants}** spots claimed.`)
    .setColor(reason === 'limit' ? 0x00FF00 : 0xFFA500)
    .setFooter({
      text: reason === 'limit' ? 'All spots filled!'
        : reason === 'funds' ? 'Sender ran out of funds'
        : 'Time expired'
    });
}
