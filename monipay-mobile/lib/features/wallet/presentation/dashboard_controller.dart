import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/supabase/supabase_client_provider.dart';
import '../../auth/presentation/splash_screen.dart' show secureStorageServiceProvider;
import '../data/dashboard_repository.dart';
import '../data/dashboard_repository_impl.dart';
import 'dashboard_state.dart';

const _kHideBalanceKey = 'monipay_hide_balance';

/// Dashboard state and actions.
class DashboardController extends StateNotifier<DashboardState> {
  DashboardController({
    required this.repository,
    required this.secureStorage,
  }) : super(const DashboardState()) {
    _loadInitial();
  }

  final DashboardRepository repository;
  final SecureStorageService secureStorage;
  Timer? _balancePollTimer;

  Future<void> _loadInitial() async {
    final hide = await secureStorage.read(key: _kHideBalanceKey);
    state = state.copyWith(hideBalance: hide == '1');

    final profile = await repository.loadProfile();
    if (profile != null) {
      List<DashboardTransaction> transactions = const [];
      if (profile.id != null && profile.id!.isNotEmpty) {
        transactions = await repository.syncTransactions(profileId: profile.id!);
      }
      state = state.copyWith(
        profileId: profile.id,
        payTag: profile.payTag,
        walletAddress: profile.walletAddress,
        solanaAddress: profile.solanaAddress,
        balance: profile.balance,
        transactions: transactions,
        preferredNetwork: profile.preferredNetwork,
        hasMoreTransactions: true,
      );
    }
  }

  void setMode(String mode) {
    if (mode == 'personal' || mode == 'merchant') {
      state = state.copyWith(mode: mode, clearActiveTab: true, clearOpenModal: true);
    }
  }

  Future<void> toggleHideBalance() async {
    final next = !state.hideBalance;
    state = state.copyWith(hideBalance: next);
    await secureStorage.write(key: _kHideBalanceKey, value: next ? '1' : '0');
  }

  void setActiveTab(String? tab) {
    state = state.copyWith(activeTab: tab, openModal: tab);
  }

  void setOpenModal(String? modal) {
    state = state.copyWith(openModal: modal, activeTab: modal);
  }

  void closeModals() {
    state = state.copyWith(clearActiveTab: true, clearOpenModal: true, clearFundSheetShortfall: true);
  }

  void openFundWithShortfall(double shortfall) {
    state = state.copyWith(openModal: 'fund', activeTab: 'fund', fundSheetShortfall: shortfall);
  }

  Future<void> setPreferredNetwork(String network) async {
    final n = network.toLowerCase();
    final profileId = state.profileId;
    final walletAddress = state.walletAddress;
    if (profileId != null && walletAddress != null && profileId.isNotEmpty && walletAddress.isNotEmpty) {
      final ok = await repository.updatePreferredNetwork(profileId, walletAddress, n);
      if (ok) {
        await secureStorage.write(key: 'monipay_preferred_network', value: n);
      }
    } else {
      await secureStorage.write(key: 'monipay_preferred_network', value: n);
    }
    state = state.copyWith(preferredNetwork: n);
    await refresh();
  }

  Future<void> refresh() async {
    state = state.copyWith(isRefreshing: true);
    final profile = await repository.loadProfile();
    if (profile != null) {
      List<DashboardTransaction> transactions = const [];
      String? txCursor;
      var hasMore = true;
      if (profile.id != null) {
        final result = await repository.loadMoreTransactions(
          profile.id!,
          _transactionsPageSize,
          null,
        );
        transactions = result.transactions;
        txCursor = result.nextCursor;
        hasMore = result.hasMore;
      }
      state = state.copyWith(
        profileId: profile.id,
        payTag: profile.payTag,
        walletAddress: profile.walletAddress,
        solanaAddress: profile.solanaAddress,
        balance: profile.balance,
        transactions: transactions,
        preferredNetwork: profile.preferredNetwork,
        isRefreshing: false,
        hasMoreTransactions: hasMore,
        txCursor: txCursor,
      );
    } else {
      state = state.copyWith(isRefreshing: false);
    }
  }

  Future<void> refreshBalance() async {
    final wallet = state.walletAddress;
    if (wallet == null || wallet.isEmpty) return;
    final balance = await repository.fetchBalance(
      network: state.preferredNetwork,
      walletAddress: wallet,
      solanaAddress: state.solanaAddress,
    );
    state = state.copyWith(balance: balance);
  }

  Future<void> syncTransactions({int limit = 50}) async {
    final profileId = state.profileId;
    if (profileId == null || profileId.isEmpty) return;
    final txs = await repository.syncTransactions(profileId: profileId, limit: limit);
    state = state.copyWith(transactions: txs);
  }

  void startBalancePolling() {
    _balancePollTimer?.cancel();
    _balancePollTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => refreshBalance(),
    );
  }

  void stopBalancePolling() {
    _balancePollTimer?.cancel();
    _balancePollTimer = null;
  }

  static const int _transactionsPageSize = 50;

  Future<void> loadMoreTransactions() async {
    if (state.isLoadingMoreTransactions || !state.hasMoreTransactions) return;
    final profileId = state.profileId;
    if (profileId == null || profileId.isEmpty) return;
    state = state.copyWith(isLoadingMoreTransactions: true);
    final result = await repository.loadMoreTransactions(
      profileId,
      _transactionsPageSize,
      state.txCursor,
    );
    state = state.copyWith(
      transactions: [...state.transactions, ...result.transactions],
      isLoadingMoreTransactions: false,
      hasMoreTransactions: result.hasMore,
      txCursor: result.nextCursor ?? state.txCursor,
    );
  }

  /// Optimistic update after send: deduct balance and prepend a sent transaction.
  void applySentTransaction({required double amount, required String counterparty}) {
    final tx = DashboardTransaction(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      type: 'sent',
      counterparty: counterparty,
      amount: amount,
      timestamp: DateTime.now(),
      status: 'pending',
    );
    state = state.copyWith(
      balance: (state.balance - amount * 1.01).clamp(0.0, double.infinity),
      transactions: [tx, ...state.transactions],
    );
  }

  @override
  void dispose() {
    _balancePollTimer?.cancel();
    super.dispose();
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  final storage = ref.watch(secureStorageServiceProvider);
  final supabase = ref.watch(supabaseClientProvider);
  return DashboardRepositoryImpl(secureStorage: storage, supabase: supabase);
});

final dashboardControllerProvider =
    StateNotifierProvider<DashboardController, DashboardState>((ref) {
  final repo = ref.watch(dashboardRepositoryProvider);
  final storage = ref.watch(secureStorageServiceProvider);
  return DashboardController(repository: repo, secureStorage: storage);
});
