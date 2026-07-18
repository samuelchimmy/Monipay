import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../../core/config/chain_configs.dart';
import '../../dashboard_controller.dart';
import 'connected_wallet_deposit_view.dart';
import 'cross_chain_deposit_view.dart';
import 'direct_deposit_view.dart';

class FundSheet extends ConsumerStatefulWidget {
  const FundSheet({
    super.key,
    required this.onClose,
    this.insufficientFundsAmount,
  });

  final VoidCallback onClose;
  final double? insufficientFundsAmount;

  @override
  ConsumerState<FundSheet> createState() => _FundSheetState();
}

class _FundSheetState extends ConsumerState<FundSheet> {
  int _networkIndex = 0; // 0 Base, 1 BSC, 2 Solana
  String _view = 'menu'; // 'menu' | 'direct' | 'crosschain' | 'connected'
  bool _depositReceived = false;
  double? _depositAmount;

  String get _currentNetwork {
    const nets = ['base', 'bsc', 'solana'];
    return nets[_networkIndex];
  }

  void _onDepositSuccess(double amount) {
    setState(() {
      _depositReceived = true;
      _depositAmount = amount;
    });
    ref.read(dashboardControllerProvider.notifier).refreshBalance();
    ref.read(dashboardControllerProvider.notifier).syncTransactions();
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) widget.onClose();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final networkNames = ['Base', 'BSC', 'SOLANA'];
    final tabColors = [const Color(0xFF0052FF), const Color(0xFFFFB800), const Color(0xFF9945FF)];
    final isSolana = _currentNetwork == 'solana';

    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          widget.onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.65,
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
                    if (_view != 'menu')
                      IconButton(
                        icon: const Icon(LucideIcons.arrowLeft),
                        onPressed: () => setState(() => _view = 'menu'),
                      ),
                    if (_view != 'menu') const SizedBox(width: 8),
                    Text(
                      _view == 'menu' ? 'Deposit' : (_view == 'direct' ? 'Direct Deposit' : _view == 'crosschain' ? 'Cross-Chain' : 'Connected Wallet'),
                      style: GoogleFonts.dmSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: widget.onClose,
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ),
              ),
              if (_depositReceived)
                Expanded(
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      margin: const EdgeInsets.symmetric(horizontal: 20),
                      decoration: BoxDecoration(
                        color: MonipayColors.success.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: MonipayColors.success.withOpacity(0.3)),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.checkCircle, size: 48, color: MonipayColors.success),
                          const SizedBox(height: 12),
                          Text(
                            'Deposit Received!',
                            style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg),
                          ),
                          if (_depositAmount != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              '+\$${_depositAmount!.toStringAsFixed(2)} ${getChainConfig(_currentNetwork).currency}',
                              style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w600, color: MonipayColors.success),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                )
              else ...[
              if (widget.insufficientFundsAmount != null && widget.insufficientFundsAmount! > 0)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.alertCircle, size: 20, color: MonipayColors.destructive),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'You need \$${widget.insufficientFundsAmount!.toStringAsFixed(2)} more to complete this payment',
                          style: GoogleFonts.dmSans(fontSize: 14, color: MonipayColors.destructive),
                        ),
                      ),
                    ],
                  ),
                ),
              if (_view == 'menu') ...[
                Container(
                  height: 52,
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: muted.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: List.generate(3, (i) {
                      final color = tabColors[i];
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _networkIndex = i),
                          child: Container(
                            decoration: BoxDecoration(
                              color: _networkIndex == i ? color : Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              networkNames[i],
                              style: GoogleFonts.dmSans(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: _networkIndex == i ? (i == 1 ? Colors.black : Colors.white) : fg,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    children: [
                      _DepositOption(
                        icon: LucideIcons.arrowLeftRight,
                        title: 'Cross-Chain Deposit',
                        subtitle: 'Bridge via Across Protocol',
                        onTap: () => setState(() => _view = 'crosschain'),
                      ),
                      if (!isSolana) ...[
                        const SizedBox(height: 12),
                        _DepositOption(
                          icon: LucideIcons.wallet,
                          title: 'Connected Wallet',
                          subtitle: _currentNetwork == 'base' ? 'Pull USDC/USDT from MetaMask, Rainbow…' : 'Pull USDT from MetaMask, Trust…',
                          onTap: () => setState(() => _view = 'connected'),
                        ),
                      ],
                      const SizedBox(height: 12),
                      _DepositOption(
                        icon: LucideIcons.qrCode,
                        title: 'Direct Deposit',
                        subtitle: 'Scan QR or copy address',
                        onTap: () => setState(() => _view = 'direct'),
                      ),
                    ],
                  ),
                ),
              ],
              if (_view == 'direct')
                Expanded(
                  child: SingleChildScrollView(
                    child: DirectDepositView(
                      network: _currentNetwork,
                      onBack: () => setState(() => _view = 'menu'),
                      onSuccess: _onDepositSuccess,
                    ),
                  ),
                ),
              if (_view == 'connected')
                Expanded(
                  child: SingleChildScrollView(
                    child: ConnectedWalletDepositView(
                      network: _currentNetwork,
                      onBack: () => setState(() => _view = 'menu'),
                      onSuccess: _onDepositSuccess,
                    ),
                  ),
                ),
              if (_view == 'crosschain')
                Expanded(
                  child: CrossChainDepositView(
                    network: _currentNetwork,
                    onBack: () => setState(() => _view = 'menu'),
                    onSuccess: _onDepositSuccess,
                  ),
                ),
            ],
          ],
          ),
        );
      },
    ),
    );
  }
}

class _DepositOption extends StatelessWidget {
  const _DepositOption({
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
                      style: GoogleFonts.dmSans(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
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

