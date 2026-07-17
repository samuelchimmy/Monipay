import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../app/widgets/monipay_logo.dart';
import 'splash_screen.dart' show secureStorageServiceProvider;

const double _kRadius = 16.0;

/// Shadow used on all feature tour cards (visible depth).
List<BoxShadow> _cardShadow(Color fg) => [
      BoxShadow(
        color: fg.withOpacity(0.12),
        blurRadius: 24,
        offset: const Offset(0, 10),
        spreadRadius: 0,
      ),
      BoxShadow(
        color: fg.withOpacity(0.06),
        blurRadius: 8,
        offset: const Offset(0, 4),
        spreadRadius: 0,
      ),
    ];

/// Clips the blue top section with a smooth circular arc at the bottom (arc under the cards).
/// Uses a larger radius for a shallower cut (less deep arc).
class _BlueArcClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    // Larger radius = shallower arc (less deep cut). ~1.4x width gives a gentler curve.
    final radius = size.width * 1.4;
    final path = Path();
    path.moveTo(0, 0);
    path.lineTo(size.width, 0);
    path.lineTo(size.width, size.height);
    path.arcToPoint(
      Offset(0, size.height),
      radius: Radius.circular(radius),
      clockwise: false,
    );
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// Jagged paper-cut (torn receipt) bottom edge: irregular triangular teeth.
class _PaperCutClipper extends CustomClipper<Path> {
  static const int _teeth = 16;
  static const double _toothDepth = 8.0;

