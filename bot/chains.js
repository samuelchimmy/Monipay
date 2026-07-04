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

import { base, bsc, celo, mainnet } from 'viem/chains';

// Custom chain definitions for networks not in viem/chains
const inkChain = {
  id: 57073,
  name: 'Ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-qnd.inkonchain.com'] } },
  blockExplorers: { default: { name: 'Ink Explorer', url: 'https://explorer.inkonchain.com' } },
};

const tempoChain = {
  id: 42431,
  name: 'Tempo',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.moderato.tempo.xyz'] } },
  blockExplorers: { default: { name: 'Tempo Explorer', url: 'https://explore.tempo.xyz' } },
};

export const CHAIN_CONFIGS = {
  base: {
    name: 'base',
    chainId: 8453,
    viemChain: base,                                           // ✅ FIX B1
    rpcs: [
      process.env.BASE_RPC_URL,
      'https://mainnet.base.org',
      'https://base-rpc.publicnode.com',
      'https://base.drpc.org',
      'https://1rpc.io/base',
      'https://base.llamarpc.com',
      'https://base-pokt.nodies.app',
      'https://base.gateway.tenderly.co',
    ].filter(Boolean),
    routerAddress:   '0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516',
    tokenAddress:    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    magicPayAddress: '0x1945c633659Ae71991aE37eE2Bdfe64E00514650',
    decimals: 6,
    symbol: 'USDC',
    explorer: 'https://basescan.org/tx/',
    useBuilderCode: true,
    isTestnet: false,
  },

  bsc: {
    name: 'bsc',
    chainId: 56,
    viemChain: bsc,                                            // ✅ FIX B1
    rpcs: [
      process.env.BSC_RPC_URL,
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed2.defibit.io',
      'https://bsc-rpc.publicnode.com',
      'https://1rpc.io/bsc',
      'https://bsc.llamarpc.com',
      'https://bsc-pokt.nodies.app',
    ].filter(Boolean),
    routerAddress:   '0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E',
    tokenAddress:    '0x55d398326f99059fF775485246999027B3197955',
    magicPayAddress: '0xF602b559eE5c51ED122F667d101be105d9eDf90d',
    decimals: 18,
    symbol: 'USDT',
    explorer: 'https://bscscan.com/tx/',
    useBuilderCode: false,
    isTestnet: false,
  },

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
    routerAddress:   process.env.USE_V2_CONTRACTS === 'true' ? '0x8768aCE3FCd925e9BD61808b90905a935697e227' : '0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e',
    tokenAddress:    '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    magicPayAddress: process.env.USE_V2_CONTRACTS === 'true' ? '0x89218866374DF22c74a0F44ae648bfA9de8BD31e' : '0x6bB3C64C382fcF8fB65b24234C455bB62b155742',
    decimals: 6,
    symbol: 'USDT',
    explorer: 'https://celoscan.io/tx/',
    useBuilderCode: false,
    isTestnet: false,
  },

  ink: {
    name: 'ink',
    chainId: 57073,
    viemChain: inkChain,                                       // ✅ FIX B1
    rpcs: [
      process.env.INK_RPC_URL,
      'https://rpc-qnd.inkonchain.com',
      'https://ink.drpc.org',
      'https://ink-public.nodies.app',
      'https://1rpc.io/ink',
      'https://ink.llamarpc.com',
      'https://ink-pokt.nodies.app',
    ].filter(Boolean),
    routerAddress:   '0x046875a42B8F79E72349d38CB8225cbd6d24C7c5',
    tokenAddress:    '0x0200C29006150606B650577BBE7B6248F58470c1',
    magicPayAddress: '0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08',
    decimals: 6,
    symbol: 'USDT0',
    explorer: 'https://explorer.inkonchain.com/tx/',
    useBuilderCode: false,
    isTestnet: false,
  },

  tempo: {
    name: 'tempo',
    chainId: 42431,
    viemChain: tempoChain,                                     // ✅ FIX B1
    rpcs: [
      process.env.TEMPO_RPC_URL,
      'https://rpc.moderato.tempo.xyz',
      'https://tempo-testnet.rpc.caldera.xyz',
    ].filter(Boolean),
    routerAddress: '0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc',
    tokenAddress:  '0x20c0000000000000000000000000000000000001',
    decimals: 6,
    symbol: 'αUSD',
    explorer: 'https://explore.tempo.xyz/tx/',
    useBuilderCode: false,
    isTestnet: true,
  },

  solana: {
    name: 'solana',
    chainId: 101,
    viemChain: null, // Solana uses relay — no viem chain object needed
    rpcs: [
      process.env.SOLANA_RPC_URL,
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
      'https://rpc.ankr.com/solana',
      'https://solana-mainnet.rpc.extrnode.com',
    ].filter(Boolean),
    routerAddress: 'TokenkegQfeZyiNwAJbVBCWLGGLGtoSte56GW7LUPbaL',
    tokenAddress:  'EPjFWdd5AufqnvUePlk4kJ2d8c1gb2cpEH43t1YpTrW',
    decimals: 6,
    symbol: 'USDC',
    explorer: 'https://solscan.io/tx/',
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

// Normalize chain name to lowercase — fixes B6 (Worker stores uppercase, VP-Social expects lower)
export function normalizeChain(chainName) {
  return (chainName || 'base').toLowerCase();
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
