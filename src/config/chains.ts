// MoniPay is Celo-only. All non-Celo networks were removed during the
// multichain strip; the public API surface (types, guards, CHAIN_CONFIGS,
// getActiveChains) is preserved so consumers continue to compile.
export type SupportedNetwork = "celo";

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

// ── V2 contract stub (empty until deployed) ──
const V2_STUB = {
  scatterVault: "" as const,
  relayerGateway: "" as const,
  adminConfig: "" as const,
  campaignFactory: "" as const,
  iouRegistry: "" as const,
  moniTagRegistry: "" as const,
};

// EvmNetwork mirrors SupportedNetwork now that Solana is removed.
export type EvmNetwork = SupportedNetwork;

export const CHAIN_CONFIGS: Record<EvmNetwork, ChainConfig> = {
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
} as const;

export function isSupportedNetwork(value: unknown): value is SupportedNetwork {
  return value === "celo";
}

export function isSolanaNetwork(_network: SupportedNetwork): boolean {
  // Solana support was removed in the Celo-only strip.
  return false;
}

export function getChainConfig(network: SupportedNetwork): ChainConfig {
  return CHAIN_CONFIGS[network];
}

/** Safe lookup into CHAIN_CONFIGS. */
export function getEvmChainConfig(network: SupportedNetwork): ChainConfig | undefined {
  return CHAIN_CONFIGS[network];
}

/** Get all active chains for UI iteration */
export function getActiveChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => c.status === "active");
}
