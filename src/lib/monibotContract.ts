/**
 * MoniBotRouter Contract Utilities
 * 
 * This module provides the ABI and helper functions for interacting with
 * the MoniBotRouter smart contract on Base Mainnet.
 * 
 * The MoniBotRouter enables gasless social payments where:
 * 1. Users pre-approve the contract once via USDC.approve()
 * 2. The Worker Bot (executor) triggers transfers on behalf of users
 * 3. 1% platform fee is automatically deducted
 */

import { createPublicClient, http, formatUnits, parseUnits, erc20Abi } from 'viem';
import { celo } from 'viem/chains';

function getViemChain(_network: SupportedNetwork) {
  return celo;
}
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { getActiveRpc } from '@/components/monibot/SystemTab';

// ============ Contract Addresses ============

/**
 * MoniBotRouter contract address on Base Mainnet
 */
export const MONIBOT_ROUTER_ADDRESS = '0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516' as const;

/**
 * MoniBotRouter contract address on BSC Mainnet
 */
export const MONIBOT_ROUTER_ADDRESS_BSC = '0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E' as const;

/**
 * USDC contract address on Base Mainnet
 */
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

/**
 * USDT contract address on BSC Mainnet
 */
export const USDT_ADDRESS_BSC = '0x55d398326f99059fF775485246999027B3197955' as const;

/**
 * Platform Treasury address for fee collection
 */
export const PLATFORM_TREASURY = '0xfa2B8eD012f756E22E780B772d604af4575d5fcf' as const;

/**
 * Get MoniBot config for a given network
 */
export function getMoniBotConfig(network: SupportedNetwork) {
  const chain = getChainConfig(network);
  return {
    routerAddress: chain.monibotRouter as `0x${string}`,
    tokenAddress: chain.token as `0x${string}`,
    decimals: chain.decimals,
    chainId: chain.id,
    currency: chain.currency,
  };
}

// ============ Contract ABI ============

/**
 * MoniBotRouter ABI - Full interface for contract interactions
 */
export const MONIBOT_ROUTER_ABI = [
  // ============ Read Functions ============
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getNonce',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'isExecutor',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tweetId', type: 'string' }],
    name: 'isTweetUsed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'campaignId', type: 'string' },
      { name: 'recipient', type: 'address' },
    ],
    name: 'isGrantIssued',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getGrantBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'calculateFee',
    outputs: [
      { name: 'fee', type: 'uint256' },
      { name: 'netAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'platformFeeBps',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'platformTreasury',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'executors',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ Write Functions ============
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'tweetId', type: 'string' },
    ],
    name: 'executeP2P',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'campaignId', type: 'string' },
    ],
    name: 'executeGrant',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'executor', type: 'address' }],
    name: 'addExecutor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'executor', type: 'address' }],
    name: 'removeExecutor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'newFeeBps', type: 'uint256' }],
    name: 'setPlatformFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'newTreasury', type: 'address' }],
    name: 'setPlatformTreasury',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'withdrawCampaignFunds',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Events ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'fee', type: 'uint256' },
      { indexed: false, name: 'nonce', type: 'uint256' },
      { indexed: false, name: 'tweetId', type: 'string' },
    ],
    name: 'P2PExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'fee', type: 'uint256' },
      { indexed: false, name: 'campaignId', type: 'string' },
    ],
    name: 'GrantExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'executor', type: 'address' }],
    name: 'ExecutorAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'executor', type: 'address' }],
    name: 'ExecutorRemoved',
    type: 'event',
  },

  // ============ Errors ============
  { inputs: [], name: 'NotExecutor', type: 'error' },
  { inputs: [], name: 'InvalidAddress', type: 'error' },
  { inputs: [], name: 'InvalidAmount', type: 'error' },
  { inputs: [], name: 'InvalidNonce', type: 'error' },
  { inputs: [], name: 'InsufficientAllowance', type: 'error' },
  { inputs: [], name: 'InsufficientBalance', type: 'error' },
  { inputs: [], name: 'TweetIdAlreadyUsed', type: 'error' },
  { inputs: [], name: 'GrantAlreadyIssued', type: 'error' },
  { inputs: [], name: 'FeeTooHigh', type: 'error' },
  { inputs: [], name: 'InsufficientContractBalance', type: 'error' },
] as const;

