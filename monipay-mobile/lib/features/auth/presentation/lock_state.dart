/// Lock screen UI state.
class LockState {
  const LockState({
    this.pin = '',
    this.error = false,
    this.errorMessage = '',
    this.isLockedOut = false,
    this.lockoutRemaining = 0,
    this.isBiometricAuth = false,
    this.biometricsAvailable = false,
    this.moniTag,
    this.success = false,
    this.isVerifying = false,
  });

  final String pin;
  final bool error;
  final String errorMessage;
  final bool isLockedOut;
  final int lockoutRemaining;
  final bool isBiometricAuth;
  final bool biometricsAvailable;
  final String? moniTag;
  final bool success;
  /// True while BCrypt + AES-GCM verification is running in the isolate.
  final bool isVerifying;

  LockState copyWith({
    String? pin,
    bool? error,
    String? errorMessage,
    bool? isLockedOut,
    int? lockoutRemaining,
    bool? isBiometricAuth,
    bool? biometricsAvailable,
    String? moniTag,
    bool? success,
    bool? isVerifying,
  }) {
    return LockState(
      pin: pin ?? this.pin,
      error: error ?? this.error,
      errorMessage: errorMessage ?? this.errorMessage,
      isLockedOut: isLockedOut ?? this.isLockedOut,
      lockoutRemaining: lockoutRemaining ?? this.lockoutRemaining,
      isBiometricAuth: isBiometricAuth ?? this.isBiometricAuth,
      biometricsAvailable: biometricsAvailable ?? this.biometricsAvailable,
      moniTag: moniTag ?? this.moniTag,
      success: success ?? this.success,
      isVerifying: isVerifying ?? this.isVerifying,
    );
  }
}
