/**
 * MoniBot Discord - Allowance Check Middleware
 * Pre-flight check for on-chain spending allowance before payment attempts.
 */

import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { getAllowance } from '../blockchain.js';
import { getChainConfig } from '../chains.js';
import logger from '../logger.js';

const log = logger.child({ module: 'allowanceCheck' });

/**
 * Checks a user's on-chain allowance before a payment attempt.
 * Returns { ok: true } if allowance is sufficient.
 * Returns { ok: false, message } with a user-facing warning if it is not.
 *
 * @param {string} walletAddress
 * @param {number} amount
 * @param {string} chain
 * @param {string} context - 'p2p' or 'magicpay'
 * @param {Object} senderProfile - The normalized sender profile
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function checkAllowance(walletAddress, amount, chain, context = 'p2p', senderProfile = null) {
  try {
    let allowance;
    const config = getChainConfig(chain);

    // MiniPay uses bot_allowance_amount from DB (works for both but critical for MiniPay)
    if (senderProfile?.bot_allowance_amount !== undefined && senderProfile.bot_allowance_amount !== null) {
      allowance = senderProfile.bot_allowance_amount;
    } else if (context === 'magicpay' && config?.magicPayAddress) {
      const rpc = config.rpcs[0];
      const publicClient = createPublicClient({ transport: http(rpc) });
      const allowanceUnits = await publicClient.readContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [walletAddress, config.magicPayAddress],
      });
      allowance = parseFloat(formatUnits(allowanceUnits, config.decimals));
    } else {
      allowance = (await getAllowance(walletAddress, chain)).allowance;
    }

    if (allowance < amount) {
      const chainLabel = chain.toUpperCase();
      const message =
        `**Allowance too low on ${chainLabel}.**\n` +
        `Your current approved spending limit is **$${allowance.toFixed(2)}** but you're trying to send **$${amount.toFixed(2)}**.\n\n` +
        `Please increase your allowance at [monipay.xyz](https://monipay.xyz) → **Settings → MoniBot AI & Automation** before sending.`;
      return { ok: false, message };
    }

    return { ok: true };
  } catch (err) {
    // If the allowance check itself fails (e.g. RPC error), log as warning
    // but do NOT allow through — this prevents wasted gas on failed transactions
    log.warn('Allowance check RPC failed', {
      wallet: walletAddress,
      chain,
      error: err.message,
    });
    return {
      ok: false,
      message: `**Could not verify your allowance on ${chain.toUpperCase()}.**\nThe network may be temporarily unavailable. Please try again in a moment.`,
    };
  }
}
