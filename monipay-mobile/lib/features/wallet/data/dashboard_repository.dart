import '../presentation/dashboard_state.dart';

/// Result of loading dashboard profile + balance + transactions.
class DashboardProfile {
  const DashboardProfile({
    this.id,
    this.payTag,
    this.walletAddress,
    this.solanaAddress,
    this.balance = 0.0,
    this.transactions = const [],
    this.preferredNetwork = 'base',
  });

  /// Supabase profile id (for relay-payment history).
  final String? id;
  final String? payTag;
  final String? walletAddress;
  /// Solana wallet address (base58) for Direct Deposit on Solana.
  final String? solanaAddress;
  final double balance;
  final List<DashboardTransaction> transactions;
  final String preferredNetwork;
}

/// Result of loading more transactions (cursor-based).
class LoadMoreTransactionsResult {
  const LoadMoreTransactionsResult({
    required this.transactions,
    this.nextCursor,
    this.hasMore = false,
  });
  final List<DashboardTransaction> transactions;
  final String? nextCursor;
  final bool hasMore;
}

/// Contract for loading dashboard data (Supabase profiles + relay-payment history).
abstract class DashboardRepository {
  Future<DashboardProfile?> loadProfile();
  Future<double> fetchBalance({
    required String network,
    required String walletAddress,
    String? solanaAddress,
  });
  Future<List<DashboardTransaction>> syncTransactions({
    required String profileId,
    int limit,
  });
  /// Load more transactions. [cursor] null for first page.
  Future<LoadMoreTransactionsResult> loadMoreTransactions(String? profileId, int limit, [String? cursor]);
  /// Persist preferred network to Supabase (check-paytag updatePreferredNetwork). Reference: PayTagContext setPreferredNetwork.
  Future<bool> updatePreferredNetwork(String profileId, String walletAddress, String network);
}
