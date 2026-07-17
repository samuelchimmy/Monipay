import '../domain/transactions_repository.dart';

/// TODO: Inject Supabase client; implement [TransactionsRepository].
class TransactionsRepositoryImpl implements TransactionsRepository {
  @override
  Future<List<Transaction>> getTransactions(String userId, {int limit = 50}) async =>
      [];

  @override
  Future<Transaction?> getTransaction(String id) async => null;
}
