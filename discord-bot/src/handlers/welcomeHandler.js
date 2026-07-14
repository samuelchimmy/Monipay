/**
 * MoniBot Discord - Welcome Message Handler
 * Sends welcome message when the bot joins a new server.
 */

import { EmbedBuilder, AttachmentBuilder, PermissionsBitField } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { INTERVALS, isPromoActive, getPromoBanner } from '../constants.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = logger.child({ module: 'welcome' });

// Track last welcome timestamp per guild to prevent duplicate events
// Key: guildId, Value: timestamp (ms)
const lastWelcomeSent = new Map();

/**
 * Check if we should send a welcome message to this guild.
 * Returns true if no welcome sent in the last 60 seconds.
 */
export function shouldSendWelcome(guildId) {
  const lastSent = lastWelcomeSent.get(guildId);
  if (!lastSent) return true;

  const elapsed = Date.now() - lastSent;
  return elapsed >= 60000; // 1 minute guard against duplicate gateway events
}

/**
 * Record that we sent a welcome message to a guild.
 */
function recordWelcomeSent(guildId) {
  lastWelcomeSent.set(guildId, Date.now());
}

/**
 * Builds and sends the MoniBot welcome embed to the most appropriate channel in a guild.
 * Priority: systemChannel → #general/#welcome/#announcements → first writable text channel → DM to owner.
 *
 * @param {import('discord.js').Guild} guild
 */
export async function sendWelcomeMessage(guild) {
  // Check duplicate guard
  if (!shouldSendWelcome(guild.id)) {
    log.info('Skipping welcome (duplicate event guard active)', { guild: guild.name, guildId: guild.id });
    return;
  }

  // Build the banner attachment
  const bannerPath = path.join(__dirname, '..', '..', 'assets', 'monibot_discord.png');
  let attachment = null;
  try {
    attachment = new AttachmentBuilder(bannerPath, { name: 'monibot_discord.png' });
  } catch (err) {
    log.warn('Could not load banner image', { error: err.message });
  }

  // Build the embed
  const promoBanner = getPromoBanner();
  const welcomeEmbed = new EmbedBuilder()
    .setTitle('Thanks for adding MoniBot!')
    .setDescription(
      [
        ...(promoBanner ? [promoBanner, ''] : []),
        '## Meet MoniBot',
        '**MoniBot** is MoniPay\'s autonomous payment agent — send stablecoins to anyone on Discord using plain English, no crypto knowledge needed.',
        '',
        '## Who can use MoniBot?',
        '**MoniPay users** (Base · BSC · Ink · Solana · Tempo · Celo)',
        '> Visit **[monipay.xyz](https://monipay.xyz)** → create a MoniTag → fund your wallet → Settings → MoniBot AI & Automation → Link Discord → Set Allowance',
        '',
        '**MiniPay users**',
        '> Open the **MiniPay mobile app** → MoniPay MiniApp → Link Discord → Approve Spending Allowance.',
        '> Start tipping on Discord.',
        '',
        '## Example Commands',
        '```',
        '!monibot send $50 to @Jesse',
        '!monibot send $50 to the first person to drop their monitag',
        '!monibot send $10 each to @Jesse & @jade',
        '!monibot send $5 to @Jesse in 5 mins',
        '!monibot send $1 to @alice every day 5 times',
        '!monibot send $20 to @alice on celo',
        '!monibot balance',
        '!monibot help',
        '```',
        '',
        '> 💡 Recipients don\'t need a MoniPay account — MagicPay holds funds until they claim.',
      ].join('\n')
    )
    .setColor(isPromoActive() ? 0xFFD700 : 0x0066FF)
    .setURL('https://monipay.xyz')
    .setFooter({ text: isPromoActive() ? '🎉 June Promo Active — Zero Celo Fees · Fee Rebates · monipay.xyz' : 'Powered by MoniPay • monipay.xyz' });

  if (attachment) {
    welcomeEmbed.setImage('attachment://monibot_discord.png');
  }

  const messagePayload = attachment
    ? { embeds: [welcomeEmbed], files: [attachment] }
    : { embeds: [welcomeEmbed] };

  // Required permissions
  const REQUIRED_PERMS = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
  ];

  function botCanPost(ch) {
    if (ch.type !== 0) return false;
    const perms = ch.permissionsFor(guild.members.me);
    if (!perms) return false;
    return REQUIRED_PERMS.every(p => perms.has(p));
  }

  // Channel selection (priority order)
  let targetChannel = null;

  // 1. System channel
  if (guild.systemChannel && botCanPost(guild.systemChannel)) {
    targetChannel = guild.systemChannel;
  }

  // 2. Named fallback channels
  if (!targetChannel) {
    const preferredNames = ['general', 'welcome', 'announcements'];
    for (const name of preferredNames) {
      const found = guild.channels.cache.find(
        ch => ch.type === 0 && ch.name.toLowerCase().includes(name) && botCanPost(ch)
      );
      if (found) {
        targetChannel = found;
        break;
      }
    }
  }

  // 3. First writable text channel
  if (!targetChannel) {
    const firstAvailable = guild.channels.cache
      .filter(ch => botCanPost(ch))
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .first();
    if (firstAvailable) {
      targetChannel = firstAvailable;
    }
  }

  // 4. Send to channel if found
  if (targetChannel) {
    try {
      await targetChannel.send(messagePayload);
      recordWelcomeSent(guild.id);
      log.info('Welcome message sent', { guild: guild.name, channel: targetChannel.name });
      return;
    } catch (err) {
      log.error('Failed to send welcome', { guild: guild.name, channel: targetChannel.name, error: err.message });
    }
  }

  // 5. Last resort — DM the server owner
  log.warn('No accessible channel, DMing owner', { guild: guild.name });
  try {
    const owner = await guild.fetchOwner();
    const ownerEmbed = new EmbedBuilder()
      .setTitle('Thanks for adding MoniBot!')
      .setDescription(
        "**Heads up:** I couldn't find a channel to post in on your server. Please give MoniBot permission to send messages in at least one channel so I can greet your community!\n\n" +
        welcomeEmbed.data.description
      )
      .setColor(0x0066FF)
      .setFooter({ text: 'Powered by MoniPay • monipay.xyz' });

    const ownerPayload = attachment
      ? { embeds: [ownerEmbed], files: [attachment] }
      : { embeds: [ownerEmbed] };

    await owner.send(ownerPayload);
    recordWelcomeSent(guild.id);
    log.info('Welcome DM sent to owner', { guild: guild.name });
  } catch (dmErr) {
    log.error('Could not DM server owner', { guild: guild.name, error: dmErr.message });
  }
}
