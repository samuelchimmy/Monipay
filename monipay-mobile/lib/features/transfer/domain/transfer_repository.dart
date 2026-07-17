// TODO: Send/receive USDC/USDT across Base, BSC, Solana; PayTag resolution.

/// Placeholder transfer model.
class Transfer {
  const Transfer({
    required this.id,
    this.amount,
    this.asset,
    this.fromChain,
    this.toChain,
    this.payTag,
  });
  final String id;
  final String? amount;
  final String? asset;
  final String? fromChain;
  final String? toChain;
  final String? payTag;
}

/// Contract for initiating and resolving transfers (web3 + Supabase).
abstract class TransferRepository {
  Future<Transfer?> send({
    required String fromUserId,
    required String toPayTagOrAddress,
    required String amount,
    required String chainId,
    String? asset,
  });
  Future<Transfer?> getTransfer(String transferId);
  // TODO: resolve PayTag to address, multi-chain support.
}
