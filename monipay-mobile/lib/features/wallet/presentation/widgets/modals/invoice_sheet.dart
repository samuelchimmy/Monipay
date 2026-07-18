import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../dashboard_controller.dart';
import '../../dashboard_state.dart';

class InvoiceSheet extends ConsumerStatefulWidget {
  const InvoiceSheet({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  ConsumerState<InvoiceSheet> createState() => _InvoiceSheetState();
}

class _InvoiceSheetState extends ConsumerState<InvoiceSheet> {
  int _tabIndex = 0; // 0 = Received, 1 = Sent
  List<_InvoiceItem> _received = [];
  List<_InvoiceItem> _sent = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchInvoices();
  }

  Future<void> _fetchInvoices() async {
    final dashboard = ref.read(dashboardControllerProvider);
    final profileId = dashboard.profileId;
    if (profileId == null || profileId.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }

    // Use already-loaded transactions as the primary source.
    var transactions = dashboard.transactions;

    // If no transactions cached yet, fetch via the authenticated relay-payment function.
    if (transactions.isEmpty) {
      try {
        final response = await Supabase.instance.client.functions.invoke(
          'relay-payment',
          body: {
            'action': 'history',
            'message': {'profileId': profileId, 'limit': 100},
          },
        );
        final data = response.data as Map<String, dynamic>?;
        final list = (data?['transactions'] as List<dynamic>?) ?? [];
        transactions = list.map((raw) {
          final tx = Map<String, dynamic>.from(raw as Map);
          final createdAt = tx['created_at'];
          DateTime ts = DateTime.now();
          if (createdAt is String) ts = DateTime.tryParse(createdAt) ?? ts;
          if (createdAt is int) ts = DateTime.fromMillisecondsSinceEpoch(createdAt);
          return DashboardTransaction(
            id: tx['id'] as String? ?? '',
            type: tx['type'] as String? ?? 'sent',
            counterparty: tx['counterparty'] as String? ?? '',
            amount: double.tryParse(tx['amount']?.toString() ?? '') ?? 0.0,
            timestamp: ts,
            invoiceId: tx['invoice_id'] as String?,
            payerPayTag: tx['payer_pay_tag'] as String?,
          );
        }).toList();
      } catch (_) {
        if (mounted) setState(() => _loading = false);
        return;
      }
    }

    if (!mounted) return;
    final myTag = dashboard.payTag ?? '';

    setState(() {
      _received = transactions
          .where((t) => t.type == 'received')
          .map((t) => _InvoiceItem(
                id: t.id,
                senderPayTag: t.payerPayTag ?? t.counterparty,
                recipientPayTag: myTag,
                amount: t.amount,
                status: 'paid',
                createdAt: t.timestamp,
              ))
          .toList();
      _sent = transactions
          .where((t) => t.type == 'sent')
          .map((t) => _InvoiceItem(
                id: t.id,
                senderPayTag: myTag,
                recipientPayTag: t.counterparty,
                amount: t.amount,
                status: 'paid',
                createdAt: t.timestamp,
              ))
          .toList();
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    final invoices = _tabIndex == 0 ? _received : _sent;

    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          widget.onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) {
          return Container(
            decoration: BoxDecoration(
              color: theme.scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.dividerColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: MonipayColors.primaryBlue.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(LucideIcons.fileText, size: 20, color: MonipayColors.primaryBlue),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Invoices',
                        style: GoogleFonts.dmSans(fontSize: 20, fontWeight: FontWeight.w700, color: fg),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: widget.onClose,
                        icon: const Icon(LucideIcons.x),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: muted.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _TabChip(
                            label: 'Received',
                            isActive: _tabIndex == 0,
                            onTap: () => setState(() => _tabIndex = 0),
                            cardBg: cardBg,
                            fg: fg,
                            muted: muted,
                          ),
                        ),
                        Expanded(
                          child: _TabChip(
                            label: 'Sent',
                            isActive: _tabIndex == 1,
                            onTap: () => setState(() => _tabIndex = 1),
                            cardBg: cardBg,
                            fg: fg,
                            muted: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: _loading
                      ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                      : invoices.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(LucideIcons.fileText, size: 48, color: muted.withOpacity(0.6)),
                                  const SizedBox(height: 12),
                                  Text(
                                    'No invoices yet',
                                    style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              controller: scrollController,
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              itemCount: invoices.length,
                              itemBuilder: (context, i) => _InvoiceRow(
                                item: invoices[i],
                                isReceived: _tabIndex == 0,
                                fg: fg,
                                muted: muted,
                              ),
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

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.isActive,
    required this.onTap,
    required this.cardBg,
    required this.fg,
    required this.muted,
  });

  final String label;
  final bool isActive;
  final VoidCallback onTap;
  final Color cardBg;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? cardBg : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.dmSans(
                fontSize: 13,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                color: isActive ? fg : muted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InvoiceItem {
  _InvoiceItem({
    required this.id,
    required this.senderPayTag,
    required this.recipientPayTag,
    required this.amount,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String? senderPayTag;
  final String recipientPayTag;
  final double amount;
  final String status;
  final DateTime createdAt;

  static _InvoiceItem fromJson(dynamic json) {
    final map = json as Map<String, dynamic>;
    final createdAt = map['created_at'];
    return _InvoiceItem(
      id: map['id'] as String? ?? '',
      senderPayTag: map['senderPayTag'] as String? ?? map['sender_pay_tag'] as String?,
      recipientPayTag: map['recipient_pay_tag'] as String? ?? '',
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      status: map['status'] as String? ?? 'pending',
      createdAt: createdAt is String ? DateTime.tryParse(createdAt) ?? DateTime.now() : DateTime.now(),
    );
  }

  String get relativeTime {
    final now = DateTime.now();
    final diff = now.difference(createdAt);
    if (diff.inDays > 0) return '${diff.inDays} day${diff.inDays == 1 ? '' : 's'} ago';
    if (diff.inHours > 0) return '${diff.inHours} hour${diff.inHours == 1 ? '' : 's'} ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes} min ago';
    return 'Just now';
  }
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({
    required this.item,
    required this.isReceived,
    required this.fg,
    required this.muted,
  });

  final _InvoiceItem item;
  final bool isReceived;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    final tag = isReceived ? (item.senderPayTag ?? 'unknown') : item.recipientPayTag;
    const paidGreen = Color(0xFF1A9E4A);
    final amber = Colors.amber.shade700;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: muted.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isReceived ? amber.withOpacity(0.1) : MonipayColors.primaryBlue.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isReceived ? LucideIcons.arrowDownLeft : LucideIcons.arrowUpRight,
              size: 20,
              color: isReceived ? amber : MonipayColors.primaryBlue,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '@$tag',
                  style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: fg),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  item.relativeTime,
                  style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\$${item.amount.toStringAsFixed(2)}',
                style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: fg),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: item.status == 'paid' ? paidGreen.withOpacity(0.1) : amber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  item.status,
                  style: GoogleFonts.dmSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: item.status == 'paid' ? paidGreen : amber,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
          const Icon(LucideIcons.chevronRight, size: 20, color: MonipayColors.mutedSlate),
        ],
      ),
    );
  }
}
