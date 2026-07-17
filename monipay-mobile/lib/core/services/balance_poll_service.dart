import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/chain_configs.dart';
import '../security/secure_storage_service.dart';

/// Fetches token balance via direct JSON-RPC, with endpoint failover + cache.
class BalancePollService {
  static final Dio _dio = Dio();
  static const _skipFailedFor = Duration(seconds: 60);
  static const _rpcTimeout = Duration(seconds: 5);
  static final Map<String, DateTime> _failedUntilByEndpoint = {};

  static String cacheKey(String network, String address) =>
      'monipay_balance_cache_${network.toLowerCase()}_${address.toLowerCase()}';

  static bool _isEndpointSkipped(String endpoint) {
    final until = _failedUntilByEndpoint[endpoint];
    if (until == null) return false;
    if (DateTime.now().isAfter(until)) {
      _failedUntilByEndpoint.remove(endpoint);
      return false;
    }
    return true;
  }

  static void _markEndpointFailed(String endpoint) {
    _failedUntilByEndpoint[endpoint] = DateTime.now().add(_skipFailedFor);
  }

  /// Returns cached balance if present, then refreshes live balance in background.
  static Future<double?> getCachedBalance({
    required SecureStorageService storage,
    required String network,
    required String address,
  }) async {
    final raw = await storage.read(key: cacheKey(network, address));
    return raw == null ? null : double.tryParse(raw);
  }

  static Future<void> cacheBalance({
    required SecureStorageService storage,
    required String network,
    required String address,
    required double balance,
  }) async {
    await storage.write(key: cacheKey(network, address), value: balance.toString());
  }

  /// Returns token balance as human-readable amount (USDC/USDT units).
  static Future<double> getBalance({
    required String network,
    required String address,
  }) async {
    final n = network.toLowerCase();
    if (address.isEmpty) return 0;
    if (n == 'solana') {
      return _getSolanaBalance(address);
    }
    return _getEvmBalance(network: n, address: address);
  }

  static Future<double> _getEvmBalance({
    required String network,
    required String address,
  }) async {
    final config = getChainConfig(network);
    final cleaned = address.replaceFirst(RegExp(r'^0x', caseSensitive: false), '');
    if (cleaned.length != 40) return 0;

    // balanceOf(address) selector + left-padded 32-byte address
    final data = '0x70a08231${cleaned.padLeft(64, '0')}';
    final body = {
      'jsonrpc': '2.0',
      'method': 'eth_call',
      'params': [
        {'to': config.token, 'data': data},
        'latest',
      ],
      'id': 1,
    };

    for (final endpoint in config.rpcUrls) {
      if (_isEndpointSkipped(endpoint)) continue;
      try {
        final res = await _dio
            .post<Map<String, dynamic>>(
              endpoint,
              data: body,
              options: Options(
                responseType: ResponseType.json,
                sendTimeout: _rpcTimeout,
                receiveTimeout: _rpcTimeout,
              ),
            )
            .timeout(_rpcTimeout);

        debugPrint('Balance RPC [$network] $endpoint raw: ${res.data}');
        final result = res.data?['result'] as String?;
        if (result == null || result == '0x') return 0;
        final value = BigInt.parse(
          result.replaceFirst(RegExp(r'^0x', caseSensitive: false), ''),
          radix: 16,
        );
        final scale = BigInt.from(10).pow(config.decimals).toDouble();
        return value.toDouble() / scale;
      } catch (_) {
        _markEndpointFailed(endpoint);
      }
    }
    return 0;
  }

  static Future<double> _getSolanaBalance(String address) async {
    const solanaUsdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const endpoint = 'https://api.mainnet-beta.solana.com';
    if (_isEndpointSkipped(endpoint)) return 0;

    final body = {
      'jsonrpc': '2.0',
      'id': 1,
      'method': 'getTokenAccountsByOwner',
      'params': [
        address,
        {'mint': solanaUsdcMint},
        {'encoding': 'jsonParsed'},
      ],
    };
    try {
      final res = await _dio
          .post<Map<String, dynamic>>(
            endpoint,
            data: body,
            options: Options(
              responseType: ResponseType.json,
              sendTimeout: _rpcTimeout,
              receiveTimeout: _rpcTimeout,
            ),
          )
          .timeout(_rpcTimeout);
      debugPrint('Balance RPC [solana] $endpoint raw: ${res.data}');

      final accounts = res.data?['result']?['value'] as List<dynamic>?;
      if (accounts == null || accounts.isEmpty) return 0;
      final amount = accounts.first['account']?['data']?['parsed']?['info']?['tokenAmount']?['uiAmount'];
      return amount is num ? amount.toDouble() : 0;
    } catch (_) {
      _markEndpointFailed(endpoint);
      return 0;
    }
  }
}
