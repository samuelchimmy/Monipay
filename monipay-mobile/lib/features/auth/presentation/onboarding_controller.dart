import 'dart:async';
import 'dart:convert';

import 'package:bcrypt/bcrypt.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:web3dart/web3dart.dart';

import '../../../../core/config/chain_configs.dart';
import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/security/wallet_service.dart';
import '../data/paytag_repository.dart';
import 'onboarding_state.dart';
import 'splash_screen.dart' show kMonipayHasProfileKey, secureStorageServiceProvider;

/// Top-level for compute: hash PIN with BCrypt (avoids blocking UI).
String _hashPinInIsolate(List<dynamic> args) {
  final pin = args[0] as String;
  return BCrypt.hashpw(pin, BCrypt.gensalt());
}

/// Holds step state, flow type, wallet data, PIN, moniTag, mode. Drives onboarding UI.
class OnboardingController extends StateNotifier<OnboardingState> {
  OnboardingController({
    required this.walletService,
    required this.secureStorage,
    PaytagRepository? paytagRepository,
  })  : _paytagRepository = paytagRepository,
        super(OnboardingState());

  final WalletService walletService;
  final SecureStorageService secureStorage;
  final PaytagRepository? _paytagRepository;

  Timer? _moniTagDebounce;

  static String get _activationFunderUrl => '$supabaseFunctionsUrl/activation-funder';

  void startCreate() {
    state = state.copyWith(flow: 'create', showSteps: true, step: 1);
  }

  void startImport() {
    state = state.copyWith(flow: 'import', showSteps: true, step: 1);
  }

  void resetToLanding() {
    state = OnboardingState();
  }

  void setMoniTag(String value) {
    state = state.copyWith(moniTag: value, tagError: '');
    _moniTagDebounce?.cancel();
    final trimmed = value.trim();
    if (trimmed.length >= 3 && RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(trimmed)) {
      _moniTagDebounce = Timer(const Duration(milliseconds: 600), () {
        checkMoniTagAvailable();
      });
    }
  }

  void setTagError(String? value) {
    state = state.copyWith(tagError: value ?? '');
  }

  void setPin(String value) {
    state = state.copyWith(pin: value);
  }

  void setConfirmPin(String value) {
    state = state.copyWith(confirmPin: value);
  }

  void setPrivateKeyInput(String value) {
    state = state.copyWith(privateKeyInput: value, importError: '');
  }

  void setSelectedMode(String mode) {
    state = state.copyWith(selectedMode: mode);
  }

  void setHasBackedUp(bool value) {
    state = state.copyWith(hasBackedUp: value);
  }

  void setCloudBackupSuccess(bool value) {
    state = state.copyWith(cloudBackupSuccess: value, hasBackedUp: true);
  }

  void setShowPrivateKey(bool value) {
    state = state.copyWith(showPrivateKey: value);
  }

  void setHasCopiedKey(bool value) {
    state = state.copyWith(hasCopiedKey: value);
  }

  void goNext() {
    state = state.copyWith(step: state.step + 1);
  }

  void goBack() {
    if (state.step > 1) state = state.copyWith(step: state.step - 1);
  }

  /// Create flow: generate wallet and store in state (call after step 2, before step 3).
  void generateWalletForCreate() {
    final result = walletService.generateEvmWallet();
    state = state.copyWith(
      generatedPrivateKey: result.privateKeyHex,
      generatedAddress: result.address,
    );
  }

  /// Step 1 create: check moniTag availability (debounced by caller).
  Future<bool> checkMoniTagAvailable() async {
    final repo = _paytagRepository;
    if (repo == null) return false;
    state = state.copyWith(isCheckingTag: true, tagError: '');
    try {
      final available = await repo.isMoniTagAvailable(state.moniTag);
      state = state.copyWith(isCheckingTag: false);
      return available;
    } catch (_) {
      state = state.copyWith(isCheckingTag: false, tagError: 'Could not check availability');
      return false;
    }
  }

  /// Step 3 create: create profile (encrypt key, register, fire activation-funder).
  Future<bool> submitStep3Create() async {
    if (state.selectedMode == null || state.pin.length != 4 || state.pin != state.confirmPin) return false;
    if (state.generatedPrivateKey == null || state.generatedAddress == null) return false;
    final repo = _paytagRepository;
    if (repo == null) {
      state = state.copyWith(importError: 'Supabase not configured');
      return false;
    }
    state = state.copyWith(isCreating: true);
    try {
      final encrypted = await compute(encryptPrivateKeyInIsolate, [state.generatedPrivateKey!, state.pin]);
      final profileId = await repo.register(
        payTag: state.moniTag.trim().toLowerCase(),
        walletAddress: state.generatedAddress!,
        encryptedPrivateKey: encrypted,
        mode: state.selectedMode!,
        preferredNetwork: 'base',
      );
      state = state.copyWith(
        isCreating: false,
        profileId: profileId,
        encryptedPrivateKey: encrypted,
        walletAddress: state.generatedAddress,
      );
      _fireActivationFunder(state.generatedAddress!);
      return true;
    } catch (e) {
      state = state.copyWith(isCreating: false, importError: e.toString());
      return false;
    }
  }

