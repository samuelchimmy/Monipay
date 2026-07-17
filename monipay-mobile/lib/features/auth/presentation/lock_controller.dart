import 'dart:async';

import 'package:bcrypt/bcrypt.dart'; // still needed for changePin (hashpw)
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/security/biometrics_service.dart' show BiometricsService, LocalAuthBiometricsService;
import '../../../../core/security/pin_lockout_service.dart';
import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/security/wallet_service.dart'
    show WalletService, verifyAndDecryptInIsolate, decryptPrivateKeyInIsolate;
import 'lock_state.dart';
import 'splash_screen.dart' show secureStorageServiceProvider;

const String _kPinHashKey = 'monipay_pin_hash';
const String _kEncryptedKey = 'monipay_encrypted_private_key';
const String _kEncryptedKeyLegacy = 'monipay_encrypted_key';

const String _kBiometricEnabledKey = 'monipay_biometric_enabled';
const String _kBiometricPinKey = 'monipay_biometric_pin';

/// In-memory decrypted private key (hex). Set on unlock, cleared on lock.
final decryptedPrivateKeyProvider = StateProvider<String?>((ref) => null);

final pinLockoutServiceProvider = Provider<PinLockoutService>((ref) {
  final storage = ref.watch(secureStorageServiceProvider);
  return PinLockoutService(storage: storage);
});

/// Lock screen state and actions.
class LockController extends StateNotifier<LockState> {
  LockController({
    required this.secureStorage,
    required this.pinLockout,
    required this.walletService,
    required this.biometricsService,
  }) : super(const LockState()) {
    _init();
  }

  final SecureStorageService secureStorage;
  final PinLockoutService pinLockout;
  final WalletService walletService;
  final BiometricsService biometricsService;

  Timer? _countdownTimer;

  // Pre-cached to eliminate storage I/O on PIN submission.
  String? _cachedPinHash;
  String? _cachedEncryptedKey;

  Future<void> _init() async {
    // Pre-cache critical keys so PIN submission has zero storage I/O.
    _cachedPinHash     = await secureStorage.read(key: _kPinHashKey);
    _cachedEncryptedKey = await secureStorage.read(key: _kEncryptedKey) ??
        await secureStorage.read(key: _kEncryptedKeyLegacy);

    final locked    = await pinLockout.isLockedOut();
    final bioEnabled = await secureStorage.read(key: _kBiometricEnabledKey) == 'true';
    final canBio    = await biometricsService.canCheckBiometrics();
    final moniTag   = await _getMoniTag();

    state = state.copyWith(
      isLockedOut: locked.isLockedOut,
      lockoutRemaining: locked.remainingSeconds,
      biometricsAvailable: bioEnabled && canBio,
      moniTag: moniTag,
    );

    if (locked.isLockedOut) {
      _startCountdown();
    }
  }

