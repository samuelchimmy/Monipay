import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/config/chain_configs.dart';
import 'network_toggle_widget.dart';

/// Balance card with dented top-center notch for network toggle.
/// Personal: #1A1F2E; Merchant: #0052FF.
class BalanceCard extends StatelessWidget {
  const BalanceCard({
    super.key,
    required this.mode,
    required this.hideBalance,
    required this.balance,
    required this.payTag,
    required this.walletAddress,
    required this.preferredNetwork,
    required this.onToggleHideBalance,
    required this.onHistory,
    required this.onNetworkChanged,
    required this.onWithdraw,
    required this.onFund,
    required this.onMoniBot,
  });

  final String mode;
  final bool hideBalance;
  final double balance;
  final String? payTag;
  final String? walletAddress;
  final String preferredNetwork;
  final VoidCallback onToggleHideBalance;
  final VoidCallback onHistory;
  final void Function(String) onNetworkChanged;
  final VoidCallback? onWithdraw;
  final VoidCallback? onFund;
  final VoidCallback? onMoniBot;

  static String _shortAddress(String? address) {
    if (address == null || address.length < 12) return '••••••••';
    return '${address.substring(0, 6)}...${address.substring(address.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    final isMerchant = mode == 'merchant';
    final cardColor = isMerchant
        ? MonipayColors.balanceCardMerchant
        : MonipayColors.balanceCardPersonal;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Card with top-center notch
        CustomPaint(
          painter: _NotchedCardPainter(
            color: cardColor,
            borderRadius: 20,
            notchWidth: 100,
            notchDepth: 12,
          ),
          child: Container(
            width: double.infinity,
            margin: const EdgeInsets.only(top: 24),
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Gradient overlay effect via decoration on inner content if needed; card is already colored
                _buildTopRow(context),
                const SizedBox(height: 12),
                _buildBalanceRow(context),
                const SizedBox(height: 8),
                _buildAddressRow(context),
                if (isMerchant && onWithdraw != null) ...[
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: _pillButton(
                      context,
                      'Withdraw',
                      onPressed: onWithdraw!,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                _buildActivationRow(context),
                if (!isMerchant && onFund != null && onMoniBot != null) ...[
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _outlinePill(
                          context,
                          'Fund',
                          LucideIcons.wallet,
                          onFund!,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _filledPill(
                          context,
                          'MoniBot AI',
                          LucideIcons.bot,
                          onMoniBot!,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        // Network toggle pill above card center
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: Center(
            child: NetworkToggleWidget(
              currentNetwork: preferredNetwork,
              onNetworkChanged: onNetworkChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTopRow(BuildContext context) {
    return Row(
      children: [
        Text(
          'BALANCE',
          style: GoogleFonts.dmSans(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.white.withOpacity(0.6),
            letterSpacing: 1.2,
          ),
        ),
        if (payTag != null && payTag!.isNotEmpty) ...[
          const SizedBox(width: 8),
          Text(
            '@${payTag!}',
            style: GoogleFonts.dmSans(
              fontSize: 12,
              color: Colors.white.withOpacity(0.35),
            ),
          ),
        ],
        const Spacer(),
        _iconButton(context, hideBalance ? LucideIcons.eyeOff : LucideIcons.eye,
            onToggleHideBalance),
        const SizedBox(width: 8),
        _iconButton(context, LucideIcons.clock, onHistory),
      ],
    );
  }

  Widget _iconButton(BuildContext context, IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white.withOpacity(0.1),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, size: 18, color: Colors.white),
        ),
      ),
    );
  }

  Widget _buildBalanceRow(BuildContext context) {
    final displayBalance = hideBalance
        ? '••••••'
        : '\$${balance.toStringAsFixed(2)}';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          displayBalance,
          style: GoogleFonts.dmSans(
            fontSize: 36,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          getChainConfig(preferredNetwork).currency,
          style: GoogleFonts.dmSans(
            fontSize: 14,
            color: Colors.white.withOpacity(0.5),
          ),
        ),
      ],
    );
  }

  Widget _buildAddressRow(BuildContext context) {
    return Row(
      children: [
        Text(
          _shortAddress(walletAddress),
          style: GoogleFonts.dmSans(
            fontSize: 12,
            color: Colors.white.withOpacity(0.45),
          ).copyWith(fontFamily: 'monospace'),
        ),
        const SizedBox(width: 8),
        _LivePill(),
      ],
    );
  }

  Widget _buildActivationRow(BuildContext context) {
    return Row(
      children: [
        Icon(
          LucideIcons.zap,
          size: 14,
          color: Colors.white.withOpacity(0.6),
        ),
        const SizedBox(width: 6),
        Text(
          'Wallet activated for gasless',
          style: GoogleFonts.dmSans(
            fontSize: 11,
            color: Colors.white.withOpacity(0.6),
          ),
        ),
      ],
    );
  }

  Widget _pillButton(BuildContext context, String label, {required VoidCallback onPressed}) {
    return Material(
      color: Colors.white.withOpacity(0.2),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            label,
            style: GoogleFonts.dmSans(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }

  Widget _outlinePill(BuildContext context, String label, IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white.withOpacity(0.5)),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.dmSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _filledPill(BuildContext context, String label, IconData icon, VoidCallback onTap) {
    return Material(
      color: MonipayColors.primaryBlue,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.dmSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LivePill extends StatefulWidget {
  @override
  State<_LivePill> createState() => _LivePillState();
}

class _LivePillState extends State<_LivePill>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: MonipayColors.success.withOpacity(_opacity.value * 0.3),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: MonipayColors.success.withOpacity(0.6)),
          ),
          child: Text(
            'Live',
            style: GoogleFonts.dmSans(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: MonipayColors.success,
            ),
          ),
        );
      },
    );
  }
}

/// Paints a rounded rectangle with a top-center notch (dented).
class _NotchedCardPainter extends CustomPainter {
  _NotchedCardPainter({
    required this.color,
    required this.borderRadius,
    required this.notchWidth,
    required this.notchDepth,
  });

  final Color color;
  final double borderRadius;
  final double notchWidth;
  final double notchDepth;

  @override
  void paint(Canvas canvas, Size size) {
    final fullRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(borderRadius),
    );
    final path = Path()..addRRect(fullRect);
    final notchLeft = (size.width - notchWidth) / 2;
    final notchRect = RRect.fromRectAndCorners(
      Rect.fromLTWH(notchLeft, 0, notchWidth, notchDepth + 10),
      topLeft: const Radius.circular(10),
      topRight: const Radius.circular(10),
    );
    path.addRRect(notchRect);
    path.fillType = PathFillType.evenOdd;
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
