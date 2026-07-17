import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Stub implementation when reown_appkit is not available (requires Dart 3.4+).
/// Replace with real WalletConnect (reown_appkit) when upgrading SDK.
class WalletConnectService {
  static final WalletConnectService _instance = WalletConnectService._();
  factory WalletConnectService() => _instance;

  WalletConnectService._();

  Future<void> init() async {
    // No-op; reown_appkit would be initialized here.
  }

  /// Opens connect modal. Returns connected address or null.
  /// Stub: always returns null (WalletConnect requires Dart 3.4+).
  Future<String?> connectWallet(BuildContext context) async {
    return null;
  }

  void disconnect() {}

  String? get connectedAddress => null;

  bool get isConnected => false;

  /// Sends ERC-20/ETH transaction via connected wallet.
  /// Stub: throws UnimplementedError.
  Future<String> sendTransaction({
    required String to,
    required String data,
    required BigInt value,
    required int chainId,
  }) async {
    throw UnimplementedError(
      'WalletConnect requires reown_appkit (Dart 3.4+). Use Direct Deposit or upgrade SDK.',
    );
  }

  /// Asks wallet to switch chain. Stub: throws UnimplementedError.
  Future<void> switchChain(int chainId) async {
    throw UnimplementedError(
      'WalletConnect requires reown_appkit (Dart 3.4+).',
    );
  }
}

final walletConnectServiceProvider = Provider<WalletConnectService>((ref) {
  return WalletConnectService();
});
