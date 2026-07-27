/**
 * MoniBot Worker - Cross-Chain Balance Check (Celo-only)
 *
 * SINGLE SOURCE OF TRUTH: chains.js
 * MoniPay is Celo-only, so there are no alternate chains to reroute to.
 * These exports are preserved so existing callers keep working; the
 * alternate-chain search is now a no-op that always returns null.
 */

/**
 * Find an alternate chain with sufficient funds. Celo-only: no alternates exist.
 * @returns {Promise<null>}
 */
export async function findAlternateChain(walletAddress, amount, currentChain, context = 'p2p') {
  return null;
}

/**
 * Legacy wrapper — retained for backward compatibility. Celo-only: no BSC.
 */
export async function checkBscFunds(walletAddress, amount) {
  return {
    hasBalance: false,
    hasAllowance: false,
    balance: 0,
    chain: 'celo',
    symbol: 'USDT',
  };
}

