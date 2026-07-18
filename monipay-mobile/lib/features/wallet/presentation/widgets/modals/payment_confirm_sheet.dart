import 'dart:math' show pow;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../../core/config/chain_configs.dart';
import '../../../../../core/services/payment_relay_service.dart';
import '../../../../auth/presentation/lock_controller.dart'
    show
        biometricsServiceProvider,
        decryptedPrivateKeyProvider,
        lockControllerProvider;
import '../../../../auth/presentation/splash_screen.dart' show secureStorageServiceProvider;
import '../../dashboard_controller.dart';
import '../../scan_screen.dart';
import '../../send_controller.dart';

const _kHighValueProtectionKey = 'monipay_high_value_protection';

class PaymentConfirmSheet extends ConsumerStatefulWidget {
  const PaymentConfirmSheet({
    super.key,
    required this.onClose,
    required this.onSuccessOverlay,
  });

  final VoidCallback onClose;
  final VoidCallback onSuccessOverlay;

  @override
  ConsumerState<PaymentConfirmSheet> createState() => _PaymentConfirmSheetState();
}

class _PaymentConfirmSheetState extends ConsumerState<PaymentConfirmSheet> {
  bool _processing = false;
  String? _error;

  Future<bool> _checkBiometricIfHighValue(double amount) async {
    if (amount < 100) return true;
    final enabled =
        await ref.read(secureStorageServiceProvider).read(key: _kHighValueProtectionKey) ==
            'true';
    if (!enabled) return true;
    return ref
        .read(biometricsServiceProvider)
        .authenticate(localizedReason: 'Confirm high-value transaction');
  }

