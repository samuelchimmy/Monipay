import 'dart:math' show pow;

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/chain_configs.dart';
import '../../../../core/services/payment_relay_service.dart';
import '../../auth/presentation/lock_controller.dart';
import 'dashboard_controller.dart';
import 'send_state.dart';

const double _feePercent = 0.01;
const int _deadlineSeconds = 3600;

/// Send sheet state and submit logic.
class SendController extends StateNotifier<SendState> {
  SendController({
    required this.dashboardController,
    required this.getPrivateKey,
  }) : super(const SendState());

  final DashboardController dashboardController;
  final String? Function() getPrivateKey;

  void setRecipientMoniTag(String value) {
    state = state.copyWith(
      recipientMoniTag: value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), ''),
      errorMessage: null,
    );
  }

  void setAmount(String value) {
    final filtered = value.replaceAll(RegExp(r'[^0-9.]'), '');
    state = state.copyWith(amount: filtered, errorMessage: null);
  }

  void clearError() => state = state.copyWith(errorMessage: null);

  void clearSuccess() => state = state.clearSuccess();

  void setSuccessForOverlay({
    required double amount,
    required String tag,
  }) {
    state = state.copyWith(successAmount: amount, successTag: tag);
  }

  double? get amountValue => double.tryParse(state.amount);

  double get feeAmount => (amountValue ?? 0) * _feePercent;

  double get recipientReceives => (amountValue ?? 0) - feeAmount;

  double get totalAmount => amountValue ?? 0;

  String get currencyLabel {
    final config = getChainConfig(dashboardController.state.preferredNetwork);
    return config.currency;
  }

  /// Validate and submit. On insufficient funds: return shortfall so caller can open Fund sheet.
  Future<double?> submit({
    required void Function() onClose,
    required void Function(double shortfall) onInsufficientFunds,
    required void Function() onSuccessShowOverlay,
    required void Function() onRefreshDashboard,
  }) async {
    final tag = state.recipientMoniTag.trim();
    if (tag.isEmpty) {
      state = state.copyWith(errorMessage: 'Enter recipient moniTag');
      return null;
    }
    final amount = amountValue;
    if (amount == null || amount <= 0) {
      state = state.copyWith(errorMessage: 'Enter a valid amount');
      return null;
    }
    final total = totalAmount;
    final balance = dashboardController.state.balance;
    if (total > balance) {
      final shortfall = total - balance;
      onClose();
      onInsufficientFunds(shortfall);
      return shortfall;
    }

    state = state.copyWith(isProcessing: true, errorMessage: null);
    final anonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';
    if (anonKey.isEmpty) {
      state = state.copyWith(isProcessing: false, errorMessage: 'Missing Supabase key');
      return null;
    }

    final privateKey = getPrivateKey();
    if (privateKey == null || privateKey.isEmpty) {
      state = state.copyWith(isProcessing: false, errorMessage: 'Wallet locked');
      return null;
    }

    final fromAddress = dashboardController.state.walletAddress;
    final senderProfileId = dashboardController.state.profileId;
    if (fromAddress == null || fromAddress.isEmpty) {
      state = state.copyWith(isProcessing: false, errorMessage: 'No wallet address');
      return null;
    }
    if (senderProfileId == null || senderProfileId.isEmpty) {
      state = state.copyWith(isProcessing: false, errorMessage: 'Missing profile id');
      return null;
    }

    final network = dashboardController.state.preferredNetwork.toLowerCase();

    try {
      final toAddress = await lookupPayTag(tag, anonKey);
      if (toAddress == null || toAddress.isEmpty) {
        state = state.copyWith(isProcessing: false, errorMessage: 'Recipient not found');
        return null;
      }

      final nonce = await getPaymentNonce(fromAddress, network, anonKey);

      final config = getChainConfig(network);
      final decimals = config.decimals;
      final scale = pow(10, decimals).toDouble();
      final recipientWei = BigInt.from((recipientReceives * scale).round());
      final feeWei = BigInt.from((feeAmount * scale).round());
      final deadline = BigInt.from(DateTime.now().millisecondsSinceEpoch ~/ 1000 + _deadlineSeconds);
      final requiredAllowance = recipientWei + feeWei;
      final allowance = await getAllowance(
        network: network,
        owner: fromAddress,
      );
      if (allowance < requiredAllowance) {
        state = state.copyWith(
          isProcessing: false,
          errorMessage: 'Wallet not activated',
        );
        return null;
      }

      final signature = signPaymentAuthorization(
        privateKeyHex: privateKey,
        from: fromAddress,
        to: toAddress,
        amount: recipientWei,
        fee: feeWei,
        nonce: nonce,
        deadline: deadline,
        network: network,
      );

      // Relay expects message fields as strings (FIX 6).
      final message = {
        'from': fromAddress,
        'to': toAddress,
        'amount': recipientWei.toString(),
        'fee': feeWei.toString(),
        'nonce': nonce.toString(),
        'deadline': deadline.toString(),
      };

      final result = await relayPayment(
        signature: signature,
        message: message,
        senderProfileId: senderProfileId,
        recipientPayTag: tag,
        network: network,
        supabaseAnonKey: anonKey,
      );

      if (result == null || result['success'] != true) {
        state = state.copyWith(
          isProcessing: false,
          errorMessage: (result?['error']?.toString() ?? 'Payment failed'),
        );
        return null;
      }

      dashboardController.applySentTransaction(amount: amount, counterparty: tag);
      state = state.copyWith(
        isProcessing: false,
        successAmount: amount,
        successTag: tag,
      );
      onClose();
      onSuccessShowOverlay();
      await dashboardController.syncTransactions();
      await dashboardController.refreshBalance();
      onRefreshDashboard();
      return null;
    } catch (e) {
      state = state.copyWith(
        isProcessing: false,
        errorMessage: e.toString().replaceFirst(RegExp(r'^Exception:?\s*'), ''),
      );
      return null;
    }
  }
}

final sendControllerProvider = StateNotifierProvider<SendController, SendState>((ref) {
  final dashboard = ref.watch(dashboardControllerProvider.notifier);
  return SendController(
    dashboardController: dashboard,
    getPrivateKey: () => ref.read(decryptedPrivateKeyProvider),
  );
});
