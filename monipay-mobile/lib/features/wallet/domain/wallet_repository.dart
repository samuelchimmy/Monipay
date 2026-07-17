// TODO: Multi-chain wallet (Base, BSC, Solana), USDC/USDT balances.

/// Placeholder wallet model.
class Wallet {
  const Wallet({
    required this.id,
    this.balanceUsdc,
    this.balanceUsdt,
    this.chainIds,
  });
  final String id;
  final String? balanceUsdc;
  final String? balanceUsdt;
  final List<String>? chainIds;
}

/// Contract for wallet data (Supabase + chain indexes).
abstract class WalletRepository {
  Future<Wallet?> getWallet(String userId);
  Future<List<Wallet>> listWallets(String userId);
  // TODO: refresh balances from chains.
}
