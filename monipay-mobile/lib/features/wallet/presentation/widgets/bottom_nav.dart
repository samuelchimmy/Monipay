import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../app/theme/app_theme.dart';

typedef BottomNavTab = String;

/// Bottom nav matching web reference: bar with rounded top corners, elevated
/// center FAB (primary blue + QR icon), side items with icon + label.
/// Personal: Invoice, Send, Pay(center), Receive, Account.
/// Merchant: Stats, Store, Charge(center), History, Account.
class BottomNav extends StatelessWidget {
  const BottomNav({
    super.key,
    required this.mode,
    required this.activeTab,
    required this.onTabPress,
  });

  final String mode;
  final BottomNavTab? activeTab;
  final ValueChanged<BottomNavTab> onTabPress;

  static const List<({String id, String label, IconData icon, bool isCenter})>
      personalItems = [
    (id: 'invoices', label: 'Invoice', icon: LucideIcons.fileText, isCenter: false),
    (id: 'send', label: 'Send', icon: LucideIcons.arrowUp, isCenter: false),
    (id: 'pay', label: 'Pay', icon: LucideIcons.qrCode, isCenter: true),
    (id: 'receive', label: 'Receive', icon: LucideIcons.arrowDownLeft, isCenter: false),
    (id: 'account', label: 'Account', icon: LucideIcons.user, isCenter: false),
  ];

  static const List<({String id, String label, IconData icon, bool isCenter})>
      merchantItems = [
    (id: 'stats', label: 'Stats', icon: LucideIcons.barChart3, isCenter: false),
    (id: 'store', label: 'Store', icon: LucideIcons.shoppingBag, isCenter: false),
    (id: 'charge', label: 'Charge', icon: LucideIcons.qrCode, isCenter: true),
    (id: 'history', label: 'History', icon: LucideIcons.clock, isCenter: false),
    (id: 'account', label: 'Account', icon: LucideIcons.user, isCenter: false),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final barBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final borderColor = isDark ? Colors.white12 : Colors.black12;
    final shadowColor = isDark ? Colors.black54 : fg.withOpacity(0.08);
    final items = mode == 'merchant' ? merchantItems : personalItems;

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: 16 + MediaQuery.of(context).padding.bottom,
      ),
      child: SizedBox(
        height: 72,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Bar: rounded top corners only, elevated (web reference)
            Container(
              height: 72,
              decoration: BoxDecoration(
                color: barBg,
                borderRadius: BorderRadius.circular(40),
                border: Border.all(color: borderColor, width: 1),
                boxShadow: [
                  BoxShadow(
                    color: shadowColor,
                    blurRadius: 24,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: Row(
                children: List.generate(items.length, (i) {
                  final item = items[i];
                  if (item.isCenter) {
                    return const Expanded(child: SizedBox());
                  }
                  return Expanded(
                    child: _NavItem(
                      icon: item.icon,
                      label: item.label,
                      isActive: activeTab == item.id,
                      fg: fg,
                      muted: muted,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        onTabPress(item.id);
                      },
                    ),
                  );
                }),
              ),
            ),
            // Center FAB: floating blue circle with white QR icon (web reference)
            Positioned(
              top: -28,
              left: 0,
              right: 0,
              child: Row(
                children: List.generate(items.length, (i) {
                  final item = items[i];
                  if (!item.isCenter) return const Expanded(child: SizedBox());
                  return Expanded(
                    child: Center(
                      child: _CenterFAB(
                        icon: item.icon,
                        label: item.label,
                        isActive: activeTab == item.id,
                        onTap: () {
                          HapticFeedback.lightImpact();
                          onTabPress(item.id);
                        },
                      ),
                    ),
                  );
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.fg,
    required this.muted,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isActive;
  final Color fg;
  final Color muted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = isActive ? MonipayColors.primaryBlue : muted;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: color),
              const SizedBox(height: 4),
              Text(
                label,
                style: GoogleFonts.dmSans(
                  fontSize: 11,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CenterFAB extends StatefulWidget {
  const _CenterFAB({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  State<_CenterFAB> createState() => _CenterFABState();
}

class _CenterFABState extends State<_CenterFAB>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scale = Tween<double>(begin: 1, end: 0.92).animate(
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
    const blue = MonipayColors.primaryBlue;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTapDown: (_) => _controller.forward(),
          onTapUp: (_) => _controller.reverse(),
          onTapCancel: () => _controller.reverse(),
          onTap: widget.onTap,
          child: AnimatedBuilder(
            animation: _scale,
            builder: (context, child) => Transform.scale(
              scale: _scale.value,
              child: child,
            ),
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: blue,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: blue.withOpacity(0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(widget.icon, size: 26, color: Colors.white),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          widget.label,
          style: GoogleFonts.dmSans(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: muted,
          ),
        ),
      ],
    );
  }
}
