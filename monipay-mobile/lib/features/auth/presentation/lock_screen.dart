import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../app/theme/app_theme.dart';
import 'lock_controller.dart';

/// Lock screen: PIN pad, lockout countdown, biometrics. Scale + fade on mount.
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen>
    with TickerProviderStateMixin {
  late final AnimationController _enterController;
  late final Animation<double> _scaleAnimation;
  late final Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _enterController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _scaleAnimation = Tween<double>(begin: 0.96, end: 1.0).animate(
      CurvedAnimation(parent: _enterController, curve: Curves.easeOut),
    );
    _opacityAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _enterController, curve: Curves.easeOut),
    );
    _enterController.forward();

    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeAutoBiometric());
  }

  void _maybeAutoBiometric() {
    final state = ref.read(lockControllerProvider);
    if (state.biometricsAvailable && !state.isLockedOut && !state.isBiometricAuth) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (!mounted) return;
        ref.read(lockControllerProvider.notifier).authenticateWithBiometrics(_onUnlock);
      });
    }
  }

  void _scheduleVerifyIfFourDigits() {
    // 50 ms is enough for the 4th dot to paint before verification starts.
    Future.delayed(const Duration(milliseconds: 50), () {
      if (!mounted) return;
      final s = ref.read(lockControllerProvider);
      if (s.pin.length == 4 && !s.error && !s.isLockedOut && !s.isVerifying) {
        _submitPin(s.pin);
      }
    });
  }

  void _onUnlock(String? decryptedKey) {
    if (!mounted) return;
    ref.read(decryptedPrivateKeyProvider.notifier).state = decryptedKey;
    context.go('/dashboard');
  }

  Future<void> _submitPin(String pin) async {
    final notifier = ref.read(lockControllerProvider.notifier);
    await notifier.verifyPinAndUnlock(pin, _onUnlock);
  }

  @override
  void dispose() {
    ref.read(lockControllerProvider.notifier).cancelCountdown();
    _enterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(lockControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final bg = theme.scaffoldBackgroundColor;

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: AnimatedBuilder(
          animation: _enterController,
          builder: (context, child) {
            return Opacity(
              opacity: _opacityAnimation.value,
              child: Transform.scale(
                scale: _scaleAnimation.value,
                child: child,
              ),
            );
          },
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (state.isLockedOut) _LockedOutHeader(remaining: state.lockoutRemaining, fg: fg) else _NormalHeader(error: state.error, moniTag: state.moniTag, fg: fg, muted: muted),
                  const SizedBox(height: 32),
                  _PinDots(pinLength: state.pin.length, error: state.error, isVerifying: state.isVerifying),
                  if (state.errorMessage.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _ErrorMessage(message: state.errorMessage),
                  ],
                  const SizedBox(height: 28),
                  if (!state.isLockedOut)
                    _Numpad(
                      onDigit: state.isVerifying ? null : (d) {
                        ref.read(lockControllerProvider.notifier).addDigit(d);
                        _scheduleVerifyIfFourDigits();
                      },
                      onDelete: state.isVerifying ? null : () => ref.read(lockControllerProvider.notifier).deleteDigit(),
                      onBiometric: state.biometricsAvailable
                          ? () => ref.read(lockControllerProvider.notifier).authenticateWithBiometrics(_onUnlock)
                          : null,
                      isBiometricAuth: state.isBiometricAuth,
                      fg: fg,
                      muted: muted,
                    ),
                  if (state.isLockedOut) _CountdownCard(remaining: state.lockoutRemaining, muted: muted),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NormalHeader extends StatelessWidget {
  const _NormalHeader({required this.error, required this.moniTag, required this.fg, required this.muted});

  final bool error;
  final String? moniTag;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return _ShakeWrap(
      shake: error,
      child: Column(
        children: [
          Text(
            'Welcome back',
            style: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.bold, color: fg),
          ),
          if (moniTag != null && moniTag!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('@$moniTag', style: GoogleFonts.dmSans(fontSize: 16, color: muted)),
          ],
        ],
      ),
    );
  }
}

class _LockedOutHeader extends StatelessWidget {
  const _LockedOutHeader({required this.remaining, required this.fg});

  final int remaining;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: MonipayColors.destructive.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(LucideIcons.timer, size: 40, color: MonipayColors.destructive),
        ),
        const SizedBox(height: 16),
        Text(
          'Temporarily Locked',
          style: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.bold, color: fg),
        ),
        const SizedBox(height: 8),
        Text(
          'Try again in $remaining seconds',
          style: GoogleFonts.dmSans(fontSize: 16, color: MonipayColors.destructive),
        ),
      ],
    );
  }
}

class _ShakeWrap extends StatefulWidget {
  const _ShakeWrap({required this.shake, required this.child});

  final bool shake;
  final Widget child;

  @override
  State<_ShakeWrap> createState() => _ShakeWrapState();
}

class _ShakeWrapState extends State<_ShakeWrap> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
    _animation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -12), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -12, end: 12), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 12, end: -12), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -12, end: 12), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 12, end: -6), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -6, end: 6), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 6, end: 0), weight: 1),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void didUpdateWidget(_ShakeWrap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.shake && !oldWidget.shake) _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.shake) return widget.child;
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) => Transform.translate(offset: Offset(_animation.value, 0), child: child),
      child: widget.child,
    );
  }
}

class _PinDots extends StatelessWidget {
  const _PinDots({required this.pinLength, required this.error, this.isVerifying = false});

  final int pinLength;
  final bool error;
  final bool isVerifying;

