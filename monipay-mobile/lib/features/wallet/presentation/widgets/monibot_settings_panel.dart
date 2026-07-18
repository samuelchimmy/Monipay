import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:web3dart/web3dart.dart';
import 'package:http/http.dart' as http;

import '../../../../app/theme/app_theme.dart';
import '../../../../core/config/chain_configs.dart';
import '../../../auth/presentation/lock_controller.dart' show lockControllerProvider;
import '../../../auth/presentation/splash_screen.dart' show secureStorageServiceProvider;

// ─────────────────────────── SVG icons ───────────────────────────────────────
const String _svgX = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>';
const String _svgDiscord = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';
const String _svgTelegram = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="m21.416 2.043-18.92 7.3c-1.764.68-1.756 1.692-.323 2.13l4.864 1.517 11.264-7.106c.531-.32.144-.067-.225.26l-9.103 8.216-.367 5.253c.536 0 .77-.245 1.069-.536l2.564-2.49 5.333 3.939c.983.542 1.69.263 1.933-.888l3.496-16.456c.355-1.425-.536-2.071-1.585-1.139z"/></svg>';

// ─────────────────────────── ERC-20 ABI ──────────────────────────────────────
const _erc20Abi = '[{"name":"allowance","type":"function","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"name":"approve","type":"function","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"name":"balanceOf","type":"function","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}]}]';

// ─────────────────────────── Constants ───────────────────────────────────────
const _discordClientId = '1473815294022520964';
const _discordRedirect = 'https://monipay.xyz/discord-callback';
const _telegramBotUsername = 'Monipay_monibot';
const _kDeviceIdKey = 'monipay_device_id';
const _kSocialCachePrefix = 'monipay_social_identity_';

// ─────────────────────────── Data model ──────────────────────────────────────
class SocialIdentity {
  const SocialIdentity({
    this.xUsername,
    this.xVerified = false,
    this.xVerificationCode,
    this.botAllowanceAmount = 0.0,
    this.discordId,
    this.discordUsername,
    this.telegramId,
    this.telegramUsername,
  });

  final String? xUsername;
  final bool xVerified;
  final String? xVerificationCode;
  final double botAllowanceAmount;
  final String? discordId;
  final String? discordUsername;
  final String? telegramId;
  final String? telegramUsername;

  bool get hasSocialLinked => xVerified || discordId != null || telegramId != null;

  factory SocialIdentity.fromMap(Map<String, dynamic> m) => SocialIdentity(
        xUsername: m['x_username'] as String?,
        xVerified: m['x_verified'] == true,
        xVerificationCode: m['x_verification_code'] as String?,
        botAllowanceAmount: (m['bot_allowance_amount'] as num?)?.toDouble() ?? 0.0,
        discordId: m['discord_id'] as String?,
        discordUsername: m['discord_username'] as String?,
        telegramId: m['telegram_id'] as String?,
        telegramUsername: m['telegram_username'] as String?,
      );

  Map<String, dynamic> toMap() => {
        'x_username': xUsername,
        'x_verified': xVerified,
        'x_verification_code': xVerificationCode,
        'bot_allowance_amount': botAllowanceAmount,
        'discord_id': discordId,
        'discord_username': discordUsername,
        'telegram_id': telegramId,
        'telegram_username': telegramUsername,
      };

  SocialIdentity copyWith({
    String? xUsername,
    bool? xVerified,
    String? xVerificationCode,
    double? botAllowanceAmount,
    String? discordId,
    String? discordUsername,
    String? telegramId,
    String? telegramUsername,
    bool clearXVerificationCode = false,
    bool clearDiscord = false,
    bool clearTelegram = false,
  }) =>
      SocialIdentity(
        xUsername: xUsername ?? this.xUsername,
        xVerified: xVerified ?? this.xVerified,
        xVerificationCode: clearXVerificationCode ? null : (xVerificationCode ?? this.xVerificationCode),
        botAllowanceAmount: botAllowanceAmount ?? this.botAllowanceAmount,
        discordId: clearDiscord ? null : (discordId ?? this.discordId),
        discordUsername: clearDiscord ? null : (discordUsername ?? this.discordUsername),
        telegramId: clearTelegram ? null : (telegramId ?? this.telegramId),
        telegramUsername: clearTelegram ? null : (telegramUsername ?? this.telegramUsername),
      );
}

// ─────────────────────────── Main panel ──────────────────────────────────────

class MoniBotSettingsPanel extends ConsumerStatefulWidget {
  const MoniBotSettingsPanel({
    super.key,
    required this.profileId,
    required this.walletAddress,
    required this.preferredNetwork,
    required this.isDark,
  });

  final String? profileId;
  final String walletAddress;
  final String preferredNetwork;
  final bool isDark;

  @override
  ConsumerState<MoniBotSettingsPanel> createState() => _MoniBotSettingsPanelState();
}

class _MoniBotSettingsPanelState extends ConsumerState<MoniBotSettingsPanel> {
  SocialIdentity? _identity;
  bool _loading = true;

