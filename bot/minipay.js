/**
 * MiniPay Support Utilities
 */

/**
 * Enforce MiniPay chain restrictions for sender and recipient.
 */
export function enforceMiniPayChainRestriction(senderProfile, recipientProfile, chain) {
  // Check sender restriction (MiniPay sender must use Celo)
  if (senderProfile && senderProfile.source === 'wallet_profile' && chain !== 'celo') {
    return {
      valid: false,
      error: 'ERROR_MINIPAY_SENDER_CHAIN_RESTRICTION'
    };
  }

  // Check recipient restriction (MiniPay recipient must receive on Celo)
  if (recipientProfile && recipientProfile.source === 'wallet_profile' && chain !== 'celo') {
    return {
      valid: false,
      error: 'ERROR_MINIPAY_RECIPIENT_CHAIN_RESTRICTION'
    };
  }

  return { valid: true };
}

/**
 * Determine claim mode for MagicPay transactions.
 */
export function determineMagicPayClaimMode(senderProfile, chain) {
  // Mandatory claim mode for MiniPay sender on Celo