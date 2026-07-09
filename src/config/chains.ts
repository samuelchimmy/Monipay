export type SupportedNetwork = "base" | "bsc" | "tempo" | "solana" | "celo" | "ink" | "arc" | "arbitrum" | "optimism" | "polygon" | "ethereum";

export type ChainStatus = "active" | "coming_soon";

export type TokenConfig = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export type ChainConfig = {
  id: number;
  name: string;
  currency: string;
  decimals: number;
  token: `0x${string}`;
  supportedTokens?: TokenConfig[];
  monipayRouter: `0x${string}` | "";
  monipayRouterV1?: `0x${string}` | "";
  monibotRouter: `0x${string}` | "";
  monibotRouterV1?: `0x${string}` | "";
  // ── V2 contract addresses (populated when deployed) ──
  scatterVault: `0x${string}` | "";
  relayerGateway: `0x${string}` | "";
  adminConfig: `0x${string}` | "";
  campaignFactory: `0x${string}` | "";
  iouRegistry: `0x${string}` | "";
  iouRegistryV1?: `0x${string}` | "";
  moniTagRegistry: `0x${string}` | "";
  rpcUrls: readonly string[];
  explorerUrl: string;
  icon: SupportedNetwork;
  hasNativeToken: boolean;
  faucetUrl?: string;
  status: ChainStatus;
  accentColor: string;
};

// Solana uses a completely different address/key system — separate config type
export type SolanaChainConfig = {
  name: string;
  currency: string;
  decimals: number;
  token: string; // SPL token mint address (Base58)
  rpcUrls: readonly string[];
  explorerUrl: string;
  icon: "solana";
  isNative: true;
};

export const SOLANA_CONFIG: SolanaChainConfig = {
  name: "Solana",
  currency: "USDC",
  decimals: 6,
  token: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  rpcUrls: [
    "https://mainnet.helius-rpc.com/?api-key=a248af07-23fe-4199-85ce-1d6ac7bbe796",
    "https://beta.helius-rpc.com/?api-key=a248af07-23fe-4199-85ce-1d6ac7bbe796",
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
  ],
  explorerUrl: "https://solscan.io",
  icon: "solana",
  isNative: true,
};

// ── V2 contract stub (empty until deployed) ──
const V2_STUB = {
  scatterVault: "" as const,
  relayerGateway: "" as const,
  adminConfig: "" as const,
  campaignFactory: "" as const,
  iouRegistry: "" as const,
  moniTagRegistry: "" as const,
};

// EvmNetwork excludes Solana (different key system)
export type EvmNetwork = Exclude<SupportedNetwork, "solana">;