  Future<String?> _askPinAndDecrypt() async {
    final c = TextEditingController();
    final pin = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Enter PIN', style: GoogleFonts.dmSans()),
        content: TextField(
          controller: c,
          keyboardType: TextInputType.number,
          maxLength: 4,
          obscureText: true,
          decoration: const InputDecoration(hintText: '4-digit PIN'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('Verify')),
        ],
      ),
    );
    if (pin == null || pin.length != 4) return null;
    final key = await ref.read(lockControllerProvider.notifier).verifyAndDecryptForSigning(pin);
    if (key != null && key.isNotEmpty) {
      ref.read(decryptedPrivateKeyProvider.notifier).state = key;
    }
    return key;
  }

  Future<void> _confirmPayment(Map<String, dynamic> data) async {
    final dashboard = ref.read(dashboardControllerProvider);
    final notifier = ref.read(dashboardControllerProvider.notifier);
    final network = dashboard.preferredNetwork.toLowerCase();
    final from = dashboard.walletAddress;
    final profileId = dashboard.profileId;
    final to = (data['merchantAddress'] ?? data['address'] ?? '').toString();
    final merchantTag = (data['merchantTag'] ?? data['payTag'] ?? '').toString();
    final amount = (data['amount'] is num)
        ? (data['amount'] as num).toDouble()
        : double.tryParse(data['amount']?.toString() ?? '') ?? 0.0;
    final fee = amount * 0.01;
    if (from == null || from.isEmpty || profileId == null || profileId.isEmpty) {
      setState(() => _error = 'Missing wallet/profile');
      return;
    }
    if (to.isEmpty || amount <= 0) {
      setState(() => _error = 'Invalid QR payload');
      return;
    }

    if (dashboard.balance < amount + fee) {
      widget.onClose();
      notifier.openFundWithShortfall((amount + fee) - dashboard.balance);
      return;
    }

    final bioOk = await _checkBiometricIfHighValue(amount);
    if (!bioOk) {
      setState(() => _error = 'Biometric verification required');
      return;
    }

    setState(() {
      _processing = true;
      _error = null;
    });
    try {
      final key = await _askPinAndDecrypt();
      if (key == null || key.isEmpty) {
        setState(() => _error = 'Incorrect PIN');
        return;
      }

      final allowance = await getAllowance(network: network, owner: from);
      final config = getChainConfig(network);
      final scale = pow(10, config.decimals).toDouble();
      final amountWei = BigInt.from((amount * scale).round());
      final feeWei = BigInt.from((fee * scale).round());
      final required = amountWei + feeWei;
      if (allowance < required) {
        setState(() => _error = 'Wallet not activated');
        return;
      }

      final anonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';
      if (anonKey.isEmpty) {
        setState(() => _error = 'Missing Supabase key');
        return;
      }
      final nonce = await getPaymentNonce(from, network, anonKey);
      final deadline = BigInt.from(DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600);
      final signature = signPaymentAuthorization(
        privateKeyHex: key,
        from: from,
        to: to,
        amount: amountWei,
        fee: feeWei,
        nonce: nonce,
        deadline: deadline,
        network: network,
      );

      final result = await relayPayment(
        signature: signature,
        message: {
          'from': from,
          'to': to,
          'amount': amountWei.toString(),
          'fee': feeWei.toString(),
          'nonce': nonce.toString(),
          'deadline': deadline.toString(),
        },
        senderProfileId: profileId,
        recipientPayTag: merchantTag,
        recipientAddress: to,
        items: (data['items'] as List<dynamic>?)
            ?.whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList(),
        network: network,
        supabaseAnonKey: anonKey,
      );

      if (result == null || result['success'] != true) {
        setState(() => _error = result?['error']?.toString() ?? 'Payment failed');
        return;
      }

      notifier.applySentTransaction(
        amount: amount,
        counterparty: merchantTag.isNotEmpty ? merchantTag : to,
      );
      ref.read(sendControllerProvider.notifier).setSuccessForOverlay(
            amount: amount,
            tag: merchantTag.isNotEmpty ? merchantTag : to,
          );
      await notifier.syncTransactions();
      await notifier.refreshBalance();
      ref.read(scannedPaymentProvider.notifier).state = null;
      widget.onClose();
      widget.onSuccessOverlay();
    } finally {
      if (mounted) {
        setState(() => _processing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(scannedPaymentProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    if (data == null) {
      return const SizedBox.shrink();
    }
    final merchantTag = (data['merchantTag'] ?? data['payTag'] ?? '').toString();
    final amount = (data['amount'] is num)
        ? (data['amount'] as num).toDouble()
        : double.tryParse(data['amount']?.toString() ?? '') ?? 0.0;
    final fee = amount * 0.01;
    final items = (data['items'] as List<dynamic>?) ?? const [];
    final isMonibot = merchantTag.replaceFirst('@', '').toLowerCase() == 'monibot';

    return DraggableScrollableSheet(
      initialChildSize: 0.68,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Container(
        decoration: BoxDecoration(
          color: theme.scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Text(
                  'Confirm Payment',
                  style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg),
                ),
                const Spacer(),
                IconButton(
                  onPressed: _processing
                      ? null
                      : () {
                          ref.read(scannedPaymentProvider.notifier).state = null;
                          widget.onClose();
                        },
                  icon: const Icon(LucideIcons.x),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  merchantTag.isEmpty ? 'Merchant' : '@${merchantTag.replaceFirst('@', '')}',
                  style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w700, color: fg),
                ),
                if (isMonibot) ...[
                  const SizedBox(width: 6),
                  const Icon(LucideIcons.badgeCheck, size: 16, color: MonipayColors.primaryBlue),
                ],
              ],
            ),
            const SizedBox(height: 16),
            _line(fg, muted, 'You pay', '\$${(amount + fee).toStringAsFixed(2)}'),
            _line(fg, muted, 'Merchant receives', '\$${amount.toStringAsFixed(2)}'),
            _line(fg, muted, 'Platform fee (1%)', '\$${fee.toStringAsFixed(2)}'),
            if (items.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Items',
                style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w700, color: muted),
              ),
              const SizedBox(height: 6),
              ...items.map((e) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '- ${e.toString()}',
                      style: GoogleFonts.dmSans(fontSize: 13, color: fg),
                    ),
                  )),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: GoogleFonts.dmSans(fontSize: 13, color: MonipayColors.destructive),
              ),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _processing ? null : () => _confirmPayment(data),
              style: ElevatedButton.styleFrom(
                backgroundColor: MonipayColors.primaryBlue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _processing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      'Confirm & Pay',
                      style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _line(Color fg, Color muted, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.dmSans(fontSize: 13, color: muted)),
          Text(value, style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: fg)),
        ],
      ),
    );
  }
}

