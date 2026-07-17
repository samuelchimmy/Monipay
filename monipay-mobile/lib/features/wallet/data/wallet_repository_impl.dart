import '../domain/wallet_repository.dart';

/// TODO: Inject Supabase client and/or web3/chain clients; implement [WalletRepository].
class WalletRepositoryImpl implements WalletRepository {
  @override
  Future<Wallet?> getWallet(String userId) async => null;

  @override
  Future<List<Wallet>> listWallets(String userId) async => [];
}