  // ── Card A: X ──────────────────────────────────────────────────────────
  final _xCtrl = TextEditingController();
  bool _generatingCode = false;
  bool _waitingForTweet = false;
  bool _copiedCode = false;
  Timer? _xPollTimer;
  int _xPollAttempts = 0;

  // ── Card B: Discord ────────────────────────────────────────────────────
  bool _linkingDiscord = false;
  bool _unlinkingDiscord = false;
  Timer? _discordPollTimer;

  // ── Card C: Telegram ───────────────────────────────────────────────────
  bool _linkingTelegram = false;
  bool _unlinkingTelegram = false;
  Timer? _telegramPollTimer;

  // ── Card E: Allowance ─────────────────────────────────────────────────
  String _currentAllowance = '0.00';
  bool _fetchingAllowance = false;
  bool _approvingAllowance = false;
  final _allowanceCtrl = TextEditingController();

  // ── Unlink ────────────────────────────────────────────────────────────
  bool _unlinkingX = false;

  @override
  void initState() {
    super.initState();
    _loadIdentity();
  }

  @override
  void dispose() {
    _xCtrl.dispose();
    _allowanceCtrl.dispose();
    _xPollTimer?.cancel();
    _discordPollTimer?.cancel();
    _telegramPollTimer?.cancel();
    super.dispose();
  }

  // ─────────────────────── identity cache ────────────────────────────────

  String get _cacheKey => '$_kSocialCachePrefix${widget.profileId}';

  Future<void> _loadIdentity() async {
    // 1. Show cached value immediately.
    final profileId = widget.profileId;
    if (profileId == null || !_isValidUuid(profileId)) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final storage = ref.read(secureStorageServiceProvider);
    final cached = await storage.read(key: _cacheKey);
    if (cached != null && mounted) {
      try {
        final map = jsonDecode(cached) as Map<String, dynamic>;
        final id = SocialIdentity.fromMap(map);
        setState(() {
          _identity = id;
          _loading = false;
          if (id.xVerificationCode != null && !id.xVerified && id.xUsername != null) {
            _xCtrl.text = id.xUsername!;
          }
        });
      } catch (_) {}
    }
    // 2. Refresh from network.
    await _fetchIdentity();
    if (_loading && mounted) setState(() => _loading = false);
    // 3. Load on-chain allowance.
    await _fetchAllowance();
  }

