import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../app/widgets/monipay_logo.dart';
import '../../auth/presentation/theme_controller.dart';
import '../../../../core/security/biometrics_service.dart';
import 'dashboard_controller.dart';
import 'dashboard_state.dart';
import 'wallet_controller.dart';
import 'widgets/balance_card.dart';
import 'widgets/bottom_nav.dart';
import 'widgets/merchant_dashboard.dart';
import 'widgets/personal_dashboard.dart';
import 'widgets/modals/fund_sheet.dart';
import 'widgets/modals/history_sheet.dart';
import 'widgets/modals/monibot_sheet.dart';
import 'widgets/modals/network_sheet.dart';
import 'widgets/modals/pay_sheet.dart';
import 'widgets/modals/payment_confirm_sheet.dart';
import 'widgets/modals/receive_sheet.dart';
import 'send_controller.dart';
import 'widgets/modals/send_sheet.dart';
import 'widgets/modals/settings_sheet.dart';
import 'widgets/modals/withdraw_sheet.dart';
import 'widgets/modals/invoice_sheet.dart';

/// Dashboard: sticky header, balance card, scrollable content, floating bottom nav.
/// Modals slide up over the screen. Session locks after 3 minutes in background.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key, this.openFundOnMount = false});

  final bool openFundOnMount;

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with WidgetsBindingObserver {
  DateTime? _backgroundAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(dashboardControllerProvider.notifier).refreshBalance();
      ref.read(dashboardControllerProvider.notifier).startBalancePolling();
    });
    if (widget.openFundOnMount) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref.read(dashboardControllerProvider.notifier).setOpenModal('fund');
        }
      });
    }
  }

  @override
  void dispose() {
    ref.read(dashboardControllerProvider.notifier).stopBalancePolling();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _backgroundAt = DateTime.now();
    } else if (state == AppLifecycleState.resumed && _backgroundAt != null) {
      final elapsed = DateTime.now().difference(_backgroundAt!);
      if (elapsed.inMinutes >= 3 && mounted) {
        context.go('/lock');
      } else {
        ref.read(dashboardControllerProvider.notifier).refreshBalance();
        ref.read(dashboardControllerProvider.notifier).syncTransactions();
      }
      _backgroundAt = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardControllerProvider);
    final storedTag = ref.watch(moniTagProvider).valueOrNull;
    final send = ref.watch(sendControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bg = isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                _Header(
                  mode: dashboard.mode,
                  isDark: isDark,
                  fg: fg,
                  muted: muted,
                  onModeChanged: (m) =>
                      ref.read(dashboardControllerProvider.notifier).setMode(m),
                  onThemeToggle: () => _toggleTheme(ref),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => ref
                        .read(dashboardControllerProvider.notifier)
                        .refresh(),
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                            child: BalanceCard(
                            mode: dashboard.mode,
                            hideBalance: dashboard.hideBalance,
                            balance: dashboard.balance,
                            payTag: dashboard.payTag ?? storedTag,
                            walletAddress: dashboard.walletAddress,
                            preferredNetwork: dashboard.preferredNetwork,
                            onToggleHideBalance: () => ref
                                .read(dashboardControllerProvider.notifier)
                                .toggleHideBalance(),
                            onHistory: () => ref
                                .read(dashboardControllerProvider.notifier)
                                .setOpenModal('history'),
                            onNetworkChanged: (network) => ref
                                .read(dashboardControllerProvider.notifier)
                                .setPreferredNetwork(network),
                            onWithdraw: dashboard.mode == 'merchant'
                                ? () => _openWithdrawWithAuth(context, ref)
                                : null,
                            onFund: dashboard.mode == 'personal'
                                ? () => ref
                                    .read(dashboardControllerProvider.notifier)
                                    .setOpenModal('fund')
                                : null,
                            onMoniBot: dashboard.mode == 'personal'
                                ? () => ref
                                    .read(dashboardControllerProvider.notifier)
                                    .setOpenModal('monibot')
                                : null,
                          ),
                        ),
                        dashboard.mode == 'personal'
                            ? PersonalDashboard(
                                transactions: dashboard.transactions,
                                isRefreshing: dashboard.isRefreshing,
                                onRefresh: () => ref
                                    .read(dashboardControllerProvider.notifier)
                                    .refresh(),
                              )
                            : MerchantDashboard(
                                transactions: dashboard.transactions,
                              ),
                          const SizedBox(height: 120),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (dashboard.openModal != null) _ModalOverlay(
              key: ValueKey(dashboard.openModal),
              modal: dashboard.openModal!,
              state: dashboard,
              onClose: () {
                final notifier = ref.read(dashboardControllerProvider.notifier);
                notifier.closeModals();
                notifier.refreshBalance();
                notifier.syncTransactions();
              },
              onNetworkSelect: (net) => ref
                  .read(dashboardControllerProvider.notifier)
                  .setPreferredNetwork(net),
              onInsufficientFunds: (shortfall) {
                ref.read(dashboardControllerProvider.notifier).openFundWithShortfall(shortfall);
              },
              onSendSuccessOverlay: () {},
            ),
            if (send.successAmount != null) _SendSuccessOverlay(
              amount: send.successAmount!,
              tag: send.successTag ?? '',
              onDismiss: () {
                ref.read(sendControllerProvider.notifier).clearSuccess();
                ref.read(dashboardControllerProvider.notifier).refresh();
              },
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: BottomNav(
                mode: dashboard.mode,
                activeTab: dashboard.activeTab,
                onTabPress: (tab) => _onNavTap(context, ref, tab),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleTheme(WidgetRef ref) async {
    final theme = ref.read(themeControllerProvider);
    final next = theme == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    await ref.read(themeControllerProvider.notifier).setTheme(next);
  }

  void _onNavTap(BuildContext context, WidgetRef ref, String tab) {
    if (tab == 'account') {
      context.push('/settings');
      return;
    }
    if (tab == 'invoices') {
      ref.read(dashboardControllerProvider.notifier).setOpenModal('invoices');
      return;
    }
    if (tab == 'pay') {
      _openPayScanner(context, ref);
      return;
    }
    if (tab == 'history') {
      context.push('/transaction-history');
      return;
    }
    ref.read(dashboardControllerProvider.notifier).setActiveTab(tab);
  }

  Future<void> _openPayScanner(BuildContext context, WidgetRef ref) async {
    final status = await Permission.camera.status;
    if (!status.isGranted) {
      final result = await Permission.camera.request();
      if (!result.isGranted && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Camera permission required to scan QR codes')),
        );
        return;
      }
    }
    if (context.mounted) {
      context.push('/scan');
    }
  }

  Future<void> _openWithdrawWithAuth(BuildContext context, WidgetRef ref) async {
    final bio = LocalAuthBiometricsService();
    final canCheck = await bio.canCheckBiometrics();
    final ok = canCheck
        ? await bio.authenticate(localizedReason: 'Confirm withdrawal')
        : true;
    if (ok && context.mounted) {
      ref.read(dashboardControllerProvider.notifier).setOpenModal('withdraw');
    }
  }

}

class _Header extends StatelessWidget {
  const _Header({
    required this.mode,
    required this.isDark,
    required this.fg,
    required this.muted,
    required this.onModeChanged,
    required this.onThemeToggle,
  });

  final String mode;
  final bool isDark;
  final Color fg;
  final Color muted;
  final ValueChanged<String> onModeChanged;
  final VoidCallback onThemeToggle;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: (isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight)
                .withOpacity(0.8),
          ),
          child: Row(
            children: [
              AnimatedMonipayLogo(
                color: fg,
                size: 40,
              ),
              const Spacer(),
              // Mode toggle pill
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: muted.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ModeChip(
                      label: 'Merchant',
                      isActive: mode == 'merchant',
                      onTap: () => onModeChanged('merchant'),
                    ),
                    _ModeChip(
                      label: 'Personal',
                      isActive: mode == 'personal',
                      onTap: () => onModeChanged('personal'),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              // Theme toggle
              Material(
                color: muted.withOpacity(0.2),
                shape: const CircleBorder(),
                child: InkWell(
                  onTap: onThemeToggle,
                  customBorder: const CircleBorder(),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Icon(
                      isDark ? LucideIcons.sun : LucideIcons.moon,
                      size: 20,
                      color: fg,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const muted = MonipayColors.mutedSlate;

    return Material(
      color: isActive ? MonipayColors.primaryBlue : Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            label,
            style: GoogleFonts.dmSans(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isActive ? Colors.white : muted,
            ),
          ),
        ),
      ),
    );
  }
}

class _ModalOverlay extends StatefulWidget {
  const _ModalOverlay({
    super.key,
    required this.modal,
    required this.state,
    required this.onClose,
    required this.onNetworkSelect,
    required this.onInsufficientFunds,
    required this.onSendSuccessOverlay,
  });

  final String modal;
  final DashboardState state;
  final VoidCallback onClose;
  final ValueChanged<String> onNetworkSelect;
  final void Function(double shortfall) onInsufficientFunds;
  final VoidCallback onSendSuccessOverlay;

  @override
  State<_ModalOverlay> createState() => _ModalOverlayState();
}

class _ModalOverlayState extends State<_ModalOverlay> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slide;
  late Animation<double> _fade;
  bool _closing = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
      reverseDuration: const Duration(milliseconds: 280),
    );
    _slide = Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _fade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0, 200 / 320, curve: Curves.easeOut)),
    );
    _controller.forward();
  }

  @override
  void didUpdateWidget(_ModalOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.modal != widget.modal) {
      _closing = false;
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _closeSheet() async {
    if (_closing) return;
    _closing = true;
    try {
      await _controller.reverse();
    } finally {
      if (mounted) {
        widget.onClose();
      }
      _closing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom + 96;
    // Build sheet once — SlideTransition/FadeTransition operate on the
    // RenderObject layer so the sheet subtree does NOT rebuild every frame.
    final sheetContent = _buildSheet(context);
    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          // Blurred + tinted backdrop — sigma and opacity both track _fade so
          // the blur fully disappears before the widget is removed from the tree.
          AnimatedBuilder(
            animation: _fade,
            builder: (context, _) {
              // Skip rendering entirely at zero to guarantee no residual blur.
              if (_fade.value <= 0.0) return const SizedBox.expand();
              final sigma = 12.0 * _fade.value;
              return GestureDetector(
                onTap: _closeSheet,
                behavior: HitTestBehavior.opaque,
                child: ClipRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
                    child: Container(
                      color: Colors.black.withOpacity(_fade.value * 0.35),
                    ),
                  ),
                ),
              );
            },
          ),
          // Sheet — transitions run on GPU, no rebuild of sheet subtree
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: EdgeInsets.only(bottom: bottomPad),
              child: SlideTransition(
                position: _slide,
                child: FadeTransition(
                  opacity: _fade,
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                    child: Material(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      child: sheetContent,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSheet(BuildContext context) {
    final onClose = _closeSheet;
    switch (widget.modal) {
      case 'send':
        return SendSheet(
          onClose: onClose,
          onInsufficientFunds: widget.onInsufficientFunds,
          onSuccessOverlay: widget.onSendSuccessOverlay,
        );
      case 'receive':
        return ReceiveSheet(onClose: onClose);
      case 'pay':
      case 'charge':
        return PaySheet(onClose: onClose);
      case 'pay_confirm':
        return PaymentConfirmSheet(
          onClose: onClose,
          onSuccessOverlay: widget.onSendSuccessOverlay,
        );
      case 'history':
        return HistorySheet(onClose: onClose);
      case 'fund':
        return FundSheet(
          onClose: onClose,
          insufficientFundsAmount: widget.state.fundSheetShortfall,
        );
      case 'settings':
        return SettingsSheet(onClose: onClose);
      case 'monibot':
        return MonibotSheet(onClose: onClose);
      case 'withdraw':
        return WithdrawSheet(onClose: onClose);
      case 'network':
        return NetworkSheet(
          currentNetwork: widget.state.preferredNetwork,
          onClose: onClose,
          onSelectNetwork: widget.onNetworkSelect,
        );
      case 'invoices':
        return InvoiceSheet(onClose: onClose);
      default:
        return const SizedBox.shrink();
    }
  }
}

class _SendSuccessOverlay extends StatefulWidget {
  const _SendSuccessOverlay({
    required this.amount,
    required this.tag,
    required this.onDismiss,
  });

  final double amount;
  final String tag;
  final VoidCallback onDismiss;

  @override
  State<_SendSuccessOverlay> createState() => _SendSuccessOverlayState();
}

class _SendSuccessOverlayState extends State<_SendSuccessOverlay> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (mounted) widget.onDismiss();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black54,
      child: Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 32),
          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
          decoration: BoxDecoration(
            color: MonipayColors.success,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.checkCircle, size: 80, color: Colors.white),
              const SizedBox(height: 16),
              Text(
                'Sent Successfully!',
                style: GoogleFonts.dmSans(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '\$${widget.amount.toStringAsFixed(2)} to @${widget.tag}',
                style: GoogleFonts.dmSans(
                  fontSize: 16,
                  color: Colors.white.withOpacity(0.8),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
