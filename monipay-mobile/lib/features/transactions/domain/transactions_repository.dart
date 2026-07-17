// TODO: List and filter transactions (Supabase + chain indexes).

/// Placeholder transaction model.
class Transaction {
  const Transaction({
    required this.id,
    this.amount,
    this.asset,
    this.chainId,
    this.type,
    this.payTag,
    this.createdAt,
  });
  final String id;
  final String? amount;
  final String? asset;
  final String? chainId;
  final String? type;
  final String? payTag;
  final DateTime? createdAt;
}

/// Contract for transaction history.
abstract class TransactionsRepository {
  Future<List<Transaction>> getTransactions(String userId, {int limit = 50});
  Future<Transaction?> getTransaction(String id);
  // TODO: pagination, filters by chain/asset.
}
