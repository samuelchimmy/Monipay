/// State for the full onboarding flow (landing, create 5 steps, import 2 steps).
/// Kept in a separate file for clarity; used by [OnboardingController].
class OnboardingState {
  OnboardingState({
    this.flow = 'create',
    this.showSteps = false,
    this.step = 1,
    this.moniTag = '',
    this.pin = '',
    this.confirmPin = '',
    this.privateKeyInput = '',
    this.selectedMode,
    this.generatedPrivateKey,
    this.generatedAddress,
    this.encryptedPrivateKey,
    this.walletAddress,
    this.profileId,
    this.hasBackedUp = false,
    this.cloudBackupSuccess = false,
    this.isCheckingTag = false,
    this.tagError,
    this.importError,
    this.isCreating = false,
    this.isImporting = false,
    this.showPrivateKey = false,
    this.hasCopiedKey = false,
    this.isRequestingFunds = false,
    this.hasFunds = false,
    this.activationError,
    this.isActivated = false,
  });

  final String flow;
  final bool showSteps;
  final int step;
  final String moniTag;
  final String pin;
  final String confirmPin;
  final String privateKeyInput;
  final String? selectedMode;
  final String? generatedPrivateKey;
  final String? generatedAddress;
  final String? encryptedPrivateKey;
  final String? walletAddress;
  final String? profileId;
  final bool hasBackedUp;
  final bool cloudBackupSuccess;
  final bool isCheckingTag;
  final String? tagError;
  final String? importError;
  final bool isCreating;
  final bool isImporting;
  final bool showPrivateKey;
  final bool hasCopiedKey;
  final bool isRequestingFunds;
  final bool hasFunds;
  final String? activationError;
  final bool isActivated;

  OnboardingState copyWith({
    String? flow,
    bool? showSteps,
    int? step,
    String? moniTag,
    String? pin,
    String? confirmPin,
    String? privateKeyInput,
    String? selectedMode,
    String? generatedPrivateKey,
    String? generatedAddress,
    String? encryptedPrivateKey,
    String? walletAddress,
    String? profileId,
    bool? hasBackedUp,
    bool? cloudBackupSuccess,
    bool? isCheckingTag,
    String? tagError,
    String? importError,
    bool? isCreating,
    bool? isImporting,
    bool? showPrivateKey,
    bool? hasCopiedKey,
    bool? isRequestingFunds,
    bool? hasFunds,
    String? activationError,
    bool? isActivated,
  }) {
    return OnboardingState(
      flow: flow ?? this.flow,
      showSteps: showSteps ?? this.showSteps,
      step: step ?? this.step,
      moniTag: moniTag ?? this.moniTag,
      pin: pin ?? this.pin,
      confirmPin: confirmPin ?? this.confirmPin,
      privateKeyInput: privateKeyInput ?? this.privateKeyInput,
      selectedMode: selectedMode ?? this.selectedMode,
      generatedPrivateKey: generatedPrivateKey ?? this.generatedPrivateKey,
      generatedAddress: generatedAddress ?? this.generatedAddress,
      encryptedPrivateKey: encryptedPrivateKey ?? this.encryptedPrivateKey,
      walletAddress: walletAddress ?? this.walletAddress,
      profileId: profileId ?? this.profileId,
      hasBackedUp: hasBackedUp ?? this.hasBackedUp,
      cloudBackupSuccess: cloudBackupSuccess ?? this.cloudBackupSuccess,
      isCheckingTag: isCheckingTag ?? this.isCheckingTag,
      tagError: tagError ?? this.tagError,
      importError: importError ?? this.importError,
      isCreating: isCreating ?? this.isCreating,
      isImporting: isImporting ?? this.isImporting,
      showPrivateKey: showPrivateKey ?? this.showPrivateKey,
      hasCopiedKey: hasCopiedKey ?? this.hasCopiedKey,
      isRequestingFunds: isRequestingFunds ?? this.isRequestingFunds,
      hasFunds: hasFunds ?? this.hasFunds,
      activationError: activationError ?? this.activationError,
      isActivated: isActivated ?? this.isActivated,
    );
  }
}
