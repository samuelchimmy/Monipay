// Cleaned Celo-only configuration for MiniPay
typedef SupportedNetwork = String;

class ChainConfig {
  const ChainConfig({
    required this.id,
    required this.name,
    required this.currency,
    required this.decimals,
    required this.token,
    required this.monipayRouter,
    required this.monibotRouter,
    required this.rpcUrls,
    required this.explorerUrl,
  });

  final int id;
  final String name;
  final String currency;
  final int decimals;
  final String token;
  final String monipayRouter;
  final String monibotRouter;
  final List<String> rpcUrls;
  final String explorerUrl;
}

const ChainConfig celoChainConfig = ChainConfig(
  id: 42220,
  name: 'Celo',
  currency: 'cUSD',
  decimals: 18,
  token: '0x765DE81E75624D1c647b96F960EE1EFD4024c9e4',
  monipayRouter: '0xa39C3B7e02686cf7F226337525515c694318BDb9',
  monibotRouter: '0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc',
  rpcUrls: ['https://forno.celo.org'],
  explorerUrl: 'https://celoscan.io',
);

const String supabaseBaseUrl = 'https://vdaeojxonqmzejwiioaq.supabase.co';
String get supabaseFunctionsUrl => '$supabaseBaseUrl/functions/v1';

ChainConfig getChainConfig(String network) => celoChainConfig;
bool isSupportedNetwork(String value) => value.toLowerCase() == 'celo';
bool isSolanaNetwork(String network) => false;
