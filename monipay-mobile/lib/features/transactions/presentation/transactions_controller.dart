import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/transactions_repository.dart';
import '../data/transactions_repository_impl.dart';
import '../../auth/presentation/auth_controller.dart';

final transactionsRepositoryProvider = Provider<TransactionsRepository>(
  (ref) => TransactionsRepositoryImpl(),
);

final transactionsControllerProvider = FutureProvider<List<Transaction>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];
  return ref
      .watch(transactionsRepositoryProvider)
      .getTransactions(user.id, limit: 50);
});
