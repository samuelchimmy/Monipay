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
}

const SLANG_LOGS = [
  "MagicPay deposit is BUSSIN ⚡",
  "Identity hashing: Certified Sigma move 🤫",
  "Sending funds to the Shadow Realm... 🪄",
  "MagicPay activated, no cap 🧢",
  "Escrowing with maximum Rizz 📈"
];

function getRandomSlang() {
  return SLANG_LOGS[Math.floor(Math.random() * SLANG_LOGS.length)];
}

/**
 * Executes MagicPay (IOURegistry).executeCreate on-chain via the executor wallet.
 * Returns { iouId, txHash, netAmount } or throws an error.
 *
 * SOURCE: All chain-specific values pulled from chains.js
 */
export async function executeCreateMagicPay({ chain, fromAddress, amount, platform, platformUserId }) {
  const config = getChainConfig(chain);
  const registry = config.magicPayAddress;

  if (!registry) throw new Error(`MagicPay not deployed on chain: ${chain}`);

  console.log(`[MagicPay] ${getRandomSlang()}`);

  const executorKey = process.env.MONIBOT_PRIVATE_KEY || process.env.MONIBOT_WALLET_PRIVATE_KEY;
  if (!executorKey) throw new Error('MONIBOT_PRIVATE_KEY missing — cannot execute MagicPay create');

  const account = privateKeyToAccount(executorKey.startsWith('0x') ? executorKey : `0x${executorKey}`);

  // Use the first available RPC from chains.js
  const rpc = config.rpcs[0];
  const publicClient = createPublicClient({ chain: config.chain, transport: http(rpc, { retryCount: 3 }) });
  const walletClient = createWalletClient({ account, chain: config.chain, transport: http(rpc, { retryCount: 3 }) });

  const recipientId = getRecipientId(platform, platformUserId);
  const amountUnits = parseUnits(Number(amount).toFixed(config.decimals), config.decimals);

  // Pre-flight: sender must have allowance to MagicPay (IOURegistry)
  const allowance = await publicClient.readContract({
    address: config.tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [fromAddress, registry],
  });

  if (allowance < amountUnits) {
    throw new Error(`ERROR_MAGIC_PAY_ALLOWANCE:Approve MagicPay on ${chain} for at least ${amount} ${config.symbol}`);
  }

  const balance = await publicClient.readContract({
    address: config.tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [fromAddress],
  });

  if (balance < amountUnits) {
    throw new Error(`ERROR_MAGIC_PAY_BALANCE:Insufficient ${config.symbol} balance on ${chain}`);
  }

  const data = encodeFunctionData({
    abi: MAGIC_PAY_ABI,
    functionName: 'executeCreate',
    args: [fromAddress, amountUnits, recipientId],
  });

  let gas;
  try {
    gas = await publicClient.estimateGas({ account: account.address, to: registry, data });
  } catch (e) {
    throw new Error(`ERROR_MAGIC_PAY_GAS:${e.message}`);
  }

  const txHash = await sendTransactionWithNonce(chain, publicClient, walletClient, { to: registry, data, gas: gas + gas / 5n });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === 'reverted') {
    throw new Error(`ERROR_MAGIC_PAY_REVERTED:On-chain create reverted (${txHash})`);
  }

  // Decode IOUCreated event to capture iouId + netAmount
  let iouId = null;
  let netAmount = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: MAGIC_PAY_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === 'IOUCreated') {
        iouId = decoded.args.iouId.toString();
        netAmount = Number(decoded.args.netAmount) / 10 ** config.decimals;
        break;
      }
    } catch (_) { /* not a MagicPay event */ }
  }

  return { iouId, txHash, netAmount, recipientId, registry };
}
