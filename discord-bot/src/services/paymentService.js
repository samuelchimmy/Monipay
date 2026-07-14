/**
 * MoniBot Discord - Payment Service
 * Orchestrates payment execution with cross-chain fallback logic.
 * Eliminates duplicated retry/reroute code from command handlers.
 */

import { executeP2P, executeMagicPay, getAllowance, CHAIN_CONFIGS } from '../blockchain.js';
import { getChainConfig, getExplorerUrl, resolveToken, resolveChainName } from '../chains.js';
import { findAlternateChain } from '../crossChainCheck.js';
import { logMonibotTransaction, updateCommandStatus } from '../database.js';
import { createMagicPayRecord } from '../iou.js';
import { withNonceQueue } from '../nonceManager.js';
import { getSigmaError } from '../errors.js';
import { TX_TYPES } from '../constants.js';
import logger from '../logger.js';

const log = logger.child({ module: 'paymentService' });

/**
 * Execute a single payment (P2P or MagicPay) with cross-chain fallback.
 * 
 * @param {Object} params
 * @param {Object} params.senderProfile - Sender's profile from DB
 * @param {Object|null} params.recipientProfile - Recipient's profile (null for MagicPay)
 * @param {Object|null} params.recipientUser - Discord user object (for MagicPay)
 * @param {number} params.amount - Amount to send
 * @param {string} params.chain - Target chain
 * @param {string} params.commandId - Command ID for reference
 * @param {boolean} params.isMagicPay - Whether this is a MagicPay (social escrow) payment
 * @returns {Promise<Object>} { success, hash, fee, chain, rerouted, error }
 */
export async function executeSinglePayment({
  senderProfile,
  recipientProfile,
  recipientUser,
  amount,
  chain,
  commandId,
  isMagicPay,
}) {
  let activeChain = chain;

  try {
    const senderAddress = senderProfile.addresses[activeChain];
    const recipientAddress = isMagicPay ? null : recipientProfile.addresses[activeChain];

    const result = await withNonceQueue(activeChain, async () => {
      if (isMagicPay) {
        return await executeMagicPay(
          senderAddress,
          recipientUser.id,
          amount,
          activeChain
        );
      } else {
        return await executeP2P(
          senderAddress,
          recipientAddress,
          amount,
          commandId,
          activeChain
        );
      }
    });

    const hash = result.hash;
    const fee = result.fee || 0;

    // Sync MagicPay record to DB
    if (isMagicPay) {
      await syncMagicPayRecord(senderProfile, recipientUser, amount, activeChain, hash, result.iouId);
    }

    // Log to unified ledger
    await logMonibotTransaction({
      senderId: senderProfile.id,
      receiverId: isMagicPay ? null : recipientProfile.id,
      amount,
      fee,
      txHash: hash,
      type: isMagicPay ? TX_TYPES.MAGICPAY : TX_TYPES.P2P,
      payerPayTag: senderProfile.pay_tag,
      recipientPayTag: isMagicPay ? `discord:${recipientUser.id}` : recipientProfile.pay_tag,
      chain: activeChain.toUpperCase(),
    });

    return {
      success: true,
      hash,
      fee,
      chain: activeChain,
      rerouted: false,
      originalChain: chain,
      iouId: result.iouId,
    };
  } catch (error) {
    log.warn('Primary chain payment failed, attempting cross-chain fallback', {
      chain: activeChain,
      error: error.message,
      isMagicPay,
    });

    // Cross-chain fallback
    if (error.message.includes('ERROR_BALANCE') || error.message.includes('ERROR_ALLOWANCE')) {
      const fallbackResult = await attemptCrossChainFallback({
        senderProfile,
        recipientProfile,
        recipientUser,
        amount,
        originalChain: activeChain,
        commandId,
        isMagicPay,
      });

      if (fallbackResult) return fallbackResult;
    }

    // No fallback succeeded
    return {
      success: false,
      error: error.message,
      chain: activeChain,
      sigmaError: getSigmaError(error, isMagicPay ? 'magicpay' : 'p2p'),
    };
  }
}

