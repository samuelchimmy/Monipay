/**
 * chains.js - SINGLE SOURCE OF TRUTH
 * Expanded RPC lists + MagicPay (IOURegistry) integration
 */

export const CHAIN_CONFIGS = {
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
