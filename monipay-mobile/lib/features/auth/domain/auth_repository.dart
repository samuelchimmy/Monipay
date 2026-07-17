// TODO: Add PayTag and Supabase auth integration.

/// Placeholder auth user model.
class AuthUser {
  const AuthUser({required this.id, this.email, this.payTag});
  final String id;
  final String? email;
  final String? payTag;
}

/// Contract for auth operations (Supabase, session, PayTag).
abstract class AuthRepository {
  Stream<AuthUser?> get authStateChanges;
  AuthUser? get currentUser;
  Future<void> signOut();
  // TODO: signIn, signUp, link PayTag.
}
