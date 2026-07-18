// Across Protocol and source chain constants (from _web_reference CrossChainDeposit.tsx).

const String acrossApi = 'https://app.across.to/api';

class SourceChain {
  const SourceChain({required this.id, required this.name, required this.chainId});
  final String id;
  final String name;
  final int chainId;
}

const List<SourceChain> sourceChains = [
  SourceChain(id: 'ETHEREUM', name: 'Ethereum', chainId: 1),
  SourceChain(id: 'ARBITRUM', name: 'Arbitrum', chainId: 42161),
  SourceChain(id: 'OPTIMISM', name: 'Optimism', chainId: 10),
  SourceChain(id: 'BASE', name: 'Base', chainId: 8453),
  SourceChain(id: 'BSC', name: 'BNB Chain', chainId: 56),
  SourceChain(id: 'POLYGON', name: 'Polygon', chainId: 137),
  SourceChain(id: 'ZKSYNC', name: 'zkSync Era', chainId: 324),
  SourceChain(id: 'MODE', name: 'Mode', chainId: 34443),
  SourceChain(id: 'WORLDCHAIN', name: 'World Chain', chainId: 480),
  SourceChain(id: 'BLAST', name: 'Blast', chainId: 81457),
  SourceChain(id: 'LINEA', name: 'Linea', chainId: 59144),
  SourceChain(id: 'SCROLL', name: 'Scroll', chainId: 534352),
  SourceChain(id: 'LISK', name: 'Lisk', chainId: 1135),
  SourceChain(id: 'INK', name: 'Ink', chainId: 57073),
  SourceChain(id: 'ZORA', name: 'Zora', chainId: 7777777),
];

class TokenInfo {
  const TokenInfo({required this.address, required this.decimals, this.isNative = false});
  final String address;
  final int decimals;
  final bool isNative;
}

/// chainId -> symbol -> TokenInfo (addresses from reference).
const Map<String, Map<String, TokenInfo>> tokensByChain = {
  'ETHEREUM': {
    'ETH': TokenInfo(address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6),
    'USDT': TokenInfo(address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6),
    'DAI': TokenInfo(address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18),
    'WBTC': TokenInfo(address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8),
  },
  'ARBITRUM': {
    'ETH': TokenInfo(address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6),
    'USDT': TokenInfo(address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6),
    'DAI': TokenInfo(address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18),
  },
  'OPTIMISM': {
    'ETH': TokenInfo(address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6),
    'USDT': TokenInfo(address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6),
    'DAI': TokenInfo(address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18),
  },
  'POLYGON': {
    'USDC': TokenInfo(address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6),
    'USDT': TokenInfo(address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6),
    'DAI': TokenInfo(address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18),
  },
  'BASE': {
    'ETH': TokenInfo(address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6),
  },
  'BSC': {
    'BNB': TokenInfo(address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, isNative: true),
    'USDT': TokenInfo(address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18),
    'USDC': TokenInfo(address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18),
  },
  'LINEA': {
    'ETH': TokenInfo(address: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', decimals: 6),
    'USDT': TokenInfo(address: '0xA219439258ca9da29E9Cc4cE5596924745e12B93', decimals: 6),
    'DAI': TokenInfo(address: '0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5', decimals: 18),
  },
  'SCROLL': {
    'ETH': TokenInfo(address: '0x5300000000000000000000000000000000000004', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', decimals: 6),
  },
  'ZKSYNC': {
    'ETH': TokenInfo(address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', decimals: 6),
    'USDT': TokenInfo(address: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', decimals: 6),
  },
  'MODE': {
    'ETH': TokenInfo(address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0xd988097fb8612cc24eeC14542bC03424c656005f', decimals: 6),
    'USDT': TokenInfo(address: '0xf0F161fDA2712DB8b566946122a5af183995e2eD', decimals: 6),
  },
  'WORLDCHAIN': {
    'ETH': TokenInfo(address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: true),
    'USDC': TokenInfo(address: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1', decimals: 6),
    'WBTC': TokenInfo(address: '0x03c7054bcb39f7b2e5b2c7acb37583e32d70cfa3', decimals: 8),
  },
  'BLAST': {
    'ETH': TokenInfo(address: '0x4300000000000000000000000000000000000004', decimals: 18, isNative: true),
    'USDB': TokenInfo(address: '0x4300000000000000000000000000000000000003', decimals: 18),
  },
  'LISK': {
    'ETH': TokenInfo(address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: true),
    'USDT': TokenInfo(address: '0x05D032ac25d322df992303dCa074EE7392C117b9', decimals: 6),
  },
  'INK': {
    'ETH': TokenInfo(address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: true),
  },
  'ZORA': {
    'ETH': TokenInfo(address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: true),
  },
};
