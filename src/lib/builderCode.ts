/**
 * ERC-8021 Builder Code Attribution for Base Network
 * 
 * Builder Codes append a special suffix to transaction calldata that attributes
 * the transaction to MoniPay. Smart contracts ignore the suffix (zero impact on
 * execution), and it adds ~256 gas per transaction (negligible cost).
 * 
 * Suffix format: 0x8021{builderCodeAsHex padded to 32 bytes}8021
 * 
 * @see https://builder-code-validator.base.org
 */

// Our Builder Code assigned by Base
const BUILDER_CODE = import.meta.env.VITE_BUILDER_CODE || 'bc_qt9yxo1d';

// Base chain ID — Builder Codes only apply here
const BASE_CHAIN_ID = 8453;

/**
 * Convert a string to a hex-encoded, 32-byte-padded representation.
 */
function toHexPadded32(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return Array.from(padded)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Pre-encoded ERC-8021 suffix for bc_qt9yxo1d.
 * Raw: 0x62635f71743979786f31640b0080218021802180218021802180218021
 * Format: 8021 + hex(code padded to 32 bytes) + 8021
 */
const BUILDER_CODE_SUFFIX = "802162635f71743979786f31640b00802180218021802180218021802180218021";

/**
 * Generate the ERC-8021 suffix (without 0x prefix).
 */
export function generateBuilderCodeSuffix(): string {
  return BUILDER_CODE_SUFFIX;
}

/**
 * Append Builder Code suffix to existing calldata (hex string starting with 0x).
 * If the input is falsy or not a hex string, returns it unchanged.
 */
export function appendBuilderCode(calldata: string): string {
  if (!calldata || !calldata.startsWith('0x')) return calldata;
  return `${calldata}${generateBuilderCodeSuffix()}`;
}

/**
 * Check whether Builder Code attribution should be used for the given network.
 * MoniPay is Celo-only; Builder Code was Base-specific, so this is always false.
 */
export function shouldUseBuilderCode(network: string): boolean {
  return false;
}

/**
 * Check whether Builder Code attribution should be used for the given chain ID.
 * MoniPay is Celo-only; Builder Code was Base-specific, so this is always false.
 */
export function shouldUseBuilderCodeByChainId(chainId: number): boolean {
  return false;
}

export { BUILDER_CODE, BASE_CHAIN_ID };
