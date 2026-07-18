import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../auth/presentation/lock_controller.dart'
    show decryptedPrivateKeyProvider, lockControllerProvider;
import '../../dashboard_controller.dart';
import '../../dashboard_state.dart';
import '../../send_controller.dart';

class SendSheet extends ConsumerStatefulWidget {
  const SendSheet({
    super.key,
    required this.onClose,
    required this.onInsufficientFunds,
    required this.onSuccessOverlay,
  });

  final VoidCallback onClose;
  final void Function(double shortfall) onInsufficientFunds;
  final VoidCallback onSuccessOverlay;

  @override
  ConsumerState<SendSheet> createState() => _SendSheetState();
}

class _SendSheetState extends ConsumerState<SendSheet> {
  final _recipientFocus = FocusNode();
  final _amountFocus = FocusNode();
  late TextEditingController _recipientController;
  late TextEditingController _amountController;
  bool _showSuggestions = false;

  Future<bool> _verifyPinForSigning() async {
    final pinCtrl = TextEditingController();
    final pin = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Enter PIN', style: GoogleFonts.dmSans()),
        content: TextField(
          controller: pinCtrl,
          keyboardType: TextInputType.number,
          maxLength: 4,
          obscureText: true,
          decoration: const InputDecoration(hintText: '4-digit PIN'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, pinCtrl.text), child: const Text('Verify')),
        ],
      ),
    );
    if (pin == null || pin.length != 4) return false;
    final key = await ref.read(lockControllerProvider.notifier).verifyAndDecryptForSigning(pin);
    if (key == null || key.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Incorrect PIN')),
        );
      }
      return false;
    }
    ref.read(decryptedPrivateKeyProvider.notifier).state = key;
    return true;
  }

  @override
  void initState() {
    super.initState();
    _recipientController = TextEditingController();
    _amountController = TextEditingController();
  }

  @override
  void dispose() {
    _recipientController.dispose();
    _amountController.dispose();
    _recipientFocus.dispose();
    _amountFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final send = ref.watch(sendControllerProvider);
    final sendNotifier = ref.read(sendControllerProvider.notifier);
    final dashboard = ref.watch(dashboardControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final currencyLabel = sendNotifier.currencyLabel;
    final amount = sendNotifier.amountValue ?? 0;
    final fee = sendNotifier.feeAmount;
    final total = sendNotifier.totalAmount;
    final canSend = send.recipientMoniTag.trim().isNotEmpty &&
        send.amount.isNotEmpty &&
        amount > 0 &&
        !send.isProcessing;

    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          widget.onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Container(
          decoration: BoxDecoration(
            color: theme.scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
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
                    Text(
                      'Send $currencyLabel',
                      style: GoogleFonts.dmSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: send.isProcessing ? null : widget.onClose,
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  children: [
                    Text(
                      'Recipient moniTag',
                      style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                    ),
                    const SizedBox(height: 8),
                    Stack(
                      children: [
                        TextField(
                          focusNode: _recipientFocus,
                          controller: _recipientController,
                          onChanged: (v) {
                            sendNotifier.setRecipientMoniTag(v);
                            setState(() => _showSuggestions = _recipientFocus.hasFocus && v.isNotEmpty);
                          },
                          onTap: () => setState(() => _showSuggestions = send.recipientMoniTag.isNotEmpty),
                          decoration: InputDecoration(
                            hintText: '@username',
                            prefixText: '@ ',
                            prefixStyle: GoogleFonts.dmSans(fontSize: 16, color: muted),
                            filled: true,
                            fillColor: fg.withOpacity(0.06),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          style: GoogleFonts.dmSans(fontSize: 16, color: fg),
                          onSubmitted: (_) => _amountFocus.requestFocus(),
                        ),
                        if (_showSuggestions) _SuggestionsList(
                          query: send.recipientMoniTag,
                          transactions: dashboard.transactions,
                          currentTag: dashboard.payTag,
                          onSelect: (tag) {
                            sendNotifier.setRecipientMoniTag(tag);
                            _recipientController.text = tag;
                            setState(() => _showSuggestions = false);
                          },
                        ),
                      ],
                    ),
                    if (send.recipientMoniTag.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            '@${send.recipientMoniTag.replaceFirst('@', '')}',
                            style: GoogleFonts.dmSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: fg,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 20),
                    Text(
                      'Amount ($currencyLabel)',
                      style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      focusNode: _amountFocus,
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      onChanged: sendNotifier.setAmount,
                      decoration: InputDecoration(
                        hintText: '0.00',
                        filled: true,
                        fillColor: fg.withOpacity(0.06),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      style: GoogleFonts.dmSans(fontSize: 16, color: fg),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: muted.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: [
                          _FeeRow(label: 'Amount', value: '\$${amount.toStringAsFixed(2)}'),
                          const SizedBox(height: 8),
                          _FeeRow(label: 'Fee (1%)', value: '\$${fee.toStringAsFixed(2)}'),
                          const SizedBox(height: 8),
                          const _FeeRow(label: 'Network Fee', value: 'Sponsored', valueColor: MonipayColors.primaryBlue),
                          const Divider(height: 24),
                          _FeeRow(label: 'Total', value: '\$${total.toStringAsFixed(2)}', bold: true),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: canSend
                            ? () async {
                                final ok = await _verifyPinForSigning();
                                if (!ok || !mounted) return;
                                await sendNotifier.submit(
                                  onClose: widget.onClose,
                                  onInsufficientFunds: (shortfall) {
                                    ref.read(dashboardControllerProvider.notifier).openFundWithShortfall(shortfall);
                                  },
                                  onSuccessShowOverlay: widget.onSuccessOverlay,
                                  onRefreshDashboard: () => ref.read(dashboardControllerProvider.notifier).refresh(),
                                );
                              }
                            : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: MonipayColors.primaryBlue,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
                        ),
                        child: send.isProcessing
                            ? Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white.withOpacity(0.9)),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    'Processing...',
                                    style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(LucideIcons.send, size: 20),
                                  const SizedBox(width: 10),
                                  Text(
                                    'Send Payment',
                                    style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w700),
                                  ),
                                ],
                              ),
                      ),
                    ),
                    if (send.errorMessage != null) ...[
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          const Icon(LucideIcons.alertCircle, size: 18, color: MonipayColors.destructive),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              send.errorMessage!,
                              style: GoogleFonts.dmSans(fontSize: 14, color: MonipayColors.destructive),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
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

class _FeeRow extends StatelessWidget {
  const _FeeRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.bold = false,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.dmSans(
            fontSize: 14,
            color: muted,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.dmSans(
            fontSize: 14,
            color: valueColor ?? fg,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _SuggestionsList extends StatelessWidget {
  const _SuggestionsList({
    required this.query,
    required this.transactions,
    required this.currentTag,
    required this.onSelect,
  });

  final String query;
  final List<DashboardTransaction> transactions;
  final String? currentTag;
  final void Function(String tag) onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    final suggestions = transactions
        .map((DashboardTransaction t) => t.counterparty)
        .where((c) =>
            c.isNotEmpty &&
            !c.startsWith('0x') &&
            c != currentTag &&
            c.toLowerCase().contains(query.toLowerCase()))
        .toSet()
        .take(5)
        .toList();

    if (suggestions.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 48),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: fg.withOpacity(0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: suggestions
            .map(
              (tag) => InkWell(
                onTap: () => onSelect(tag),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  child: Row(
                    children: [
                      Text(
                        '@$tag',
                        style: GoogleFonts.dmSans(fontSize: 14, color: fg),
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
