/**
 * MoniBot Discord - Feedback Service
 * Handles ERC-8004 feedback prompts for successful transactions.
 */

import { EmbedBuilder } from 'discord.js';
import { checkFeedbackEligibility, logFeedbackPrompt } from '../database.js';
import logger from '../logger.js';

const log = logger.child({ module: 'feedbackService' });

/**
 * Mapping for ERC-8004 chain parameters.
 */
const AGENT_ID_MAP = {
  base: '51818',
  bsc: '96451',
  celo: '9103',
};

/**
 * Send a feedback prompt if the user is eligible.
 * @param {import('discord.js').Message|import('discord.js').TextChannel} target - Where to send the prompt
 * @param {string} txHash - Transaction hash
 * @param {string} chain - Blockchain network slug
 * @param {string} profileId - MoniPay profile UUID
 */
export async function sendFeedbackPrompt(target, txHash, chain, profileId) {
  try {
    if (!profileId || !txHash) return;

    // Check eligibility
    const eligible = await checkFeedbackEligibility(profileId);
    if (!eligible) return;

    const chainSlug = chain?.toLowerCase() || 'base';
    const agentId = AGENT_ID_MAP[chainSlug] || '51818';
    const feedbackUrl = `https://8004scan.io/agents/${chainSlug}/${agentId}?score=5&tx=${txHash}`;

    const embed = new EmbedBuilder()
      .setDescription(`Enjoying the Sigma speed? [Leave a quick rating for this transaction](${feedbackUrl}) to boost your Aura! 📈`)
      .setColor(0x00FF00)
      .setFooter({ text: 'MoniBot: The Most Sigma Payment AI 🗿' });

    // Handle both Message (reply) and Channel (send) targets
    if (typeof target.reply === 'function') {
      await target.reply({ embeds: [embed] });
    } else if (typeof target.send === 'function') {
      await target.send({ embeds: [embed] });
    }

    // Log the prompt
    await logFeedbackPrompt(profileId, txHash);
    log.info('Feedback prompt sent', { profileId, txHash, chain });
  } catch (err) {
    log.error('Failed to send feedback prompt', { error: err.message, profileId, txHash });
  }
}

/**
 * Check eligibility and return feedback URL, logging the prompt in the database.
 * @param {string} profileId - User profile ID
 * @param {string} txHash - Transaction hash
 * @param {string} chain - Network slug
 * @returns {Promise<string|null>} - Feedback URL or null
 */
export async function getFeedbackUrlIfEligible(profileId, txHash, chain) {
  try {
    if (!profileId || !txHash) return null;

    const eligible = await checkFeedbackEligibility(profileId);
    if (!eligible) return null;

    const chainSlug = chain?.toLowerCase() || 'base';
    const agentId = AGENT_ID_MAP[chainSlug] || '51818';
    const feedbackUrl = `https://8004scan.io/agents/${chainSlug}/${agentId}?score=5&tx=${txHash}`;

    // Log the prompt
    await logFeedbackPrompt(profileId, txHash);
    log.info('Feedback prompt URL generated', { profileId, txHash, chain });

    return feedbackUrl;
  } catch (err) {
    log.error('Failed to get feedback URL', { error: err.message, profileId, txHash });
    return null;
  }
}