// ============ Public Client ============

const publicClient = createPublicClient({
  chain: celo,
  transport: http(getActiveRpc('celo')),
});

// ============ Read Functions ============

/**
 * Get the current nonce for a user (for P2P commands)
 * @param userAddress User's wallet address
 * @returns Current nonce value
 */
export async function getMoniBotNonce(userAddress: `0x${string}`): Promise<bigint> {
  try {
    const nonce = await (publicClient as any).readContract({
      address: MONIBOT_ROUTER_ADDRESS,
      abi: MONIBOT_ROUTER_ABI,
      functionName: 'getNonce',
      args: [userAddress],
    });
    return nonce as bigint;
  } catch (error) {
    console.error('Failed to get MoniBot nonce:', error);
    return BigInt(0);
  }
}

/**
 * Check user's token allowance for the MoniBotRouter (network-aware)
 * @param userAddress User's wallet address
 * @param network Target network (default: 'celo')
 * @returns Allowance in token units (formatted with correct decimals)
 */
export async function getMoniBotAllowance(userAddress: `0x${string}`, network: SupportedNetwork = 'celo'): Promise<{
  allowance: bigint;
  allowanceFormatted: string;
}> {
  try {
    const config = getMoniBotConfig(network);
    const client = createPublicClient({
      chain: getViemChain(network),
      transport: http(getActiveRpc(network)),
    });

    const allowance = await (client as any).readContract({
      address: config.tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAddress, config.routerAddress],
    });

    return {
      allowance: allowance as bigint,
      allowanceFormatted: formatUnits(allowance as bigint, config.decimals),
    };
  } catch (error) {
    console.error('Failed to get MoniBot allowance:', error);
    return {
      allowance: BigInt(0),
      allowanceFormatted: '0',
    };
  }
}

/**
 * Check if a tweet ID has already been processed
 * @param tweetId Twitter tweet ID
 * @returns Boolean indicating if already used
 */
export async function isTweetProcessed(tweetId: string): Promise<boolean> {
  try {
    const isUsed = await (publicClient as any).readContract({
      address: MONIBOT_ROUTER_ADDRESS,
      abi: MONIBOT_ROUTER_ABI,
      functionName: 'isTweetUsed',
      args: [tweetId],
    });
    return isUsed as boolean;
  } catch (error) {
    console.error('Failed to check tweet status:', error);
    return false;
  }
}

/**
 * Check if a grant has been issued for a campaign + recipient combo
 * @param campaignId Campaign identifier
 * @param recipient Recipient address
 * @returns Boolean indicating if grant was already issued
 */
export async function isGrantIssued(
  campaignId: string,
  recipient: `0x${string}`
): Promise<boolean> {
  try {
    const isIssued = await (publicClient as any).readContract({
      address: MONIBOT_ROUTER_ADDRESS,
      abi: MONIBOT_ROUTER_ABI,
      functionName: 'isGrantIssued',
      args: [campaignId, recipient],
    });
    return isIssued as boolean;
  } catch (error) {
    console.error('Failed to check grant status:', error);
    return false;
  }
}

/**
 * Get the contract's token balance (available for grants) - network-aware
 * @param network Target network (default: 'celo')
 * @returns Balance formatted as string
 */
