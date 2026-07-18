/**
 * MoniBot Telegram - Cross-Chain Balance Check
 * 
 * Checks all alternate chains for sufficient balance/allowance when
 * the requested chain has insufficient funds. Enables auto-rerouting.
 * Supports Base ↔ BSC ↔ Tempo ↔ Ink fallback.
 */

export { findAlternateChain } from './shared/crossChainCheck.js';