  Future<void> _fetchIdentity() async {
    final profileId = widget.profileId;
    if (profileId == null || !_isValidUuid(profileId)) return;
    try {
      final res = await Supabase.instance.client.functions
          .invoke('social-identity', body: {'action': 'get', 'profileId': profileId});
      if (res.data != null && mounted) {
        final id = SocialIdentity.fromMap(Map<String, dynamic>.from(res.data as Map));
        _cacheIdentity(id);
        setState(() {
          _identity = id;
          _loading = false;
          if (id.xVerificationCode != null && !id.xVerified && id.xUsername != null) {
            _xCtrl.text = id.xUsername!;
          }
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _cacheIdentity(SocialIdentity id) async {
    final profileId = widget.profileId;
    if (profileId == null) return;
    final storage = ref.read(secureStorageServiceProvider);
    await storage.write(key: _cacheKey, value: jsonEncode(id.toMap()));
  }

  // ─────────────────────── on-chain allowance ────────────────────────────

  Future<void> _fetchAllowance() async {
    final addr = widget.walletAddress;
    if (addr.isEmpty) return;
    final cfg = getChainConfig(widget.preferredNetwork);
    if (cfg.token.isEmpty || cfg.monibotRouter.isEmpty) return;
    setState(() => _fetchingAllowance = true);
    try {
      final client = Web3Client(cfg.rpcUrls.first, http.Client());
      try {
        final contract = DeployedContract(
          ContractAbi.fromJson(_erc20Abi, 'ERC20'),
          EthereumAddress.fromHex(cfg.token),
        );
        final result = await client.call(
          contract: contract,
          function: contract.function('allowance'),
          params: [
            EthereumAddress.fromHex(addr),
            EthereumAddress.fromHex(cfg.monibotRouter),
          ],
        );
        if (result.isNotEmpty && mounted) {
          final raw = result[0] as BigInt;
          final formatted = raw / BigInt.from(10).pow(cfg.decimals);
          setState(() => _currentAllowance = formatted.toStringAsFixed(2));
        }
      } finally {
        client.dispose();
      }
    } catch (_) {}
    if (mounted) setState(() => _fetchingAllowance = false);
  }

  // ─────────────────────── Card A: X ─────────────────────────────────────

  Future<void> _generateXCode() async {
    final username = _xCtrl.text.trim().replaceAll('@', '');
    if (username.isEmpty) { _snack('Enter your X username'); return; }
    final profileId = widget.profileId;
    if (profileId == null) return;
    setState(() => _generatingCode = true);
    try {
      final res = await Supabase.instance.client.functions.invoke(
        'social-identity',
        body: {
          'action': 'generate-x-code',
          'profileId': profileId,
          'walletAddress': widget.walletAddress,
          'xUsername': username,
        },
      );
      if (res.data != null) {
        final code = (res.data as Map)['code'] as String?;
        if (code != null && mounted) {
          // Store code in identity for persistence.
          final updated = (_identity ?? const SocialIdentity()).copyWith(
            xUsername: username,
            xVerificationCode: code,
          );
          setState(() => _identity = updated);
          _cacheIdentity(updated);
        }
      }
    } catch (e) {
      _snack('Failed to generate code: $e');
    } finally {
      if (mounted) setState(() => _generatingCode = false);
    }
  }

  Future<void> _tweetCode() async {
    final code = _identity?.xVerificationCode;
    if (code == null) return;
    final encoded = Uri.encodeComponent(code);
    await launchUrl(
      Uri.parse('https://x.com/intent/tweet?text=$encoded'),
      mode: LaunchMode.externalApplication,
    );
    if (!mounted) return;
    setState(() { _waitingForTweet = true; _xPollAttempts = 0; });
    _startXPolling();
  }

  void _startXPolling() {
    _xPollTimer?.cancel();
    _xPollTimer = Timer.periodic(const Duration(seconds: 15), (_) async {
      _xPollAttempts++;
      final found = await _checkXVerification();
      if (found || _xPollAttempts >= 3) {
        _xPollTimer?.cancel();
        if (mounted) setState(() => _waitingForTweet = false);
        if (!found) _snack('Verification pending. Make sure you tweeted the exact code.');
      }
    });
  }

  Future<bool> _checkXVerification() async {
    final profileId = widget.profileId;
    if (profileId == null) return false;
    try {
      // Trigger server-side poll.
      await Supabase.instance.client.functions.invoke('twitter-poll-verification', body: {});
      final res = await Supabase.instance.client.functions.invoke(
        'social-identity',
        body: {'action': 'check-x-verification', 'profileId': profileId},
      );
      if ((res.data as Map?)?.containsKey('verified') == true &&
          (res.data as Map)['verified'] == true) {
        _snack('X account verified!');
        await _fetchIdentity();
        if (mounted) setState(() { _waitingForTweet = false; });
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> _unlinkX() async {
    final profileId = widget.profileId;
    if (profileId == null) return;
    setState(() => _unlinkingX = true);
    try {
      await Supabase.instance.client.functions.invoke(
        'social-identity',
        body: {'action': 'unlink-x', 'profileId': profileId, 'walletAddress': widget.walletAddress},
      );
      _snack('X account unlinked');
      await _fetchIdentity();
    } catch (e) {
      _snack('Failed to unlink X');
    } finally {
      if (mounted) setState(() => _unlinkingX = false);
    }
  }

  // ─────────────────────── Card B: Discord ───────────────────────────────

  Future<void> _linkDiscord() async {
    final profileId = widget.profileId;
    if (profileId == null) return;
    final stateParam = base64Url.encode(
        utf8.encode(jsonEncode({'profileId': profileId, 'walletAddress': widget.walletAddress})));
    final url = 'https://discord.com/api/oauth2/authorize'
        '?client_id=$_discordClientId'
        '&redirect_uri=${Uri.encodeComponent(_discordRedirect)}'
        '&response_type=code'
        '&scope=identify'
        '&state=$stateParam'
        '&prompt=consent';
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!mounted) return;
    setState(() => _linkingDiscord = true);
    // Poll profiles table every 3s for up to 2 min.
    int attempts = 0;
    _discordPollTimer?.cancel();
    _discordPollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      attempts++;
      final found = await _pollForDiscord(profileId);
      if (found || attempts >= 40) {
        _discordPollTimer?.cancel();
        if (mounted) setState(() => _linkingDiscord = false);
      }
    });
  }

  Future<bool> _pollForDiscord(String profileId) async {
    try {
      final res = await Supabase.instance.client
          .from('profiles')
          .select('discord_id, discord_username')
          .eq('id', profileId)
          .maybeSingle();
      if (res != null && res['discord_id'] != null) {
        final username = res['discord_username'] as String? ?? res['discord_id'] as String;
        _snack('Discord linked as $username!');
        await _fetchIdentity();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> _unlinkDiscord() async {
    final profileId = widget.profileId;
    if (profileId == null) return;
    setState(() => _unlinkingDiscord = true);
    try {
      await Supabase.instance.client.functions.invoke(
        'social-identity',
        body: {'action': 'unlink-discord', 'profileId': profileId, 'walletAddress': widget.walletAddress},
      );
      _snack('Discord unlinked');
      await _fetchIdentity();
    } catch (_) {
      _snack('Failed to unlink Discord');
    } finally {
      if (mounted) setState(() => _unlinkingDiscord = false);
    }
  }

  // ─────────────────────── Card C: Telegram ──────────────────────────────

  Future<void> _linkTelegram() async {
    final profileId = widget.profileId;
    if (profileId == null) return;
    final stateParam = base64Url.encode(
        utf8.encode(jsonEncode({'profileId': profileId, 'walletAddress': widget.walletAddress})));
    final returnTo = Uri.encodeComponent(
        'https://monipay.xyz/telegram-callback?state=${Uri.encodeComponent(stateParam)}');
    final url = 'https://oauth.telegram.org/auth'
        '?bot_id=$_telegramBotUsername'
        '&origin=https://monipay.xyz'
        '&return_to=$returnTo';
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!mounted) return;
    setState(() => _linkingTelegram = true);
    int attempts = 0;
    _telegramPollTimer?.cancel();
    _telegramPollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      attempts++;
      final found = await _pollForTelegram(profileId);
      if (found || attempts >= 40) {
        _telegramPollTimer?.cancel();
        if (mounted) setState(() => _linkingTelegram = false);
      }
    });
  }

  Future<bool> _pollForTelegram(String profileId) async {
    try {
      final res = await Supabase.instance.client
          .from('profiles')
          .select('telegram_id, telegram_username')
          .eq('id', profileId)
          .maybeSingle();
      if (res != null && res['telegram_id'] != null) {
        final username = res['telegram_username'] as String? ?? res['telegram_id'].toString();
        _snack('Telegram linked as @$username!');
        await _fetchIdentity();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> _unlinkTelegram() async {
    final profileId = widget.profileId;
    if (profileId == null) return;
    setState(() => _unlinkingTelegram = true);
    try {
      await Supabase.instance.client.functions.invoke(
        'social-identity',
        body: {'action': 'unlink-telegram', 'profileId': profileId, 'walletAddress': widget.walletAddress},
      );
      _snack('Telegram unlinked');
      await _fetchIdentity();
    } catch (_) {
      _snack('Failed to unlink Telegram');
    } finally {
      if (mounted) setState(() => _unlinkingTelegram = false);
    }
  }

  // ─────────────────────── Card E: Allowance ─────────────────────────────

  Future<void> _approveAllowance() async {
    final amountStr = _allowanceCtrl.text.trim();
    final amount = double.tryParse(amountStr);
    if (amount == null || amount <= 0) { _snack('Enter a valid amount'); return; }
    if (_identity?.hasSocialLinked != true) {
      _snack('Link at least one social account first'); return;
    }
    final profileId = widget.profileId;
    if (profileId == null) return;
    final cfg = getChainConfig(widget.preferredNetwork);
    if (cfg.token.isEmpty || cfg.monibotRouter.isEmpty) { _snack('Network not supported'); return; }

    // Ask for PIN and get decrypted private key.
    final privateKey = await _showPinDialog(context);
    if (privateKey == null) return;

    setState(() => _approvingAllowance = true);
    try {
      final walletAddr = widget.walletAddress;
      final client = Web3Client(cfg.rpcUrls.first, http.Client());
      try {
        // BSC: check BNB balance for gas.
        if (widget.preferredNetwork == 'bsc') {
          final bnb = await client.getBalance(EthereumAddress.fromHex(walletAddr));
          if (bnb == EtherAmount.zero()) {
            throw Exception('You need BNB on BSC for gas fees. Send a small amount of BNB to your wallet first.');
          }
        }

        // Base: ensure wallet has ETH for activation.
        if (widget.preferredNetwork == 'base') {
          final storage = ref.read(secureStorageServiceProvider);
          final deviceId = await _getDeviceId(storage);
          final checkRes = await Supabase.instance.client.functions.invoke(
            'activation-funder',
            body: {'action': 'checkEthBalance', 'walletAddress': walletAddr, 'deviceId': deviceId},
          );
          final hasEnough = (checkRes.data as Map?)?['hasEnoughForActivation'] == true;
          if (!hasEnough) {
            _snack('Funding wallet for gas…');
            await Supabase.instance.client.functions.invoke(
              'activation-funder',
              body: {'action': 'fund', 'walletAddress': walletAddr, 'deviceId': deviceId},
            );
            await Future.delayed(const Duration(milliseconds: 3500));
          }
        }

        // Build approve call.
        final contract = DeployedContract(
          ContractAbi.fromJson(_erc20Abi, 'ERC20'),
          EthereumAddress.fromHex(cfg.token),
        );
        final decimals = cfg.decimals;
        final amountInUnits = BigInt.from((amount * pow(10, decimals)).round());
        final credentials = EthPrivateKey.fromHex(
            privateKey.startsWith('0x') ? privateKey.substring(2) : privateKey);

        final txHash = await client.sendTransaction(
          credentials,
          Transaction.callContract(
            contract: contract,
            function: contract.function('approve'),
            parameters: [EthereumAddress.fromHex(cfg.monibotRouter), amountInUnits],
            maxGas: 100000,
          ),
          chainId: cfg.id,
        );

        // Wait for receipt.
        TransactionReceipt? receipt;
        for (int i = 0; i < 30; i++) {
          await Future.delayed(const Duration(seconds: 2));
          receipt = await client.getTransactionReceipt(txHash);
          if (receipt != null) break;
        }
        if (receipt != null && !receipt.status!) {
          throw Exception('Transaction reverted on-chain.');
        }

        // Update Supabase.
        await Supabase.instance.client.functions.invoke(
          'social-identity',
          body: {'action': 'update-allowance', 'profileId': profileId, 'walletAddress': walletAddr, 'amount': amount},
        );

        _snack('Allowance approved!');
        _allowanceCtrl.clear();
        await _fetchAllowance();
        await _fetchIdentity();
      } finally {
        client.dispose();
      }
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _approvingAllowance = false);
    }
  }

  // ─────────────────────── PIN dialog ────────────────────────────────────

  /// Shows a PIN dialog and returns the decrypted private key, or null if cancelled / wrong PIN.
  Future<String?> _showPinDialog(BuildContext context) {
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _PinDialog(
        onVerify: (pin) => ref.read(lockControllerProvider.notifier).verifyAndDecryptForSigning(pin),
      ),
    );
  }

  // ─────────────────────── helpers ───────────────────────────────────────

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  static bool _isValidUuid(String id) {
    final r = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', caseSensitive: false);
    return r.hasMatch(id);
  }

  static Future<String> _getDeviceId(dynamic storage) async {
    final existing = await storage.read(key: _kDeviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final rand = Random.secure();
    final id = List.generate(16, (_) => rand.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    await storage.write(key: _kDeviceIdKey, value: id);
    return id;
  }

  // ─────────────────────── build ─────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    final fg   = isDark ? MonipayColors.foregroundDark  : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final card  = isDark ? MonipayColors.cardDark        : MonipayColors.cardLight;
    final border = muted.withOpacity(0.25);
    final cfg   = getChainConfig(widget.preferredNetwork);

    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator(color: MonipayColors.primaryBlue)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Card A: X (Twitter) ─────────────────────────────────────────
        _MbCard(card: card, border: border, child: _buildXCard(fg, muted)),
        const SizedBox(height: 12),
        // ── Card B: Discord ──────────────────────────────────────────────
        _MbCard(card: card, border: _identity?.discordId != null ? MonipayColors.success.withOpacity(0.4) : border,
            child: _buildDiscordCard(fg, muted)),
        const SizedBox(height: 12),
        // ── Card C: Telegram ─────────────────────────────────────────────
        _MbCard(card: card, border: _identity?.telegramId != null ? MonipayColors.success.withOpacity(0.4) : border,
            child: _buildTelegramCard(fg, muted)),
        const SizedBox(height: 12),
        // ── Card D: Add to server ────────────────────────────────────────
        _MbCard(card: card, border: border, child: _buildAddToServerCard(fg, muted)),
        const SizedBox(height: 12),
        // ── Card E: Allowance ────────────────────────────────────────────
        _MbCard(card: card, border: border, child: _buildAllowanceCard(fg, muted, cfg)),
      ],
    );
  }

  // ── Card A builder ────────────────────────────────────────────────────
  Widget _buildXCard(Color fg, Color muted) {
    final id = _identity;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CardHeader(
          icon: SvgPicture.string(_svgX, width: 18, height: 18,
              color: fg, colorBlendMode: BlendMode.srcIn),
          iconBg: muted.withOpacity(0.15),
          title: 'Link X Account',
          subtitle: 'Verify your Twitter/X identity',
        ),
        const SizedBox(height: 12),
        if (id?.xVerified == true) ...[
          _LinkedBadge(label: 'Connected as @${id!.xUsername}'),
          const SizedBox(height: 10),
          _MbButton(
            label: _unlinkingX ? 'Unlinking…' : 'Unlink X Account',
            icon: LucideIcons.unlink,
            loading: _unlinkingX,
            outlined: true,
            fg: fg,
            muted: muted,
            onTap: _unlinkingX ? null : _unlinkX,
          ),
        ] else if (id?.xVerificationCode != null) ...[
          _buildXVerificationStep(fg, muted),
        ] else ...[
          _buildXInputStep(fg, muted),
        ],
      ],
    );
  }

  Widget _buildXInputStep(Color fg, Color muted) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Enter your X username', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
          const SizedBox(height: 8),
          _TextField(controller: _xCtrl, hint: 'username (without @)', fg: fg, muted: muted),
          const SizedBox(height: 10),
          _MbButton(
            label: _generatingCode ? 'Generating…' : 'Generate Verification Code',
            icon: LucideIcons.shield,
            loading: _generatingCode,
            onTap: _generatingCode ? null : _generateXCode,
          ),
        ],
      );

  Widget _buildXVerificationStep(Color fg, Color muted) {
    final code = _identity!.xVerificationCode!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tweet this code to verify:', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: muted.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: Row(
            children: [
              Expanded(child: Text(code, style: GoogleFonts.sourceCodePro(fontSize: 12, color: fg, fontWeight: FontWeight.w600))),
              GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: code));
                  setState(() => _copiedCode = true);
                  Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => _copiedCode = false); });
                  _snack('Code copied');
                },
                child: Icon(_copiedCode ? LucideIcons.check : LucideIcons.copy, size: 16,
                    color: _copiedCode ? MonipayColors.success : muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        if (_waitingForTweet) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: MonipayColors.primaryBlue.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: MonipayColors.primaryBlue.withOpacity(0.2))),
            child: Row(
              children: [
                const SizedBox(width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: MonipayColors.primaryBlue)),
                const SizedBox(width: 10),
                Expanded(child: Text('Checking for your tweet… Verification happens automatically.',
                    style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.primaryBlue))),
              ],
            ),
          ),
        ] else
          _MbButton(
            label: 'Tweet Code',
            icon: LucideIcons.externalLink,
            onTap: _tweetCode,
          ),
        const SizedBox(height: 6),
        Center(
          child: Text(
            _waitingForTweet ? 'Checking for your tweet…' : 'Code expires in 24 hours',
            style: GoogleFonts.dmSans(fontSize: 11, color: muted),
          ),
        ),
      ],
    );
  }

  // ── Card B builder ────────────────────────────────────────────────────
  Widget _buildDiscordCard(Color fg, Color muted) {
    final id = _identity;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CardHeader(
          icon: SvgPicture.string(_svgDiscord, width: 18, height: 18,
              color: const Color(0xFF5865F2), colorBlendMode: BlendMode.srcIn),
          iconBg: const Color(0xFF5865F2).withOpacity(0.1),
          title: 'Link Discord',
          subtitle: 'Connect your Discord with one click',
        ),
        const SizedBox(height: 12),
        if (id?.discordId != null) ...[
          _LinkedBadge(label: 'Connected as ${id!.discordUsername ?? id.discordId}'),
          const SizedBox(height: 10),
          _MbButton(
            label: _unlinkingDiscord ? 'Unlinking…' : 'Unlink Discord',
            icon: LucideIcons.unlink,
            loading: _unlinkingDiscord,
            outlined: true,
            fg: fg,
            muted: muted,
            onTap: _unlinkingDiscord ? null : _unlinkDiscord,
          ),
        ] else ...[
          Text('Sign in with Discord to automatically link your account.',
              style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
          const SizedBox(height: 10),
          _MbButton(
            label: _linkingDiscord ? 'Waiting for Discord…' : 'Connect with Discord',
            icon: LucideIcons.link,
            loading: _linkingDiscord,
            color: const Color(0xFF4F46E5),
            onTap: _linkingDiscord ? null : _linkDiscord,
          ),
        ],
      ],
    );
  }

  // ── Card C builder ────────────────────────────────────────────────────
  Widget _buildTelegramCard(Color fg, Color muted) {
    final id = _identity;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CardHeader(
          icon: SvgPicture.string(_svgTelegram, width: 18, height: 18,
              color: const Color(0xFF229ED9), colorBlendMode: BlendMode.srcIn),
          iconBg: const Color(0xFF229ED9).withOpacity(0.1),
          title: 'Link Telegram',
          subtitle: 'Connect your Telegram with one click',
        ),
        const SizedBox(height: 12),
        if (id?.telegramId != null) ...[
          _LinkedBadge(label: 'Connected as @${id!.telegramUsername ?? id.telegramId}'),
          const SizedBox(height: 10),
          _MbButton(
            label: _unlinkingTelegram ? 'Unlinking…' : 'Unlink Telegram',
            icon: LucideIcons.unlink,
            loading: _unlinkingTelegram,
            outlined: true,
            fg: fg,
            muted: muted,
            onTap: _unlinkingTelegram ? null : _unlinkTelegram,
          ),
        ] else ...[
          Text('Sign in with Telegram to automatically link your account.',
              style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
          const SizedBox(height: 10),
          _MbButton(
            label: _linkingTelegram ? 'Linking Telegram…' : 'Connect with Telegram',
            icon: LucideIcons.send,
            loading: _linkingTelegram,
            color: const Color(0xFF229ED9),
            onTap: _linkingTelegram ? null : _linkTelegram,
          ),
        ],
      ],
    );
  }

  // ── Card D builder ────────────────────────────────────────────────────
  Widget _buildAddToServerCard(Color fg, Color muted) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeader(
            icon: Icon(LucideIcons.globe, size: 18, color: MonipayColors.primaryBlue),
            iconBg: MonipayColors.primaryBlue.withOpacity(0.1),
            title: 'Add MoniBot to Your Server',
            subtitle: 'Bring instant payments to your community',
          ),
          const SizedBox(height: 12),
          _MbButton(
            label: 'Add to Discord Server',
            svgIcon: _svgDiscord,
            svgColor: const Color(0xFF5865F2),
            outlined: true,
            fg: fg,
            muted: muted,
            onTap: () => launchUrl(
              Uri.parse('https://discord.com/oauth2/authorize?client_id=$_discordClientId&permissions=2147483648&scope=bot'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          const SizedBox(height: 8),
          _MbButton(
            label: 'Add to Telegram Group',
            icon: LucideIcons.send,
            outlined: true,
            fg: fg,
            muted: muted,
            onTap: () => launchUrl(Uri.parse('https://t.me/$_telegramBotUsername'), mode: LaunchMode.externalApplication),
          ),
          const SizedBox(height: 8),
          _MbButton(
            label: 'Tweet at MoniBot',
            svgIcon: _svgX,
            svgColor: fg,
            outlined: true,
            fg: fg,
            muted: muted,
            onTap: () => launchUrl(
              Uri.parse('https://x.com/intent/tweet?text=%40monibot%20'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          const SizedBox(height: 10),
          Center(
            child: Text('Once added, members can use MoniBot commands to send payments instantly.',
                textAlign: TextAlign.center,
                style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
          ),
        ],
      );

  // ── Card E builder ────────────────────────────────────────────────────
  Widget _buildAllowanceCard(Color fg, Color muted, ChainConfig cfg) {
    final id = _identity;
    final networkLabel = widget.preferredNetwork == 'bsc'
        ? 'BSC (USDT)'
        : widget.preferredNetwork == 'tempo'
            ? 'Tempo (αUSD)'
            : 'Base (USDC)';
    final currencyLabel = cfg.currency;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CardHeader(
          icon: Icon(LucideIcons.wallet, size: 18, color: MonipayColors.primaryBlue),
          iconBg: MonipayColors.primaryBlue.withOpacity(0.1),
          title: 'Bot Allowance',
          subtitle: 'Approving on $networkLabel',
        ),
        const SizedBox(height: 12),

        // Warning if no social linked.
        if (id?.hasSocialLinked != true)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
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
                Expanded(child: Text('Link at least one social account (X, Discord, or Telegram) to use MoniBot features.',
                    style: GoogleFonts.dmSans(fontSize: 12, color: muted))),
              ],
            ),
          ),

        // Current allowance display.
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: muted.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Current On-Chain Allowance', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                  if (_fetchingAllowance)
                    const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 1.5, color: MonipayColors.primaryBlue))
                  else
                    Text('\$$_currentAllowance $currencyLabel',
                        style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w700, color: fg)),
                ],
              ),
              if (id != null && id.botAllowanceAmount > 0) ...[
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Authorized Amount', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                    Text('\$${id.botAllowanceAmount.toStringAsFixed(2)} $currencyLabel',
                        style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: MonipayColors.primaryBlue)),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),

        // How it works.
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: muted.withOpacity(0.05),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: muted.withOpacity(0.15)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('How it works: This allowance lets MoniBot execute social payments on your behalf.',
                  style: GoogleFonts.dmSans(fontSize: 11, color: muted)),
              const SizedBox(height: 6),
              _infoRow('Base (USDC)', '@monibot send \$5 to @user', fg, muted),
              _infoRow('BSC (USDT)', '@monibot send \$5 usdt to @user', fg, muted),
              _infoRow('Tempo (αUSD)', '@monibot send \$5 to @user on tempo', fg, muted),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: MonipayColors.primaryBlue.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('⚠️ Each chain requires its own approval. To use MoniBot on all 3 chains, switch networks and approve on each one.',
                    style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Amount input.
        Text('Max Spend Limit ($currencyLabel)', style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: muted)),
        const SizedBox(height: 6),
        _TextField(controller: _allowanceCtrl, hint: '100', fg: fg, muted: muted, numeric: true),
        const SizedBox(height: 4),
        Text('1% deposit fee applies', style: GoogleFonts.dmSans(fontSize: 11, color: muted)),
        const SizedBox(height: 10),
        _MbButton(
          label: _approvingAllowance ? 'Approving…' : 'Approve Allowance',
          icon: LucideIcons.check,
          loading: _approvingAllowance,
          onTap: (_approvingAllowance || id?.hasSocialLinked != true) ? null : _approveAllowance,
        ),
      ],
    );
  }

  Widget _infoRow(String net, String cmd, Color fg, Color muted) => Padding(
        padding: const EdgeInsets.only(bottom: 3),
        child: RichText(
          text: TextSpan(
            style: GoogleFonts.dmSans(fontSize: 11, color: muted),
            children: [
              TextSpan(text: '$net: ', style: const TextStyle(fontWeight: FontWeight.w600)),
              TextSpan(text: cmd, style: GoogleFonts.sourceCodePro(fontSize: 10, color: fg)),
            ],
          ),
        ),
      );
}