  void _fireActivationFunder(String walletAddress) {
    final deviceId = 'flutter-${DateTime.now().millisecondsSinceEpoch}';
    http
        .post(
          Uri.parse(_activationFunderUrl),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'action': 'fund', 'walletAddress': walletAddress, 'deviceId': deviceId}),
        )
        .ignore();
  }

  /// Import step 1: validate private key format.
  bool validateImportKey() {
    final key = state.privateKeyInput.trim();
    if (key.isEmpty) {
      state = state.copyWith(importError: 'Please enter your private key');
      return false;
    }
    if (!RegExp(r'^(0x)?[a-fA-F0-9]{64}$').hasMatch(key)) {
      state = state.copyWith(importError: 'Invalid private key format. Should be 64 hex characters.');
      return false;
    }
    state = state.copyWith(importError: '');
    return true;
  }

  /// Import step 2: encrypt key with PIN, save to secure storage, write monipay_has_profile.
  Future<bool> submitImportWallet() async {
    if (state.pin.length != 4 || state.pin != state.confirmPin) return false;
    final key = state.privateKeyInput.trim();
    if (!RegExp(r'^(0x)?[a-fA-F0-9]{64}$').hasMatch(key)) return false;
    state = state.copyWith(isImporting: true, importError: '');
    try {
      final hexKey = key.startsWith('0x') ? key : '0x$key';
      final encrypted = await compute(encryptPrivateKeyInIsolate, [hexKey, state.pin]);
      final address = _addressFromPrivateKey(hexKey);
      await secureStorage.write(key: 'monipay_encrypted_private_key', value: encrypted);
      await secureStorage.write(key: 'monipay_wallet_address', value: address);
      await secureStorage.write(key: kMonipayHasProfileKey, value: '1');
      state = state.copyWith(isImporting: false, walletAddress: address);
      return true;
    } catch (e) {
      state = state.copyWith(isImporting: false, importError: e.toString());
      return false;
    }
  }

  String _addressFromPrivateKey(String hex) {
    final cred = EthPrivateKey.fromHex(hex);
    return cred.address.hex;
  }

  /// Step 5: request activation funds (call when entering step 5).
  Future<void> requestActivationFunds() async {
    final addr = state.walletAddress;
    if (addr == null || state.isRequestingFunds || state.hasFunds) return;
    state = state.copyWith(isRequestingFunds: true, activationError: '');
    try {
      final resp = await http.post(
        Uri.parse(_activationFunderUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'action': 'fund',
          'walletAddress': addr,
          'deviceId': 'flutter-${DateTime.now().millisecondsSinceEpoch}',
        }),
      );
      final data = jsonDecode(resp.body) as Map<String, dynamic>?;
      if (data?['success'] == true || data?['alreadyFunded'] == true) {
        await Future.delayed(Duration(milliseconds: data?['alreadyFunded'] == true ? 500 : 3000));
        state = state.copyWith(hasFunds: true, isRequestingFunds: false);
      } else if (data?['pending'] == true) {
        state = state.copyWith(isRequestingFunds: false);
        await Future.delayed(const Duration(seconds: 3));
        if (!state.hasFunds) requestActivationFunds();
      } else if (data?['deviceLimited'] == true) {
        state = state.copyWith(
          activationError: 'This device has already been used for activation. Please use the Fund Wallet option instead.',
          isRequestingFunds: false,
        );
      } else {
        state = state.copyWith(isRequestingFunds: false);
      }
    } catch (_) {
      state = state.copyWith(activationError: 'Network error. Please try again.', isRequestingFunds: false);
    }
  }

  void setActivated() {
    state = state.copyWith(isActivated: true);
  }

  /// Write all profile data to secure storage (after backup step). Matches web: encrypted key, wallet, PIN hash, biometric PIN, has_profile, pay_tag, preferred_network, mode.
  Future<void> completeOnboarding() async {
    final enc = state.encryptedPrivateKey;
    final addr = state.walletAddress;
    final pin = state.pin;
    final tag = state.moniTag.trim();
    final mode = state.selectedMode;

    if (enc != null && enc.isNotEmpty && addr != null && addr.isNotEmpty && pin.length == 4 && tag.isNotEmpty && mode != null) {
      final pinHash = await compute(_hashPinInIsolate, [pin]);
      await secureStorage.write(key: 'monipay_encrypted_private_key', value: enc);
      await secureStorage.write(key: 'monipay_wallet_address', value: addr);
      await secureStorage.write(key: 'monipay_pin_hash', value: pinHash);
      await secureStorage.write(key: 'monipay_biometric_pin', value: pin);
      await secureStorage.write(key: 'monipay_pay_tag', value: tag.toLowerCase());
      await secureStorage.write(key: 'monipay_preferred_network', value: 'base');
      await secureStorage.write(key: 'monipay_mode', value: mode);
      if (state.profileId != null) {
        await secureStorage.write(key: 'monipay_profile_id', value: state.profileId!);
      }
    }
    await secureStorage.write(key: kMonipayHasProfileKey, value: '1');
    state = state.copyWith(generatedPrivateKey: null);
  }
}

// Provider
final onboardingControllerProvider =
    StateNotifierProvider<OnboardingController, OnboardingState>((ref) {
  final walletService = WalletService();
  final secureStorage = ref.watch(secureStorageServiceProvider);
  final paytagRepo = ref.watch(paytagRepositoryProvider);
  return OnboardingController(
    walletService: walletService,
    secureStorage: secureStorage,
    paytagRepository: paytagRepo,
  );
});
