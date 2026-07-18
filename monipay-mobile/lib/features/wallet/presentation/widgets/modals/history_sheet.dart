import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';

import '../../dashboard_controller.dart';
import '../../dashboard_state.dart';
import '../../transaction_badge_helper.dart';

class HistorySheet extends ConsumerWidget {
  const HistorySheet({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.25,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) {
          return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Theme.of(context).dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Row(
                  children: [
                    Text(
                      'Transaction History',
                      style: GoogleFonts.dmSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: onClose,
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Builder(
                  builder: (context) {
                    final txs =
                        ref.watch(dashboardControllerProvider).transactions.take(10).toList();
                    if (txs.isEmpty) {
                      return Center(
                        child: Text(
                          'No transactions yet',
                          style: GoogleFonts.dmSans(
                            fontSize: 16,
                            color: Theme.of(context).hintColor,
                          ),
                        ),
                      );
                    }
                    return ListView.builder(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      itemCount: txs.length + 1,
                      itemBuilder: (context, i) {
                        if (i == txs.length) {
                          return TextButton(
                            onPressed: () => context.push('/transaction-history'),
                            child: const Text('View full history'),
                          );
                        }
                        final tx = txs[i];
                        return _HistoryRow(transaction: tx);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.transaction});

  final DashboardTransaction transaction;

  @override
  Widget build(BuildContext context) {
    final isSent = transaction.type == 'sent';
    final fg = Theme.of(context).brightness == Brightness.dark
        ? Colors.white
        : Colors.black;
    const muted = Color(0xFF64748B);
    final amountColor = isSent ? const Color(0xFFEF4444) : const Color(0xFF22C55E);
    final label = transaction.counterparty.startsWith('0x')
        ? '${transaction.counterparty.substring(0, 6)}...${transaction.counterparty.substring(transaction.counterparty.length - 4)}'
        : '@${transaction.counterparty.replaceFirst('@', '')}';
    final showVerified = transaction.counterparty.replaceFirst('@', '').toLowerCase() == 'monibot';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: muted.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.dmSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: fg,
                    ),
                  ),
                ),
                if (showVerified) ...[
                  const SizedBox(width: 4),
                  const Icon(LucideIcons.badgeCheck, size: 14, color: Color(0xFF0052FF)),
                ],
                const SizedBox(width: 6),
                Wrap(
                  spacing: 4,
                  children: getTransactionBadges(transaction)
                      .take(1)
                      .map((e) => Text(
                            e,
                            style: GoogleFonts.dmSans(fontSize: 10, color: muted),
                          ))
                      .toList(),
                ),
              ],
            ),
          ),
          Text(
            '${isSent ? '-' : '+'}\$${transaction.amount.toStringAsFixed(2)}',
            style: GoogleFonts.dmSans(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: amountColor,
            ),
          ),
        ],
      ),
    );
  }
}
