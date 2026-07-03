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