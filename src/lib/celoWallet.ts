/**
 * celoWallet.ts — NEW FILE
 * Location: src/lib/celoWallet.ts
 *
 * All Celo-specific blockchain utilities for the MiniPay integration.
 * Kept completely separate from wallet.ts so Base/BSC/Tempo/Solana
 * flows are never touched.
 *
 * Token: USDT on Celo Mainnet (0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e)
 * Decimals: 6
 * Router: MoniPayRouter on Celo (0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0)
 * Chain ID: 42220
 *
 * MiniPay tx requirements:
 *   - Legacy transaction format (no EIP-1559 fields)
 *   - feeCurrency = USDm (0x765DE816845861e75A25fCA122bb6898B8B1282a)
 *     so users pay gas in stablecoin, not CELO
 */

import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  encodeFunctionData,
  erc20Abi,
  type Hex,
} from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Celo addresses ───────────────────────────────────────────────────────────

/** USDT on Celo Mainnet — 6 decimals */
export const CELO_USDT_ADDRESS = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as const;

const isV2 = import.meta.env.VITE_USE_V2_CONTRACTS === 'true';

/** MoniPayRouter deployed on Celo Mainnet */
export const CELO_MONIPAY_ROUTER = (isV2 
  ? '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' 
  : '0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0') as `0x${string}`;

/** MoniBotRouter deployed on Celo Mainnet */
export const CELO_MONIBOT_ROUTER = (isV2
  ? '0x8768aCE3FCd925e9BD61808b90905a935697e227'
  : '0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e') as `0x${string}`;

/** USDm — used as feeCurrency so users pay gas in stablecoin (MiniPay requirement) */
export const CELO_FEE_CURRENCY = '0x765DE816845861e75A25fCA122bb6898B8B1282a' as const;

/** MoniPay platform treasury */
export const CELO_TREASURY = '0xDC9B47551734bE984D7Aa2a365251E002f8FF2D7' as const;

/** Token decimals — USDT on Celo is 6 (same as USDC) */
export const CELO_TOKEN_DECIMALS = 6;

/** Celo chain ID in hex — used for wallet_switchEthereumChain */
export const CELO_CHAIN_ID_HEX = '0xa4ec';

// ─── Public RPC client (read-only) ───────────────────────────────────────────

export const celoPublicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
});

// ─── EIP-712 domain — must match the deployed MoniPayRouter exactly ───────────

export function getCeloDomain() {
  return {
    name: 'MoniPay Router',
    version: '1',
    chainId: 42220,
    verifyingContract: CELO_MONIPAY_ROUTER,
  };
}

// ─── Balance ─────────────────────────────────────────────────────────────────

/**
 * Fetch USDT balance on Celo for a given address.
 * Returns a human-readable number (e.g. 12.50 for 12.50 USDT).
 * Falls back to localStorage cache on RPC failure.
 */
export async function getCeloUsdtBalance(address: `0x${string}`): Promise<number> {
  const CACHE_KEY = `monipay_celo_usdt_balance:${address.toLowerCase()}`;

  try {
    const raw = await (celoPublicClient as any).readContract({
      address: CELO_USDT_ADDRESS,
      abi: erc20Abi,