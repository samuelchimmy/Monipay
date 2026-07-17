import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/supabase_client_provider.dart';

/// moniTag™ availability and registration (Supabase profiles + check-paytag edge function).
abstract class PaytagRepository {
  /// Returns true if the moniTag is available (not taken). Case-insensitive.
  Future<bool> isMoniTagAvailable(String moniTag);

  /// Register a new profile. Throws on failure or if already taken.
  /// [solanaAddress] optional; include when user has Solana wallet (matches web check-paytag register).
  Future<String> register({
    required String payTag,
    required String walletAddress,
    required String encryptedPrivateKey,
    required String mode,
    String preferredNetwork = 'base',
    String? solanaAddress,
  });
}

class SupabasePaytagRepository implements PaytagRepository {
  SupabasePaytagRepository(this._client);

  final SupabaseClient _client;

  @override
  Future<bool> isMoniTagAvailable(String moniTag) async {
    final normalized = moniTag.trim().toLowerCase();
    if (normalized.isEmpty) return false;
    try {
      final response = await _client.functions.invoke(
        'check-paytag',
        body: {'action': 'check', 'payTag': normalized},
      );
      if (response.status != 200) return false;
      final data = response.data as Map<String, dynamic>?;
      return data?['available'] == true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<String> register({
    required String payTag,
    required String walletAddress,
    required String encryptedPrivateKey,
    required String mode,
    String preferredNetwork = 'base',
    String? solanaAddress,
  }) async {
    final body = <String, dynamic>{
      'action': 'register',
      'payTag': payTag.trim().toLowerCase(),
      'walletAddress': walletAddress.toLowerCase(),
      'encryptedPrivateKey': encryptedPrivateKey,
      'preferredMode': mode,
      'preferredNetwork': preferredNetwork,
    };
    if (solanaAddress != null && solanaAddress.isNotEmpty) {
      body['solanaAddress'] = solanaAddress;
    }
    final response = await _client.functions.invoke(
      'check-paytag',
      body: body,
    );
    if (response.status != 200) {
      final data = response.data as Map<String, dynamic>?;
      final err = data?['error'] as String?;
      throw Exception(err ?? 'Failed to register');
    }
    final data = response.data as Map<String, dynamic>?;
    final profileId = data?['profileId'] as String?;
    if (profileId == null) throw Exception('No profile ID returned');
    return profileId;
  }
}

final paytagRepositoryProvider = Provider<PaytagRepository?>((ref) {
  final client = ref.watch(supabaseClientProvider);
  if (client == null) return null;
  return SupabasePaytagRepository(client);
});
