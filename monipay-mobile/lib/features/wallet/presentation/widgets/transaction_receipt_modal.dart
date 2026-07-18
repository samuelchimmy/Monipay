import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/config/chain_configs.dart';
import '../dashboard_state.dart';

class TransactionReceiptModal extends StatelessWidget {
  const TransactionReceiptModal({
    super.key,
    required this.transaction,
    required this.preferredNetwork,
    required this.onClose,
  });

  final DashboardTransaction transaction;
  final String preferredNetwork;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
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
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Row(
              children: [
                Text(
                  'Transaction Receipt',
                  style: GoogleFonts.dmSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: fg,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(LucideIcons.share2),
                  onPressed: () => _shareReceipt(context),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x),
                  onPressed: onClose,
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isDark ? MonipayColors.cardDark : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: muted.withOpacity(0.3)),
                ),
                child: Column(
                  children: [
                    Text.rich(
                      TextSpan(
                        text: 'Moni',
                        style: GoogleFonts.montserrat(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                        children: [
                          TextSpan(
                            text: 'PAY',
                            style: GoogleFonts.montserrat(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: MonipayColors.primaryBlue,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      transaction.counterparty.startsWith('0x')
                          ? '${transaction.counterparty.substring(0, 10)}...'
                          : '@${transaction.counterparty}',
                      style: GoogleFonts.dmSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: fg,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _formatDateTime(transaction.timestamp),
                      style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                    ),
                    const SizedBox(height: 16),
                    const _DashedDivider(color: MonipayColors.mutedSlate),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Receipt #${transaction.id.length > 12 ? transaction.id.substring(0, 12).toUpperCase() : transaction.id.toUpperCase()}',
                          style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                        ),
                        Text(
                          transaction.type == 'sent' ? 'Sent' : 'Received',
                          style: GoogleFonts.dmSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: fg,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const _DashedDivider(color: MonipayColors.mutedSlate),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Item', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                        Text('Qty', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                        Text('Price', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${getChainConfig(preferredNetwork).currency} Transfer', style: GoogleFonts.dmSans(fontSize: 12, color: fg)),
                        const Text('1', style: TextStyle(fontSize: 12)),
                        Text(
                          '\$${transaction.amount.toStringAsFixed(2)}',
                          style: GoogleFonts.dmSans(fontSize: 12, color: fg),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const _DashedDivider(color: MonipayColors.mutedSlate),
                    const SizedBox(height: 12),
                    _ReceiptRow('Subtotal', '\$${transaction.amount.toStringAsFixed(2)}', muted, fg),
                    _ReceiptRow('Platform Fee (1%)', '\$${(transaction.amount * 0.01).toStringAsFixed(2)}', muted, fg),
                    const _ReceiptRow('Network Fee', 'Sponsored ✨', MonipayColors.mutedSlate, MonipayColors.primaryBlue),
                    _ReceiptRow('Total', '\$${(transaction.amount * 1.01).toStringAsFixed(2)}', muted, fg, bold: true),
                    const SizedBox(height: 16),
                    const _DashedDivider(color: MonipayColors.mutedSlate),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            transaction.id,
                            style: GoogleFonts.dmSans(fontSize: 10, color: muted).copyWith(fontFamily: 'monospace'),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(LucideIcons.copy, size: 16),
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: transaction.id));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Copied')),
                            );
                          },
                        ),
                      ],
                    ),
                    TextButton(
                      onPressed: () {
                        final base = getChainConfig(preferredNetwork).explorerUrl;
                        final url = transaction.txHash != null && transaction.txHash!.isNotEmpty
                            ? '$base/tx/${transaction.txHash}'
                            : base;
                        launchUrl(Uri.parse(url));
                      },
                      child: Text(
                        'View on Explorer',
                        style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.primaryBlue),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'THANK YOU!',
                      style: GoogleFonts.dmSans(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Powered by MoniPay',
                      style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                    ),
                    Text(
                      'www.monipay.xyz',
                      style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _shareReceipt(context),
                    icon: const Icon(LucideIcons.share2, size: 18),
                    label: const Text('Share Receipt'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      final base = getChainConfig(preferredNetwork).explorerUrl;
                      final url = transaction.txHash != null && transaction.txHash!.isNotEmpty
                          ? '$base/tx/${transaction.txHash}'
                          : base;
                      launchUrl(Uri.parse(url));
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: MonipayColors.primaryBlue,
                      foregroundColor: Colors.white,
                    ),
                    icon: const Icon(LucideIcons.externalLink, size: 18),
                    label: const Text('View on Explorer'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime t) {
    return '${t.month}/${t.day}/${t.year} ${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  void _shareReceipt(BuildContext context) {
    final counterparty = transaction.counterparty.startsWith('0x')
        ? '${transaction.counterparty.substring(0, 10)}...'
        : '@${transaction.counterparty}';
    final hasItems = transaction.items != null && transaction.items!.isNotEmpty;
    final subtotal = hasItems
        ? transaction.items!
            .fold<double>(0, (s, i) => s + (i['price'] as num?)! * ((i['quantity'] as num?) ?? 1))
        : transaction.amount;
    final fee = transaction.fee;
    final total = subtotal + fee;
    final buffer = StringBuffer()
      ..writeln('MoniPay')
      ..writeln('Receipt')
      ..writeln()
      ..writeln(counterparty)
      ..writeln('Date: ${_formatDateTime(transaction.timestamp)}')
      ..writeln('Receipt #: ${transaction.id.length > 12 ? transaction.id.substring(0, 12).toUpperCase() : transaction.id.toUpperCase()}');
    if (hasItems) {
      for (final item in transaction.items!) {
        final name = item['name'] as String? ?? 'Item';
        final qty = (item['quantity'] as num?)?.toInt() ?? 1;
        final price = (item['price'] as num?) ?? 0.0;
        buffer.writeln('$name x$qty  \$${(price * qty).toStringAsFixed(2)}');
      }
      buffer.writeln();
    }
    buffer
      ..writeln('Subtotal: \$${subtotal.toStringAsFixed(2)}')
      ..writeln('Platform fee (1%): \$${fee.toStringAsFixed(2)}')
      ..writeln('Network fee: Sponsored')
      ..writeln('Total: \$${total.toStringAsFixed(2)}')
      ..writeln()
      ..writeln('Tx: ${transaction.txHash ?? transaction.id}')
      ..writeln()
      ..writeln('Thank you · monipay.xyz');
    Share.share(buffer.toString());
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(20, (_) => Container(
        width: 4,
        height: 1,
        margin: const EdgeInsets.symmetric(horizontal: 2),
        color: color,
      )),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow(this.label, this.value, this.muted, this.fg, {this.bold = false});

  final String label;
  final String value;
  final Color muted;
  final Color fg;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.dmSans(
              fontSize: 12,
              color: muted,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.dmSans(
              fontSize: 12,
              color: fg,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