export async function getGrantBalance(network: SupportedNetwork = 'celo'): Promise<string> {
  try {
    const config = getMoniBotConfig(network);
    const client = createPublicClient({
      chain: getViemChain(network),
      transport: http(getActiveRpc(network)),
    });

    const balance = await (client as any).readContract({
      address: config.routerAddress,
      abi: MONIBOT_ROUTER_ABI,
      functionName: 'getGrantBalance',
    });
    return formatUnits(balance as bigint, config.decimals);
  } catch (error) {
    console.error('Failed to get grant balance:', error);
    return '0';
  }
}

/**
 * Calculate fee for a given USDC amount
 * @param amount Amount in USDC (human readable, e.g., "10.50")
 * @returns Fee and net amount
 */
export async function calculateFee(amount: string): Promise<{
  grossAmount: string;
  fee: string;
  netAmount: string;
}> {
  try {
    const amountWei = parseUnits(amount, 6);
    const result = await (publicClient as any).readContract({
      address: MONIBOT_ROUTER_ADDRESS,
      abi: MONIBOT_ROUTER_ABI,
      functionName: 'calculateFee',
      args: [amountWei],
    });
    
    const [fee, netAmount] = result as [bigint, bigint];

    return {
      grossAmount: amount,
      fee: formatUnits(fee, 6),
      netAmount: formatUnits(netAmount, 6),
    };
  } catch (error) {
    console.error('Failed to calculate fee:', error);
    // Fallback to local calculation with MIN_FEE
    const gross = parseFloat(amount);
    const calculatedFee = gross * 0.01;
    const feeAmount = Math.max(calculatedFee, 0.05); // MIN_FEE = $0.05
    return {
      grossAmount: amount,
      fee: feeAmount.toFixed(6),
      netAmount: (gross - feeAmount).toFixed(6),
    };
  }
}

/**
 * Check if an address is an authorized executor
 * @param address Address to check
 * @returns Boolean indicating executor status
 */
export async function isExecutor(address: `0x${string}`): Promise<boolean> {
  try {
    const isExec = await (publicClient as any).readContract({
      address: MONIBOT_ROUTER_ADDRESS,
      abi: MONIBOT_ROUTER_ABI,
      functionName: 'isExecutor',
      args: [address],
    });
    return isExec as boolean;
  } catch (error) {
    console.error('Failed to check executor status:', error);
    return false;
  }
}

// ============ Constants ============

/**
 * Platform fee in basis points (100 = 1%)
 */
export const PLATFORM_FEE_BPS = 100;

/**
 * Platform fee as decimal (0.01 = 1%)
 */
export const PLATFORM_FEE_DECIMAL = 0.01;

/**
 * Minimum fee in USDC (prevents gas losses on micro-transactions)
 * $0.05 minimum ensures profitability even when gas spikes
 */
export const MIN_FEE_USDC = 0.05;

/**
 * Calculate fee for a given amount (includes MIN_FEE floor)
 * @param amount Base amount in USDC
 * @returns Fee breakdown with minimum fee applied
 */
export function calculateLocalFee(amount: number): { 
  fee: number; 
  netAmount: number; 
  feePercentage: number;
  isMinFeeApplied: boolean;
} {
  const calculatedFee = amount * PLATFORM_FEE_DECIMAL;
  const fee = Math.max(calculatedFee, MIN_FEE_USDC);
  const netAmount = amount - fee;
  const feePercentage = (fee / amount) * 100;
  const isMinFeeApplied = calculatedFee < MIN_FEE_USDC;
  return { fee, netAmount, feePercentage, isMinFeeApplied };
}

/**
 * Calculate total amount user needs to approve (amount + fee)
 * Uses MIN_FEE floor for micro-transactions
 * @param amount Base amount in USDC
 * @returns Total amount including fee
 */
export function calculateTotalWithFee(amount: number): number {
  const { fee } = calculateLocalFee(amount);
  return amount; // Note: User pays gross amount, fee is deducted from it
}

// ============ Type Exports ============

export type MoniBotRouterAddress = typeof MONIBOT_ROUTER_ADDRESS;
export type UsdcAddress = typeof USDC_ADDRESS;
