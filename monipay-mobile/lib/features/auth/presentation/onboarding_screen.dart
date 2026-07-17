import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/security/drive_backup_service.dart';
import 'onboarding_controller.dart';
import 'onboarding_state.dart';

const double _kRadius = 16.0;

/// Full onboarding: Landing, Create (5 steps), Import (2 steps), then Feature Tour.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(onboardingControllerProvider);

    // Step 5: auto-activate when funds are ready (like web reference)
    ref.listen<OnboardingState>(onboardingControllerProvider, (prev, next) {
      if (next.step == 5 && next.hasFunds && !next.isActivated) {
        SchedulerBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) _onStep5Activate(context);
        });
      }
    });

    if (!state.showSteps) {
      return _LandingView(
        onGetStarted: () => ref.read(onboardingControllerProvider.notifier).startCreate(),
        onSignIn: () => ref.read(onboardingControllerProvider.notifier).startImport(),
      );
    }

    if (state.flow == 'import') {
      final c = ref.read(onboardingControllerProvider.notifier);
      return _ImportFlowView(
        state: state,
        onBack: c.resetToLanding,
        onStep1Next: () {
          if (c.validateImportKey()) c.goNext();
        },
        onImportComplete: () => _runImportFlow(context),
        onPrivateKeyChanged: c.setPrivateKeyInput,
        onPinChanged: c.setPin,
        onConfirmPinChanged: c.setConfirmPin,
        onRestoreFromDrive: () => _runRestoreFromDrive(context),
      );
    }

    final c = ref.read(onboardingControllerProvider.notifier);
    return _CreateFlowView(
      state: state,
      onBack: () {
        if (state.step >= 1 && state.step <= 3) c.resetToLanding();
      },
      canBack: state.step >= 1 && state.step <= 3,
      onStep1Next: () => _onCreateStep1Next(context, state),
      onStep2Next: () {
        c.generateWalletForCreate();
        c.goNext();
      },
      onStep3Next: () => _onCreateStep3Next(context),
      onStep4Next: () async {
        await c.completeOnboarding();
        c.goNext();
        c.requestActivationFunds();
      },
      onStep5Activate: () => _onStep5Activate(context),
      onMoniTagChanged: c.setMoniTag,
      onPinChanged: c.setPin,
      onConfirmPinChanged: c.setConfirmPin,
      onModeSelected: c.setSelectedMode,
      onCopyKey: () => _copyKey(state.generatedPrivateKey),
      onToggleShowKey: () => c.setShowPrivateKey(!state.showPrivateKey),
      onSetHasBackedUp: c.setHasBackedUp,
      onPressDriveBackup: () => _runDriveBackup(context),
    );
  }

  Future<void> _onCreateStep1Next(BuildContext context, OnboardingState state) async {
    final c = ref.read(onboardingControllerProvider.notifier);
    final tag = state.moniTag.trim();
    if (tag.length < 3) {
      c.setTagError('moniTag™ must be at least 3 characters');
      return;
    }
    if (!RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(tag)) {
      c.setTagError('Only letters, numbers, and underscores allowed');
      return;
    }
    final available = await c.checkMoniTagAvailable();
    if (!available) {
      c.setTagError('This moniTag™ is already taken. Please choose a different one.');
      return;
    }
    c.goNext();
  }

  Future<void> _onCreateStep3Next(BuildContext context) async {
    final success = await ref.read(onboardingControllerProvider.notifier).submitStep3Create();
    if (success && context.mounted) ref.read(onboardingControllerProvider.notifier).goNext();
  }

  Future<void> _runImportFlow(BuildContext context) async {
    final success = await ref.read(onboardingControllerProvider.notifier).submitImportWallet();
    if (success && context.mounted) context.go('/feature-tour');
  }

  void _onStep5Activate(BuildContext context) {
    ref.read(onboardingControllerProvider.notifier).setActivated();
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (context.mounted) context.go('/feature-tour');
    });
  }

  void _copyKey(String? key) {
    if (key == null) return;
    Clipboard.setData(ClipboardData(text: key));
    ref.read(onboardingControllerProvider.notifier).setHasCopiedKey(true);
  }

  Future<void> _runRestoreFromDrive(BuildContext context) async {
    final drive = DriveBackupService();
    final token = await drive.signInAndGetAccessToken();
    if (!context.mounted) return;
    if (token == null) return;
    final backup = await drive.downloadBackup(token);
    if (!context.mounted) return;
    if (backup == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No backup found in Google Drive')),
      );
      return;
    }
    final pin = await _showPinDialog(context, 'Enter the PIN you used when you backed up this wallet.');
    if (!context.mounted || pin == null) return;
    final keyHex = await drive.decryptBackup(backup: backup, pin: pin);
    if (!context.mounted) return;
    if (keyHex == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Wrong PIN or invalid backup')),
      );
      return;
    }
    ref.read(onboardingControllerProvider.notifier).setPrivateKeyInput(keyHex);
  }

  Future<String?> _showPinDialog(BuildContext context, String message) async {
    String pin = '';
    return showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Backup PIN'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message, style: GoogleFonts.dmSans()),
              const SizedBox(height: 16),
              TextField(
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 4,
                onChanged: (v) => pin = v.replaceAll(RegExp(r'\D'), '').length > 4 ? v.replaceAll(RegExp(r'\D'), '').substring(0, 4) : v.replaceAll(RegExp(r'\D'), ''),
                decoration: const InputDecoration(labelText: 'PIN'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(pin.length == 4 ? pin : null),
              child: const Text('Restore'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _runDriveBackup(BuildContext context) async {
    final state = ref.read(onboardingControllerProvider);
    final key = state.generatedPrivateKey;
    final pin = state.pin;
    if (key == null || pin.length != 4) return;
    final drive = DriveBackupService();
    final token = await drive.signInAndGetAccessToken();
    if (!context.mounted) return;
    if (token == null) return;
    final exists = await drive.checkBackupExists(token);
    if (!context.mounted) return;
    bool overwrite = false;
    if (exists.exists) {
      final doOverwrite = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Backup exists'),
          content: const Text('A backup already exists in Google Drive. Overwrite it?'),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Overwrite')),
          ],
        ),
      );
      if (!context.mounted || doOverwrite != true) return;
      overwrite = true;
    }
    final result = await drive.uploadBackup(privateKeyHex: key, pin: pin, accessToken: token, overwrite: overwrite, payTag: state.moniTag.trim().isEmpty ? null : state.moniTag.trim());
    if (!context.mounted) return;
    if (result.success) {
      ref.read(onboardingControllerProvider.notifier).setCloudBackupSuccess(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Backup saved to Google Drive'), backgroundColor: MonipayColors.success),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Backup failed')),
      );
    }
  }
}