export const CHAIN_CONFIGS: Record<EvmNetwork, ChainConfig> = {
  base: {
    id: 8453,
    name: "Base",
    currency: "USDC",
    decimals: 6,
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    monipayRouter: "0x4048d18F71E723647f83B61202362425C5a7D2c0",
    monibotRouter: "0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516",
    ...V2_STUB,
    iouRegistry: "0x1945c633659Ae71991aE37eE2Bdfe64E00514650",
    rpcUrls: [
      "https://base-rpc.publicnode.com",
      "https://base.drpc.org",
      "https://mainnet.base.org",
      "https://1rpc.io/base",
      "wss://base.drpc.org",
      "https://base-mainnet.g.alchemy.com/v2/nJWEltdO_GLfbGAE5jlq9",
      "https://base-mainnet.core.chainstack.com/436571b85004cc73cb338da64b12aa01",
    ],
    explorerUrl: "https://basescan.org",
    icon: "base",
    hasNativeToken: true,
    status: "active",
    accentColor: "221 100% 58%",
  },
  bsc: {
    id: 56,
    name: "BSC",
    currency: "USDT",
    decimals: 18,
    token: "0x55d398326f99059fF775485246999027B3197955",
    monipayRouter: "0x557285AbC46038E898d90eB00943Ff42c4Fbcb54",
    monibotRouter: "0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E",
    ...V2_STUB,
    iouRegistry: "0xF602b559eE5c51ED122F667d101be105d9eDf90d",
    rpcUrls: [
      "https://bsc-dataseed.binance.org",
      "https://bsc-rpc.publicnode.com",
      "https://binance.llamarpc.com",
      "https://bsc.drpc.org",
      "https://bsc.meowrpc.com",
      "https://bnb.api.onfinality.io/public",
      "https://bsc-mainnet.public.blastapi.io",
      "https://rpc-bsc.48.club",
      "https://binance-smart-chain-public.nodies.app",
      "https://bsc.blockrazor.xyz",
      "https://bnb.rpc.subquery.network/public",
      "https://bsc-mainnet.core.chainstack.com/2ea75bc0f9eb8d84168d3482cc3e997e",
    ],
    explorerUrl: "https://bscscan.com",
    icon: "bsc",
    hasNativeToken: true,
    status: "active",
    accentColor: "44 100% 50%",
  },
  tempo: {
    id: 42431,
    name: "Tempo",
    currency: "aUSD",
    decimals: 6,
    token: "0x20c0000000000000000000000000000000000001",
    monipayRouter: "0xa39C3B7e02686cf7F226337525515c694318BDb9",
    monibotRouter: "0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc",
    ...V2_STUB,
    rpcUrls: ["https://rpc.moderato.tempo.xyz"],
    explorerUrl: "https://explore.tempo.xyz",
    icon: "tempo",
    hasNativeToken: false,
    faucetUrl: "https://faucet.tempo.xyz",
    status: "active",
    accentColor: "220 80% 60%",
  },
  celo: {
    id: 42220,
    name: "Celo",
    currency: "USDT",
    decimals: 6,
    token: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    supportedTokens: [
      {
        symbol: "USDT",
        address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
        decimals: 6,
      },
      {
        symbol: "G$",
        address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
        decimals: 18,
      },
      {
        symbol: "USDC",
        address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
        decimals: 6,
      },
      {
        symbol: "USDm",
        address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
        decimals: 18,
      },
    ],
    monipayRouter: import.meta.env.VITE_USE_V2_CONTRACTS === 'true' ? "0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE" : "0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0",
    monipayRouterV1: "0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0",
    monibotRouter: import.meta.env.VITE_USE_V2_CONTRACTS === 'true' ? "0x8768aCE3FCd925e9BD61808b90905a935697e227" : "0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e",
    monibotRouterV1: "0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e",
    ...V2_STUB,
    iouRegistry: import.meta.env.VITE_USE_V2_CONTRACTS === 'true' ? "0x89218866374DF22c74a0F44ae648bfA9de8BD31e" : "0x6bB3C64C382fcF8fB65b24234C455bB62b155742",
    iouRegistryV1: "0x6bB3C64C382fcF8fB65b24234C455bB62b155742",
    rpcUrls: [
      "https://forno.celo.org",
      "https://rpc.ankr.com/celo",
      "https://1rpc.io/celo",
    ],
    explorerUrl: "https://celoscan.io",
    icon: "celo",
    hasNativeToken: true,
    status: "active",
    accentColor: "55 100% 66%",
  },
  arbitrum: {
    id: 42161,
    name: "Arbitrum",
    currency: "USDC",
    decimals: 6,
    token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    monipayRouter: "",
    monibotRouter: "",
    ...V2_STUB,
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum-one-rpc.publicnode.com",
      "https://arbitrum.drpc.org",
      "https://1rpc.io/arb",
    ],
    explorerUrl: "https://arbiscan.io",
    icon: "arbitrum",
    hasNativeToken: true,
    status: "coming_soon",
    accentColor: "207 100% 56%",
  },
  optimism: {
    id: 10,
    name: "Optimism",
    currency: "USDC",
    decimals: 6,
    token: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    monipayRouter: "",
    monibotRouter: "",
    ...V2_STUB,
    rpcUrls: [
      "https://mainnet.optimism.io",
      "https://optimism-rpc.publicnode.com",
      "https://optimism.drpc.org",
      "https://1rpc.io/op",
    ],
    explorerUrl: "https://optimistic.etherscan.io",
    icon: "optimism",
    hasNativeToken: true,
    status: "coming_soon",
    accentColor: "0 100% 50%",
  },
  polygon: {
    id: 137,
    name: "Polygon",
    currency: "USDC",
    decimals: 6,
    token: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    monipayRouter: "",
    monibotRouter: "",
    ...V2_STUB,
    rpcUrls: [
      "https://polygon-rpc.com",
      "https://polygon-bor-rpc.publicnode.com",
      "https://polygon.drpc.org",
      "https://1rpc.io/matic",
    ],
    explorerUrl: "https://polygonscan.com",
    icon: "polygon",
    hasNativeToken: true,
    status: "coming_soon",
    accentColor: "263 84% 55%",
  },
  ethereum: {
    id: 1,
    name: "Ethereum",
    currency: "USDC",
    decimals: 6,
    token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    monipayRouter: "",
    monibotRouter: "",
    ...V2_STUB,
    rpcUrls: [
      "https://eth.drpc.org",
      "https://ethereum-rpc.publicnode.com",
      "https://1rpc.io/eth",
      "https://rpc.ankr.com/eth",
    ],
    explorerUrl: "https://etherscan.io",
    icon: "ethereum",
    hasNativeToken: true,
    status: "coming_soon",
    accentColor: "227 55% 55%",
  },
  ink: {
    id: 57073,
    name: "Ink",
    currency: "USDT0",
    decimals: 6,
    token: "0x0200C29006150606B650577BBE7B6248F58470c1",
    monipayRouter: "0xb5f22E6a45Bc8992DE276Ed4d3aD8626D382E76b",
    monibotRouter: "0x046875a42B8F79E72349d38CB8225cbd6d24C7c5",
    ...V2_STUB,
    iouRegistry: "0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08",
    rpcUrls: [
      "https://rpc-qnd.inkonchain.com",
      "https://ink.drpc.org",
      "https://ink-public.nodies.app",
      "https://rpc-gel.inkonchain.com",
    ],
    explorerUrl: "https://explorer.inkonchain.com",
    icon: "ink",
    hasNativeToken: true,
    status: "active",
    accentColor: "260 70% 55%",
  },
  // ── Arc Testnet (Circle's payment-native L1) ──
  // Gated by VITE_ENABLE_ARC. Placeholder values until Arc network params confirmed.
  // TODO(arc): replace id, token, rpcUrls, explorerUrl with confirmed Arc testnet values.
  arc: {
    id: 0,
    name: "Arc",
    currency: "USDC",
    decimals: 6,
    token: "0x0000000000000000000000000000000000000000",
    monipayRouter: "",
    monibotRouter: "",
    ...V2_STUB,
    rpcUrls: [
      "https://rpc-testnet.arc.network",
    ],
    explorerUrl: "https://explorer-testnet.arc.network",
    icon: "arc" as SupportedNetwork,
    hasNativeToken: false,
    faucetUrl: "https://faucet.arc.network",
    status: "coming_soon",
    accentColor: "210 95% 55%",
  },
} as const;

