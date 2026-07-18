import 'dart:async';

import 'package:bcrypt/bcrypt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../auth/presentation/lock_controller.dart' show decryptedPrivateKeyProvider, biometricsServiceProvider;
import '../../../../auth/presentation/splash_screen.dart' show secureStorageServiceProvider;
import '../../../../../core/config/chain_configs.dart';
import '../../../../../core/services/payment_relay_service.dart';
import '../../dashboard_controller.dart';
import '../../withdraw_controller.dart';

class WithdrawSheet extends ConsumerStatefulWidget {
  const WithdrawSheet({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  ConsumerState<WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends ConsumerState<WithdrawSheet> {
  String _step = 'auth'; // auth | method | details_moni | details_addr | confirm | processing | success | error
  String _method = ''; // 'monitag' | 'address'
  final _moniTagController = TextEditingController();
  final _addressController = TextEditingController();
  final _amountController = TextEditingController();
  String _pin = '';
  String _authError = '';
  String _lookupError = '';
  String _errorMessage = '';
  double? _confirmAmount;
  String? _confirmRecipient;
  Timer? _successTimer;
  bool _authTriedBiometric = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
  }

  Future<void> _tryBiometric() async {
    if (_step != 'auth' || _authTriedBiometric) return;
    setState(() => _authTriedBiometric = true);
    try {
      final bio = ref.read(biometricsServiceProvider);
      final ok = await bio.authenticate(localizedReason: 'Confirm withdrawal');
      if (!mounted) return;
      if (ok) setState(() => _step = 'method');
    } catch (_) {}
  }

  Future<void> _verifyPin() async {
    if (_pin.length != 4) return;
    final storage = ref.read(secureStorageServiceProvider);
    final hash = await storage.read(key: 'monipay_pin_hash');
    if (hash == null || hash.isEmpty) {
      setState(() {
        _authError = 'PIN not set';
        _pin = '';
      });
      return;
    }
    try {
      final ok = BCrypt.checkpw(_pin, hash);
      if (!mounted) return;
      if (ok) {
        setState(() {
          _step = 'method';
          _pin = '';
          _authError = '';
        });
      } else {
        setState(() {
          _authError = 'Incorrect PIN';
          _pin = '';
        });
      }
    } catch (_) {
      setState(() {
        _authError = 'Incorrect PIN';
        _pin = '';
      });
    }
  }

  @override
  void dispose() {
    _successTimer?.cancel();
    _moniTagController.dispose();
    _addressController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final balance = dashboard.balance;

    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          widget.onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.6,
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
                    if (_step != 'method' && _step != 'auth')
                      IconButton(
                        icon: const Icon(LucideIcons.arrowLeft),
                        onPressed: () {
                          if (_step == 'details_moni' || _step == 'details_addr') {
                            setState(() => _step = 'method');
                          } else if (_step == 'confirm') {
                            setState(() => _step = _method == 'monitag' ? 'details_moni' : 'details_addr');
                          }
                        },
                      ),
                    if (_step != 'method' && _step != 'auth') const SizedBox(width: 8),
                    Text(
                      _step == 'auth'
                          ? 'Verify Identity'
                          : _step == 'method'
                              ? 'Withdraw Funds'
                              : _step == 'details_moni'
                                  ? 'Send to moniTag'
                                  : _step == 'details_addr'
                                      ? 'Send to Address'
                                      : _step == 'confirm'
                                          ? 'Confirm Withdrawal'
                                          : _step == 'processing'
                                              ? 'Processing'
                                              : _step == 'success'
                                                  ? 'Success'
                                                  : 'Withdraw',
                      style: GoogleFonts.dmSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
                    ),
                    const Spacer(),
                    if (_step == 'method' || _step == 'error' || _step == 'auth') IconButton(
                      onPressed: widget.onClose,
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: _buildStepContent(fg, muted, balance, isDark, theme, dashboard.preferredNetwork),
                ),
              ),
            ],
          ),
        );
      },
    ),
    );
  }

  Widget _buildStepContent(Color fg, Color muted, double balance, bool isDark, ThemeData theme, String preferredNetwork) {
    if (_step == 'auth') {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: MonipayColors.primaryBlue.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.lock, size: 32, color: MonipayColors.primaryBlue),
          ),
          const SizedBox(height: 24),
          Text(
            'Verify Identity',
            style: GoogleFonts.dmSans(fontSize: 20, fontWeight: FontWeight.w700, color: fg),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter PIN or use biometrics to access withdrawals',
            style: GoogleFonts.dmSans(fontSize: 14, color: muted),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (i) {
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 8),
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i < _pin.length ? MonipayColors.primaryBlue : fg.withOpacity(0.2),
                ),
              );
            }),
          ),
          if (_authError.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              _authError,
              style: GoogleFonts.dmSans(fontSize: 14, color: MonipayColors.destructive),
            ),
          ],
          const SizedBox(height: 48),
          _PinPad(
            onDigit: (d) {
              if (_pin.length < 4) setState(() => _pin += d);
              if (_pin.length == 4) _verifyPin();
            },
            onBack: () {
              if (_pin.isNotEmpty) setState(() => _pin = _pin.substring(0, _pin.length - 1));
            },
          ),
        ],
      );
    }

    if (_step == 'method') {
      return Column(
        children: [
          Text(
            'Available: \$${balance.toStringAsFixed(2)} ${getChainConfig(preferredNetwork).currency}',
            style: GoogleFonts.dmSans(fontSize: 14, color: muted),
          ),
          const SizedBox(height: 24),
          _OptionCard(
            icon: LucideIcons.atSign,
            title: 'By moniTag',
            subtitle: 'Send to another MoniPay user',
            onTap: () => setState(() {
              _method = 'monitag';
              _step = 'details_moni';
            }),
          ),
          const SizedBox(height: 12),
          _OptionCard(
            icon: LucideIcons.wallet,
            title: 'By Wallet Address',
            subtitle: 'Send to any EVM address',
            onTap: () => setState(() {
              _method = 'address';
              _step = 'details_addr';
            }),
          ),
        ],
      );
    }

    if (_step == 'details_moni') {
      final amount = double.tryParse(_amountController.text) ?? 0;
      final fee = amount * 0.01;
      final total = amount + fee;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _moniTagController,
            decoration: InputDecoration(
              hintText: '@username',
              prefixText: '@ ',
              filled: true,
              fillColor: fg.withOpacity(0.06),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
            ),
            style: GoogleFonts.dmSans(fontSize: 16, color: fg),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              hintText: '0.00',
              filled: true,
              fillColor: fg.withOpacity(0.06),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
            ),
            style: GoogleFonts.dmSans(fontSize: 16, color: fg),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: muted.withOpacity(0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                _FeeLine('Amount', '\$${amount.toStringAsFixed(2)}', muted, fg),
                _FeeLine('Fee (1%)', '\$${fee.toStringAsFixed(2)}', muted, fg),
                _FeeLine('Network Fee', 'Sponsored', muted, MonipayColors.primaryBlue),
                const Divider(height: 20),
                _FeeLine('Total', '\$${total.toStringAsFixed(2)}', muted, fg, bold: true),
              ],
            ),
          ),
          if (_lookupError.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(_lookupError, style: GoogleFonts.dmSans(fontSize: 14, color: MonipayColors.destructive)),
            ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () async {
              if (_moniTagController.text.trim().isEmpty || amount <= 0 || total > balance) return;
              final tag = _moniTagController.text.trim().replaceFirst(RegExp(r'^@'), '');
              final anonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';
              if (anonKey.isEmpty) {
                setState(() => _lookupError = 'Missing config');
                return;
              }
              final addr = await lookupPayTag(tag, anonKey);
              if (!mounted) return;
              if (addr == null || addr.isEmpty) {
                setState(() => _lookupError = 'Recipient not found');
                return;
              }
              setState(() {
                _confirmAmount = amount;
                _confirmRecipient = '@$tag';
                _step = 'confirm';
                _lookupError = '';
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: MonipayColors.primaryBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text('Continue'),
          ),
        ],
      );
    }

    if (_step == 'details_addr') {
      final amount = double.tryParse(_amountController.text) ?? 0;
      final fee = amount * 0.01;
      final total = amount + fee;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _addressController,
            decoration: InputDecoration(
              hintText: '0x...',
              filled: true,
              fillColor: fg.withOpacity(0.06),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
            ),
            style: GoogleFonts.dmSans(fontSize: 14, color: fg).copyWith(fontFamily: 'monospace'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              hintText: '0.00',
              filled: true,
              fillColor: fg.withOpacity(0.06),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
            ),
            style: GoogleFonts.dmSans(fontSize: 16, color: fg),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: muted.withOpacity(0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                _FeeLine('Amount', '\$${amount.toStringAsFixed(2)}', muted, fg),
                _FeeLine('Fee (1%)', '\$${fee.toStringAsFixed(2)}', muted, fg),
                _FeeLine('Network Fee', 'Sponsored', muted, MonipayColors.primaryBlue),
                const Divider(height: 20),
                _FeeLine('Total', '\$${total.toStringAsFixed(2)}', muted, fg, bold: true),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              final addr = _addressController.text.trim();
              if (!RegExp(r'^0x[a-fA-F0-9]{40}$').hasMatch(addr) || amount <= 0 || total > balance) return;
              setState(() {
                _confirmAmount = amount;
                _confirmRecipient = '${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}';
                _step = 'confirm';
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: MonipayColors.primaryBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text('Continue'),
          ),
        ],
      );
    }

    if (_step == 'confirm' && _confirmAmount != null && _confirmRecipient != null) {
      final fee = _confirmAmount! * 0.01;
      final receive = _confirmAmount! - fee;
      return Column(
        children: [
          const SizedBox(height: 16),
          Text(
            _confirmRecipient!,
            style: GoogleFonts.dmSans(fontSize: 20, fontWeight: FontWeight.w700, color: fg),
          ),
          const SizedBox(height: 24),
          Text(
            '\$${_confirmAmount!.toStringAsFixed(2)}',
            style: GoogleFonts.dmSans(fontSize: 36, fontWeight: FontWeight.w700, color: fg),
          ),
          Text(getChainConfig(preferredNetwork).currency, style: GoogleFonts.dmSans(fontSize: 14, color: muted)),
          const SizedBox(height: 20),
          _FeeLine('Recipient receives', '\$${receive.toStringAsFixed(2)}', muted, fg),
          _FeeLine('Platform fee', '\$${fee.toStringAsFixed(2)}', muted, fg),
          _FeeLine('Network fee', 'Sponsored', muted, MonipayColors.primaryBlue),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () => _confirmAndSend(fg, theme),
            style: ElevatedButton.styleFrom(
              backgroundColor: MonipayColors.primaryBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text('Confirm & Send'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => setState(() => _step = _method == 'monitag' ? 'details_moni' : 'details_addr'),
            child: const Text('Cancel'),
          ),
        ],
      );
    }

    if (_step == 'processing') {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 48),
          const CircularProgressIndicator(),
          const SizedBox(height: 20),
          Text(
            'Processing withdrawal...',
            style: GoogleFonts.dmSans(fontSize: 16, color: muted),
          ),
        ],
      );
    }

    if (_step == 'success') {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 48),
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: MonipayColors.primaryBlue,
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.check, size: 40, color: Colors.white),
          ),
          const SizedBox(height: 20),
          Text(
            'Withdrawal Sent!',
            style: GoogleFonts.dmSans(fontSize: 20, fontWeight: FontWeight.w700, color: fg),
          ),
          const SizedBox(height: 8),
          Text(
            '\$${_confirmAmount?.toStringAsFixed(2)} to $_confirmRecipient',
            style: GoogleFonts.dmSans(fontSize: 14, color: muted),
          ),
        ],
      );
    }

    if (_step == 'error') {
      return Column(
        children: [
          const SizedBox(height: 24),
          Text(_errorMessage, style: GoogleFonts.dmSans(fontSize: 14, color: MonipayColors.destructive)),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => setState(() => _step = 'method'),
            child: const Text('Try Again'),
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }

  Future<void> _confirmAndSend(Color fg, ThemeData theme) async {
    if (_confirmAmount == null || _confirmRecipient == null) return;
    final isByAddress = _method == 'address';
    final recipient = isByAddress
        ? _addressController.text.trim()
        : _moniTagController.text.trim().replaceFirst(RegExp(r'^@'), '');
    if (recipient.isEmpty) return;

    setState(() => _step = 'processing');
    final state = ref.read(dashboardControllerProvider);
    final dashboard = ref.read(dashboardControllerProvider.notifier);
    final error = await submitWithdraw(
      recipientMoniTagOrAddress: isByAddress ? _addressController.text.trim() : recipient,
      amount: _confirmAmount!,
      isByAddress: isByAddress,
      balance: state.balance,
      fromAddress: state.walletAddress,
      network: state.preferredNetwork,
      getPrivateKey: () => ref.read(decryptedPrivateKeyProvider),
      onSuccessApplyTransaction: (amount, counterparty) =>
          dashboard.applySentTransaction(amount: amount, counterparty: counterparty),
    );

    if (!mounted) return;
    if (error != null) {
      setState(() {
        _step = 'error';
        _errorMessage = error;
      });
      return;
    }
    setState(() => _step = 'success');
    ref.read(dashboardControllerProvider.notifier).refresh();
    _successTimer?.cancel();
    _successTimer = Timer(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      widget.onClose();
    });
  }
}

