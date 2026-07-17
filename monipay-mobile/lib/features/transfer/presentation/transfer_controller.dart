import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/transfer_repository.dart';
import '../data/transfer_repository_impl.dart';

final transferRepositoryProvider = Provider<TransferRepository>(
  (ref) => TransferRepositoryImpl(),
);

// TODO: Add Notifier/StateNotifier for send flow (amount, PayTag, chain, confirmation).
final transferControllerProvider = Provider<TransferRepository>(
  (ref) => ref.watch(transferRepositoryProvider),
);
