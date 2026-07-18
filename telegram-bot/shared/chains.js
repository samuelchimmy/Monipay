/**
 * chains.js - SINGLE SOURCE OF TRUTH
 * Expanded RPC lists + MagicPay (IOURegistry) integration
 */

export const CHAIN_CONFIGS = {
  base: {
    name: 'base',
    displayName: 'Base',
    chainId: 8453,
    rpcs: [
      process.env.BASE_RPC_URL,
      'https://mainnet.base.org',
      'https://base-rpc.publicnode.com',
      'https://base.drpc.org',
      'https://1rpc.io/base',
      'https://base.llamarpc.com',
      'https://base-pokt.nodies.app',
      'https://base.gateway.tenderly.co'
    ].filter(Boolean),
    routerAddress: '0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516',
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    magicPayAddress: '0x1945c633659Ae71991aE37eE2Bdfe64E00514650',
    decimals: 6,
    symbol: 'USDC',
    explorer: 'https://basescan.org/tx/',
    useBuilderCode: true,
    isTestnet: false,
  },
  bsc: {
    name: 'bsc',
    displayName: 'BNB Chain (BSC)',
    chainId: 56,
    rpcs: [
      process.env.BSC_RPC_URL,
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed2.defibit.io',
      'https://bsc-rpc.publicnode.com',
      'https://1rpc.io/bsc',
      'https://bsc.llamarpc.com',
      'https://bsc-pokt.nodies.app'
    ].filter(Boolean),
    routerAddress: process.env.BSC_ROUTER_ADDRESS || '0x9eEd16952d734DFC84B7C4E75e9a3228B42D832e',
    tokenAddress: '0x55d398326f99059fF775485246999027B3197955',
    magicPayAddress: '0xF602b559eE5c51ED122F667d101be105d9eDf90d',
    decimals: 18,
    symbol: 'USDT',
    explorer: 'https://bscscan.com/tx/',
    useBuilderCode: false,
    isTestnet: false,
  },
  celo: {
    name: 'celo',
    displayName: 'Celo',
    chainId: 42220,
    rpcs: [
      process.env.CELO_RPC_URL,
      'https://forno.celo.org',
      'https://rpc.ankr.com/celo',
      'https://1rpc.io/celo',
      'https://celo-rpc.publicnode.com',
      'https://celo.llamarpc.com',
      'https://celo-pokt.nodies.app'
    ].filter(Boolean),
    routerAddress: process.env.USE_V2_CONTRACTS === 'true' ? '0x8768aCE3FCd925e9BD61808b90905a935697e227' : '0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e',
    tokenAddress: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    magicPayAddress: process.env.USE_V2_CONTRACTS === 'true' ? '0x89218866374DF22c74a0F44ae648bfA9de8BD31e' : '0x6bB3C64C382fcF8fB65b24234C455bB62b155742',
    decimals: 6,
    symbol: 'USDT',
    explorer: 'https://celoscan.io/tx/',
    useBuilderCode: false,
    isTestnet: false,
    supportedTokens: [
      { symbol: 'USDT', address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6 },
      { symbol: 'G$', address: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', decimals: 18 },
      { symbol: 'USDC', address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6 },
      { symbol: 'USDm', address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 }
    ]
  },
  ink: {
    name: 'ink',
    displayName: 'Ink',
    chainId: 57073,
    rpcs: [
      process.env.INK_RPC_URL,
      'https://rpc-qnd.inkonchain.com',
      'https://ink.drpc.org',
      'https://ink-public.nodies.app',
      'https://1rpc.io/ink',
      'https://ink.llamarpc.com',
      'https://ink-pokt.nodies.app'
    ].filter(Boolean),
    routerAddress: '0x046875a42B8F79E72349d38CB8225cbd6d24C7c5',
    tokenAddress: '0x0200C29006150606B650577BBE7B6248F58470c1',
    magicPayAddress: '0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08',
    decimals: 6,
    symbol: 'USDT0',
    explorer: 'https://explorer.inkonchain.com/tx/',
    useBuilderCode: false,
    isTestnet: false,
  },
  tempo: {
    name: 'tempo',
    displayName: 'Tempo',
    chainId: 42431,
    rpcs: [
      process.env.TEMPO_RPC_URL,
      'https://rpc.moderato.tempo.xyz',
      'https://tempo-testnet.rpc.caldera.xyz'
    ].filter(Boolean),
    routerAddress: '0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc',
    tokenAddress: '0x20c0000000000000000000000000000000000001',
    decimals: 6,
    symbol: 'αUSD',
    explorer: 'https://explore.tempo.xyz/tx/',
    useBuilderCode: false,
    isTestnet: true,
  },
  solana: {
    name: 'solana',
    displayName: 'Solana',
    chainId: 101,
    rpcs: [
      process.env.SOLANA_RPC_URL,
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
      'https://rpc.ankr.com/solana',
      'https://solana-mainnet.rpc.extrnode.com'
    ].filter(Boolean),
    routerAddress: 'TokenkegQfeZyiNwAJbVBCWLGGLGtoSte56GW7LUPbaL',
    tokenAddress: 'EPjFWdd5AufqnvUePlk4kJ2d8c1gb2cpEH43t1YpTrW',
    decimals: 6,
    symbol: 'USDC',
    explorer: 'https://solscan.io/tx/',
    useBuilderCode: false,
    isTestnet: false,
  }
};

export function getChainConfig(chainName, symbol) {
  const config = CHAIN_CONFIGS[chainName?.toLowerCase()];
  if (!config) throw new Error(`Unsupported chain: ${chainName}`);
  if (config.supportedTokens && symbol) {
    const matched = config.supportedTokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    if (matched) {
      return {
        ...config,
        tokenAddress: matched.address,
        decimals: matched.decimals,
        symbol: matched.symbol
      };
    }
  }
  return config;
}

export function resolveToken(chainName) {
  return CHAIN_CONFIGS[chainName?.toLowerCase()]?.symbol ?? 'USDC';
}

export function resolveChainName(chainName) {
  return CHAIN_CONFIGS[chainName?.toLowerCase()]?.displayName ?? chainName;
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
    return '\n\n⚠️ **Note:** This is a testnet transaction. These funds have no real-world value.';
  }
  return '';
}
