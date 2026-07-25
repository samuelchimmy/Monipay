import { useMemo } from 'react';
import { useWalletClient } from 'wagmi';
import { privateKeyToAccount } from 'viem/accounts';
import { usePayTag } from '@/contexts/PayTagContext';
import type { TypedDataSigner } from '@/lib/wallet';

/**
 * Returns a unified EIP-712 signer that works for both:
 *   - Legacy (Path A): signs with the locally-decrypted private key
 *   - Wallet-only (Path B/C): signs with the connected wagmi walletClient
 *
 * Consumers should call `signPaymentAuthorizationWithSigner(signer, ...)`
 * from `@/lib/wallet` instead of the private-key variant, then forward the
 * signature to the existing relay-payment edge functions unchanged.
 */
export function useUnifiedSigner(): {
  signer: TypedDataSigner | null;
  mode: 'legacy' | 'wallet-only' | null;
  ready: boolean;
} {
  const { profile, decryptedPrivateKey, isWalletOnly } = usePayTag();
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    const address = profile?.wallet?.address?.toLowerCase() as `0x${string}` | undefined;

    if (isWalletOnly) {
      if (!walletClient || !address) return { signer: null, mode: 'wallet-only' as const, ready: false };
      return {
        mode: 'wallet-only' as const,
        ready: true,
        signer: {
          address,
          signTypedData: (args) =>
            walletClient.signTypedData(args as any) as Promise<`0x${string}`>,
        },
      };
    }

    if (!decryptedPrivateKey) return { signer: null, mode: 'legacy' as const, ready: false };
    const account = privateKeyToAccount(decryptedPrivateKey as `0x${string}`);
    return {
      mode: 'legacy' as const,
      ready: true,
      signer: {
        address: account.address.toLowerCase() as `0x${string}`,
        signTypedData: (args) => account.signTypedData(args as any),
      },
    };
  }, [isWalletOnly, walletClient, decryptedPrivateKey, profile?.wallet?.address]);
}