class _PinPad extends StatelessWidget {
  const _PinPad({required this.onDigit, required this.onBack});

  final void Function(String) onDigit;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fg = theme.brightness == Brightness.dark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _PinDigitButton(label: '1', onTap: () => onDigit('1'), fg: fg),
            _PinDigitButton(label: '2', onTap: () => onDigit('2'), fg: fg),
            _PinDigitButton(label: '3', onTap: () => onDigit('3'), fg: fg),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _PinDigitButton(label: '4', onTap: () => onDigit('4'), fg: fg),
            _PinDigitButton(label: '5', onTap: () => onDigit('5'), fg: fg),
            _PinDigitButton(label: '6', onTap: () => onDigit('6'), fg: fg),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _PinDigitButton(label: '7', onTap: () => onDigit('7'), fg: fg),
            _PinDigitButton(label: '8', onTap: () => onDigit('8'), fg: fg),
            _PinDigitButton(label: '9', onTap: () => onDigit('9'), fg: fg),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(width: 56, height: 56),
            _PinDigitButton(label: '0', onTap: () => onDigit('0'), fg: fg),
            _PinDigitButton(label: '⌫', onTap: onBack, fg: fg),
          ],
        ),
      ],
    );
  }
}

class _PinDigitButton extends StatelessWidget {
  const _PinDigitButton({required this.label, required this.onTap, required this.fg});

  final String label;
  final VoidCallback onTap;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: label.isEmpty ? null : onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 56,
            height: 56,
            child: Center(
              child: label.isEmpty
                  ? const SizedBox()
                  : Text(
                      label,
                      style: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.w600, color: fg),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    return Material(
      color: cardBg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          height: 72,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: muted.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: MonipayColors.primaryBlue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 24, color: MonipayColors.primaryBlue),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w700, color: fg),
                    ),
                    Text(
                      subtitle,
                      style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                    ),
                  ],
                ),
              ),
              const Icon(LucideIcons.chevronRight, size: 20, color: MonipayColors.mutedSlate),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeeLine extends StatelessWidget {
  const _FeeLine(this.label, this.value, this.muted, this.fg, {this.bold = false});

  final String label;
  final String value;
  final Color muted;
  final Color fg;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.dmSans(
              fontSize: 13,
              color: muted,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.dmSans(
              fontSize: 13,
              color: fg,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
