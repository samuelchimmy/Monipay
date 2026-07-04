/**
 * MoniBot Worker - Blockchain Module (Multi-Chain + MagicPay)
 *
 * FIX B1: getClients() always passes viemChain from chains.js.
 * FIX B2: executeMagicPay() pre-flight checks magicPayAddress allowance.
 * FIX B6: chain stored lowercase via normalizeChain().
 * FIX RPC: All execution functions loop through every RPC on a chain before
 *          giving up. RPC infrastructure failures (rate limits, timeouts,
 *          "Requested resource not found") rotate to the next endpoint
 *          automatically. Real errors (balance, allowance, duplicate) throw
 *          immediately without wasting retries.
 * FIX NONCE: Mutex+chainNonces pattern (ported from Discord bot) prevents
 *            nonce collisions when oracle fires many jobs simultaneously.
 */

// ============ Nonce Manager (Mutex pattern — safe under burst concurrency) ============

class Mutex {
  constructor() { this.queue = Promise.resolve(); }
  async run(fn) {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
}

const _chainMutexes = {};
const _chainNonces  = {};

function _getMutex(chainKey) {
  if (!_chainMutexes[chainKey]) _chainMutexes[chainKey] = new Mutex();
  return _chainMutexes[chainKey];
}

/**
 * Mutex-gated transaction sender.
 * - Fetches nonce ONCE per chain (blockTag: 'pending'), then increments in-memory.
 * - On failure: clears cache so next tx re-fetches fresh from network.
 * - Ensures sequential tx ordering even when oracle fires 10k jobs at once.
 */
export async function sendTransactionWithNonce(chainName, publicClient, walletClient, txParams) {
  const chainKey = typeof normalizeChain === 'function' ? normalizeChain(chainName) : chainName.toLowerCase();
  return _getMutex(chainKey).run(async () => {
    const address = walletClient.account.address;
    if (_chainNonces[chainKey] == null) {
      console.log(`[NonceManager] Fetching pending nonce for ${address} on ${chainKey}`);
      _chainNonces[chainKey] = await publicClient.getTransactionCount({
        address,
        blockTag: 'pending',
      });
    }
    const nonce = _chainNonces[chainKey];
    console.log(`[NonceManager] Sending tx on ${chainKey} with nonce ${nonce}`);
    try {
      const hash = await walletClient.sendTransaction({ ...txParams, nonce });
      _chainNonces[chainKey]++;
      return hash;
    } catch (err) {
      console.warn(`[NonceManager] Tx failed on ${chainKey}, clearing cached nonce. Error: ${err.message?.split('\n')[0]}`);
      _chainNonces[chainKey] = null;
      throw err;
    }
  });
}

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  erc20Abi,
  encodeFunctionData,
  keccak256,
  encodePacked,
  decodeEventLog,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, CHAIN_CONFIGS, isTestnet, getExplorerUrl, normalizeChain } from './chains.js';

// ============ ERC-8021 Builder Code (Twitter-specific) ============
const BUILDER_CODE_SUFFIX = '802162635f71743979786f31640b00802180218021802180218021802180218021';

function appendBuilderCode(calldata) {
  if (!calldata || !calldata.startsWith('0x')) return calldata;
  return `${calldata}${BUILDER_CODE_SUFFIX}`;
}

// ============ Exports ============
export const MONIBOT_ROUTER_ADDRESS = '0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516';
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ============ ABIs ============
const moniBotRouterAbi = [
  { name: 'executeP2P',    type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'tweetId', type: 'string' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'executeGrant',  type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'campaignId', type: 'string' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'getNonce',      type: 'function', stateMutability: 'view',       inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'nonces',        type: 'function', stateMutability: 'view',       inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'isTweetUsed',   type: 'function', stateMutability: 'view',       inputs: [{ name: 'tweetId', type: 'string' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'isGrantIssued', type: 'function', stateMutability: 'view',       inputs: [{ name: 'campaignId', type: 'string' }, { name: 'recipient', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'calculateFee',  type: 'function', stateMutability: 'view',       inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ name: 'fee', type: 'uint256' }, { name: 'netAmount', type: 'uint256' }] },
  { name: 'calculateFee',  type: 'function', stateMutability: 'view',       inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
];

const magicPayAbi = [
  { name: 'executeCreate', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'recipientId', type: 'bytes32' }], outputs: [{ name: 'iouId', type: 'uint256' }] },
  {
    name: 'IOUCreated', type: 'event',
    inputs: [
      { name: 'iouId',       type: 'uint256', indexed: true },
      { name: 'sender',      type: 'address', indexed: true },
      { name: 'recipientId', type: 'bytes32', indexed: true },
      { name: 'grossAmount', type: 'uint256', indexed: false },
      { name: 'netAmount',   type: 'uint256', indexed: false },
      { name: 'fee',         type: 'uint256', indexed: false },
      { name: 'expiry',      type: 'uint64',  indexed: false },
    ],
  },
];

// ============ RPC Failover ============

const rpcIndexes = {};