/**
 * Cross-Chain Balance Check (Celo-only)
 *
 * MoniPay is Celo-only, so there are no alternate chains to reroute to.
 * This export is preserved so existing callers keep working; the
 * alternate-chain search is now a no-op that always returns null.
 */

export async function findAlternateChain(walletAddress, amount, currentChain, context = 'p2p') {
  return null;
}