  @override
  Widget build(BuildContext context) {
    final color = error ? MonipayColors.destructive : MonipayColors.primaryBlue;
    const muted = MonipayColors.mutedSlate;

    if (isVerifying) {
      return SizedBox(
        height: 24,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(MonipayColors.primaryBlue),
              ),
            ),
          ],
        ),
      );
    }

    return _ShakeWrap(
      shake: error,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(4, (i) {
          final filled = i < pinLength;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: _PinDot(
              filled: filled,
              color: error ? MonipayColors.destructive : (filled ? color : muted),
            ),
          );
        }),
      ),
    );
  }
}

class _PinDot extends StatefulWidget {
  const _PinDot({required this.filled, required this.color});

  final bool filled;
  final Color color;

  @override
  State<_PinDot> createState() => _PinDotState();
}

class _PinDotState extends State<_PinDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
    _scale = Tween<double>(begin: 1, end: 1.1).animate(CurvedAnimation(parent: _controller, curve: Curves.elasticOut));
  }

  @override
  void didUpdateWidget(_PinDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.filled && !oldWidget.filled) _controller.forward(from: 0);
    if (!widget.filled) _controller.reverse();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _scale,
      builder: (context, child) => Transform.scale(scale: widget.filled ? _scale.value : 1, child: child),
      child: Container(
        width: 16,
        height: 16,
        decoration: BoxDecoration(
          color: widget.filled ? widget.color : Colors.transparent,
          shape: BoxShape.circle,
          border: Border.all(color: widget.color, width: 2),
        ),
      ),
    );
  }
}

class _ErrorMessage extends StatelessWidget {
  const _ErrorMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(LucideIcons.alertCircle, size: 18, color: MonipayColors.destructive),
        const SizedBox(width: 8),
        Text(
          message,
          style: GoogleFonts.dmSans(fontSize: 14, color: MonipayColors.destructive),
        ),
      ],
    );
  }
}

const List<String> _numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

class _Numpad extends StatelessWidget {
  const _Numpad({
    required this.onDigit,
    required this.onDelete,
    required this.onBiometric,
    required this.isBiometricAuth,
    required this.fg,
    required this.muted,
  });

  final void Function(String)? onDigit;
  final VoidCallback? onDelete;
  final VoidCallback? onBiometric;
  final bool isBiometricAuth;
  final Color fg;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Column(
        children: [
          _NumpadRow(keys: _numpadKeys.sublist(0, 3), cardBg: cardBg, fg: fg, onDigit: onDigit),
          const SizedBox(height: 12),
          _NumpadRow(keys: _numpadKeys.sublist(3, 6), cardBg: cardBg, fg: fg, onDigit: onDigit),
          const SizedBox(height: 12),
          _NumpadRow(keys: _numpadKeys.sublist(6, 9), cardBg: cardBg, fg: fg, onDigit: onDigit),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _BiometricButton(onTap: onBiometric, isActive: isBiometricAuth)),
              const SizedBox(width: 12),
              Expanded(child: _NumButton(label: '0', cardBg: cardBg, fg: fg, onTap: onDigit == null ? null : () => onDigit!('0'))),
              const SizedBox(width: 12),
              Expanded(child: _DeleteButton(muted: muted, onTap: onDelete)),
            ],
          ),
        ],
      ),
    );
  }
}

class _NumpadRow extends StatelessWidget {
  const _NumpadRow({required this.keys, required this.cardBg, required this.fg, required this.onDigit});

  final List<String> keys;
  final Color cardBg;
  final Color fg;
  final void Function(String)? onDigit;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final k in keys)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: _NumButton(label: k, cardBg: cardBg, fg: fg, onTap: onDigit == null ? null : () => onDigit!(k)),
            ),
          ),
      ],
    );
  }
}

class _NumButton extends StatelessWidget {
  const _NumButton({required this.label, required this.cardBg, required this.fg, required this.onTap});

  final String label;
  final Color cardBg;
  final Color fg;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: cardBg,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          height: 64,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: MonipayColors.mutedSlate.withOpacity(0.3)),
            boxShadow: [BoxShadow(color: MonipayColors.foregroundLight.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Text(label, style: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.w600, color: fg)),
        ),
      ),
    );
  }
}

class _DeleteButton extends StatelessWidget {
  const _DeleteButton({required this.muted, required this.onTap});

  final Color muted;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          height: 64,
          alignment: Alignment.center,
          child: Icon(LucideIcons.delete, size: 24, color: muted),
        ),
      ),
    );
  }
}

class _BiometricButton extends StatefulWidget {
  const _BiometricButton({required this.onTap, required this.isActive});

  final VoidCallback? onTap;
  final bool isActive;

  @override
  State<_BiometricButton> createState() => _BiometricButtonState();
}

class _BiometricButtonState extends State<_BiometricButton> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.onTap == null) {
      return const SizedBox(height: 64);
    }
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final opacity = widget.isActive ? 0.5 + (_pulseController.value * 0.5) : 1.0;
        return Opacity(
          opacity: opacity,
          child: Material(
            color: MonipayColors.primaryBlue.withOpacity(0.1),
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              onTap: widget.onTap,
              borderRadius: BorderRadius.circular(24),
              child: Container(
                height: 64,
                alignment: Alignment.center,
                child: const Icon(LucideIcons.fingerprint, size: 28, color: MonipayColors.primaryBlue),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CountdownCard extends StatelessWidget {
  const _CountdownCard({required this.remaining, required this.muted});

  final int remaining;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
      decoration: BoxDecoration(
        color: MonipayColors.destructive.withOpacity(0.1),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Text(
            '$remaining',
            style: GoogleFonts.dmSans(fontSize: 48, fontWeight: FontWeight.bold, color: MonipayColors.destructive),
          ),
          const SizedBox(height: 4),
          Text('seconds remaining', style: GoogleFonts.dmSans(fontSize: 14, color: muted)),
        ],
      ),
    );
  }
}
