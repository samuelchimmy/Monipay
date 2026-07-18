/**
 * Shared IOURegistry helpers for all bots.
 *
 * Provides on-chain `executeCreate` against the IOURegistry deployed on
 * Base / BSC / Celo / Ink and the deterministic recipientId hash.
 */

export { MAGIC_PAY_ABI, getRecipientId, isIouSupported } from './shared/iouRegistry.js';
export { executeCreateMagicPay as executeCreateIOU } from './shared/iouRegistry.js';
