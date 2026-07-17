import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/security/drive_backup_service.dart';
import '../../auth/presentation/lock_controller.dart' show decryptedPrivateKeyProvider, lockControllerProvider;
import '../../auth/presentation/theme_controller.dart';
import '../../auth/presentation/splash_screen.dart' show secureStorageServiceProvider;
import 'dashboard_controller.dart';
import 'wallet_controller.dart';
import 'widgets/network_toggle_widget.dart';
import 'widgets/monibot_settings_panel.dart';

const _kBiometricEnabledKey = 'monipay_biometric_enabled';
const _kAutoLockMinutesKey = 'monipay_auto_lock_minutes';
const _kAutoLockEnabledKey = 'monipay_auto_lock_enabled';
const _kHighValueProtectionKey = 'monipay_high_value_protection';
const _kSoundEffectsKey = 'monipay_sound_effects';
const _kNotificationsEnabledKey = 'monipay_notifications_enabled';
const _kLanguageKey = 'monipay_language';
const _languageNames = {'en': 'English', 'fr': 'French', 'es': 'Spanish', 'pt': 'Portuguese', 'sw': 'Swahili'};
const _languageCodes = ['en', 'fr', 'es', 'pt', 'sw'];

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool? _biometricEnabled;
  int _autoLockMinutes = 5;
  bool _autoLockEnabled = false;
  bool _highValueProtection = false;
  bool _soundEffects = true;
  bool _loadingPrefs = true;
  bool _notificationsEnabled = false;
  bool _notificationsSupported = false;
  String _languageCode = 'en';
  bool _showNetworkExpanded = false;
  bool _showDeveloper = false;
  bool _showMoniBot = false;
  String _appVersion = '0.1.0';

  // Developer mode state
  String? _apiPublicKey;
  String? _apiSecretKeyPreview;
  String? _newSecretKey;
  bool _showSecretKey = false;
  bool _generatingKeys = false;
  bool _showConfirmGenerate = false;
  final _webhookController = TextEditingController();
  bool _savingWebhook = false;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
    _checkNotifications();
    PackageInfo.fromPlatform().then((info) {
      if (mounted) setState(() => _appVersion = info.version);
    });
  }

  @override
  void dispose() {
    _webhookController.dispose();
    super.dispose();
  }

  Future<void> _loadApiKeys(String profileId) async {
    try {
      final res = await Supabase.instance.client.functions
          .invoke('api-keys', body: {'action': 'get', 'profileId': profileId});
      final data = res.data as Map?;
      if (data != null && mounted) {
        setState(() {
          _apiPublicKey = data['public_key'] as String?;
          _apiSecretKeyPreview = data['secret_key_preview'] as String?;
          _webhookController.text = (data['webhook_url'] as String?) ?? '';
        });
      }
    } catch (_) {}
  }

  Future<void> _generateApiKeys(String profileId) async {
    setState(() { _generatingKeys = true; _showConfirmGenerate = false; });
    try {
      final res = await Supabase.instance.client.functions
          .invoke('api-keys', body: {'action': 'generate', 'profileId': profileId});
      final data = res.data as Map?;
      if (data != null && mounted) {
        setState(() {
          _apiPublicKey = data['public_key'] as String?;
          _apiSecretKeyPreview = data['secret_key_preview'] as String?;
          _newSecretKey = data['secret_key'] as String?;
          _showSecretKey = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('API keys generated — save your secret key now!')),
        );
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to generate keys')));
    } finally {
      if (mounted) setState(() => _generatingKeys = false);
    }
  }

  Future<void> _saveWebhook(String profileId) async {
    final url = _webhookController.text.trim();
    if (url.isNotEmpty && !url.startsWith('http')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Webhook URL must start with http')));
      return;
    }
    setState(() => _savingWebhook = true);
    try {
      await Supabase.instance.client.functions.invoke(
        'api-keys',
        body: {'action': 'update-webhook', 'profileId': profileId, 'webhookUrl': url.isEmpty ? null : url},
      );
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Webhook URL saved')));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to save webhook')));
    } finally {
      if (mounted) setState(() => _savingWebhook = false);
    }
  }

  Future<void> _checkNotifications() async {
    try {
      final status = await Permission.notification.status;
      if (!mounted) return;
      setState(() {
        _notificationsSupported = true;
        _notificationsEnabled = status.isGranted;
      });
      final storage = ref.read(secureStorageServiceProvider);
      final stored = await storage.read(key: _kNotificationsEnabledKey);
      if (stored == '1' && mounted) setState(() => _notificationsEnabled = true);
    } catch (_) {
      if (mounted) setState(() => _notificationsSupported = false);
    }
  }

  Future<void> _loadPrefs() async {
    final storage = ref.read(secureStorageServiceProvider);
    final bio = await storage.read(key: _kBiometricEnabledKey);
    final lock = await storage.read(key: _kAutoLockMinutesKey);
    final lockEnabled = await storage.read(key: _kAutoLockEnabledKey);
    final highValue = await storage.read(key: _kHighValueProtectionKey);
    final sound = await storage.read(key: _kSoundEffectsKey);
    final lang = await storage.read(key: _kLanguageKey);
    if (!mounted) return;
    setState(() {
      _biometricEnabled = bio == 'true';
      _autoLockMinutes = int.tryParse(lock ?? '') ?? 5;
      _autoLockEnabled = lockEnabled == 'true';
      _highValueProtection = highValue == 'true';
      _soundEffects = sound != '0';
      _languageCode = (lang != null && _languageCodes.contains(lang)) ? lang : 'en';
      _loadingPrefs = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    final storedTag = ref.watch(moniTagProvider).valueOrNull;
    final payTag = (dashboard.payTag ?? storedTag ?? '').trim();
    final address = dashboard.walletAddress ?? '';
    final shortAddress = address.length >= 12
        ? '${address.substring(0, 6)}...${address.substring(address.length - 4)}'
        : address;

    return Scaffold(
      backgroundColor: isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight,
      body: SafeArea(
        child: Column(
          children: [
            ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(8, 12, 8, 12),
                  decoration: BoxDecoration(
                    color: (isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight)
                        .withOpacity(0.8),
                    border: Border(bottom: BorderSide(color: muted.withOpacity(0.3))),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(LucideIcons.arrowLeft),
                        onPressed: () => context.pop(),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Settings',
                        style: GoogleFonts.dmSans(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: muted.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                MonipayColors.primaryBlue,
                                Color(0xCC0052FF),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            payTag.isNotEmpty ? payTag[0].toUpperCase() : '',
                            style: GoogleFonts.montserrat(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  if (payTag.isNotEmpty)
                                    Text(
                                      '@$payTag',
                                      style: GoogleFonts.dmSans(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: fg,
                                      ),
                                    ),
                                  const SizedBox(width: 6),
                                  const Icon(LucideIcons.badgeCheck, size: 18, color: MonipayColors.primaryBlue),
                                ],
                              ),
                              const SizedBox(height: 4),
                              GestureDetector(
                                onTap: () {
                                  Clipboard.setData(ClipboardData(text: address));
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Address copied')));
                                },
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      shortAddress,
                                      style: GoogleFonts.dmSans(fontSize: 12, color: muted).copyWith(fontFamily: 'monospace'),
                                    ),
                                    const SizedBox(width: 6),
                                    Icon(LucideIcons.copy, size: 14, color: muted),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'SECURITY',
                    style: GoogleFonts.dmSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _SettingsTile(
                    icon: LucideIcons.lock,
                    iconBg: MonipayColors.primaryBlue.withOpacity(0.1),
                    iconColor: MonipayColors.primaryBlue,
                    title: 'Change PIN',
                    subtitle: 'Update your 4-digit PIN',
                    onTap: () => _showChangePinDialog(context, ref, fg, muted),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.key,
                    iconBg: MonipayColors.warning.withOpacity(0.1),
                    iconColor: MonipayColors.warning,
                    title: 'Backup Wallet',
                    subtitle: 'View your private key',
                    onTap: () => _showBackupDialog(context, ref, address, fg, muted),
                  ),
                  _GoogleDriveBackupTile(
                    payTag: payTag,
                    onBackup: () => _runGoogleDriveBackup(context, payTag),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.fingerprint,
                    iconBg: MonipayColors.primaryBlue.withOpacity(0.1),
                    iconColor: MonipayColors.primaryBlue,
                    title: 'Biometric Unlock',
                    subtitle: _biometricEnabled == true ? 'Use fingerprint or Face ID' : (ref.watch(lockControllerProvider).biometricsAvailable ? 'Use fingerprint or Face ID' : 'Not supported on this device'),
                    trailing: _loadingPrefs
                        ? const SizedBox(width: 40, height: 24, child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
                        : Switch(
                            value: _biometricEnabled ?? false,
                            onChanged: (v) => _toggleBiometrics(context, ref, v, fg),
                          ),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.timer,
                    iconBg: Colors.orange.withOpacity(0.2),
                    iconColor: Colors.orange,
                    title: 'Auto-Lock',
                    subtitle: 'Lock after $_autoLockMinutes min of inactivity',
                    trailing: Switch(
                      value: _autoLockEnabled,
                      onChanged: (v) async {
                        setState(() => _autoLockEnabled = v);
                        await ref.read(secureStorageServiceProvider).write(key: _kAutoLockEnabledKey, value: v.toString());
                      },
                    ),
                  ),
                  if (_autoLockEnabled) ...[
                    Padding(
                      padding: const EdgeInsets.only(left: 16, right: 16, bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Lock timeout (minutes)', style: GoogleFonts.dmSans(fontSize: 11, color: muted)),
                          const SizedBox(height: 8),
                          Row(
                            children: [1, 5, 10, 30].map((m) {
                              final selected = _autoLockMinutes == m;
                              return Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4),
                                  child: Material(
                                    color: selected ? MonipayColors.primaryBlue : muted.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                    child: InkWell(
                                      onTap: () async {
                                        setState(() => _autoLockMinutes = m);
                                        await ref.read(secureStorageServiceProvider).write(key: _kAutoLockMinutesKey, value: m.toString());
                                      },
                                      borderRadius: BorderRadius.circular(8),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 10),
                                        child: Center(
                                          child: Text('${m}m', style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : muted)),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                  _SettingsTile(
                    icon: LucideIcons.dollarSign,
                    iconBg: MonipayColors.warning.withOpacity(0.1),
                    iconColor: MonipayColors.warning,
                    title: 'High-Value Protection',
                    subtitle: 'Require biometrics for large transactions',
                    trailing: Switch(
                      value: _highValueProtection,
                      onChanged: (v) async {
                        setState(() => _highValueProtection = v);
                        await ref.read(secureStorageServiceProvider).write(key: _kHighValueProtectionKey, value: v.toString());
                      },
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'PREFERENCES',
                    style: GoogleFonts.dmSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _SettingsTile(
                    icon: LucideIcons.bell,
                    iconBg: Colors.purple.withOpacity(0.1),
                    iconColor: Colors.purple,
                    title: 'Notifications',
                    subtitle: _notificationsSupported ? 'Payment alerts & updates' : 'Not supported on this device',
                    trailing: _notificationsSupported
                        ? Switch(
                            value: _notificationsEnabled,
                            onChanged: (v) => _toggleNotifications(context, ref, v),
                          )
                        : null,
                  ),
                  _SettingsTile(
                    icon: LucideIcons.volume2,
                    iconBg: muted.withOpacity(0.2),
                    iconColor: muted,
                    title: 'Sound Effects',
                    trailing: Switch(
                      value: _soundEffects,
                      onChanged: (v) async {
                        setState(() => _soundEffects = v);
                        await ref.read(secureStorageServiceProvider).write(
                          key: _kSoundEffectsKey,
                          value: v ? '1' : '0',
                        );
                      },
                    ),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.moon,
                    iconBg: muted.withOpacity(0.2),
                    iconColor: muted,
                    title: 'Dark Mode',
                    subtitle: 'Switch to dark theme',
                    trailing: Switch(
                      value: ref.watch(themeControllerProvider) == ThemeMode.dark,
                      onChanged: (v) => ref.read(themeControllerProvider.notifier).setTheme(v ? ThemeMode.dark : ThemeMode.light),
                    ),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.languages,
                    iconBg: Colors.lightBlue.withOpacity(0.1),
                    iconColor: Colors.lightBlue,
                    title: 'Language',
                    subtitle: 'Select language',
                    trailing: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text(
                        _languageNames[_languageCode] ?? 'English',
                        style: GoogleFonts.dmSans(fontSize: 13, color: muted),
                      ),
                    ),
                    onTap: () => _showLanguageSheet(context, ref),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.globe,
                    iconBg: Colors.green.withOpacity(0.1),
                    iconColor: Colors.green,
                    title: 'Network',
                    subtitle: 'Choose your preferred blockchain',
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          dashboard.preferredNetwork.toUpperCase(),
                          style: GoogleFonts.dmSans(fontSize: 13, color: muted),
                        ),
                        const SizedBox(width: 4),
                        AnimatedRotation(
                          turns: _showNetworkExpanded ? 0.25 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: const Icon(LucideIcons.chevronRight, size: 20, color: MonipayColors.mutedSlate),
                        ),
                      ],
                    ),
                    onTap: () => setState(() => _showNetworkExpanded = !_showNetworkExpanded),
                  ),
                  if (_showNetworkExpanded)
                    AnimatedSize(
                      duration: const Duration(milliseconds: 200),
                      child: Padding(
                        padding: const EdgeInsets.only(left: 16, right: 16, bottom: 12),
                        child: NetworkToggleWidget(
                          currentNetwork: dashboard.preferredNetwork,
                          onNetworkChanged: (n) => ref.read(dashboardControllerProvider.notifier).setPreferredNetwork(n),
                        ),
                      ),
                    ),
                  const SizedBox(height: 24),
                  Text(
                    'AI & AUTOMATION',
                    style: GoogleFonts.dmSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _SettingsTile(
                    icon: LucideIcons.bot,
                    iconBg: MonipayColors.primaryBlue.withOpacity(0.1),
                    iconColor: MonipayColors.primaryBlue,
                    title: 'MoniBot AI',
                    subtitle: 'Link social accounts & bot features',
                    trailing: AnimatedRotation(
                      turns: _showMoniBot ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(LucideIcons.chevronRight, size: 20, color: MonipayColors.mutedSlate),
                    ),
                    onTap: () => setState(() => _showMoniBot = !_showMoniBot),
                  ),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 240),
                    curve: Curves.easeOutCubic,
                    child: _showMoniBot
                        ? Padding(
                            padding: const EdgeInsets.only(top: 8, bottom: 4),
                            child: MoniBotSettingsPanel(
                              profileId: dashboard.profileId,
                              walletAddress: dashboard.walletAddress ?? '',
                              preferredNetwork: dashboard.preferredNetwork,
                              isDark: isDark,
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'DEVELOPER',
                    style: GoogleFonts.dmSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _SettingsTile(
                    icon: LucideIcons.code,
                    iconBg: Colors.cyan.withOpacity(0.1),
                    iconColor: Colors.cyan,
                    title: 'Developer Mode',
                    subtitle: 'API keys, webhooks & integrations',
                    trailing: AnimatedRotation(
                      turns: _showDeveloper ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(LucideIcons.chevronRight, size: 20, color: MonipayColors.mutedSlate),
                    ),
                    onTap: () {
                      setState(() => _showDeveloper = !_showDeveloper);
                      if (_showDeveloper && dashboard.profileId != null) {
                        _loadApiKeys(dashboard.profileId!);
                      }
                    },
                  ),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 240),
                    curve: Curves.easeOutCubic,
                    child: _showDeveloper
                        ? Padding(
                            padding: const EdgeInsets.only(top: 8, bottom: 4),
                            child: _DeveloperPanel(
                              isDark: isDark,
                              fg: fg,
                              muted: muted,
                              cardBg: cardBg,
                              profileId: dashboard.profileId,
                              apiPublicKey: _apiPublicKey,
                              apiSecretKeyPreview: _apiSecretKeyPreview,
                              newSecretKey: _newSecretKey,
                              showSecretKey: _showSecretKey,
                              generatingKeys: _generatingKeys,
                              showConfirmGenerate: _showConfirmGenerate,
                              webhookController: _webhookController,
                              savingWebhook: _savingWebhook,
                              onToggleSecretKey: () => setState(() => _showSecretKey = !_showSecretKey),
                              onGenerateKeys: () {
                                if (dashboard.profileId == null) return;
                                if (_apiPublicKey != null && !_showConfirmGenerate) {
                                  setState(() => _showConfirmGenerate = true);
                                } else {
                                  _generateApiKeys(dashboard.profileId!);
                                }
                              },
                              onCancelGenerate: () => setState(() => _showConfirmGenerate = false),
                              onSaveWebhook: () {
                                if (dashboard.profileId != null) _saveWebhook(dashboard.profileId!);
                              },
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.bookOpen,
                    iconBg: Colors.teal.withOpacity(0.1),
                    iconColor: Colors.teal,
                    title: 'API Documentation',
                    subtitle: 'Integration guides & code examples',
                    onTap: () => launchUrl(Uri.parse('https://docs.monipay.xyz')),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'SUPPORT & ACCOUNT',
                    style: GoogleFonts.dmSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _SettingsTile(
                    icon: LucideIcons.helpCircle,
                    iconBg: Colors.lightBlue.withOpacity(0.1),
                    iconColor: Colors.lightBlue,
                    title: 'Help & Support',
                    subtitle: 'FAQ, feedback & contact',
                    onTap: () => context.push('/settings/help'),
                  ),
                  _SettingsTile(
                    icon: LucideIcons.logOut,
                    iconBg: muted.withOpacity(0.2),
                    iconColor: muted,
                    title: 'Lock Wallet',
                    subtitle: 'Require PIN to access',
                    onTap: () {
                      ref.read(decryptedPrivateKeyProvider.notifier).state = null;
                      context.go('/lock');
                    },
                  ),
                  _SettingsTile(
                    icon: LucideIcons.trash2,
                    iconBg: MonipayColors.destructive.withOpacity(0.1),
                    iconColor: MonipayColors.destructive,
                    title: 'Delete Account',
                    subtitle: 'Remove all data permanently',
                    onTap: () => _showDeleteAccountDialog(context, ref),
                  ),
                  const SizedBox(height: 32),
                  Text(
                    'Monipay V$_appVersion · Built on Base',
                    style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _themeSubtitle(WidgetRef ref) {
    switch (ref.watch(themeControllerProvider)) {
      case ThemeMode.light:
        return 'Light';
      case ThemeMode.dark:
        return 'Dark';
      case ThemeMode.system:
        return 'System';
    }
  }

  Future<void> _showThemeDialog(BuildContext context, WidgetRef ref, Color fg, Color muted) async {
    final current = ref.read(themeControllerProvider);
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Theme', style: GoogleFonts.dmSans(color: fg)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _themeOption(ctx, ref, 'Light', ThemeMode.light, current),
            _themeOption(ctx, ref, 'Dark', ThemeMode.dark, current),
            _themeOption(ctx, ref, 'System', ThemeMode.system, current),
          ],
        ),
      ),
    );
  }

  ListTile _themeOption(BuildContext context, WidgetRef ref, String label, ThemeMode mode, ThemeMode current) {
    return ListTile(
      title: Text(label, style: GoogleFonts.dmSans()),
      trailing: current == mode ? const Icon(LucideIcons.check, size: 20) : null,
      onTap: () {
        ref.read(themeControllerProvider.notifier).setTheme(mode);
        Navigator.of(context).pop();
      },
    );
  }

  Future<void> _showChangePinDialog(BuildContext context, WidgetRef ref, Color fg, Color muted) async {
    final currentController = TextEditingController();
    final newController = TextEditingController();
    final confirmController = TextEditingController();
    final lock = ref.read(lockControllerProvider.notifier);

    final verified = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text('Enter current PIN', style: GoogleFonts.dmSans(color: fg)),
        content: TextField(
          controller: currentController,
          keyboardType: TextInputType.number,
          maxLength: 4,
          obscureText: true,
          decoration: const InputDecoration(hintText: '4-digit PIN'),
          style: GoogleFonts.dmSans(fontSize: 18),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              final pin = currentController.text;
              if (pin.length != 4) return;
              final ok = await lock.verifyPinForSettings(pin);
              if (!ctx.mounted) return;
              Navigator.pop(ctx, ok);
            },
            child: const Text('Verify'),
          ),
        ],
      ),
    );
    if (verified != true || !context.mounted) return;

    final changed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Enter new PIN', style: GoogleFonts.dmSans(color: fg)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: newController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                obscureText: true,
                decoration: const InputDecoration(hintText: 'New 4-digit PIN'),
                style: GoogleFonts.dmSans(fontSize: 18),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                obscureText: true,
                decoration: const InputDecoration(hintText: 'Confirm new PIN'),
                style: GoogleFonts.dmSans(fontSize: 18),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(
              onPressed: () {
                final a = newController.text;
                final b = confirmController.text;
                if (a.length != 4 || a != b) return;
                Navigator.pop(ctx, true);
              },
              child: const Text('Update'),
            ),
          ],
        );
      },
    );
    if (changed == true) {
      await lock.changePin(newController.text);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PIN updated')),
        );
      }
    }
  }

  Future<void> _showBackupDialog(BuildContext context, WidgetRef ref, String address, Color fg, Color muted) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Backup Wallet', style: GoogleFonts.dmSans(color: fg)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Save your wallet address. Never share your recovery phrase or private key.',
              style: GoogleFonts.dmSans(fontSize: 13, color: muted),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: muted.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: SelectableText(
                address,
                style: GoogleFonts.dmSans(fontSize: 12).copyWith(fontFamily: 'monospace'),
              ),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: address));
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Address copied')));
              },
              icon: const Icon(LucideIcons.copy, size: 18),
              label: const Text('Copy address'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done')),
        ],
      ),
    );
  }

  Future<void> _toggleBiometrics(BuildContext context, WidgetRef ref, bool enable, Color fg) async {
    final lock = ref.read(lockControllerProvider.notifier);
    if (enable) {
      final pin = await showDialog<String>(
        context: context,
        builder: (ctx) {
          final c = TextEditingController();
          return AlertDialog(
            title: Text('Enter PIN to enable biometrics', style: GoogleFonts.dmSans(color: fg)),
            content: TextField(
              controller: c,
              keyboardType: TextInputType.number,
              maxLength: 4,
              obscureText: true,
              decoration: const InputDecoration(hintText: '4-digit PIN'),
              style: GoogleFonts.dmSans(fontSize: 18),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              TextButton(
                onPressed: () => Navigator.pop(ctx, c.text),
                child: const Text('Enable'),
              ),
            ],
          );
        },
      );
      if (pin == null || pin.length != 4 || !context.mounted) return;
      final ok = await lock.verifyPinForSettings(pin);
      if (!ok || !context.mounted) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Incorrect PIN')),
          );
        }
        return;
      }
      await lock.enableBiometricsWithPin(pin);
    } else {
      await lock.disableBiometrics();
    }
    if (!mounted) return;
    setState(() => _biometricEnabled = enable);
  }

  Future<void> _toggleNotifications(BuildContext context, WidgetRef ref, bool enable) async {
    if (enable) {
      final status = await Permission.notification.request();
      if (status.isPermanentlyDenied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Enable notifications in device settings')),
          );
        }
        return;
      }
      if (status.isGranted) {
        await ref.read(secureStorageServiceProvider).write(key: _kNotificationsEnabledKey, value: '1');
        if (mounted) setState(() => _notificationsEnabled = true);
      }
    } else {
      await ref.read(secureStorageServiceProvider).write(key: _kNotificationsEnabledKey, value: '0');
      if (mounted) setState(() => _notificationsEnabled = false);
    }
  }

  Future<void> _showLanguageSheet(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, scrollController) => ListView(
          controller: scrollController,
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: _languageCodes.map((code) {
            return ListTile(
              title: Text(_languageNames[code] ?? code),
              leading: Radio<String>(
                value: code,
                groupValue: _languageCode,
                onChanged: (v) async {
                  if (v != null) {
                    await ref.read(secureStorageServiceProvider).write(key: _kLanguageKey, value: v);
                    if (!mounted) return;
                    setState(() => _languageCode = v);
                    if (ctx.mounted) Navigator.of(ctx).pop();
                  }
                },
              ),
              onTap: () async {
                await ref.read(secureStorageServiceProvider).write(key: _kLanguageKey, value: code);
                if (!mounted) return;
                setState(() => _languageCode = code);
                if (ctx.mounted) Navigator.of(ctx).pop();
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _devRow(String label, String value, Color fg, Color muted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.dmSans(fontSize: 12, color: fg).copyWith(fontFamily: 'monospace'),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _runGoogleDriveBackup(BuildContext context, String payTag) async {
    final privateKeyHex = ref.read(decryptedPrivateKeyProvider);
    if (privateKeyHex == null || privateKeyHex.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Wallet locked. Unlock to backup.')));
      }
      return;
    }
    final pin = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final c = TextEditingController();
        return AlertDialog(
          title: Text('Enter PIN to encrypt backup', style: GoogleFonts.dmSans(color: Theme.of(ctx).brightness == Brightness.dark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight)),
          content: TextField(
            controller: c,
            keyboardType: TextInputType.number,
            maxLength: 4,
            obscureText: true,
            decoration: const InputDecoration(hintText: '4-digit PIN'),
            style: GoogleFonts.dmSans(fontSize: 18),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.of(ctx).pop(c.text), child: const Text('Backup')),
          ],
        );
      },
    );
    if (pin == null || pin.length != 4 || !context.mounted) return;
    final drive = DriveBackupService();
    final token = await drive.signInAndGetAccessToken();
    if (!context.mounted) return;
    if (token == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Google sign-in cancelled')));
      return;
    }
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
    final result = await drive.uploadBackup(
      privateKeyHex: privateKeyHex,
      pin: pin,
      accessToken: token,
      overwrite: overwrite,
      payTag: payTag.isEmpty ? null : payTag,
    );
    if (!context.mounted) return;
    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Backup saved to Google Drive'), backgroundColor: MonipayColors.success),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Backup failed')),
      );
    }
  }

  Future<void> _showDeleteAccountDialog(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account?'),
        content: const Text(
          'This will permanently remove all your data. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: MonipayColors.destructive)),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      final storage = ref.read(secureStorageServiceProvider);
      await storage.deleteAll();
      ref.read(decryptedPrivateKeyProvider.notifier).state = null;
      if (context.mounted) context.go('/onboarding');
    }
  }

  Future<void> _showAutoLockDialog(BuildContext context, WidgetRef ref, Color fg, Color muted) async {
    final chosen = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Session Auto-Lock', style: GoogleFonts.dmSans(color: fg)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [1, 5, 15]
              .map((m) => ListTile(
                    title: Text('$m minutes', style: GoogleFonts.dmSans()),
                    trailing: _autoLockMinutes == m ? const Icon(LucideIcons.check, size: 20) : null,
                    onTap: () => Navigator.pop(ctx, m),
                  ))
              .toList(),
        ),
      ),
    );
    if (chosen != null) {
      await ref.read(secureStorageServiceProvider).write(key: _kAutoLockMinutesKey, value: chosen.toString());
      setState(() => _autoLockMinutes = chosen);
    }
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 22, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.dmSans(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: fg,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) trailing! else const Icon(LucideIcons.chevronRight, size: 20, color: MonipayColors.mutedSlate),
            ],
          ),
        ),
      ),
    );
  }
}

