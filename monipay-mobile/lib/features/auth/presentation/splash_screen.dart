import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../app/widgets/monipay_logo.dart';
import '../../../../core/security/secure_storage_service.dart';

/// Key in secure storage: set when user has completed onboarding (profile exists).
const String kMonipayHasProfileKey = 'monipay_has_profile';

/// Full-screen splash: logo animation, wordmark, tagline; then navigates to lock or onboarding.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _pathLengthAnimation;
  late final Animation<double> _dotScaleAnimation;
  late final Animation<double> _wordmarkOpacityAnimation;
  late final Animation<double> _taglineOpacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    );

    _pathLengthAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0, 2800 / 4000, curve: Curves.easeInOut),
      ),
    );

    _dotScaleAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(3200 / 4000, 1, curve: Curves.elasticOut),
      ),
    );

    _wordmarkOpacityAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(3600 / 4000, 1, curve: Curves.easeOut),
      ),
    );

    _taglineOpacityAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(3800 / 4000, 1, curve: Curves.easeOut),
      ),
    );

    _controller.forward().then((_) => _onSplashComplete());
  }

  Future<void> _onSplashComplete() async {
    if (!mounted) return;
    final storage = ref.read(secureStorageServiceProvider);
    final hasProfile =
        await storage.read(key: kMonipayHasProfileKey) == '1';
    if (!mounted) return;
    if (hasProfile) {
      context.go('/lock');
    } else {
      context.go('/onboarding');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final foregroundColor =
        isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const primaryColor = MonipayColors.primaryBlue;
    const mutedColor = MonipayColors.mutedSlate;

    return Scaffold(
      backgroundColor: isDark
          ? MonipayColors.backgroundDark
          : MonipayColors.backgroundLight,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 120,
                height: 120,
                child: AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    final pathT = _pathLengthAnimation.value;
                    final showFill = pathT >= 1.0;
                    final dotT = _dotScaleAnimation.value;
                    return CustomPaint(
                      painter: MonipayLogoPainter(
                        pathLength: pathT,
                        showFill: showFill,
                        dotScale: dotT,
                        dotOpacity: 1,
                        color: foregroundColor,
                      ),
                      size: const Size(120, 120),
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),
              AnimatedBuilder(
                animation: _controller,
                builder: (context, child) {
                  return Opacity(
                    opacity: _wordmarkOpacityAnimation.value,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          'Moni',
                          style: GoogleFonts.montserrat(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: foregroundColor,
                          ),
                        ),
                        Text(
                          'PAY',
                          style: GoogleFonts.montserrat(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: primaryColor,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 8),
              AnimatedBuilder(
                animation: _controller,
                builder: (context, child) {
                  return Opacity(
                    opacity: _taglineOpacityAnimation.value,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minWidth: 280),
                      child: Text(
                        'A HAMMER. NOT A DISHWASHER.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.dmSans(
                          fontSize: 12,
                          color: mutedColor,
                          letterSpacing: 4,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return FlutterSecureStorageService();
});