// ─────────────────────────── PIN dialog ──────────────────────────────────────

class _PinDialog extends StatefulWidget {
  const _PinDialog({required this.onVerify});
  final Future<String?> Function(String pin) onVerify;

  @override
  State<_PinDialog> createState() => _PinDialogState();
}

class _PinDialogState extends State<_PinDialog> {
  String _pin = '';
  bool _verifying = false;
  String _error = '';

  void _addDigit(String d) {
    if (_pin.length >= 4 || _verifying) return;
    setState(() { _pin += d; _error = ''; });
    if (_pin.length == 4) _submit();
  }

  void _delete() => setState(() {
        if (_pin.isNotEmpty) _pin = _pin.substring(0, _pin.length - 1);
        _error = '';
      });

  Future<void> _submit() async {
    setState(() => _verifying = true);
    final key = await widget.onVerify(_pin);
    if (!mounted) return;
    if (key != null) {
      Navigator.of(context).pop(key);
    } else {
      setState(() { _verifying = false; _pin = ''; _error = 'Incorrect PIN'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fg    = isDark ? MonipayColors.foregroundDark  : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final bg    = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    return Dialog(
      backgroundColor: bg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Enter PIN', style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg)),
            const SizedBox(height: 4),
            Text('Sign the approval transaction', style: GoogleFonts.dmSans(fontSize: 13, color: muted)),
            const SizedBox(height: 20),
            // PIN dots.
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (i) {
                final filled = i < _pin.length;
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  width: 14, height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: filled ? MonipayColors.primaryBlue : muted.withOpacity(0.3),
                  ),
                );
              }),
            ),
            if (_error.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(_error, style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.destructive)),
            ],
            const SizedBox(height: 20),
            if (_verifying)
              const CircularProgressIndicator(color: MonipayColors.primaryBlue)
            else
              _Numpad(fg: fg, muted: muted, onDigit: _addDigit, onDelete: _delete),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
              child: Text('Cancel', style: GoogleFonts.dmSans(fontSize: 13, color: muted)),
            ),
          ],
        ),
      ),
    );
  }
}