class _GoogleDriveBackupTile extends StatelessWidget {
  const _GoogleDriveBackupTile({required this.payTag, required this.onBackup});

  final String payTag;
  final VoidCallback onBackup;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(LucideIcons.cloud, size: 22, color: Colors.green),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Google Drive Backup',
                      style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w600, color: fg),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Back up encrypted wallet to Google Drive',
                      style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: onBackup,
                child: const Text('Backup'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────── Developer Panel ────────────────────────

class _DeveloperPanel extends StatelessWidget {
  const _DeveloperPanel({
    required this.isDark,
    required this.fg,
    required this.muted,
    required this.cardBg,
    required this.profileId,
    required this.apiPublicKey,
    required this.apiSecretKeyPreview,
    required this.newSecretKey,
    required this.showSecretKey,
    required this.generatingKeys,
    required this.showConfirmGenerate,
    required this.webhookController,
    required this.savingWebhook,
    required this.onToggleSecretKey,
    required this.onGenerateKeys,
    required this.onCancelGenerate,
    required this.onSaveWebhook,
  });

  final bool isDark;
  final Color fg;
  final Color muted;
  final Color cardBg;
  final String? profileId;
  final String? apiPublicKey;
  final String? apiSecretKeyPreview;
  final String? newSecretKey;
  final bool showSecretKey;
  final bool generatingKeys;
  final bool showConfirmGenerate;
  final TextEditingController webhookController;
  final bool savingWebhook;
  final VoidCallback onToggleSecretKey;
  final VoidCallback onGenerateKeys;
  final VoidCallback onCancelGenerate;
  final VoidCallback onSaveWebhook;

  @override
  Widget build(BuildContext context) {
    final borderColor = muted.withOpacity(0.25);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── API Keys Card ──────────────────────────────────────────
        _DevCard(
          cardBg: cardBg,
          borderColor: borderColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: MonipayColors.primaryBlue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(LucideIcons.key, size: 20, color: MonipayColors.primaryBlue),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('API Keys',
                            style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: fg)),
                        Text('Use these keys to integrate MoniPay with your app',
                            style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (apiPublicKey != null) ...[
                _KeyField(label: 'Public Key', value: apiPublicKey!, isDark: isDark, fg: fg, muted: muted),
                const SizedBox(height: 12),
                _SecretKeyField(
                  label: 'Secret Key',
                  preview: apiSecretKeyPreview ?? '••••••••••••••••',
                  newKey: newSecretKey,
                  showKey: showSecretKey,
                  onToggle: onToggleSecretKey,
                  isDark: isDark,
                  fg: fg,
                  muted: muted,
                ),
                const SizedBox(height: 4),
                if (newSecretKey != null)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.amber.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.amber.withOpacity(0.3)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(LucideIcons.alertTriangle, size: 16, color: Colors.amber),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Save this secret key now! It won\'t be shown again.',
                            style: GoogleFonts.dmSans(fontSize: 12, color: Colors.amber.shade700),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 12),
                if (showConfirmGenerate) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: MonipayColors.destructive.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: MonipayColors.destructive.withOpacity(0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('This will invalidate your current keys. Are you sure?',
                            style: GoogleFonts.dmSans(fontSize: 13, color: MonipayColors.destructive)),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _DevButton(
                                label: generatingKeys ? 'Rotating…' : 'Yes, Rotate',
                                color: MonipayColors.destructive,
                                loading: generatingKeys,
                                onTap: onGenerateKeys,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: onCancelGenerate,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 13),
                                  decoration: BoxDecoration(
                                    color: muted.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text('Cancel',
                                      style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: fg)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ] else
                  _DevButton(
                    label: 'Rotate API Keys',
                    icon: LucideIcons.refreshCw,
                    color: muted.withOpacity(0.3),
                    textColor: fg,
                    onTap: onGenerateKeys,
                  ),
              ] else ...[
                Center(
                  child: Column(
                    children: [
                      Icon(LucideIcons.key, size: 40, color: muted),
                      const SizedBox(height: 8),
                      Text('No API keys generated yet',
                          style: GoogleFonts.dmSans(fontSize: 13, color: muted)),
                      const SizedBox(height: 12),
                      _DevButton(
                        label: generatingKeys ? 'Generating…' : 'Generate API Keys',
                        icon: LucideIcons.key,
                        color: MonipayColors.primaryBlue,
                        loading: generatingKeys,
                        onTap: onGenerateKeys,
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        // ── Webhook Card ───────────────────────────────────────────
        _DevCard(
          cardBg: cardBg,
          borderColor: borderColor,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.purple.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(LucideIcons.webhook, size: 20, color: Colors.purple),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Webhook URL',
                            style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: fg)),
                        Text('Receive payment notifications at this endpoint',
                            style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: webhookController,
                style: GoogleFonts.sourceCodePro(fontSize: 12, color: fg),
                decoration: InputDecoration(
                  hintText: 'https://yoursite.com/webhook/monipay',
                  hintStyle: GoogleFonts.dmSans(fontSize: 12, color: muted),
                  filled: true,
                  fillColor: muted.withOpacity(0.08),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _DevButton(
                label: savingWebhook ? 'Saving…' : 'Save Webhook URL',
                icon: LucideIcons.check,
                color: MonipayColors.primaryBlue,
                loading: savingWebhook,
                onTap: onSaveWebhook,
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: muted.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: RichText(
                  text: TextSpan(
                    style: GoogleFonts.dmSans(fontSize: 11, color: muted),
                    children: [
                      const TextSpan(text: 'Webhooks are signed with HMAC-SHA256 using your secret key. Verify the '),
                      TextSpan(
                        text: 'X-MoniPay-Signature',
                        style: GoogleFonts.sourceCodePro(fontSize: 11, color: fg),
                      ),
                      const TextSpan(text: ' header to ensure authenticity.'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DevCard extends StatelessWidget {
  const _DevCard({required this.child, required this.cardBg, required this.borderColor});
  final Widget child;
  final Color cardBg;
  final Color borderColor;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
      ),
      child: child,
    );
  }
}

class _KeyField extends StatefulWidget {
  const _KeyField({
    required this.label, required this.value,
    required this.isDark, required this.fg, required this.muted,
  });
  final String label;
  final String value;
  final bool isDark;
  final Color fg;
  final Color muted;
  @override
  State<_KeyField> createState() => _KeyFieldState();
}
class _KeyFieldState extends State<_KeyField> {
  bool _copied = false;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label,
            style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: widget.muted)),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                decoration: BoxDecoration(
                  color: widget.muted.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  widget.value,
                  style: GoogleFonts.sourceCodePro(fontSize: 11, color: widget.fg),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: widget.value));
                setState(() => _copied = true);
                Future.delayed(const Duration(seconds: 2), () {
                  if (mounted) setState(() => _copied = false);
                });
              },
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: widget.muted.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: widget.muted.withOpacity(0.25)),
                ),
                child: Icon(
                  _copied ? LucideIcons.check : LucideIcons.copy,
                  size: 16,
                  color: _copied ? MonipayColors.success : widget.muted,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SecretKeyField extends StatefulWidget {
  const _SecretKeyField({
    required this.label, required this.preview, required this.newKey,
    required this.showKey, required this.onToggle,
    required this.isDark, required this.fg, required this.muted,
  });
  final String label;
  final String preview;
  final String? newKey;
  final bool showKey;
  final VoidCallback onToggle;
  final bool isDark;
  final Color fg;
  final Color muted;
  @override
  State<_SecretKeyField> createState() => _SecretKeyFieldState();
}
class _SecretKeyFieldState extends State<_SecretKeyField> {
  bool _copied = false;
  @override
  Widget build(BuildContext context) {
    final displayText = widget.showKey && widget.newKey != null ? widget.newKey! : widget.preview;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label,
            style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: widget.muted)),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                decoration: BoxDecoration(
                  color: widget.muted.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  displayText,
                  style: GoogleFonts.sourceCodePro(fontSize: 11, color: widget.fg),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            if (widget.newKey != null) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: widget.onToggle,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: widget.muted.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: widget.muted.withOpacity(0.25)),
                  ),
                  child: Icon(
                    widget.showKey ? LucideIcons.eyeOff : LucideIcons.eye,
                    size: 16, color: widget.muted,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: widget.newKey!));
                  setState(() => _copied = true);
                  Future.delayed(const Duration(seconds: 2), () {
                    if (mounted) setState(() => _copied = false);
                  });
                },
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: widget.muted.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: widget.muted.withOpacity(0.25)),
                  ),
                  child: Icon(
                    _copied ? LucideIcons.check : LucideIcons.copy,
                    size: 16,
                    color: _copied ? MonipayColors.success : widget.muted,
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _DevButton extends StatelessWidget {
  const _DevButton({
    required this.label, required this.color, required this.onTap,
    this.icon, this.loading = false, this.textColor,
  });
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool loading;
  final Color? textColor;
  @override
  Widget build(BuildContext context) {
    final tc = textColor ?? Colors.white;
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (loading)
              SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: tc))
            else if (icon != null)
              Icon(icon, size: 16, color: tc),
            if (loading || icon != null) const SizedBox(width: 8),
            Text(label,
                style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: tc)),
          ],
        ),
      ),
    );
  }
}
