/**
 * Shared MagicPay helpers for all bots.
 *
 * Provides on-chain `executeCreate` against the IOURegistry (MagicPay)
 * deployed on various chains and the deterministic recipientId hash.
 *
 * SOURCE OF TRUTH: chains.js
 */

import { createPublicClient, createWalletClient, http, keccak256, encodePacked, parseUnits, encodeFunctionData, decodeEventLog, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, isTestnet } from './chains.js';
import { getRecipientId as canonicalGetRecipientId, sendTransactionWithNonce } from './blockchain.js';

export const MAGIC_PAY_ABI = [
  { type: 'function', name: 'executeCreate', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'recipientId', type: 'bytes32' }], outputs: [{ name: 'iouId', type: 'uint256' }] },
  { type: 'function', name: 'getPendingIOUs', stateMutability: 'view', inputs: [{ name: 'recipientId', type: 'bytes32' }], outputs: [{ name: 'ids', type: 'uint256[]' }, { name: 'count', type: 'uint256' }] },
  { type: 'event', name: 'IOUCreated', inputs: [
    { name: 'iouId', type: 'uint256', indexed: true },
    { name: 'sender', type: 'address', indexed: true },
    { name: 'recipientId', type: 'bytes32', indexed: true },
    { name: 'grossAmount', type: 'uint256', indexed: false },
    { name: 'netAmount', type: 'uint256', indexed: false },
    { name: 'fee', type: 'uint256', indexed: false },
    { name: 'expiry', type: 'uint64', indexed: false },
  ], anonymous: false },
];

/**
 * keccak256(encodePacked(platform, ":", userId))
 * Delegates to the canonical implementation in blockchain.js.
 */
export function getRecipientId(platform, userId) {
  return canonicalGetRecipientId(platform, userId);