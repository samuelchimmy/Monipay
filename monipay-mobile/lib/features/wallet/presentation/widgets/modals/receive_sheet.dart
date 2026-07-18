import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../../core/config/chain_configs.dart';
import '../../dashboard_controller.dart';
import '../../wallet_controller.dart';

class ReceiveSheet extends ConsumerStatefulWidget {
  const ReceiveSheet({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  ConsumerState<ReceiveSheet> createState() => _ReceiveSheetState();
}

class _ReceiveSheetState extends ConsumerState<ReceiveSheet> {
  int _tabIndex = 0; // 0 = MoniPay, 1 = External
  bool _receiveSuccess = false;
  String? _successPayerTag;
  double? _successAmount;
  String? _lastKnownTxId;
  int? _openedAtMs;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _openedAtMs = DateTime.now().millisecondsSinceEpoch;
    final state = ref.read(dashboardControllerProvider);
    _lastKnownTxId = state.transactions.isNotEmpty ? state.transactions.first.id : null;
    _startPolling();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _checkPayment());
  }

  Future<void> _checkPayment() async {
    if (!mounted || _receiveSuccess) return;
    final profileId = ref.read(dashboardControllerProvider).profileId;
    if (profileId == null || profileId.isEmpty) return;
    try {
      final response = await Supabase.instance.client.functions.invoke(
        'relay-payment',
        body: {
          'action': 'history',
          'message': {'profileId': profileId, 'limit': 50},
        },
      );
      final data = response.data as Map<String, dynamic>?;
      final list = (data?['transactions'] as List<dynamic>?) ?? const [];
      final openedAt = _openedAtMs ?? DateTime.now().millisecondsSinceEpoch;
      Map<String, dynamic>? match;
      for (final raw in list) {
        final tx = Map<String, dynamic>.from(raw as Map);
        final type = (tx['type'] as String?) ?? '';
        final id = tx['id'] as String?;
        if (type != 'received' || id == null || id == _lastKnownTxId) continue;
        final createdAt = tx['created_at'];
        int tsMs;
        if (createdAt is int) {
          tsMs = createdAt > 1000000000000 ? createdAt : createdAt * 1000;
        } else {
          final parsed = DateTime.tryParse(createdAt?.toString() ?? '');
          tsMs = parsed?.millisecondsSinceEpoch ?? 0;
        }
        if (tsMs > openedAt - 5000) {
          match = tx;
          break;
        }
      }
      if (match == null) return;

      final amount = double.tryParse(match['amount']?.toString() ?? '') ?? 0.0;
      final payer = (match['counterparty'] as String?) ?? '';
      setState(() {
        _receiveSuccess = true;
        _successPayerTag = payer;
        _successAmount = amount;
      });
      _pollTimer?.cancel();
      await ref.read(dashboardControllerProvider.notifier).refreshBalance();
      await ref.read(dashboardControllerProvider.notifier).syncTransactions();
      Future.delayed(const Duration(milliseconds: 2000), () {
        if (mounted) {
          setState(() {
            _receiveSuccess = false;
            _successPayerTag = null;
            _successAmount = null;
          });
          widget.onClose();
        }
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final storedTag = ref.watch(moniTagProvider).valueOrNull;
    final payTag = (dashboard.payTag ?? storedTag ?? '').trim();
    final address = dashboard.walletAddress ?? '';
    final network = dashboard.preferredNetwork.toLowerCase();
    final chainConfig = getChainConfig(network);
    final currencyLabel = chainConfig.currency;
    final networkLabel = '${chainConfig.currency} on ${chainConfig.name}';

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
                    Text(
                      'Receive Payment',
                      style: GoogleFonts.dmSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
                    ),
                    const Spacer(),
                    if (!_receiveSuccess)
                      IconButton(
                        onPressed: widget.onClose,
                        icon: const Icon(LucideIcons.x),
                      ),
                  ],
                ),
              ),
              if (_receiveSuccess)
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: MonipayColors.success,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(
                              LucideIcons.check,
                              size: 40,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Payment Received!',
                            style: GoogleFonts.dmSans(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: fg,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'From',
                            style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                          ),
                          Text(
                            _successPayerTag != null && !_successPayerTag!.startsWith('0x')
                                ? '@$_successPayerTag'
                                : '${_successPayerTag?.substring(0, 6)}...${_successPayerTag?.substring(_successPayerTag!.length - 4)}',
                            style: GoogleFonts.dmSans(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: fg,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            decoration: BoxDecoration(
                              color: muted.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(24),
                            ),
                            child: Text(
                              '+\$${_successAmount?.toStringAsFixed(2) ?? '0.00'} $currencyLabel',
                              style: GoogleFonts.dmSans(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                                color: MonipayColors.success,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else ...[
                _TabBar(
                  tabIndex: _tabIndex,
                  onTap: (i) => setState(() => _tabIndex = i),
                  isDark: isDark,
                  fg: fg,
                  muted: muted,
                ),
                const SizedBox(height: 20),
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _tabIndex == 0
                        ? _MoniPayTab(
                            payTag: payTag,
                            address: address,
                            onCopyTag: () {
                              if (payTag.isEmpty) return;
                              Clipboard.setData(ClipboardData(text: '@$payTag'));
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Copied @$payTag')),
                              );
                            },
                            onShareTag: () {
                              if (payTag.isEmpty) return;
                              Share.share('@$payTag on MoniPay — monipay.xyz');
                            },
                            muted: muted,
                            fg: fg,
                          )
                        : _ExternalTab(
                            address: address,
                            networkLabel: networkLabel,
                            muted: muted,
                            fg: fg,
                          ),
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

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tabIndex,
    required this.onTap,
    required this.isDark,
    required this.fg,
    required this.muted,
  });

  final int tabIndex;
  final ValueChanged<int> onTap;
  final bool isDark;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    return Container(
      padding: const EdgeInsets.all(4),
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: muted.withOpacity(0.2),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Expanded(
            child: _TabChip(
              label: 'MoniPay',
              icon: LucideIcons.smartphone,
              isActive: tabIndex == 0,
              onTap: () => onTap(0),
              cardBg: cardBg,
              fg: fg,
              muted: muted,
            ),
          ),
          Expanded(
            child: _TabChip(
              label: 'External Wallet',
              icon: LucideIcons.globe,
              isActive: tabIndex == 1,
              onTap: () => onTap(1),
              cardBg: cardBg,
              fg: fg,
              muted: muted,
            ),
          ),
        ],
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.icon,
    required this.isActive,
    required this.onTap,
    required this.cardBg,
    required this.fg,
    required this.muted,
  });

  final String label;
  final IconData icon;
  final bool isActive;
  final VoidCallback onTap;
  final Color cardBg;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? cardBg : Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: isActive ? fg : muted),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.dmSans(
                  fontSize: 13,
                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                  color: isActive ? fg : muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MoniPayTab extends StatelessWidget {
  const _MoniPayTab({
    required this.payTag,
    required this.address,
    required this.onCopyTag,
    required this.onShareTag,
    required this.muted,
    required this.fg,
  });

  final String payTag;
  final String address;
  final VoidCallback onCopyTag;
  final VoidCallback onShareTag;
  final Color muted;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    final payload = jsonEncode({
      'type': 'paytag_receive',
      'payTag': payTag,
      'address': address,
    });

    return Column(
      children: [
        _QrWithBrandedBand(data: payload, size: 160),
        const SizedBox(height: 16),
        if (payTag.isNotEmpty) ...[
          Text(
            '@$payTag',
            style: GoogleFonts.montserrat(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
        ],
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _PillButton(icon: LucideIcons.copy, label: 'Copy', onTap: onCopyTag),
            const SizedBox(width: 12),
            _PillButton(icon: LucideIcons.share2, label: 'Share', onTap: onShareTag),
          ],
        ),
        const SizedBox(height: 12),
        Text.rich(
          TextSpan(
            text: 'For ',
            style: GoogleFonts.dmSans(fontSize: 13, color: muted),
            children: [
              TextSpan(
                text: 'MoniPay App',
                style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w700, color: muted),
              ),
              const TextSpan(text: ' users'),
            ],
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        const _WaitingIndicator(),
      ],
    );
  }
}

class _QrWithBrandedBand extends StatelessWidget {
  const _QrWithBrandedBand({required this.data, required this.size});

  final String data;
  final double size;

  static const double _bandWidth = 8;
  static const double _borderWidth = 3;
  static const double _radius = 16;
  static const Color _blue = Color(0xFF0052FF);
  static const Color _lightBlue = Color(0xFF99BBFF);

  @override
  Widget build(BuildContext context) {
    final total = size + 2 * _bandWidth;
    return Container(
      width: total,
      height: total,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _blue, width: _borderWidth),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(_radius - 1),
        child: Stack(
          children: [
            CustomPaint(
              size: Size(total, total),
              painter: _DiagonalStripesPainter(
                colors: const [_blue, _lightBlue],
                stripeWidth: 8,
              ),
            ),
            Center(
              child: Container(
                width: size,
                height: size,
                color: Colors.white,
                child: QrImageView(
                  data: data,
                  version: QrVersions.auto,
                  size: size,
                  backgroundColor: Colors.white,
                  eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: _blue),
                  dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.black),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DiagonalStripesPainter extends CustomPainter {
  _DiagonalStripesPainter({required this.colors, required this.stripeWidth});

  final List<Color> colors;
  final double stripeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    final diagonal = size.width + size.height;
    canvas.save();
    canvas.translate(0, size.height);
    canvas.rotate(-0.785398); // 45 degrees
    for (var i = 0.0; i < diagonal; i += stripeWidth) {
      paint.color = colors[(i ~/ stripeWidth).toInt() % colors.length];
      canvas.drawRect(Rect.fromLTWH(i, -diagonal, stripeWidth, diagonal * 2), paint);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _PillButton extends StatelessWidget {
  const _PillButton({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 8),
              Text(label, style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExternalTab extends StatelessWidget {
  const _ExternalTab({
    required this.address,
    required this.networkLabel,
    required this.muted,
    required this.fg,
  });

  final String address;
  final String networkLabel;
  final Color muted;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _QrWithBrandedBand(data: address, size: 160),
        const SizedBox(height: 16),
        Text(
          address.length >= 12
              ? '${address.substring(0, 6)}...${address.substring(address.length - 4)}'
              : address,
          style: GoogleFonts.dmSans(fontSize: 13, color: fg).copyWith(fontFamily: 'monospace'),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          networkLabel,
          style: GoogleFonts.dmSans(fontSize: 12, color: muted),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _PillButton(
              icon: LucideIcons.copy,
              label: 'Copy',
              onTap: () {
                Clipboard.setData(ClipboardData(text: address));
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Address copied')));
              },
            ),
            const SizedBox(width: 12),
            _PillButton(
              icon: LucideIcons.share2,
              label: 'Share',
              onTap: () => Share.share('$address — MoniPay monipay.xyz'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text.rich(
          TextSpan(
            text: 'For ',
            style: GoogleFonts.dmSans(fontSize: 13, color: muted),
            children: [
              TextSpan(
                text: 'External Wallets',
                style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w700, color: muted),
              ),
            ],
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        const _WaitingIndicator(),
      ],
    );
  }
}

class _WaitingIndicator extends StatefulWidget {
  const _WaitingIndicator();

  @override
  State<_WaitingIndicator> createState() => _WaitingIndicatorState();
}

class _WaitingIndicatorState extends State<_WaitingIndicator>
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
    _opacity = Tween<double>(begin: 0.3, end: 1.0).animate(
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
    const muted = MonipayColors.mutedSlate;

    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, child) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: MonipayColors.primaryBlue.withOpacity(_opacity.value.clamp(0.0, 1.0)),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Waiting for payment...',
              style: GoogleFonts.dmSans(fontSize: 14, color: muted),
            ),
          ],
        );
      },
    );
  }
}
