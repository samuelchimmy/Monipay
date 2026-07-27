/**
 * chains.js - SINGLE SOURCE OF TRUTH (Worker Bot)
 *
 * ⚠️ SYNC REQUIRED: This file must stay aligned with
 * monibot-discord-main/chains.js for shared contract addresses and chain metadata.
 * If you update one, compare and sync the other explicitly.
 *
 * FIX B1: Added viem chain objects to every config so getClients()
 * can pass chain: config.viemChain to createPublicClient/createWalletClient.
 * Without this, viem silently signs transactions for the wrong chainId on
 * non-Base networks, causing reverts or misdirected transactions.
 */

import { celo } from 'viem/chains';

export const CHAIN_CONFIGS = {
  celo: {
    name: 'celo',
    chainId: 42220,
    viemChain: celo,                                           // ✅ FIX B1
    rpcs: [
      process.env.CELO_RPC_URL,
      'https://forno.celo.org',
      'https://rpc.ankr.com/celo',
      'https://1rpc.io/celo',
      'https://celo-rpc.publicnode.com',
      'https://celo.llamarpc.com',
      'https://celo-pokt.nodies.app',
    ].filter(Boolean),
    routerAddress:   '0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e',
    tokenAddress:    '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    magicPayAddress: '0x6bB3C64C382fcF8fB65b24234C455bB62b155742',
    decimals: 6,
    symbol: 'USDT',
    explorer: 'https://celoscan.io/tx/',
    useBuilderCode: false,
    isTestnet: false,
  },
};

/**
 * Returns the chain config including viemChain.
 * Use config.viemChain when constructing createPublicClient / createWalletClient.
 * See blockchain.js getClients() for the canonical pattern.
 */
export function getChainConfig(chainName) {
  const config = CHAIN_CONFIGS[chainName?.toLowerCase()];
  if (!config) throw new Error(`Unsupported chain: ${chainName}`);
  return config;
}

export function isTestnet(chainName) {
  return CHAIN_CONFIGS[chainName?.toLowerCase()]?.isTestnet || false;
}

export function getExplorerUrl(chainName, txHash) {
  const config = getChainConfig(chainName);
  return `${config.explorer}${txHash}`;
}

export function getTestnetWarning(chainName) {
  const config = CHAIN_CONFIGS[chainName?.toLowerCase()];
  if (config?.isTestnet) {
    return '\n\n⚠️ Note: This is a testnet transaction. These funds have no real-world value.';
  }
  return '';
}

// Normalize chain name to lowercase — Celo-only.
export function normalizeChain(chainName) {
  return (chainName || 'celo').toLowerCase();
}

/**
 * Returns a human-readable summary of all configured chains.
 * Useful for startup logs and health checks.
 */
export function getChainSummary() {
  return Object.entries(CHAIN_CONFIGS).map(([name, cfg]) => ({
    name,
    chainId: cfg.chainId,
    symbol: cfg.symbol,
    rpcCount: cfg.rpcs.length,
    isTestnet: cfg.isTestnet || false,
    hasRouter: !!cfg.routerAddress,
    hasMagicPay: !!cfg.magicPayAddress,
  }));
}