export function isSupportedNetwork(value: unknown): value is SupportedNetwork {
  return (
    value === "base" ||
    value === "bsc" ||
    value === "tempo" ||
    value === "solana" ||
    value === "celo" ||
    value === "ink" ||
    value === "arc" ||
    value === "arbitrum" ||
    value === "optimism" ||
    value === "polygon" ||
    value === "ethereum"
  );
}

export function isSolanaNetwork(network: SupportedNetwork): boolean {
  return network === "solana";
}

export function getChainConfig(network: SupportedNetwork): ChainConfig {
  if (network === "solana") {
    return {
      id: 0,
      name: "Solana",
      currency: "USDC",
      decimals: 6,
      token: "0x0000000000000000000000000000000000000000",
      monipayRouter: "",
      monibotRouter: "",
      ...V2_STUB,
      rpcUrls: SOLANA_CONFIG.rpcUrls,
      explorerUrl: SOLANA_CONFIG.explorerUrl,
      icon: "solana",
      hasNativeToken: false,
      status: "active",
      accentColor: "168 80% 50%",
    };
  }
  return CHAIN_CONFIGS[network];
}

/** Safe lookup into CHAIN_CONFIGS — returns undefined for Solana */
export function getEvmChainConfig(network: SupportedNetwork): ChainConfig | undefined {
  if (network === "solana") return undefined;
  return CHAIN_CONFIGS[network];
}

/** Get all active chains for UI iteration */
export function getActiveChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => c.status === "active");
}
