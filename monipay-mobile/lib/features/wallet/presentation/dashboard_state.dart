/// Dashboard UI and data state.
class DashboardState {
  final String mode;
  final bool hideBalance;
  final String? activeTab;
  final String? openModal;
  final double balance;
  final List<DashboardTransaction> transactions;
  final bool isRefreshing;
  final bool isLoadingMoreTransactions;
  final bool hasMoreTransactions;
  final String? profileId;
  final String? txCursor;
  final String? payTag;
  final String? walletAddress;
  final String? solanaAddress;
  final String preferredNetwork;
  /// When opening Fund sheet from Send due to insufficient funds.
  final double? fundSheetShortfall;

  const DashboardState({
    this.mode = 'personal',
    this.hideBalance = false,
    this.activeTab,
    this.openModal,
    this.balance = 0.0,
    this.transactions = const [],
    this.isRefreshing = false,
    this.isLoadingMoreTransactions = false,
    this.hasMoreTransactions = true,
    this.profileId,
    this.txCursor,
    this.payTag,
    this.walletAddress,
    this.solanaAddress,
    this.preferredNetwork = 'base',
    this.fundSheetShortfall,
  });

  // Sentinel for fields that can be explicitly nulled via copyWith.
  static const _keep = Object();

  DashboardState copyWith({
    String? mode,
    bool? hideBalance,
    // Use clearActiveTab / clearOpenModal to set these to null.
    Object? activeTab = _keep,
    Object? openModal = _keep,
    bool clearActiveTab = false,
    bool clearOpenModal = false,
    double? balance,
    List<DashboardTransaction>? transactions,
    bool? isRefreshing,
    bool? isLoadingMoreTransactions,
    bool? hasMoreTransactions,
    String? profileId,
    String? txCursor,
    String? payTag,
    String? walletAddress,
    String? solanaAddress,
    String? preferredNetwork,
    double? fundSheetShortfall,
    bool clearFundSheetShortfall = false,
  }) {
    return DashboardState(
      mode: mode ?? this.mode,
      hideBalance: hideBalance ?? this.hideBalance,
      activeTab: clearActiveTab ? null : (activeTab == _keep ? this.activeTab : activeTab as String?),
      openModal: clearOpenModal ? null : (openModal == _keep ? this.openModal : openModal as String?),
      balance: balance ?? this.balance,
      transactions: transactions ?? this.transactions,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMoreTransactions: isLoadingMoreTransactions ?? this.isLoadingMoreTransactions,
      hasMoreTransactions: hasMoreTransactions ?? this.hasMoreTransactions,
      profileId: profileId ?? this.profileId,
      txCursor: txCursor ?? this.txCursor,
      payTag: payTag ?? this.payTag,
      walletAddress: walletAddress ?? this.walletAddress,
      solanaAddress: solanaAddress ?? this.solanaAddress,
      preferredNetwork: preferredNetwork ?? this.preferredNetwork,
      fundSheetShortfall: clearFundSheetShortfall ? null : (fundSheetShortfall ?? this.fundSheetShortfall),
    );
  }
}

/// Single transaction for list display. Maps relay-payment history response (reference: PayTagContext syncTransactions).
class DashboardTransaction {
  const DashboardTransaction({
    required this.id,
    required this.type,
    required this.counterparty,
    required this.amount,
    required this.timestamp,
    this.fee = 0.0,
    this.txHash,
    this.items,
    this.invoiceId,
    this.payerPayTag,
    this.source,
    this.metadata,
    this.status = 'completed',
  });

  final String id;
  final String type; // 'sent' | 'received'
  final String counterparty;
  final double amount;
  final DateTime timestamp;
  final double fee;
  final String? txHash;
  final List<Map<String, dynamic>>? items;
  final String? invoiceId;
  final String? payerPayTag;
  final String? source;
  final Map<String, dynamic>? metadata;
  final String status; // 'completed' | 'pending' | 'failed'
}

/// Personal bottom nav tab ids.
const personalTabs = ['invoices', 'send', 'pay', 'receive', 'account'];

/// Merchant bottom nav tab ids.
const merchantTabs = ['stats', 'store', 'charge', 'history', 'account'];