// ---------- Landing ----------
class _LandingView extends StatelessWidget {
  const _LandingView({required this.onGetStarted, required this.onSignIn});

  final VoidCallback onGetStarted;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Scaffold(
      backgroundColor: isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text('Moni', style: GoogleFonts.montserrat(fontSize: 28, fontWeight: FontWeight.w700, color: fg)),
                    Text('PAY', style: GoogleFonts.montserrat(fontSize: 28, fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'A Hammer. Not a Dishwasher.',
                  style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onGetStarted,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: MonipayColors.primaryBlue,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
                    ),
                    child: Text('Get Started', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: onSignIn,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: BorderSide(color: fg.withOpacity(0.5)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
                    ),
                    child: Text('Sign In', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600, color: fg)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------- Import flow (2 steps) ----------
class _ImportFlowView extends StatelessWidget {
  const _ImportFlowView({
    required this.state,
    required this.onBack,
    required this.onStep1Next,
    required this.onImportComplete,
    required this.onPrivateKeyChanged,
    required this.onPinChanged,
    required this.onConfirmPinChanged,
    required this.onRestoreFromDrive,
  });

  final OnboardingState state;
  final VoidCallback onBack;
  final VoidCallback onStep1Next;
  final VoidCallback onImportComplete;
  final ValueChanged<String> onPrivateKeyChanged;
  final ValueChanged<String> onPinChanged;
  final ValueChanged<String> onConfirmPinChanged;
  final VoidCallback onRestoreFromDrive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bg = isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back), color: fg),
                  const Spacer(),
                  Text('Moni', style: GoogleFonts.montserrat(fontWeight: FontWeight.w700, color: fg)),
                  Text('PAY', style: GoogleFonts.montserrat(fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue)),
                  const Spacer(),
                  const SizedBox(width: 48),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: List.generate(2, (i) {
                  final filled = state.step > i;
                  return Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      height: 6,
                      decoration: BoxDecoration(
                        color: filled ? MonipayColors.primaryBlue : muted.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 8),
            Text('Step ${state.step} of 2', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
            const SizedBox(height: 24),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                transitionBuilder: (child, animation) {
                  return SlideTransition(
                    position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(animation),
                    child: child,
                  );
                },
                child: state.step == 1
                    ? _ImportStep1(
                        key: const ValueKey('import1'),
                        state: state,
                        fg: fg,
                        muted: muted,
                        onContinue: onStep1Next,
                        onPrivateKeyChanged: onPrivateKeyChanged,
                        onRestoreFromDrive: onRestoreFromDrive,
                      )
                    : _ImportStep2(
                        key: const ValueKey('import2'),
                        state: state,
                        fg: fg,
                        muted: muted,
                        onImport: onImportComplete,
                        onPinChanged: onPinChanged,
                        onConfirmPinChanged: onConfirmPinChanged,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ImportStep1 extends StatelessWidget {
  const _ImportStep1({
    super.key,
    required this.state,
    required this.fg,
    required this.muted,
    required this.onContinue,
    required this.onPrivateKeyChanged,
    required this.onRestoreFromDrive,
  });

  final OnboardingState state;
  final Color fg;
  final Color muted;
  final VoidCallback onContinue;
  final ValueChanged<String> onPrivateKeyChanged;
  final VoidCallback onRestoreFromDrive;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: MonipayColors.primaryBlue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(_kRadius),
            ),
            child: const Icon(Icons.key, size: 32, color: MonipayColors.primaryBlue),
          ),
          const SizedBox(height: 20),
          Center(child: Text('Import your wallet', style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700, color: fg), textAlign: TextAlign.center)),
          const SizedBox(height: 8),
          Center(child: Text('Enter your private key to recover your MoniPay account.', style: GoogleFonts.dmSans(fontSize: 14, color: muted), textAlign: TextAlign.center)),
          const SizedBox(height: 24),
          TextField(
            obscureText: true,
            onChanged: onPrivateKeyChanged,
            decoration: InputDecoration(
              labelText: 'Private Key',
              hintText: '0x...',
              errorText: state.importError != null && state.importError!.isNotEmpty ? state.importError : null,
            ),
            style: const TextStyle(fontFamily: 'monospace'),
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: onRestoreFromDrive,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_outlined, size: 20, color: MonipayColors.primaryBlue),
                const SizedBox(width: 8),
                Text('Restore from Google Drive', style: GoogleFonts.dmSans(fontSize: 14, color: MonipayColors.primaryBlue)),
              ],
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: state.privateKeyInput.trim().isEmpty ? null : onContinue,
              style: ElevatedButton.styleFrom(
                backgroundColor: MonipayColors.primaryBlue,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
              ),
              child: Text('Continue', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImportStep2 extends StatefulWidget {
  const _ImportStep2({
    super.key,
    required this.state,
    required this.fg,
    required this.muted,
    required this.onImport,
    required this.onPinChanged,
    required this.onConfirmPinChanged,
  });

  final OnboardingState state;
  final Color fg;
  final Color muted;
  final VoidCallback onImport;
  final ValueChanged<String> onPinChanged;
  final ValueChanged<String> onConfirmPinChanged;

  @override
  State<_ImportStep2> createState() => _ImportStep2State();
}

class _ImportStep2State extends State<_ImportStep2> {
  late final FocusNode _confirmFocusNode;

  @override
  void initState() {
    super.initState();
    _confirmFocusNode = FocusNode();
  }

  @override
  void dispose() {
    _confirmFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final valid = state.pin.length == 4 && state.confirmPin.length == 4 && state.pin == state.confirmPin;
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: MonipayColors.primaryBlue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(_kRadius),
            ),
            child: const Icon(Icons.lock_outline, size: 32, color: MonipayColors.primaryBlue),
          ),
          const SizedBox(height: 20),
          Center(child: Text('Set a new PIN', style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700, color: widget.fg), textAlign: TextAlign.center)),
          const SizedBox(height: 8),
          Center(child: Text('Create a 4-digit PIN to secure your imported wallet.', style: GoogleFonts.dmSans(fontSize: 14, color: widget.muted), textAlign: TextAlign.center)),
          const SizedBox(height: 24),
          TextField(
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            onChanged: (v) {
              final normalized = v.replaceAll(RegExp(r'\D'), '');
              final pin = normalized.length > 4 ? normalized.substring(0, 4) : normalized;
              widget.onPinChanged(pin);
              if (pin.length == 4) _confirmFocusNode.requestFocus();
            },
            decoration: const InputDecoration(labelText: 'Enter PIN'),
            textAlign: TextAlign.center,
            style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          TextField(
            focusNode: _confirmFocusNode,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            onChanged: (v) {
              final normalized = v.replaceAll(RegExp(r'\D'), '');
              widget.onConfirmPinChanged(normalized.length > 4 ? normalized.substring(0, 4) : normalized);
            },
            decoration: const InputDecoration(labelText: 'Confirm PIN'),
            textAlign: TextAlign.center,
            style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 32),
          SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: state.isImporting || !valid ? null : widget.onImport,
              style: ElevatedButton.styleFrom(
                backgroundColor: MonipayColors.primaryBlue,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius)),
              ),
              child: state.isImporting
                  ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Import Wallet', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------- Create flow (5 steps) ----------
class _CreateFlowView extends StatelessWidget {
  const _CreateFlowView({
    required this.state,
    required this.onBack,
    required this.canBack,
    required this.onStep1Next,
    required this.onStep2Next,
    required this.onStep3Next,
    required this.onStep4Next,
    required this.onStep5Activate,
    required this.onMoniTagChanged,
    required this.onPinChanged,
    required this.onConfirmPinChanged,
    required this.onModeSelected,
    required this.onCopyKey,
    required this.onToggleShowKey,
    required this.onSetHasBackedUp,
    required this.onPressDriveBackup,
  });

  final OnboardingState state;
  final VoidCallback onBack;
  final bool canBack;
  final VoidCallback onStep1Next;
  final VoidCallback onStep2Next;
  final VoidCallback onStep3Next;
  final VoidCallback onStep4Next;
  final VoidCallback onStep5Activate;
  final ValueChanged<String> onMoniTagChanged;
  final ValueChanged<String> onPinChanged;
  final ValueChanged<String> onConfirmPinChanged;
  final ValueChanged<String> onModeSelected;
  final VoidCallback onCopyKey;
  final VoidCallback onToggleShowKey;
  final ValueChanged<bool> onSetHasBackedUp;
  final VoidCallback onPressDriveBackup;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bg = isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: canBack ? onBack : null,
                    icon: const Icon(Icons.arrow_back),
                    color: fg,
                  ),
                  const Spacer(),
                  Text('Moni', style: GoogleFonts.montserrat(fontWeight: FontWeight.w700, color: fg)),
                  Text('PAY', style: GoogleFonts.montserrat(fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue)),
                  const Spacer(),
                  const SizedBox(width: 48),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: List.generate(5, (i) {
                  final filled = state.step > i;
                  return Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      height: 6,
                      decoration: BoxDecoration(
                        color: filled ? MonipayColors.primaryBlue : muted.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 8),
            Text('Step ${state.step} of 5', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
            const SizedBox(height: 24),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                transitionBuilder: (child, animation) {
                  return SlideTransition(
                    position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(animation),
                    child: child,
                  );
                },
                child: _buildStepContent(context, fg, muted),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepContent(BuildContext context, Color fg, Color muted) {
    switch (state.step) {
      case 1:
        return _CreateStep1(key: const ValueKey('c1'), state: state, fg: fg, muted: muted, onContinue: onStep1Next, onMoniTagChanged: onMoniTagChanged);
      case 2:
        return _CreateStep2(key: const ValueKey('c2'), state: state, fg: fg, muted: muted, onContinue: onStep2Next, onPinChanged: onPinChanged, onConfirmPinChanged: onConfirmPinChanged);
      case 3:
        return _CreateStep3(key: const ValueKey('c3'), state: state, fg: fg, muted: muted, onContinue: onStep3Next, onModeSelected: onModeSelected);
      case 4:
        return _CreateStep4(key: const ValueKey('c4'), state: state, fg: fg, muted: muted, onContinue: onStep4Next, onCopyKey: onCopyKey, onToggleShowKey: onToggleShowKey, onSetHasBackedUp: onSetHasBackedUp, onPressDriveBackup: onPressDriveBackup);
      case 5:
        return _CreateStep5(key: const ValueKey('c5'), state: state, fg: fg, muted: muted, onActivate: onStep5Activate);
      default:
        return const SizedBox.shrink();
    }
  }
}

// Create step 1: moniTag™
class _CreateStep1 extends StatelessWidget {
  const _CreateStep1({super.key, required this.state, required this.fg, required this.muted, required this.onContinue, required this.onMoniTagChanged});

  final OnboardingState state;
  final Color fg;
  final Color muted;
  final VoidCallback onContinue;
  final ValueChanged<String> onMoniTagChanged;

  @override
  Widget build(BuildContext context) {
    final valid = state.moniTag.trim().length >= 3 && RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(state.moniTag.trim());
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: MonipayColors.primaryBlue.withOpacity(0.1), borderRadius: BorderRadius.circular(_kRadius)),
            child: const Icon(Icons.alternate_email, size: 32, color: MonipayColors.primaryBlue),
          ),
          const SizedBox(height: 20),
          Center(child: Text('Create your moniTag™', style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700, color: fg), textAlign: TextAlign.center)),
          const SizedBox(height: 8),
          Center(child: Text('Your unique identifier for instant payments on Base Chain.', style: GoogleFonts.dmSans(fontSize: 14, color: muted), textAlign: TextAlign.center)),
          const SizedBox(height: 24),
          TextField(
            onChanged: (v) => onMoniTagChanged(v.replaceAll(' ', '')),
            maxLength: 20,
            decoration: InputDecoration(
              prefixText: '@ ',
              prefixStyle: GoogleFonts.montserrat(fontSize: 18, fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue),
              hintText: 'yourname',
              errorText: state.tagError != null && state.tagError!.isNotEmpty ? state.tagError : null,
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: (valid && !state.isCheckingTag) ? onContinue : null,
              style: ElevatedButton.styleFrom(backgroundColor: MonipayColors.primaryBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius))),
              child: state.isCheckingTag ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text('Continue', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

// Create step 2: PIN
class _CreateStep2 extends StatefulWidget {
  const _CreateStep2({super.key, required this.state, required this.fg, required this.muted, required this.onContinue, required this.onPinChanged, required this.onConfirmPinChanged});

  final OnboardingState state;
  final Color fg;
  final Color muted;
  final VoidCallback onContinue;
  final ValueChanged<String> onPinChanged;
  final ValueChanged<String> onConfirmPinChanged;

  @override
  State<_CreateStep2> createState() => _CreateStep2State();
}

class _CreateStep2State extends State<_CreateStep2> {
  late final FocusNode _confirmFocusNode;

  @override
  void initState() {
    super.initState();
    _confirmFocusNode = FocusNode();
  }

  @override
  void dispose() {
    _confirmFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final valid = state.pin.length == 4 && state.confirmPin.length == 4 && state.pin == state.confirmPin;
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: MonipayColors.primaryBlue.withOpacity(0.1), borderRadius: BorderRadius.circular(_kRadius)),
            child: const Icon(Icons.lock_outline, size: 32, color: MonipayColors.primaryBlue),
          ),
          const SizedBox(height: 20),
          Center(child: Text('Secure your wallet', style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700, color: widget.fg), textAlign: TextAlign.center)),
          const SizedBox(height: 8),
          Center(child: Text('Create a 4-digit PIN to protect your funds.', style: GoogleFonts.dmSans(fontSize: 14, color: widget.muted), textAlign: TextAlign.center)),
          const SizedBox(height: 24),
          TextField(
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            onChanged: (v) {
              final normalized = v.replaceAll(RegExp(r'\D'), '');
              final pin = normalized.length > 4 ? normalized.substring(0, 4) : normalized;
              widget.onPinChanged(pin);
              if (pin.length == 4) _confirmFocusNode.requestFocus();
            },
            decoration: const InputDecoration(labelText: 'Enter PIN'),
            textAlign: TextAlign.center,
            style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          TextField(
            focusNode: _confirmFocusNode,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            onChanged: (v) {
              final normalized = v.replaceAll(RegExp(r'\D'), '');
              widget.onConfirmPinChanged(normalized.length > 4 ? normalized.substring(0, 4) : normalized);
            },
            decoration: const InputDecoration(labelText: 'Confirm PIN'),
            textAlign: TextAlign.center,
            style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shield_outlined, size: 18, color: widget.muted),
              const SizedBox(width: 8),
              Text('Your PIN encrypts your private key locally', style: GoogleFonts.dmSans(fontSize: 12, color: widget.muted)),
            ],
          ),
          const SizedBox(height: 32),
          SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: valid ? widget.onContinue : null,
              style: ElevatedButton.styleFrom(backgroundColor: MonipayColors.primaryBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius))),
              child: Text('Continue', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

// Create step 3: Mode (Merchant / Personal)
class _CreateStep3 extends StatelessWidget {
  const _CreateStep3({super.key, required this.state, required this.fg, required this.muted, required this.onContinue, required this.onModeSelected});

  final OnboardingState state;
  final Color fg;
  final Color muted;
  final VoidCallback onContinue;
  final ValueChanged<String> onModeSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Text('Choose your focus', style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700, color: fg)),
          const SizedBox(height: 8),
          Text('You can switch anytime. This sets your default view.', style: GoogleFonts.dmSans(fontSize: 14, color: muted)),
          const SizedBox(height: 24),
          _ModeCard(
            title: 'Merchant Mode',
            subtitle: 'Accept payments, create QR codes, manage POS',
            icon: Icons.storefront,
            isSelected: state.selectedMode == 'merchant',
            accentColor: MonipayColors.primaryBlue,
            onTap: () => onModeSelected('merchant'),
          ),
          const SizedBox(height: 12),
          _ModeCard(
            title: 'Personal Mode',
            subtitle: 'Scan to pay, send money, manage balance',
            icon: Icons.person_outline,
            isSelected: state.selectedMode == 'user',
            accentColor: fg,
            onTap: () => onModeSelected('user'),
          ),
          const SizedBox(height: 32),
          SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: (state.selectedMode != null && !state.isCreating) ? onContinue : null,
              style: ElevatedButton.styleFrom(backgroundColor: MonipayColors.primaryBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius))),
              child: state.isCreating ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text('Continue', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({required this.title, required this.subtitle, required this.icon, required this.isSelected, required this.accentColor, required this.onTap});

  final String title;
  final String subtitle;
  final IconData icon;
  final bool isSelected;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    return Material(
      color: cardBg,
      borderRadius: BorderRadius.circular(_kRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(_kRadius),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            border: Border.all(color: isSelected ? accentColor : MonipayColors.mutedSlate.withOpacity(0.3), width: 2),
            borderRadius: BorderRadius.circular(_kRadius),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: isSelected ? accentColor : MonipayColors.mutedSlate.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: isSelected ? Colors.white : MonipayColors.mutedSlate, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w700, color: theme.brightness == Brightness.dark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.mutedSlate)),
                  ],
                ),
              ),
              if (isSelected) Icon(Icons.check_circle, color: accentColor, size: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// Create step 4: Backup
class _CreateStep4 extends StatelessWidget {
  const _CreateStep4({super.key, required this.state, required this.fg, required this.muted, required this.onContinue, required this.onCopyKey, required this.onToggleShowKey, required this.onSetHasBackedUp, required this.onPressDriveBackup});

  final OnboardingState state;
  final Color fg;
  final Color muted;
  final VoidCallback onContinue;
  final VoidCallback onCopyKey;
  final VoidCallback onToggleShowKey;
  final ValueChanged<bool> onSetHasBackedUp;
  final VoidCallback onPressDriveBackup;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: MonipayColors.warning.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.warning_amber_rounded, size: 28, color: MonipayColors.warning),
          ),
          const SizedBox(height: 16),
          Center(child: Text('Backup Your Wallet', style: GoogleFonts.montserrat(fontSize: 22, fontWeight: FontWeight.w700, color: fg), textAlign: TextAlign.center)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: MonipayColors.destructive.withOpacity(0.1), border: Border.all(color: MonipayColors.destructive.withOpacity(0.3)), borderRadius: BorderRadius.circular(_kRadius)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.warning_amber_rounded, size: 18, color: MonipayColors.destructive),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Without your private key, you cannot recover your wallet if you lose access. Your funds will be lost forever.',
                    style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.destructive),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: MonipayColors.warning.withOpacity(0.5)), borderRadius: BorderRadius.circular(_kRadius)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Your Private Key', style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: MonipayColors.warning)),
                const SizedBox(height: 8),
                Stack(
                  alignment: Alignment.centerRight,
                  children: [
                    Text(
                      state.showPrivateKey ? (state.generatedPrivateKey ?? '') : '•••• •••• •••• •••• •••• •••• •••• ••••',
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 10),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    IconButton(
                      icon: Icon(state.showPrivateKey ? Icons.visibility_off : Icons.visibility, size: 20, color: muted),
                      onPressed: onToggleShowKey,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: state.generatedPrivateKey != null ? onCopyKey : null,
                  icon: const Icon(Icons.copy, size: 18),
                  label: Text(state.hasCopiedKey ? 'Copied!' : 'Copy Private Key'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (state.cloudBackupSuccess)
            Row(
              children: [
                const Icon(Icons.check_circle, size: 22, color: MonipayColors.success),
                const SizedBox(width: 8),
                Text('Backed up to Google Drive', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: MonipayColors.success)),
              ],
            )
          else
            OutlinedButton.icon(
              onPressed: onPressDriveBackup,
              icon: const Icon(Icons.cloud_upload),
              label: const Text('Backup to Google Drive'),
            ),
          const SizedBox(height: 16),
          CheckboxListTile(
            value: state.hasBackedUp,
            onChanged: (v) => onSetHasBackedUp(v == true),
            title: Text(
              'I have securely saved my private key and understand that I cannot recover my wallet without it.',
              style: GoogleFonts.dmSans(fontSize: 12),
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: state.hasBackedUp ? onContinue : null,
              style: ElevatedButton.styleFrom(backgroundColor: MonipayColors.primaryBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius))),
              child: Text('Continue', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

// Create step 5: Activate
class _CreateStep5 extends StatelessWidget {
  const _CreateStep5({super.key, required this.state, required this.fg, required this.muted, required this.onActivate});

  final OnboardingState state;
  final Color fg;
  final Color muted;
  final VoidCallback onActivate;

  @override
  Widget build(BuildContext context) {
    if (state.isActivated) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(color: MonipayColors.primaryBlue, borderRadius: BorderRadius.circular(_kRadius)),
              child: Column(
                children: [
                  const CircleAvatar(radius: 32, backgroundColor: Colors.white, child: Icon(Icons.check, size: 40, color: MonipayColors.primaryBlue)),
                  const SizedBox(height: 16),
                  Text('All Set!', style: GoogleFonts.montserrat(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
                  const SizedBox(height: 8),
                  Text('Redirecting to dashboard...', style: GoogleFonts.dmSans(fontSize: 14, color: Colors.white70)),
                ],
              ),
            ),
          ],
        ),
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Center(child: Text('Activate Your Account', style: GoogleFonts.montserrat(fontSize: 24, fontWeight: FontWeight.w700, color: fg), textAlign: TextAlign.center)),
          const SizedBox(height: 8),
          Center(child: Text('One final step to unlock gasless transactions.', style: GoogleFonts.dmSans(fontSize: 14, color: muted), textAlign: TextAlign.center)),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: muted.withOpacity(0.15), borderRadius: BorderRadius.circular(_kRadius)),
            child: state.isRequestingFunds
                ? Row(
                    children: [
                      const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: MonipayColors.primaryBlue)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Preparing your account...', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg)),
                          Text("We're covering the activation fee", style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                        ],
                      )),
                    ],
                  )
                : state.hasFunds
                    ? Row(
                        children: [
                          const Icon(Icons.check_circle, color: MonipayColors.success, size: 24),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Ready for activation', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg)),
                                Text('Tap the button below to activate', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                              ],
                            ),
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)),
                          const SizedBox(width: 12),
                          Text('Initializing...', style: GoogleFonts.dmSans(fontSize: 14, color: fg)),
                        ],
                      ),
          ),
          if (state.hasFunds) ...[
            const SizedBox(height: 24),
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: onActivate,
                style: ElevatedButton.styleFrom(backgroundColor: MonipayColors.primaryBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_kRadius))),
                child: Text('Activate', style: GoogleFonts.montserrat(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
