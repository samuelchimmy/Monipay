import 'dart:math' show pow;

import 'package:flutter_dotenv/flutter_dotenv.dart';

import '../../../../core/config/chain_configs.dart';
import '../../../../core/services/payment_relay_service.dart';

const double _feePercent = 0.01;
const int _deadlineSeconds = 3600;

/// Withdraw (relay) result: null = success, non-null = error message.
Future<String?> submitWithdraw({
  required String recipientMoniTagOrAddress,
  required double amount,
  required bool isByAddress,
  required double balance,
  required String? fromAddress,
  required String network,
  required String? Function() getPrivateKey,
  required void Function(double amount, String counterparty) onSuccessApplyTransaction,
}) async {
  final total = amount * (1 + _feePercent);
  if (total > balance) return 'Insufficient funds';

  final anonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';
  if (anonKey.isEmpty) return 'Missing Supabase key';

  final privateKey = getPrivateKey();
  if (privateKey == null || privateKey.isEmpty) return 'Wallet locked';

  if (fromAddress == null || fromAddress.isEmpty) return 'No wallet address';

  final networkLower = network.toLowerCase();
  String toAddress;
  String recipientPayTag;
  String displayCounterparty;

  if (isByAddress) {
    toAddress = recipientMoniTagOrAddress;
    recipientPayTag = recipientMoniTagOrAddress;
    displayCounterparty = toAddress.length >= 12
        ? '${toAddress.substring(0, 6)}...${toAddress.substring(toAddress.length - 4)}'
        : toAddress;
  } else {
    final tag = recipientMoniTagOrAddress.replaceFirst(RegExp(r'^@'), '').trim();
    final addr = await lookupPayTag(tag, anonKey);
    if (addr == null || addr.isEmpty) return 'Recipient not found';
    toAddress = addr;
    recipientPayTag = tag;
    displayCounterparty = tag;
  }

  final nonce = await getPaymentNonce(fromAddress, networkLower, anonKey);

  final config = getChainConfig(networkLower);
  final scale = pow(10, config.decimals).toDouble();
  final feeAmount = amount * _feePercent;
  final amountWei = BigInt.from((amount * scale).round());
  final feeWei = BigInt.from((feeAmount * scale).round());
  final deadline = BigInt.from(DateTime.now().millisecondsSinceEpoch ~/ 1000 + _deadlineSeconds);

  try {
    final signature = signPaymentAuthorization(
      privateKeyHex: privateKey,
      from: fromAddress,
      to: toAddress,
      amount: amountWei,
      fee: feeWei,
      nonce: nonce,
      deadline: deadline,
      network: networkLower,
    );

    final message = {
      'from': fromAddress,
      'to': toAddress,
      'amount': amountWei.toString(),
      'fee': feeWei.toString(),
      'nonce': nonce.toString(),
      'deadline': deadline.toString(),
    };

    final result = await relayPayment(
      signature: signature,
      message: message,
      senderProfileId: fromAddress,
      recipientPayTag: recipientPayTag,
      network: networkLower,
      supabaseAnonKey: anonKey,
    );

    if (result == null) return 'Withdrawal failed';

    onSuccessApplyTransaction(amount, displayCounterparty);
    return null;
  } catch (e) {
    return e.toString().replaceFirst(RegExp(r'^Exception:?\s*'), '');
  }
}
