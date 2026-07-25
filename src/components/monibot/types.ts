export interface WalletOptions {
  walletAddress: string;
  signMessage: (message: string) => Promise<string>;
}