/**
 * Attempt cross-chain fallback when primary chain fails.
 */
async function attemptCrossChainFallback({
  senderProfile,
  recipientProfile,
  recipientUser,
  amount,
  originalChain,
  commandId,
  isMagicPay,
}) {
  const context = isMagicPay ? 'magicpay' : 'p2p';
  const senderAddressForAlt = senderProfile.addresses[originalChain] || senderProfile.addresses.celo; // fallback to celo for search
  const alt = await findAlternateChain(senderAddressForAlt, amount, originalChain, context);

  if (!alt) {
    log.info('No alternate chain found with sufficient funds');
    return null;
  }

  if (alt.needsAllowance) {
    log.info('Alternate chain found but needs allowance', { chain: alt.chain });
    return {
      success: false,
      error: `Funds on ${alt.chain} but no allowance`,
      chain: alt.chain,
      sigmaError: getSigmaError('ERROR_ALLOWANCE', context) +
        `\n_(You have **${alt.balance.toFixed(2)} ${alt.symbol}** on ${alt.chain.toUpperCase()} but need to approve it first)_`,
      needsAllowance: true,
    };
  }

  // Execute on alternate chain
  try {
    const senderAddressAlt = senderProfile.addresses[alt.chain];
    const recipientAddressAlt = isMagicPay ? null : recipientProfile.addresses[alt.chain];

    const result = await withNonceQueue(alt.chain, async () => {
      if (isMagicPay) {
        return await executeMagicPay(
          senderAddressAlt,
          recipientUser.id,
          amount,
          alt.chain
        );
      } else {
        return await executeP2P(
          senderAddressAlt,
          recipientAddressAlt,
          amount,
          commandId,
          alt.chain
        );
      }
    });

    const hash = result.hash;
    const fee = result.fee || 0;

    // Sync MagicPay record
    if (isMagicPay) {
      await syncMagicPayRecord(senderProfile, recipientUser, amount, alt.chain, hash, result.iouId);
    }

    // Log to unified ledger
    await logMonibotTransaction({
      senderId: senderProfile.id,
      receiverId: isMagicPay ? null : recipientProfile.id,
      amount,
      fee,
      txHash: hash,
      type: isMagicPay ? TX_TYPES.MAGICPAY : TX_TYPES.P2P,
      payerPayTag: senderProfile.pay_tag,
      recipientPayTag: isMagicPay ? `discord:${recipientUser.id}` : recipientProfile.pay_tag,
      chain: alt.chain.toUpperCase(),
    });

    log.info('🔄 Cross-chain fallback succeeded', {
      from: originalChain,
      to: alt.chain,
      amount,
    });

    return {
      success: true,
      hash,
      fee,
      chain: alt.chain,
      rerouted: true,
      originalChain,
      iouId: result.iouId,
    };
  } catch (retryError) {
    log.error('Cross-chain fallback also failed', {
      chain: alt.chain,
      error: retryError.message,
    });
    return null;
  }
}

/**
 * Sync a MagicPay record to the database.
 */
async function syncMagicPayRecord(senderProfile, recipientUser, amount, chain, txHash, iouId) {
  try {
    const chainConfig = getChainConfig(chain);
    await createMagicPayRecord({
      senderProfileId: senderProfile.id,
      senderPayTag: senderProfile.pay_tag,
      senderSource: senderProfile.source,
      recipientUsername: recipientUser.username,
      platformUserId: recipientUser.id,
      amount,
      chain,
      token: chainConfig.tokenAddress,
      tokenSymbol: chainConfig.symbol,
      txHash,
      iouId,
    });
  } catch (dbErr) {
    log.error('MagicPay record sync failed', { error: dbErr.message });
  }
}
