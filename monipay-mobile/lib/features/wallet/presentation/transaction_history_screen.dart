import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/config/chain_configs.dart';
import 'dashboard_controller.dart';
import 'dashboard_state.dart';
import 'transaction_badge_helper.dart';
import 'widgets/transaction_receipt_modal.dart';

class TransactionHistoryScreen extends ConsumerStatefulWidget {
  const TransactionHistoryScreen({super.key});

  @override
  ConsumerState<TransactionHistoryScreen> createState() =>
      _TransactionHistoryScreenState();
}

class _TransactionHistoryScreenState
    extends ConsumerState<TransactionHistoryScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _typeFilter = 'All';
  String _tagFilter = 'all'; // 'all' or one of transactionBadgeTypes
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 200) {
      ref.read(dashboardControllerProvider.notifier).loadMoreTransactions();
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    var list = dashboard.transactions;
    if (_searchQuery.isNotEmpty) {
      list = list
          .where((t) =>
              t.counterparty.toLowerCase().contains(_searchQuery.toLowerCase()))
          .toList();
    }
    if (_typeFilter == 'Sent') list = list.where((t) => t.type == 'sent').toList();
    if (_typeFilter == 'Received') list = list.where((t) => t.type == 'received').toList();
    if (_tagFilter != 'all') {
      list = list
          .where((t) => getTransactionBadges(t).contains(_tagFilter))
          .toList();
    }

    return Scaffold(
      backgroundColor: isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight,
      body: SafeArea(
        child: Column(
          children: [
            ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  decoration: BoxDecoration(
                    color: (isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight)
                        .withOpacity(0.8),
                    border: Border(bottom: BorderSide(color: muted.withOpacity(0.3))),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(LucideIcons.arrowLeft),
                        onPressed: () => context.pop(),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Transaction History',
                        style: GoogleFonts.dmSans(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _searchController,
                onChanged: (v) => setState(() => _searchQuery = v),
                decoration: InputDecoration(
                  hintText: 'Search by moniTag...',
                  prefixIcon: const Icon(LucideIcons.search, size: 20),
                  filled: true,
                  fillColor: fg.withOpacity(0.06),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                style: GoogleFonts.dmSans(fontSize: 14, color: fg),
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: ['All', 'Sent', 'Received']
                    .map((t) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(t),
                            selected: _typeFilter == t,
                            onSelected: (_) => setState(() => _typeFilter = t),
                            backgroundColor: _typeFilter == t
                                ? MonipayColors.primaryBlue
                                : Colors.transparent,
                            selectedColor: MonipayColors.primaryBlue,
                            side: BorderSide(
                              color: _typeFilter == t
                                  ? MonipayColors.primaryBlue
                                  : muted.withOpacity(0.5),
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: const Text('All Tags'),
                      selected: _tagFilter == 'all',
                      onSelected: (_) => setState(() => _tagFilter = 'all'),
                      backgroundColor: _tagFilter == 'all'
                          ? const Color(0xFF0052FF)
                          : Colors.transparent,
                      selectedColor: const Color(0xFF0052FF),
                      side: BorderSide(
                        color: _tagFilter == 'all'
                            ? const Color(0xFF0052FF)
                            : muted.withOpacity(0.5),
                      ),
                      labelStyle: GoogleFonts.dmSans(
                        fontSize: 12,
                        color: _tagFilter == 'all' ? Colors.white : fg,
                      ),
                    ),
                  ),
                  ...tagFilterOptions.map((opt) {
                    final value = opt.$1;
                    final label = opt.$2;
                    final selected = _tagFilter == value;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(label),
                        selected: selected,
                        onSelected: (_) => setState(() {
                          _tagFilter = selected ? 'all' : value;
                        }),
                        backgroundColor: selected
                            ? const Color(0xFF0052FF)
                            : Colors.transparent,
                        selectedColor: const Color(0xFF0052FF),
                        side: BorderSide(
                          color: selected
                              ? const Color(0xFF0052FF)
                              : muted.withOpacity(0.5),
                        ),
                        labelStyle: GoogleFonts.dmSans(
                          fontSize: 12,
                          color: selected ? Colors.white : fg,
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: list.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(LucideIcons.wallet, size: 48, color: MonipayColors.mutedSlate),
                          const SizedBox(height: 16),
                          Text(
                            'No transactions found',
                            style: GoogleFonts.dmSans(fontSize: 16, color: muted),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: list.length + (dashboard.hasMoreTransactions ? 0 : 1) + (dashboard.isLoadingMoreTransactions ? 1 : 0),
                      itemBuilder: (context, i) {
                        if (i == list.length) {
                          if (dashboard.isLoadingMoreTransactions) {
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )),
                            );
                          }
                          return Padding(
                            padding: const EdgeInsets.all(16),
                            child: Center(
                              child: Text(
                                'All transactions loaded',
                                style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                              ),
                            ),
                          );
                        }
                        final tx = list[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _TransactionCard(
                            transaction: tx,
                            preferredNetwork: dashboard.preferredNetwork,
                            cardBg: cardBg,
                            fg: fg,
                            muted: muted,
                            onTap: () => _showReceipt(context, tx),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _showReceipt(BuildContext context, DashboardTransaction tx) {
    final preferredNetwork = ref.read(dashboardControllerProvider).preferredNetwork;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => TransactionReceiptModal(
        transaction: tx,
        preferredNetwork: preferredNetwork,
        onClose: () => Navigator.of(ctx).pop(),
      ),
    );
  }
}

class _TransactionCard extends StatelessWidget {
  const _TransactionCard({
    required this.transaction,
    required this.preferredNetwork,
    required this.cardBg,
    required this.fg,
    required this.muted,
    required this.onTap,
  });

  final DashboardTransaction transaction;
  final String preferredNetwork;
  final Color cardBg;
  final Color fg;
  final Color muted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isSent = transaction.type == 'sent';
    final icon = isSent ? LucideIcons.arrowUpRight : LucideIcons.arrowDownLeft;
    final iconBg = isSent
        ? MonipayColors.destructive.withOpacity(0.1)
        : MonipayColors.success.withOpacity(0.1);
    final iconColor = isSent ? MonipayColors.destructive : MonipayColors.success;
    final amountColor = isSent ? MonipayColors.destructive : MonipayColors.success;
    final prefix = isSent ? '-' : '+';
    final counterparty = transaction.counterparty.startsWith('0x')
        ? '${transaction.counterparty.substring(0, 6)}...${transaction.counterparty.substring(transaction.counterparty.length - 4)}'
        : '@${transaction.counterparty.replaceFirst('@', '')}';
    final showVerified = !transaction.counterparty.startsWith('0x') &&
        transaction.counterparty.replaceFirst('@', '').toLowerCase() == 'monibot';

    return Material(
      color: cardBg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: muted.withOpacity(0.2)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            counterparty,
                            style: GoogleFonts.dmSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: fg,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (showVerified) ...[
                          const SizedBox(width: 4),
                          const Icon(
                            LucideIcons.badgeCheck,
                            size: 14,
                            color: MonipayColors.primaryBlue,
                          ),
                        ],
                        const SizedBox(width: 6),
                        Wrap(
                          spacing: 4,
                          runSpacing: 2,
                          children: getTransactionBadges(transaction)
                              .map((b) => _TransactionBadgePill(type: b))
                              .toList(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatDate(transaction.timestamp),
                      style: GoogleFonts.dmSans(fontSize: 11, color: muted),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$prefix\$${transaction.amount.toStringAsFixed(2)}',
                    style: GoogleFonts.dmSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: amountColor,
                    ),
                  ),
                  Text(
                    getChainConfig(preferredNetwork).currency,
                    style: GoogleFonts.dmSans(fontSize: 10, color: muted),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime t) {
    final now = DateTime.now();
    final diff = now.difference(t);
    if (diff.inMinutes < 60) {
      final mins = diff.inMinutes <= 0 ? 1 : diff.inMinutes;
      return '$mins min${mins == 1 ? '' : 's'} ago';
    }
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${t.month}/${t.day}/${t.year}';
  }
}

/// Small rounded pill per TransactionBadge.tsx: green/blue/orange/purple.
class _TransactionBadgePill extends StatelessWidget {
  const _TransactionBadgePill({required this.type});

  final String type;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fgColor;
    String label;
    switch (type) {
      case 'monibot_p2p':
        label = 'MoniBot P2P';
        bg = Colors.green.withOpacity(0.1);
        fgColor = Colors.green;
        break;
      case 'monibot_grant':
        label = 'MoniBot Grant';
        bg = Colors.green.withOpacity(0.1);
        fgColor = Colors.green;
        break;
      case 'invoice':
        label = 'Invoice';
        bg = Colors.blue.withOpacity(0.1);
        fgColor = Colors.blue;
        break;
      case 'external':
        label = 'External';
        bg = Colors.orange.withOpacity(0.1);
        fgColor = Colors.orange;
        break;
      case 'payment_link':
        label = 'Store';
        bg = Colors.purple.withOpacity(0.1);
        fgColor = Colors.purple;
        break;
      case 'online_order':
        label = 'Online Sale';
        bg = Colors.purple.withOpacity(0.1);
        fgColor = Colors.purple;
        break;
      default:
        label = type;
        bg = Colors.grey.withOpacity(0.1);
        fgColor = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fgColor.withOpacity(0.2)),
      ),
      child: Text(
        label,
        style: GoogleFonts.dmSans(fontSize: 10, fontWeight: FontWeight.w600, color: fgColor),
      ),
    );
  }
}
