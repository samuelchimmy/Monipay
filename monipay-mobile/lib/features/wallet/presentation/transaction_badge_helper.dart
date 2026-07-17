import 'dashboard_state.dart';

/// Badge type ids matching _web_reference TransactionBadge.tsx.
const transactionBadgeTypes = [
  'monibot_p2p',
  'monibot_grant',
  'invoice',
  'external',
  'payment_link',
  'online_order',
];

/// Tag filter labels for the second row (All Tags + these).
const tagFilterOptions = [
  ('monibot_p2p', 'MoniBot P2P'),
  ('monibot_grant', 'MoniBot Grant'),
  ('invoice', 'Invoice'),
  ('payment_link', 'Store'),
  ('online_order', 'Online Sale'),
  ('external', 'External'),
];

/// Determines which badges to show for a transaction. Matches
/// _web_reference/src/components/TransactionBadge.tsx getTransactionBadges.
List<String> getTransactionBadges(DashboardTransaction tx) {
  final badges = <String>[];
  final source = tx.source?.trim().toLowerCase();

  if (source == 'monibot_p2p') badges.add('monibot_p2p');
  if (source == 'monibot_grant') badges.add('monibot_grant');

  if (source == null || source.isEmpty) {
    final meta = tx.metadata;
    final inferred = meta?['monibot_type'];
    if (inferred == 'p2p' || (meta?['is_monibot_transaction'] == true)) {
      badges.add('monibot_p2p');
    } else if (inferred == 'grant' ||
        (tx.payerPayTag?.toLowerCase() == 'monibot')) {
      badges.add('monibot_grant');
    }
  }

  if (tx.invoiceId != null && tx.invoiceId!.isNotEmpty) badges.add('invoice');
  if (source == 'payment_link') badges.add('payment_link');
  if (source == 'online_order') badges.add('online_order');
  if (source == 'external') badges.add('external');
  if (badges.isEmpty &&
      tx.counterparty.startsWith('0x') &&
      (tx.payerPayTag == null || tx.payerPayTag!.isEmpty)) {
    badges.add('external');
  }

  return badges;
}
