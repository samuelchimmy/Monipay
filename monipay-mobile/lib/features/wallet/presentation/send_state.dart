/// Send sheet UI and submission state.
class SendState {
  const SendState({
    this.recipientMoniTag = '',
    this.amount = '',
    this.isProcessing = false,
    this.errorMessage,
    this.successAmount,
    this.successTag,
  });

  final String recipientMoniTag;
  final String amount;
  final bool isProcessing;
  final String? errorMessage;
  final double? successAmount;
  final String? successTag;

  SendState copyWith({
    String? recipientMoniTag,
    String? amount,
    bool? isProcessing,
    String? errorMessage,
    double? successAmount,
    String? successTag,
  }) {
    return SendState(
      recipientMoniTag: recipientMoniTag ?? this.recipientMoniTag,
      amount: amount ?? this.amount,
      isProcessing: isProcessing ?? this.isProcessing,
      errorMessage: errorMessage ?? this.errorMessage,
      successAmount: successAmount ?? this.successAmount,
      successTag: successTag ?? this.successTag,
    );
  }

  SendState clearSuccess() => copyWith(successAmount: null, successTag: null);
}
