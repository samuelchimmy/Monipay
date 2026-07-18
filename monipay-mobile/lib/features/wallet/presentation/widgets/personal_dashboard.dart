import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../app/theme/app_theme.dart';
import '../dashboard_state.dart';

class PersonalDashboard extends StatelessWidget {
  const PersonalDashboard({
    super.key,
    required this.transactions,
    required this.isRefreshing,
    required this.onRefresh,
  });

  final List<DashboardTransaction> transactions;
  final bool isRefreshing;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
          child: Text(
            'RECENT ACTIVITY',
            style: GoogleFonts.dmSans(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: muted,
              letterSpacing: 1.2,
            ),
          ),
        ),
        if (transactions.isEmpty)
          _EmptyState(foreground: fg, muted: muted)
        else
          ...transactions.map(
            (tx) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 0),
              child: _TransactionRow(
                transaction: tx,
                fg: fg,
                muted: muted,
              ),
            ),
          ),
      ],
    );
  }
}

class _TransactionRow extends StatelessWidget {
  const _TransactionRow({
    required this.transaction,
    required this.fg,
    required this.muted,
  });

  final DashboardTransaction transaction;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    final isSent = transaction.type == 'sent';
    final normalizedTag = transaction.counterparty.replaceFirst('@', '').toLowerCase();
    final showVerified = normalizedTag == 'monibot';
    final icon = isSent ? LucideIcons.arrowUpRight : LucideIcons.arrowDownLeft;
    final amountColor = isSent ? MonipayColors.destructive : MonipayColors.success;
    final prefix = isSent ? '-' : '+';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: fg.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: muted.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: amountColor.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: amountColor),
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
                        transaction.counterparty.startsWith('0x')
                            ? transaction.counterparty
                            : '@${transaction.counterparty.replaceFirst('@', '')}',
                        style: GoogleFonts.dmSans(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
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
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  _formatTime(transaction.timestamp),
                  style: GoogleFonts.dmSans(
                    fontSize: 12,
                    color: muted,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '$prefix\$${transaction.amount.toStringAsFixed(2)}',
            style: GoogleFonts.dmSans(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: amountColor,
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime t) {
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

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.foreground, required this.muted});

  final Color foreground;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              LucideIcons.wallet,
              size: 56,
              color: muted,
            ),
            const SizedBox(height: 16),
            Text(
              'No transactions yet',
              style: GoogleFonts.dmSans(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: foreground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Fund your wallet to get started',
              style: GoogleFonts.dmSans(
                fontSize: 14,
                color: muted,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
