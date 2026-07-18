import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../../core/config/chain_configs.dart';
import '../../dashboard_controller.dart';
import '../../../../../core/services/balance_poll_service.dart';

/// Direct deposit: QR + address copy + warning + polling for balance increase.
class DirectDepositView extends ConsumerStatefulWidget {
  const DirectDepositView({
    super.key,
    required this.network,
    required this.onBack,
    required this.onSuccess,
  });

  final String network;
  final VoidCallback onBack;
  final void Function(double depositedAmount) onSuccess;

  @override
  ConsumerState<DirectDepositView> createState() => _DirectDepositViewState();
}

class _DirectDepositViewState extends ConsumerState<DirectDepositView> {
  bool _copied = false;
  Timer? _copyResetTimer;
  Timer? _pollTimer;
  double? _initialBalance;
  bool _polling = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startPolling());
  }

  Future<void> _startPolling() async {
    final balance = await BalancePollService.getBalance(
      network: widget.network,
      address: _displayAddress,
    );
    if (!mounted) return;
    setState(() => _initialBalance = balance);
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _checkBalance());
  }

  Future<void> _checkBalance() async {
    if (!_polling || !mounted) return;
    final current = await BalancePollService.getBalance(
      network: widget.network,
      address: _displayAddress,
    );
    if (!mounted) return;
    final initial = _initialBalance ?? 0;
    if (current > initial) {
      _pollTimer?.cancel();
      _polling = false;
      widget.onSuccess(current - initial);
    }
  }

  String get _displayAddress {
    final dashboard = ref.read(dashboardControllerProvider);
    if (widget.network.toLowerCase() == 'solana') {
      return dashboard.solanaAddress ?? dashboard.walletAddress ?? '';
    }
    return dashboard.walletAddress ?? '';
  }

  @override
  void dispose() {
    _copyResetTimer?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  void _onCopy() {
    Clipboard.setData(ClipboardData(text: _displayAddress));
    _copyResetTimer?.cancel();
    setState(() => _copied = true);
    _copyResetTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final isSolana = widget.network.toLowerCase() == 'solana';
    final config = getChainConfig(widget.network);
    final currencyLabel = config.currency;
    final networkLabel = config.name;
    final accentColor = isSolana
        ? const Color(0xFF9945FF)
        : widget.network.toLowerCase() == 'base'
            ? const Color(0xFF0052FF)
            : const Color(0xFFFFB800);

    if (_displayAddress.isEmpty && isSolana) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(context, theme, fg, isSolana),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Solana wallet not linked. Add your Solana address in profile settings.',
              style: GoogleFonts.dmSans(fontSize: 14, color: muted),
            ),
          ),
        ],
      );
    }

    final shortened = _displayAddress.length > 10
        ? '${_displayAddress.substring(0, 6)}...${_displayAddress.substring(_displayAddress.length - 4)}'
        : _displayAddress;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildHeader(context, theme, fg, isSolana),
        const SizedBox(height: 24),
        QrImageView(
          data: _displayAddress,
          version: QrVersions.auto,
          size: 180,
          backgroundColor: Colors.white,
        ),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(
            'Your $networkLabel Wallet Address',
            style: GoogleFonts.dmSans(fontSize: 12, color: muted),
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Material(
            color: theme.cardColor,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: _onCopy,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: theme.dividerColor),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      shortened,
                      style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w500, color: fg).copyWith(fontFamily: 'monospace'),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      _copied ? LucideIcons.check : LucideIcons.copy,
                      size: 20,
                      color: _copied ? MonipayColors.success : muted,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.amber.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.amber.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Only send $currencyLabel on $networkLabel',
                  style: GoogleFonts.dmSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.amber.shade800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Only send $currencyLabel on the $networkLabel network. Other tokens or networks may result in permanent loss.',
                  style: GoogleFonts.dmSans(fontSize: 12, color: Colors.amber.shade700),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _PulsingDot(color: accentColor),
              const SizedBox(width: 8),
              Text(
                'Waiting for deposit...',
                style: GoogleFonts.dmSans(fontSize: 14, color: muted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeader(BuildContext context, ThemeData theme, Color fg, bool isSolana) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(LucideIcons.arrowLeft),
            onPressed: widget.onBack,
          ),
          Expanded(
            child: Text(
              'Direct Deposit',
              style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg),
            ),
          ),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: (widget.network.toLowerCase() == 'base'
                      ? const Color(0xFF0052FF)
                      : widget.network.toLowerCase() == 'bsc'
                          ? const Color(0xFFFFB800)
                          : const Color(0xFF9945FF))
                  .withOpacity(0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                widget.network.toUpperCase().substring(0, 1),
                style: GoogleFonts.dmSans(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: isSolana ? const Color(0xFF9945FF) : widget.network.toLowerCase() == 'base' ? const Color(0xFF0052FF) : const Color(0xFFFFB800),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});

  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Opacity(
          opacity: 0.5 + 0.5 * _controller.value,
          child: Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
          ),
        );
      },
    );
  }
}
