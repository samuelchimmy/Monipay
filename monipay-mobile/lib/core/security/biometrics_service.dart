import 'package:local_auth/local_auth.dart';

abstract class BiometricsService {
  Future<bool> canCheckBiometrics();

  Future<bool> authenticate({String localizedReason = 'Authenticate to continue'});
}

class LocalAuthBiometricsService implements BiometricsService {
  LocalAuthBiometricsService({LocalAuthentication? localAuth})
      : _localAuth = localAuth ?? LocalAuthentication();

  final LocalAuthentication _localAuth;

  @override
  Future<bool> canCheckBiometrics() {
    return _localAuth.canCheckBiometrics;
  }

  @override
  Future<bool> authenticate({String localizedReason = 'Authenticate to continue'}) async {
    final canCheck = await canCheckBiometrics();
    if (!canCheck) {
      return false;
    }

    return _localAuth.authenticate(
      localizedReason: localizedReason,
      options: const AuthenticationOptions(biometricOnly: true),
    );
  }
}

// Provider for dependency injection (optional; add flutter_riverpod import where used).
// BiometricsService getBiometricsService() => LocalAuthBiometricsService();

