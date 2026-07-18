import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/splash_screen.dart' show secureStorageServiceProvider;
import '../domain/wallet_repository.dart';
import '../data/wallet_repository_impl.dart';
import '../../auth/presentation/auth_controller.dart';

final walletRepositoryProvider = Provider<WalletRepository>(
  (ref) => WalletRepositoryImpl(),
);

final walletControllerProvider = FutureProvider<Wallet?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  return ref.watch(walletRepositoryProvider).getWallet(user.id);
});

/// Canonical moniTag source from secure storage.
final moniTagProvider = FutureProvider<String?>((ref) async {
  final storage = ref.watch(secureStorageServiceProvider);
  final tag = await storage.read(key: 'monipay_pay_tag');
  if (tag == null || tag.trim().isEmpty) return null;
  return tag.trim().replaceFirst('@', '');
});
