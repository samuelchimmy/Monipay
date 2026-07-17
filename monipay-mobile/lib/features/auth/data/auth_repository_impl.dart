import '../domain/auth_repository.dart';

/// Supabase-backed implementation of [AuthRepository].
/// TODO: Inject Supabase client, map Supabase user to [AuthUser], implement authStateChanges, signIn, signUp, PayTag linking.
class SupabaseAuthRepository implements AuthRepository {
  @override
  Stream<AuthUser?> get authStateChanges => const Stream.empty();

  @override
  AuthUser? get currentUser => null;

  @override
  Future<void> signOut() async {}
}
