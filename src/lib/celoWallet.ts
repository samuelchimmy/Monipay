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