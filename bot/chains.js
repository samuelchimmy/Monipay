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