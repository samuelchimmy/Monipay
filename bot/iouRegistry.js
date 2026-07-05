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