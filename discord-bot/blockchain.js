/**
 * MoniBot Discord - Blockchain Module (Refactored)
 * SINGLE SOURCE OF TRUTH: chains.js
 * FEATURES: MagicPay (IOURegistry), executeGrant, executeP2P, RPC failover, safety guards
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, erc20Abi, encodeFunctionData, keccak256, encodePacked, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, isTestnet, getExplorerUrl, CHAIN_CONFIGS } from './chains.js';
import { getAgentHeaders } from './middleware/agentFeedback.js';
import logger from './logger.js';

class Mutex {
  constructor() {
    this.queue = Promise.resolve();
  }

  async run(fn) {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
}

const chainMutexes = {};
// chainNonces cache removed — nonce is now fetched fresh before every tx
// to eliminate stale-nonce errors across restarts, failures, and external txs.

function getMutex(chainName) {
  const normChain = chainName.toLowerCase();
  if (!chainMutexes[normChain]) {
    chainMutexes[normChain] = new Mutex();
  }
  return chainMutexes[normChain];
}

export async function sendTransactionWithNonce(chainName, publicClient, walletClient, txParams) {
  const normChain = chainName.toLowerCase();
  const mutex = getMutex(normChain);

  return mutex.run(async () => {
    const address = walletClient.account.address;

    // Always fetch the latest pending nonce from the chain before every tx.
    // A cached nonce causes 'nonce too low' errors whenever:
    //   - a previous tx failed and the cache wasn't cleared properly
    //   - the bot restarted and the in-memory cache was lost
    //   - a tx was submitted externally (outside the bot)
    //   - the RPC node returned a stale 'pending' value on the previous call
    // The mutex above already serialises concurrent txs per chain, so fetching
    // fresh every time is safe with no race condition.
    console.log(`[NonceManager] Fetching fresh pending nonce for ${address} on ${normChain}`);
    const nonce = await publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    });

    console.log(`[NonceManager] Sending tx on ${normChain} with nonce ${nonce} for ${address}`);

    try {
      const hash = await walletClient.sendTransaction({
        ...txParams,
        nonce,
      });
      return hash;
    } catch (error) {
      console.warn(`[NonceManager] Tx failed on ${normChain} at nonce ${nonce}. Error:`, error.message);
      throw error;
    }
  });
}

const log = logger.child({ module: 'blockchain' });

// ============ Builder Code (Base Only) ============
const BUILDER_CODE = process.env.BUILDER_CODE || 'bc_qt9yxo1d';

function generateBuilderCodeSuffix() {
  const bytes = Buffer.from(BUILDER_CODE, 'utf8');
  const padded = Buffer.alloc(32);
  bytes.copy(padded);
  return `8021${padded.toString('hex')}8021`;
}

function appendBuilderCode(calldata) {
  if (!calldata?.startsWith('0x')) return calldata;
  return `${calldata}${generateBuilderCodeSuffix()}`;
}

// ============ ABIs ============

const moniBotRouterAbi = [
  { name: 'executeP2P', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'tweetId', type: 'string' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'executeGrant', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'campaignId', type: 'string' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'getNonce', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'calculateFee', type: 'function', stateMutability: 'view', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ name: 'fee', type: 'uint256' }, { name: 'netAmount', type: 'uint256' }] },
];

const reputationRegistryAbi = [
  { name: 'giveFeedback', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'score', type: 'uint8' }, { name: 'comment', type: 'string' }], outputs: [] },
];

const REPUTATION_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

const magicPayAbi = [
  { name: 'executeCreate', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'recipientId', type: 'bytes32' }], outputs: [{ name: 'iouId', type: 'uint256' }] },
  { name: 'IOUCreated', type: 'event', inputs: [
    { name: 'iouId', type: 'uint256', indexed: true },
    { name: 'sender', type: 'address', indexed: true },
    { name: 'recipientId', type: 'bytes32', indexed: true },
    { name: 'grossAmount', type: 'uint256', indexed: false },
    { name: 'netAmount', type: 'uint256', indexed: false },
    { name: 'fee', type: 'uint256', indexed: false },
    { name: 'expiry', type: 'uint64', indexed: false },
  ] }
];

// ============ 1. IDENTITY HASHING UTILITY ============

export function getRecipientId(platform, userId) {
  return keccak256(encodePacked(
    ['string', 'string', 'string'],
    [String(platform).toLowerCase(), ':', String(userId)]
  ));
}

// ============ RPC Failover Tracking ============

const rpcIndexes = {};

function isSolanaChain(chainName) {
  return chainName?.toLowerCase() === 'solana';
}

function isValidAddress(addr, chainName) {
  if (!addr || typeof addr !== 'string') return false;
  if (isSolanaChain(chainName)) {
    return addr.length >= 32 && addr.length <= 44;
  }
  return addr.startsWith('0x') && addr.length === 42;
}

function getClients(chainName) {
  const config = getChainConfig(chainName);
  const rpcIdx = Math.min(rpcIndexes[chainName] || 0, config.rpcs.length - 1);
  const rpc = config.rpcs[rpcIdx];

  const publicClient = createPublicClient({ transport: http(rpc) });
  const walletClient = createWalletClient({
    account: privateKeyToAccount(process.env.MONIBOT_PRIVATE_KEY),
    transport: http(rpc),
  });

  return { publicClient, walletClient, config, rpcUrl: rpc };
}

function rotateRpc(chainName) {
  const config = getChainConfig(chainName);
  const current = rpcIndexes[chainName] || 0;
  const next = (current + 1) % config.rpcs.length;
  rpcIndexes[chainName] = next;
  const newRpc = config.rpcs[next];
  log.warn('Rotating RPC endpoint', { chain: chainName, from: current, to: next, rpc: newRpc });
  return newRpc;
}

async function withRpcFailover(chainName, operation, maxRetries = 3) {
  const config = getChainConfig(chainName);
  const totalRpcs = config.rpcs.length;
  const attempts = Math.min(maxRetries, totalRpcs);

  for (let i = 0; i < attempts; i++) {
    const { publicClient, walletClient } = getClients(chainName);
    try {
      return await operation(publicClient, walletClient, config);
    } catch (error) {
      const isRpcError = error.message?.includes('fetch') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('502') ||
        error.message?.includes('503') ||
        error.message?.includes('429');

      if (isRpcError && i < attempts - 1) {
        rotateRpc(chainName);
        continue;
      }
      throw error;
    }
  }
}

// ============ Solana Relay Implementation ============
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function executeSolanaRelay(action, body) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/relay-solana-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      ...getAgentHeaders(),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || `Solana error: ${resp.status}`);
  return data;
}

// ============ MagicPay (IOU / Social Escrow) ============

export async function executeMagicPay(fromAddress, recipientUserId, amount, chainName = 'base') {
  if (!isValidAddress(fromAddress, chainName)) throw new Error('ERROR_INVALID_ADDRESS:Invalid sender address');
  if (isSolanaChain(chainName)) throw new Error('ERROR_SOLANA_MAGICPAY_NOT_SUPPORTED');

  return await withRpcFailover(chainName, async (publicClient, walletClient, config) => {
    if (!config.magicPayAddress) throw new Error(`ERROR_NOT_SUPPORTED:MagicPay address not configured for ${chainName}`);

    const amountInUnits = parseUnits(amount.toFixed(config.decimals), config.decimals);
    const recipientId = getRecipientId('discord', recipientUserId);

    const balance = await publicClient.readContract({
      address: config.tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [fromAddress],
    });

    if (balance < amountInUnits) throw new Error(`ERROR_BALANCE:Insufficient funds for MagicPay`);

    const allowance = await publicClient.readContract({
      address: config.tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [fromAddress, config.magicPayAddress],
    });

    if (allowance < amountInUnits) throw new Error(`ERROR_ALLOWANCE:Insufficient MagicPay allowance`);

    const calldata = encodeFunctionData({
      abi: magicPayAbi,
      functionName: 'executeCreate',
      args: [fromAddress, amountInUnits, recipientId]
    });

    let gas;
    try {
      gas = await publicClient.estimateGas({
        account: walletClient.account.address,
        to: config.magicPayAddress,
        data: calldata,
      });
    } catch {
      gas = 400000n;
    }

    const hash = await sendTransactionWithNonce(chainName, publicClient, walletClient, {
      to: config.magicPayAddress,
      data: calldata,
      gas: gas + (gas * 20n / 100n),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === 'reverted') throw new Error(`ERROR_REVERTED:MagicPay transaction reverted (${hash})`);

    let iouId = null;
    for (const logEntry of receipt.logs) {
      if (logEntry.address.toLowerCase() !== config.magicPayAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: magicPayAbi, data: logEntry.data, topics: logEntry.topics });
        if (decoded.eventName === 'IOUCreated') {
          iouId = decoded.args.iouId.toString();
          break;
        }
      } catch (e) { }
    }

    log.info('MagicPay executed', { chain: chainName, hash, iouId });
    return { hash, iouId };
  });
}

// ============ P2P (Main Payment Flow) ============
export async function executeP2P(fromAddress, toAddress, amount, commandId, chainName = 'base', tokenSymbol = null) {
  if (!isValidAddress(fromAddress, chainName) || !isValidAddress(toAddress, chainName)) {
    throw new Error('ERROR_INVALID_ADDRESS:Invalid sender or recipient address');
  }

  if (isSolanaChain(chainName)) {
    try {
      const data = await executeSolanaRelay('transfer', {
        from: fromAddress,
        to: toAddress,
        amount: amount,
        reference: `discord_${commandId}`
      });
      return { hash: data.hash, fee: data.fee || 0 };
    } catch (e) {
      throw new Error(`ERROR_SOLANA_EXECUTION: ${e.message}`);
    }
  }

  return await withRpcFailover(chainName, async (publicClient, walletClient, baseConfig) => {
    // Resolve token-specific config (address + decimals) when a symbol is provided
    const config = tokenSymbol ? getChainConfig(chainName, tokenSymbol) : baseConfig;
    const amountInUnits = parseUnits(amount.toFixed(config.decimals), config.decimals);

    let nonce, balance, allowance, feeRaw;

    try {
      [nonce, balance, allowance, [feeRaw]] = await Promise.all([
        publicClient.readContract({ address: config.routerAddress, abi: moniBotRouterAbi, functionName: 'getNonce', args: [fromAddress] }),
        publicClient.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [fromAddress] }),
        publicClient.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'allowance', args: [fromAddress, config.routerAddress] }),
        publicClient.readContract({ address: config.routerAddress, abi: moniBotRouterAbi, functionName: 'calculateFee', args: [amountInUnits] }),
      ]);
    } catch (e) {
      if (isTestnet(chainName)) throw new Error(`ERROR_TEMPO_CONTRACT:${e.message}`);
      throw new Error(`ERROR_CONTRACT_READ:${e.message}`);
    }

    if (balance < amountInUnits) throw new Error(`ERROR_BALANCE:Has ${formatUnits(balance, config.decimals)}, needs ${amount}`);
    if (allowance < amountInUnits) throw new Error(`ERROR_ALLOWANCE:Approved ${formatUnits(allowance, config.decimals)}, needs ${amount}`);

    let calldata = encodeFunctionData({
      abi: moniBotRouterAbi,
      functionName: 'executeP2P',
      args: [fromAddress, toAddress, amountInUnits, nonce, `discord_${commandId}`],
    });

    if (config.useBuilderCode) calldata = appendBuilderCode(calldata);

    let gas;
    try {
      gas = await publicClient.estimateGas({
        account: walletClient.account.address,
        to: config.routerAddress,
        data: calldata,
      });
    } catch {
      gas = 300000n;
    }

    const hash = await sendTransactionWithNonce(chainName, publicClient, walletClient, {
      to: config.routerAddress,
      data: calldata,
      gas: gas + (gas * 20n / 100n),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === 'reverted') throw new Error(`ERROR_REVERTED:Transaction reverted (${hash})`);

    log.info('P2P executed', { chain: chainName, hash, amount, fee: formatUnits(feeRaw, config.decimals) });
    return { hash, fee: parseFloat(formatUnits(feeRaw, config.decimals)) };
  });
}

// ============ GRANT (Giveaways & Rewards) ============
export async function executeGrant(toAddress, amount, campaignId, chainName = 'base') {
  if (!isValidAddress(toAddress, chainName)) throw new Error('ERROR_INVALID_ADDRESS:Invalid recipient');
  if (isSolanaChain(chainName)) throw new Error('ERROR_SOLANA_GRANT_NOT_SUPPORTED');

  return await withRpcFailover(chainName, async (publicClient, walletClient, config) => {
    const amountInUnits = parseUnits(amount.toFixed(config.decimals), config.decimals);

    let feeRaw;
    try {
      const contractBalance = await publicClient.readContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [config.routerAddress],
      });

      if (contractBalance < amountInUnits) throw new Error(`ERROR_CONTRACT_BALANCE:Has ${formatUnits(contractBalance, config.decimals)}, needs ${amount}`);

      [feeRaw] = await publicClient.readContract({
        address: config.routerAddress,
        abi: moniBotRouterAbi,
        functionName: 'calculateFee',
        args: [amountInUnits],
      });
    } catch (e) {
      throw new Error(`ERROR_GRANT_PREFLIGHT:${e.message}`);
    }

    let calldata = encodeFunctionData({
      abi: moniBotRouterAbi,
      functionName: 'executeGrant',
      args: [toAddress, amountInUnits, campaignId],
    });

    if (config.useBuilderCode) calldata = appendBuilderCode(calldata);

    let gas;
    try {
      gas = await publicClient.estimateGas({
        account: walletClient.account.address,
        to: config.routerAddress,
        data: calldata,
      });
    } catch {
      gas = 250000n;
    }

    const hash = await sendTransactionWithNonce(chainName, publicClient, walletClient, {
      to: config.routerAddress,
      data: calldata,
      gas: gas + (gas * 20n / 100n),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === 'reverted') throw new Error(`ERROR_REVERTED:Grant reverted (${hash})`);

    log.info('Grant executed', { chain: chainName, hash, amount });
    return { hash, fee: parseFloat(formatUnits(feeRaw, config.decimals)) };
  });
}

export async function giveAgentFeedback(peerAgentId, score = 5, comment = '', chainName = 'base') {
  if (!['base', 'celo', 'bsc'].includes(chainName.toLowerCase())) {
    chainName = 'base';
  }

  log.info('Queuing agent feedback', { peerAgentId, score, chain: chainName });

  try {
    return await withRpcFailover(chainName, async (publicClient, walletClient) => {
      const calldata = encodeFunctionData({
        abi: reputationRegistryAbi,
        functionName: 'giveFeedback',
        args: [BigInt(peerAgentId), score, comment],
      });

      let gas;
      try {
        gas = await publicClient.estimateGas({
          account: walletClient.account.address,
          to: REPUTATION_REGISTRY_ADDRESS,
          data: calldata,
        });
      } catch {
        gas = 150000n;
      }

      const hash = await sendTransactionWithNonce(chainName, publicClient, walletClient, {
        to: REPUTATION_REGISTRY_ADDRESS,
        data: calldata,
        gas: gas + (gas * 20n / 100n),
      });

      log.info('✅ Agent feedback submitted', { hash, peerAgentId, chain: chainName });
      return { hash };
    });
  } catch (error) {
    log.error('❌ Failed to give agent feedback', { error: error.message, peerAgentId, chain: chainName });
    return null;
  }
}

// ============ BALANCE & ALLOWANCE ============
export async function getBalance(address, chainName = 'base') {
  if (!isValidAddress(address, chainName)) {
    log.warn('Invalid address passed to getBalance', { address });
    return { balance: 0, symbol: 'UNKNOWN' };
  }

  if (isSolanaChain(chainName)) {
    try {
      const data = await executeSolanaRelay('getBalance', { address });
      return { balance: data.balance || 0, symbol: 'USDC' };
    } catch (e) {
      return { balance: 0, symbol: 'USDC' };
    }
  }

  try {
    return await withRpcFailover(chainName, async (publicClient, _, config) => {
      const balance = await publicClient.readContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      return { balance: parseFloat(formatUnits(balance, config.decimals)), symbol: config.symbol };
    });
  } catch (e) {
    const config = getChainConfig(chainName);
    log.warn('getBalance failed after RPC rotation', { chain: chainName, error: e.message });
    return { balance: 0, symbol: config.symbol };
  }
}

export async function getAllowance(address, chainName = 'base') {
  if (!isValidAddress(address, chainName)) {
    log.warn('Invalid address passed to getAllowance', { address });
    return { allowance: 0, symbol: 'UNKNOWN' };
  }
  if (isSolanaChain(chainName)) return { allowance: 999999, symbol: 'USDC' };

  try {
    return await withRpcFailover(chainName, async (publicClient, _, config) => {
      const allowance = await publicClient.readContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, config.routerAddress],
      });
      return { allowance: parseFloat(formatUnits(allowance, config.decimals)), symbol: config.symbol };
    });
  } catch (e) {
    const config = getChainConfig(chainName);
    log.warn('getAllowance failed after RPC rotation', { chain: chainName, error: e.message });
    return { allowance: 0, symbol: config.symbol };
  }
}

/**
 * Fetch balances across all supported chains in parallel.
 */
export async function getAllBalances(addresses) {
  const chains = Object.keys(CHAIN_CONFIGS);
  const tasks = chains.map(async (chain) => {
    const addr = addresses[chain];
    if (!addr) return { chain, balance: 0, symbol: CHAIN_CONFIGS[chain].symbol, error: 'No address' };
    try {
      const { balance, symbol } = await getBalance(addr, chain);
      return { chain, balance, symbol };
    } catch (e) {
      return { chain, balance: 0, symbol: CHAIN_CONFIGS[chain].symbol, error: e.message };
    }
  });

  return Promise.all(tasks);
}

// Re-export from chains.js for backward compatibility
export { CHAIN_CONFIGS, getChainConfig, isTestnet, getExplorerUrl } from './chains.js';