class _Numpad extends StatelessWidget {
  const _Numpad({required this.fg, required this.muted, required this.onDigit, required this.onDelete});
  final Color fg;
  final Color muted;
  final void Function(String) onDigit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    const rows = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];
    return Column(
      children: rows.map((row) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: row.map((label) {
            if (label.isEmpty) return const SizedBox(width: 72, height: 48);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: GestureDetector(
                onTap: label == '⌫' ? onDelete : () => onDigit(label),
                child: Container(
                  width: 56, height: 48,
                  decoration: BoxDecoration(
                    color: muted.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Text(label,
                    style: GoogleFonts.dmSans(fontSize: label == '⌫' ? 18 : 20, fontWeight: FontWeight.w600, color: fg)),
                ),
              ),
            );
          }).toList(),
        ),
      )).toList(),
    );
  }
}

// ─────────────────────────── Shared UI helpers ────────────────────────────────

class _MbCard extends StatelessWidget {
  const _MbCard({required this.child, required this.card, required this.border});
  final Widget child;
  final Color card;
  final Color border;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: card, borderRadius: BorderRadius.circular(16), border: Border.all(color: border)),
        child: child,
      );
}

class _CardHeader extends StatelessWidget {
  const _CardHeader({required this.icon, required this.iconBg, required this.title, required this.subtitle});
  final Widget icon;
  final Color iconBg;
  final String title;
  final String subtitle;
  @override
  Widget build(BuildContext context) {
    const muted = MonipayColors.mutedSlate;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    return Row(
      children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
          alignment: Alignment.center,
          child: icon,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg)),
              Text(subtitle, style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
            ],
          ),
        ),
      ],
    );
  }
}