  @override
  Path getClip(Size size) {
    final path = Path();
    path.moveTo(0, 0);
    path.lineTo(size.width, 0);
    path.lineTo(size.width, size.height);
    final step = size.width / _teeth;
    // Draw jagged edge: alternate down into the card (teeth) and back up
    for (var i = _teeth - 1; i >= 0; i--) {
      final x = i * step;
      final xMid = x + step * 0.5;
      // Tooth tip dips down (positive y = downward)
      path.lineTo(xMid, size.height + _toothDepth);
      path.lineTo(x, size.height);
    }
    path.lineTo(0, size.height);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// Swipeable feature tour: Send, Payment Terminal, AI/MoniBot, Ready to Send Money.
/// Layout: blue top with curved transition, card in blue area; title/subtitle on light bg; dots + Skip/NEXT (or ENTER + Fund Wallet on last).
class FeatureTourScreen extends ConsumerStatefulWidget {
  const FeatureTourScreen({super.key});

  @override
  ConsumerState<FeatureTourScreen> createState() => _FeatureTourScreenState();
}

class _FeatureTourScreenState extends ConsumerState<FeatureTourScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  static const int _totalPages = 4;
  String _moniTag = '';

  @override
  void initState() {
    super.initState();
    _loadTag();
  }

  Future<void> _loadTag() async {
    final tag = await ref.read(secureStorageServiceProvider).read(key: 'monipay_pay_tag');
    if (!mounted) return;
    setState(() => _moniTag = tag?.trim() ?? '');
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onEnter() {
    context.go('/dashboard');
  }

  void _onFundWallet() {
    context.go('/dashboard', extra: {'openFund': true});
  }

  void _onSkip() {
    context.go('/dashboard');
  }

  void _onNext() {
    if (_currentPage >= _totalPages - 1) {
      _onEnter();
    } else {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bg = isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    final isLastPage = _currentPage == _totalPages - 1;

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (i) => setState(() => _currentPage = i),
                children: [
                  _tourPageLayout(
                    context: context,
                    fg: fg,
                    muted: muted,
                    title: 'Send Money Instantly',
                    subtitle: 'Type @username and an amount. Money arrives in 10 seconds. Gasless. No complicated addresses.',
                    card: _SendMoneyCard(cardBg: cardBg, fg: fg, muted: muted),
                  ),
                  _tourPageLayout(
                    context: context,
                    fg: fg,
                    muted: muted,
                    title: 'Your Phone is a Payment Terminal',
                    subtitle: 'Share a payment link, run an online store, show a QR code, or send an invoice. Get paid in stablecoins.',
                    card: _PaymentTerminalCard(cardBg: cardBg, fg: fg, muted: muted),
                  ),
                  _tourPageLayout(
                    context: context,
                    fg: fg,
                    muted: muted,
                    title: 'AI That Sends Payments for You',
                    subtitle: 'Tweet @monibot send \$5 to @alice and watch it happen. Campaigns on X & Discord — autonomously.',
                    card: _MoniBotCard(cardBg: cardBg, fg: fg, muted: muted),
                  ),
                  _ReadyCard(
                    fg: fg,
                    muted: muted,
                    moniTag: _moniTag,
                    onEnter: _onEnter,
                    onFundWallet: _onFundWallet,
                  ),
                ],
              ),
            ),
            if (!isLastPage) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_totalPages, (i) {
                    final active = i == _currentPage;
                    return GestureDetector(
                      onTap: () => _pageController.animateToPage(
                        i,
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeOut,
                      ),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: active ? 22 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: active ? fg : muted.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    );
                  }),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: OutlinedButton(
                          onPressed: _onSkip,
                          style: OutlinedButton.styleFrom(
                            backgroundColor: fg,
                            foregroundColor: bg,
                            side: BorderSide.none,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
                          ),
                          child: Text('Skip', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: ElevatedButton(
                          onPressed: _onNext,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: fg,
                            foregroundColor: bg,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
                          ),
                          child: Text('NEXT', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w800)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Shared layout: blue top with arc (curved bottom) under the card; card centered in blue; title + subtitle below on light bg.
Widget _tourPageLayout({
  required BuildContext context,
  required Color fg,
  required Color muted,
  required String title,
  required String subtitle,
  required Widget card,
}) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  final bg = isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight;

  return Column(
    children: [
      Expanded(
        flex: 11,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Blue section clipped to curved bottom (arc is under the card)
            ClipPath(
              clipper: _BlueArcClipper(),
              child: Stack(
                children: [
                  Container(
                    width: double.infinity,
                    height: double.infinity,
                    color: MonipayColors.primaryBlue,
                  ),
                  Positioned(
                    left: -64,
                    top: -64,
                    child: Container(
                      width: 176,
                      height: 176,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.08),
                      ),
                    ),
                  ),
                  Positioned(
                    right: -48,
                    top: 48,
                    child: Container(
                      width: 128,
                      height: 128,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.08),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Card on top of the blue (arc is under it); constrained width and depth
            Center(
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: card,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      Expanded(
        flex: 9,
        child: Container(
          color: bg,
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                style: GoogleFonts.montserrat(fontSize: 28, fontWeight: FontWeight.w800, color: fg),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                subtitle,
                style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

/// Card 1: Send Money Instantly
class _SendMoneyCard extends StatelessWidget {
  const _SendMoneyCard({required this.cardBg, required this.fg, required this.muted});

  final Color cardBg;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(_kRadius),
            border: Border.all(color: muted.withOpacity(0.2)),
            boxShadow: _cardShadow(fg),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(color: MonipayColors.primaryBlue, borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.send_rounded, size: 18, color: Colors.white),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Sending USDC', style: GoogleFonts.montserrat(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
                      Text('Gasless · Instant', style: GoogleFonts.dmSans(fontSize: 9, color: muted)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: muted.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    CircleAvatar(radius: 12, backgroundColor: MonipayColors.primaryBlue.withOpacity(0.2), child: Text('A', style: GoogleFonts.montserrat(fontSize: 10, fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue))),
                    const SizedBox(width: 8),
                    Text('@alice', style: GoogleFonts.montserrat(fontSize: 14, fontWeight: FontWeight.w700, color: fg)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text('\$50.00', style: GoogleFonts.montserrat(fontSize: 28, fontWeight: FontWeight.w800, color: fg), textAlign: TextAlign.center),
              Text('50.00 USDC on Base', style: GoogleFonts.dmSans(fontSize: 10, color: muted), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Network Fee', style: GoogleFonts.dmSans(fontSize: 10, color: muted)),
                  Text('Sponsored ✨', style: GoogleFonts.dmSans(fontSize: 10, fontWeight: FontWeight.w600, color: MonipayColors.primaryBlue)),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(color: MonipayColors.primaryBlue, borderRadius: BorderRadius.circular(12)),
                child: Text('Confirm & Send', style: GoogleFonts.montserrat(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white), textAlign: TextAlign.center),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: MonipayColors.success.withOpacity(0.3)),
            boxShadow: _cardShadow(fg),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.check_circle, size: 20, color: MonipayColors.success),
              const SizedBox(width: 8),
              Text('Sent in 10 seconds', style: GoogleFonts.montserrat(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
            ],
          ),
        ),
      ],
    );
  }
}

/// Card 2: Your Phone is a Payment Terminal (paper-cut bottom edge)
class _PaymentTerminalCard extends StatelessWidget {
  const _PaymentTerminalCard({required this.cardBg, required this.fg, required this.muted});

  final Color cardBg;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: _PaperCutClipper(),
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(_kRadius),
            topRight: Radius.circular(_kRadius),
          ),
          border: Border.all(color: muted.withOpacity(0.2)),
          boxShadow: _cardShadow(fg),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(color: MonipayColors.primaryBlue, borderRadius: BorderRadius.circular(6)),
                  child: Center(child: Text('M', style: GoogleFonts.montserrat(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white))),
                ),
                const SizedBox(width: 6),
                Text('Moni', style: GoogleFonts.montserrat(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
                Text('PAY', style: GoogleFonts.montserrat(fontSize: 12, fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue)),
              ],
            ),
            const SizedBox(height: 4),
            Text('Transaction Receipt', style: GoogleFonts.dmSans(fontSize: 9, color: muted), textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text('@shopkeeper', style: GoogleFonts.montserrat(fontSize: 11, fontWeight: FontWeight.w600, color: fg), textAlign: TextAlign.center),
            Text('Feb 25, 2026 · 2:15 PM', style: GoogleFonts.dmSans(fontSize: 8, color: muted), textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Divider(color: muted.withOpacity(0.3), height: 1),
            const SizedBox(height: 8),
            _receiptRow('Premium Headphones', '\$89.00', fg),
            _receiptRow('USB-C Cable', '\$12.00', fg),
            const SizedBox(height: 8),
            Divider(color: muted.withOpacity(0.3), height: 1),
            const SizedBox(height: 8),
            _receiptRow('Subtotal', '\$101.00', fg),
            _receiptRow('Fee (1%)', '-\$1.01', muted),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Network Fee', style: GoogleFonts.dmSans(fontSize: 8, color: muted)),
                Text('Sponsored ✨', style: GoogleFonts.dmSans(fontSize: 8, fontWeight: FontWeight.w500, color: MonipayColors.primaryBlue)),
              ],
            ),
            const SizedBox(height: 8),
            Divider(color: muted.withOpacity(0.3), height: 1),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total', style: GoogleFonts.montserrat(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
                Text('\$99.99', style: GoogleFonts.montserrat(fontSize: 11, fontWeight: FontWeight.w800, color: MonipayColors.success)),
              ],
            ),
            const SizedBox(height: 12),
            Text('PAYMENT CONFIRMED ✓', style: GoogleFonts.montserrat(fontSize: 9, fontWeight: FontWeight.w700, color: fg), textAlign: TextAlign.center),
            Text('Powered by MoniPay', style: GoogleFonts.dmSans(fontSize: 8, color: muted), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _receiptRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.dmSans(fontSize: 9, color: color)),
          Text(value, style: GoogleFonts.dmSans(fontSize: 9, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

/// Card 3: AI That Sends Payments for You (@monibot)
class _MoniBotCard extends StatelessWidget {
  const _MoniBotCard({required this.cardBg, required this.fg, required this.muted});

  final Color cardBg;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(_kRadius),
        border: Border.all(color: muted.withOpacity(0.2)),
        boxShadow: _cardShadow(fg),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: fg, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.smart_toy_outlined, size: 18, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('@monibot', style: GoogleFonts.montserrat(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
                  Text('AI Payment Agent', style: GoogleFonts.dmSans(fontSize: 9, color: muted)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: muted.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    text: '@you ',
                    style: GoogleFonts.dmSans(fontSize: 11, color: fg, fontWeight: FontWeight.w600),
                    children: [
                      TextSpan(text: 'tweeted:', style: GoogleFonts.dmSans(fontSize: 11, color: fg)),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Text('"@monibot send \$5 to @alice, @bob, @charlie"', style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _moniBotRow('@alice', '\$5.00 ✓'),
          _moniBotRow('@bob', '\$5.00 ✓'),
          _moniBotRow('@charlie', '\$5.00 ✓'),
          const SizedBox(height: 12),
          Divider(color: muted.withOpacity(0.3), height: 1),
          const SizedBox(height: 8),
          Text('3 payments · 0 gas fees · 12 seconds', style: GoogleFonts.dmSans(fontSize: 9, color: muted), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _moniBotRow(String handle, String amount) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle, size: 18, color: MonipayColors.success),
              const SizedBox(width: 8),
              Text(handle, style: GoogleFonts.montserrat(fontSize: 10, fontWeight: FontWeight.w600, color: fg)),
            ],
          ),
          Text(amount, style: GoogleFonts.montserrat(fontSize: 10, fontWeight: FontWeight.w700, color: MonipayColors.success)),
        ],
      ),
    );
  }
}

/// Card 4: Ready to Send Money? — ENTER + Fund Wallet (dark buttons)
class _ReadyCard extends StatelessWidget {
  const _ReadyCard({
    required this.fg,
    required this.muted,
    required this.moniTag,
    required this.onEnter,
    required this.onFundWallet,
  });

  final Color fg;
  final Color muted;
  final String moniTag;
  final VoidCallback onEnter;
  final VoidCallback onFundWallet;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight;

    return Column(
      children: [
        Expanded(
          flex: 11,
          child: Stack(
            children: [
              ClipPath(
                clipper: _BlueArcClipper(),
                child: Stack(
                  children: [
                    Container(width: double.infinity, height: double.infinity, color: MonipayColors.primaryBlue),
                    Positioned(left: -64, top: -64, child: _circle(176)),
                    Positioned(right: -48, top: 48, child: _circle(128)),
                  ],
                ),
              ),
              const Center(
                child: SizedBox(
                  width: 104,
                  height: 104,
                  child: AnimatedMonipayLogo(color: Colors.white, size: 104),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          flex: 9,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Ready to Send Money?', style: GoogleFonts.montserrat(fontSize: 28, fontWeight: FontWeight.w800, color: fg), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                Text(
                  moniTag.isNotEmpty
                      ? 'Welcome @${moniTag.replaceFirst('@', '')}. Your wallet is set up. Start sending and receiving payments instantly.'
                      : 'Your wallet is set up. Start sending and receiving payments instantly.',
                  style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: onEnter,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: fg,
                      foregroundColor: bg,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
                    ),
                    child: Text('ENTER', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: onFundWallet,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: fg,
                      foregroundColor: bg,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.account_balance_wallet_outlined, size: 22),
                        const SizedBox(width: 8),
                        Text('Fund Wallet', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _circle(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withOpacity(0.08)),
    );
  }
}