  Future<String?> _getMoniTag() async {
    final tag = await secureStorage.read(key: 'monipay_pay_tag');
    if (tag == null || tag.trim().isEmpty) return null;
    return tag.trim().toLowerCase();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    void tick() async {
      final locked = await pinLockout.isLockedOut();
      if (!locked.isLockedOut) {
        _countdownTimer?.cancel();
        state = state.copyWith(isLockedOut: false, lockoutRemaining: 0);
        return;
      }
      state = state.copyWith(lockoutRemaining: locked.remainingSeconds);
    }

    tick();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => tick());
  }

  void cancelCountdown() {
    _countdownTimer?.cancel();
  }

  void addDigit(String digit) {
    if (state.pin.length >= 4 || state.error || state.isLockedOut) return;
    state = state.copyWith(pin: state.pin + digit, error: false, errorMessage: '');
  }

  void deleteDigit() {
    if (state.pin.isEmpty) return;
    state = state.copyWith(pin: state.pin.substring(0, state.pin.length - 1), error: false, errorMessage: '');
  }

  void clearError() {
    state = state.copyWith(error: false, errorMessage: '');
  }

  void setSuccessAndNavigate(void Function() onNavigate) {
    state = state.copyWith(success: true);
    onNavigate();
  }

  /// Verify PIN and unlock — BCrypt check + AES-GCM decrypt run in a single
  /// background isolate so the UI thread is never blocked.
  Future<bool> verifyPinAndUnlock(String pin, void Function(String? decryptedKey) onSuccess) async {
    if (pin.length != 4) return false;

    // Show verifying indicator immediately so UI feels responsive.
    state = state.copyWith(isVerifying: true);

    final hash      = _cachedPinHash      ?? await secureStorage.read(key: _kPinHashKey);
    final encrypted = _cachedEncryptedKey ??
        await secureStorage.read(key: _kEncryptedKey) ??
        await secureStorage.read(key: _kEncryptedKeyLegacy);

    bool verified = false;
    String? decrypted;

    if (hash != null && hash.isNotEmpty && encrypted != null && encrypted.isNotEmpty) {
      try {
        // Single isolate: BCrypt verify + PBKDF2+AES decrypt — avoids two round-trips.
        final result = await compute(verifyAndDecryptInIsolate, [pin, hash, encrypted]);
        verified  = result[0] as bool;
        decrypted = result[1] as String?;
      } catch (_) {
        verified = false;
      }
    }

    // Legacy fallback: no bcrypt hash stored yet (first install, old format).
    if (!verified && encrypted != null && encrypted.isNotEmpty) {
      try {
        decrypted = await compute(decryptPrivateKeyInIsolate, [encrypted, pin]);
        verified  = true;
      } catch (_) {
        verified = false;
      }
    }

    if (!verified) {
      final result = await pinLockout.recordFailedAttempt();
      state = state.copyWith(
        pin: '',
        error: true,
        isVerifying: false,
        errorMessage: result.isNowLocked
            ? 'Too many attempts. Try again in ${result.lockoutSeconds}s'
            : 'Incorrect PIN. ${result.attemptsRemaining} attempts left',
        isLockedOut: result.isNowLocked,
        lockoutRemaining: result.lockoutSeconds,
      );
      if (result.isNowLocked) _startCountdown();
      return false;
    }

    await pinLockout.resetLockout();
    state = state.copyWith(pin: '', success: true, isVerifying: false);
    onSuccess(decrypted);
    return true;
  }

  /// Verify PIN and return the decrypted private key — used by on-chain signing
  /// flows (e.g. MoniBot allowance approval) without navigating away.
  Future<String?> verifyAndDecryptForSigning(String pin) async {
    if (pin.length != 4) return null;
    final hash      = _cachedPinHash      ?? await secureStorage.read(key: _kPinHashKey);
    final encrypted = _cachedEncryptedKey ??
        await secureStorage.read(key: _kEncryptedKey) ??
        await secureStorage.read(key: _kEncryptedKeyLegacy);
    if (hash == null || hash.isEmpty || encrypted == null || encrypted.isEmpty) return null;
    try {
      final result = await compute(verifyAndDecryptInIsolate, [pin, hash, encrypted]);
      if (result[0] as bool) return result[1] as String?;
    } catch (_) {}
    return null;
  }

  /// Verify PIN only (for Settings). Does not unlock or update decrypted key. Returns true if PIN is correct.
  Future<bool> verifyPinForSettings(String pin) async {
    if (pin.length != 4) return false;
    final hash      = _cachedPinHash      ?? await secureStorage.read(key: _kPinHashKey);
    final encrypted = _cachedEncryptedKey ??
        await secureStorage.read(key: _kEncryptedKey) ??
        await secureStorage.read(key: _kEncryptedKeyLegacy);
    bool verified = false;
    if (hash != null && hash.isNotEmpty && encrypted != null && encrypted.isNotEmpty) {
      try {
        final result = await compute(verifyAndDecryptInIsolate, [pin, hash, encrypted]);
        verified = result[0] as bool;
      } catch (_) {}
    }
    if (!verified && encrypted != null && encrypted.isNotEmpty) {
      try {
        await compute(decryptPrivateKeyInIsolate, [encrypted, pin]);
        verified = true;
      } catch (_) {}
    }
    if (!verified) {
      final result = await pinLockout.recordFailedAttempt();
      state = state.copyWith(
        error: true,
        errorMessage: result.isNowLocked
            ? 'Too many attempts. Try again in ${result.lockoutSeconds}s'
            : 'Incorrect PIN. ${result.attemptsRemaining} attempts left',
        isLockedOut: result.isNowLocked,
        lockoutRemaining: result.lockoutSeconds,
      );
      if (result.isNowLocked) _startCountdown();
      return false;
    }
    return true;
  }

  /// Update PIN to new value. Caller must have verified current PIN (e.g. via verifyPinForSettings).
  Future<void> changePin(String newPin) async {
    if (newPin.length != 4) return;
    final hash = BCrypt.hashpw(newPin, BCrypt.gensalt());
    await secureStorage.write(key: _kPinHashKey, value: hash);
    await secureStorage.write(key: _kBiometricPinKey, value: newPin);
  }

  /// Enable biometrics: store PIN for biometric unlock. Call after verifyPinForSettings(pin) returns true.
  Future<void> enableBiometricsWithPin(String pin) async {
    await secureStorage.write(key: _kBiometricPinKey, value: pin);
    await secureStorage.write(key: _kBiometricEnabledKey, value: 'true');
    final canBio = await biometricsService.canCheckBiometrics();
    state = state.copyWith(biometricsAvailable: canBio);
  }

  /// Disable biometrics.
  Future<void> disableBiometrics() async {
    await secureStorage.delete(key: _kBiometricPinKey);
    await secureStorage.delete(key: _kBiometricEnabledKey);
    state = state.copyWith(biometricsAvailable: false);
  }

  /// Trigger biometric auth. On success use stored PIN to verify and unlock, then call onSuccess(decryptedKey).
  Future<void> authenticateWithBiometrics(void Function(String? key) onSuccess) async {
    if (!state.biometricsAvailable || state.isLockedOut || state.isBiometricAuth) return;

    state = state.copyWith(isBiometricAuth: true);
    try {
      final ok = await biometricsService.authenticate(localizedReason: 'Unlock Monipay');
      if (!ok) {
        state = state.copyWith(isBiometricAuth: false);
        return;
      }
      final rawPin = await secureStorage.read(key: _kBiometricPinKey);
      if (rawPin == null || rawPin.isEmpty) {
        state = state.copyWith(isBiometricAuth: false);
        return;
      }
      await verifyPinAndUnlock(rawPin, onSuccess);
    } finally {
      state = state.copyWith(isBiometricAuth: false);
    }
  }
}

final walletServiceProvider = Provider<WalletService>((ref) => WalletService());

final biometricsServiceProvider = Provider<BiometricsService>((ref) => LocalAuthBiometricsService());

final lockControllerProvider =
    StateNotifierProvider<LockController, LockState>((ref) {
  final storage = ref.watch(secureStorageServiceProvider);
  final pinLockout = ref.watch(pinLockoutServiceProvider);
  final wallet = ref.watch(walletServiceProvider);
  final bio = ref.watch(biometricsServiceProvider);
  return LockController(
    secureStorage: storage,
    pinLockout: pinLockout,
    walletService: wallet,
    biometricsService: bio,
  );
});
