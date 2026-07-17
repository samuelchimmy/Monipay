import '../domain/transfer_repository.dart';

/// TODO: Inject web3dart/Supabase; implement [TransferRepository] and PayTag resolution.
class TransferRepositoryImpl implements TransferRepository {
  @override
  Future<Transfer?> send({
    required String fromUserId,
    required String toPayTagOrAddress,
    required String amount,
    required String chainId,
    String? asset,
  }) async => null;

  @override
  Future<Transfer?> getTransfer(String transferId) async => null;
}