class _LinkedBadge extends StatelessWidget {
  const _LinkedBadge({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: MonipayColors.success.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: MonipayColors.success.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            const Icon(LucideIcons.badgeCheck, size: 16, color: MonipayColors.success),
            const SizedBox(width: 8),
            Expanded(child: Text(label,
                style: GoogleFonts.dmSans(fontSize: 13, color: MonipayColors.success, fontWeight: FontWeight.w600))),
          ],
        ),
      );
}

class _MbButton extends StatelessWidget {
  const _MbButton({
    required this.label,
    required this.onTap,
    this.icon,
    this.svgIcon,
    this.svgColor,
    this.loading = false,
    this.outlined = false,
    this.color,
    this.fg,
    this.muted,
  });

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final String? svgIcon;
  final Color? svgColor;
  final bool loading;
  final bool outlined;
  final Color? color;
  final Color? fg;
  final Color? muted;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? MonipayColors.primaryBlue;
    final textColor = outlined ? (fg ?? Colors.white) : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: outlined ? Colors.transparent : (onTap == null ? effectiveColor.withOpacity(0.5) : effectiveColor),
          borderRadius: BorderRadius.circular(12),
          border: outlined ? Border.all(color: muted?.withOpacity(0.4) ?? MonipayColors.mutedSlate.withOpacity(0.4)) : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (loading)
              SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: outlined ? effectiveColor : Colors.white))
            else if (svgIcon != null)
              SvgPicture.string(svgIcon!, width: 16, height: 16,
                  color: svgColor ?? textColor, colorBlendMode: BlendMode.srcIn)
            else if (icon != null)
              Icon(icon, size: 16, color: textColor),
            if (loading || svgIcon != null || icon != null) const SizedBox(width: 8),
            Text(label, style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: textColor)),
            const SizedBox(width: 4),
            if (!loading && onTap != null && !outlined)
              Icon(LucideIcons.externalLink, size: 12, color: textColor.withOpacity(0.7)),
          ],
        ),
      ),
    );
  }
}

class _TextField extends StatelessWidget {
  const _TextField({required this.controller, required this.hint, required this.fg, required this.muted, this.numeric = false});
  final TextEditingController controller;
  final String hint;
  final Color fg;
  final Color muted;
  final bool numeric;
  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        keyboardType: numeric ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
        style: GoogleFonts.dmSans(fontSize: 14, color: fg),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.dmSans(fontSize: 14, color: muted),
          filled: true,
          fillColor: muted.withOpacity(0.08),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        ),
      );
}
