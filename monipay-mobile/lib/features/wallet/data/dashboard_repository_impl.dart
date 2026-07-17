import 'dart:async';
import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/services/balance_poll_service.dart';
import '../presentation/dashboard_state.dart';
import 'dashboard_repository.dart';

const _kWalletAddressKey = 'monipay_wallet_address';
const _kProfileIdKey = 'monipay_profile_id';

/// Loads profile from secure storage + Supabase; transactions via relay-payment history.
class DashboardRepositoryImpl implements DashboardRepository {
  DashboardRepositoryImpl({
    required this.secureStorage,
    this.supabase,
  });

  final SecureStorageService secureStorage;
  final SupabaseClient? supabase;

  static List<Map<String, dynamic>>? _normalizeItems(dynamic raw) {
    if (raw == null) return null;
    if (raw is List) {
      return raw.map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}).toList();
    }
    if (raw is String) {
      try {
        final p = jsonDecode(raw);
        if (p is List) return p.map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}).toList();
        if (p is Map && p['items'] is List) return (p['items'] as List).map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}).toList();
      } catch (_) {}
    }
    if (raw is Map && raw['items'] is List) {
      return (raw['items'] as List).map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}).toList();
    }
    return null;
  }

  static String? _normalizeSource(dynamic raw) {
    if (raw == null || raw is! String) return null;
    final n = raw.trim().toLowerCase();
    return n.isEmpty ? null : n;
  }

  static Map<String, dynamic>? _normalizeMetadata(dynamic raw) {
    if (raw == null) return null;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    if (raw is String) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }
    return null;
  }

  @override
  Future<DashboardProfile?> loadProfile() async {
    final address = await secureStorage.read(key: _kWalletAddressKey);
    if (address == null || address.isEmpty) return null;

    final client = supabase;
    if (client != null) {
      try {
        final res = await client
            .from('profiles')
            .select()
            .eq('wallet_address', address.toLowerCase())
            .maybeSingle();
        if (res != null) {
          final map = Map<String, dynamic>.from(res);
          final id = map['id'] as String?;
          final payTag = map['pay_tag'] as String?;
          final preferredNetwork = (map['preferred_network'] as String?) ?? 'base';
          final solanaAddress = map['solana_address'] as String?;
          if (id != null) {
            await secureStorage.write(key: _kProfileIdKey, value: id);
          }
          // Persist payTag locally so it is available without network (returning users)
          if (payTag != null && payTag.isNotEmpty) {
            await secureStorage.write(key: 'monipay_pay_tag', value: payTag);
          }
          final balance = await fetchBalance(
            network: preferredNetwork,
            walletAddress: address,
            solanaAddress: solanaAddress,
          );
          return DashboardProfile(
            id: id,
            payTag: payTag,
            walletAddress: address,
            solanaAddress: solanaAddress,
            balance: balance,
            transactions: [],
            preferredNetwork: preferredNetwork,
          );
        }
      } catch (_) {
        // Fall through to minimal profile
      }
    }

    final storedProfileId = await secureStorage.read(key: _kProfileIdKey);
    final preferredNetwork = await secureStorage.read(key: 'monipay_preferred_network') ?? 'base';
    final payTag = await secureStorage.read(key: 'monipay_pay_tag');
    final balance = await fetchBalance(
      network: preferredNetwork,
      walletAddress: address,
      solanaAddress: null,
    );
    return DashboardProfile(
      id: storedProfileId,
      payTag: payTag,
      walletAddress: address,
      solanaAddress: null,
      balance: balance,
      transactions: [],
      preferredNetwork: preferredNetwork,
    );
  }

  @override
  Future<double> fetchBalance({
    required String network,
    required String walletAddress,
    String? solanaAddress,
  }) async {
    final n = network.toLowerCase();
    final effectiveAddress = n == 'solana' ? (solanaAddress ?? '') : walletAddress;
    if (effectiveAddress.isEmpty) return 0;

    final cached = await BalancePollService.getCachedBalance(
      storage: secureStorage,
      network: n,
      address: effectiveAddress,
    );
    if (cached != null) {
      // Refresh in the background so UI can show cached value immediately.
      unawaited(
        BalancePollService.getBalance(network: n, address: effectiveAddress).then(
          (fresh) => BalancePollService.cacheBalance(
            storage: secureStorage,
            network: n,
            address: effectiveAddress,
            balance: fresh,
          ),
        ),
      );
      return cached;
    }

    final fresh = await BalancePollService.getBalance(network: n, address: effectiveAddress);
    await BalancePollService.cacheBalance(
      storage: secureStorage,
      network: n,
      address: effectiveAddress,
      balance: fresh,
    );
    return fresh;
  }

  @override
  Future<List<DashboardTransaction>> syncTransactions({
    required String profileId,
    int limit = 50,
  }) async {
    final result = await loadMoreTransactions(profileId, limit, null);
    return result.transactions;
  }

  @override
  Future<LoadMoreTransactionsResult> loadMoreTransactions(String? profileId, int limit, [String? cursor]) async {
    if (profileId == null || profileId.isEmpty) {
      return const LoadMoreTransactionsResult(transactions: [], hasMore: false);
    }
    final client = supabase;
    if (client == null) {
      return const LoadMoreTransactionsResult(transactions: [], hasMore: false);
    }
    try {
      final body = <String, dynamic>{
        'action': 'history',
        'message': {'profileId': profileId, 'limit': limit},
      };
      if (cursor != null && cursor.isNotEmpty) {
        (body['message'] as Map<String, dynamic>)['cursor'] = cursor;
      }
      final response = await client.functions.invoke('relay-payment', body: body);
      final data = response.data as Map<String, dynamic>?;
      final list = data?['transactions'] as List<dynamic>?;
      final nextCursor = data?['nextCursor'] as String?;
      final hasMore = data?['hasMore'] as bool? ?? false;
      final transactions = <DashboardTransaction>[];
      if (list != null) {
        for (final raw in list) {
          final tx = Map<String, dynamic>.from(raw as Map);
          final id = tx['id'] as String? ?? '';
          final type = (tx['type'] as String?) ?? 'sent';
          final amount = (double.tryParse(tx['amount']?.toString() ?? '') ?? 0.0);
          final fee = (double.tryParse(tx['fee']?.toString() ?? '') ?? 0.0);
          final counterparty = (tx['counterparty'] as String?) ?? '';
          final createdAt = tx['created_at'];
          DateTime timestamp = DateTime.now();
          if (createdAt != null) {
            if (createdAt is String) {
              timestamp = DateTime.tryParse(createdAt) ?? timestamp;
            } else if (createdAt is int) {
              timestamp = DateTime.fromMillisecondsSinceEpoch(createdAt);
            }
          }
          transactions.add(DashboardTransaction(
            id: id,
            type: type,
            counterparty: counterparty,
            amount: amount,
            timestamp: timestamp,
            fee: fee,
            txHash: tx['tx_hash'] as String?,
            items: _normalizeItems(tx['items']),
            invoiceId: tx['invoice_id'] as String?,
            payerPayTag: tx['payer_pay_tag'] as String?,
            source: _normalizeSource(tx['source']),
            metadata: _normalizeMetadata(tx['metadata']),
            status: (tx['status'] as String?) ?? 'completed',
          ));
        }
        transactions.sort((a, b) => b.timestamp.compareTo(a.timestamp));
      }
      return LoadMoreTransactionsResult(
        transactions: transactions,
        nextCursor: nextCursor,
        hasMore: hasMore,
      );
    } catch (_) {
      return const LoadMoreTransactionsResult(transactions: [], hasMore: false);
    }
  }

  @override
  Future<bool> updatePreferredNetwork(String profileId, String walletAddress, String network) async {
    final client = supabase;
    if (client == null) return false;
    try {
      final response = await client.functions.invoke(
        'check-paytag',
        body: {
          'action': 'updatePreferredNetwork',
          'profileId': profileId,
          'walletAddress': walletAddress,
          'preferredNetwork': network.toLowerCase(),
        },
      );
      return response.status == 200;
    } catch (_) {
      return false;
    }
  }
}
