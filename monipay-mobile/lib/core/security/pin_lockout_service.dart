import 'dart:convert';

import 'secure_storage_service.dart';

const String _kLockoutKey = 'monipay_pin_lockout';

/// Lockout durations in ms: 1m, 5m, 15m, 1h. Reference: pinLockout.ts LOCKOUT_DURATIONS_MS.
const List<int> _lockoutDurationsMs = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
];
const int maxAttempts = 5;
const int _lockoutResetAfterMs = 24 * 60 * 60 * 1000;

/// PIN lockout state stored in secure storage as JSON.
class PinLockoutState {
  const PinLockoutState({
    this.failedAttempts = 0,
    this.lockedUntil,
    this.lastAttemptTime,
    this.consecutiveLockouts = 0,
  });

  final int failedAttempts;
  final int? lockedUntil; // ms since epoch
  final int? lastAttemptTime;
  final int consecutiveLockouts;

  Map<String, dynamic> toJson() => {
        'failedAttempts': failedAttempts,
        'lockedUntil': lockedUntil,
        'lastAttemptTime': lastAttemptTime,
        'consecutiveLockouts': consecutiveLockouts,
      };

  static PinLockoutState fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PinLockoutState();
    return PinLockoutState(
      failedAttempts: json['failedAttempts'] as int? ?? 0,
      lockedUntil: json['lockedUntil'] as int?,
      lastAttemptTime: json['lastAttemptTime'] as int?,
      consecutiveLockouts: json['consecutiveLockouts'] as int? ?? 0,
    );
  }
}

/// Result of recording a failed attempt.
class RecordFailedResult {
  const RecordFailedResult({
    required this.isNowLocked,
    required this.lockoutSeconds,
    this.attemptsRemaining = 0,
  });

  final bool isNowLocked;
  final int lockoutSeconds;
  /// When !isNowLocked, number of attempts left before lockout.
  final int attemptsRemaining;
}

/// Manages PIN lockout: exponential backoff, persistence in secure storage.
class PinLockoutService {
  PinLockoutService({required SecureStorageService storage}) : _storage = storage;

  final SecureStorageService _storage;

  Future<PinLockoutState> _load() async {
    final raw = await _storage.read(key: _kLockoutKey);
    if (raw == null || raw.isEmpty) return const PinLockoutState();
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>?;
      final s = PinLockoutState.fromJson(json);
      final now = DateTime.now().millisecondsSinceEpoch;
      if (s.lastAttemptTime != null && (now - s.lastAttemptTime!) > _lockoutResetAfterMs) {
        return const PinLockoutState();
      }
      return s;
    } catch (_) {
      return const PinLockoutState();
    }
  }

  Future<void> _save(PinLockoutState s) async {
    await _storage.write(key: _kLockoutKey, value: jsonEncode(s.toJson()));
  }

  int _getLockoutDurationMs(int consecutiveLockouts) {
    final index = consecutiveLockouts.clamp(0, _lockoutDurationsMs.length - 1);
    return _lockoutDurationsMs[index];
  }

  /// Returns current lockout state. If lockedUntil has passed, reset failedAttempts and lockedUntil but keep consecutiveLockouts/lastAttemptTime.
  Future<({bool isLockedOut, int remainingSeconds})> isLockedOut() async {
    var s = await _load();
    final now = DateTime.now().millisecondsSinceEpoch;

    if (s.lockedUntil != null && now >= s.lockedUntil!) {
      s = PinLockoutState(
        failedAttempts: 0,
        lockedUntil: null,
        lastAttemptTime: s.lastAttemptTime,
        consecutiveLockouts: s.consecutiveLockouts,
      );
      await _save(s);
    }

    if (s.lockedUntil == null || s.lockedUntil! <= now) {
      return (isLockedOut: false, remainingSeconds: 0);
    }

    final remainingMs = s.lockedUntil! - now;
    final remainingSeconds = (remainingMs / 1000).ceil().clamp(0, 9999);
    return (isLockedOut: true, remainingSeconds: remainingSeconds);
  }

  /// Records a failed attempt. On lockout: save newAttempts (not 0), increment consecutiveLockouts, set lockedUntil.
  Future<RecordFailedResult> recordFailedAttempt() async {
    final s = await _load();
    final now = DateTime.now().millisecondsSinceEpoch;
    final newAttempts = s.failedAttempts + 1;

    if (newAttempts >= maxAttempts) {
      final newConsecutive = s.consecutiveLockouts + 1;
      final durationMs = _getLockoutDurationMs(newConsecutive - 1);
      final lockedUntil = now + durationMs;
      await _save(PinLockoutState(
        failedAttempts: newAttempts,
        lockedUntil: lockedUntil,
        lastAttemptTime: now,
        consecutiveLockouts: newConsecutive,
      ));
      return RecordFailedResult(
        isNowLocked: true,
        lockoutSeconds: (durationMs / 1000).ceil(),
        attemptsRemaining: 0,
      );
    }

    await _save(PinLockoutState(
      failedAttempts: newAttempts,
      lockedUntil: s.lockedUntil,
      lastAttemptTime: now,
      consecutiveLockouts: s.consecutiveLockouts,
    ));
    return RecordFailedResult(
      isNowLocked: false,
      lockoutSeconds: 0,
      attemptsRemaining: maxAttempts - newAttempts,
    );
  }

  /// Full reset: failedAttempts 0, lockedUntil null, lastAttemptTime 0, consecutiveLockouts 0.
  Future<void> resetLockout() async {
    await _save(const PinLockoutState(
      failedAttempts: 0,
      lockedUntil: null,
      lastAttemptTime: 0,
      consecutiveLockouts: 0,
    ));
  }
}
