/**
 * useCeloApproval.ts
 * Manages the USDT → MoniPayRouter approval state on Celo.
 *
 * Supports two modes:
 * 1. MiniPay context: uses window.ethereum (approveCeloUsdt)
 * 2. Normal app context: uses decrypted private key (approveCeloUsdtWithKey)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCeloUsdtAllowance,
  approveCeloUsdt,
  approveCeloUsdtWithKey,
  usdtToRaw,
} from '@/lib/celoWallet';
import { ensureGasForApproval } from '@/lib/gasGuard';
import { toast } from 'sonner';

const MIN_SUFFICIENT_ALLOWANCE_USDT = 100;

interface UseCeloApprovalResult {
  isApproved: boolean;
  allowanceUsdt: number;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  approve: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useCeloApproval(
  walletAddress: `0x${string}` | null,
  decryptedPrivateKey?: `0x${string}` | null,
): UseCeloApprovalResult {
  const [isApproved, setIsApproved]       = useState(false);
  const [allowanceUsdt, setAllowanceUsdt] = useState(0);
  const [isLoading, setIsLoading]         = useState(false);
  const [isSending, setIsSending]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const fetchAllowance = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const { allowance } = await getCeloUsdtAllowance(walletAddress);
      const minRaw = usdtToRaw(MIN_SUFFICIENT_ALLOWANCE_USDT);
      const humanAllowance = Number(allowance) / 1_000_000;
      setAllowanceUsdt(humanAllowance);
      setIsApproved(allowance >= minRaw);
    } catch (err: any) {
      console.error('[useCeloApproval] Fetch failed:', err);
      setError('Failed to check approval status');
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  const approve = useCallback(async () => {
    if (!walletAddress) return;

    setIsSending(true);
    setError(null);

    try {
      const isMiniPay = !!(window as any).ethereum?.isMiniPay;

      // Top up CELO gas first so the approve tx doesn't fail silently.
      if (!isMiniPay) {
        const guard = await ensureGasForApproval('celo', walletAddress);
        if (!guard.funded) {
          toast.message('Topping up network fee', {
            description: 'Please try again in a moment.',
          });
          setIsSending(false);
          return;
        }
      }

      if (isMiniPay) {
        // MiniPay context — use injected wallet
        const txHash = await approveCeloUsdt(walletAddress);
        console.log('[useCeloApproval] MiniPay approval tx:', txHash);
      } else if (decryptedPrivateKey) {
        // Normal app context — use local private key
        const txHash = await approveCeloUsdtWithKey(decryptedPrivateKey);
        console.log('[useCeloApproval] Key-based approval tx:', txHash);
      } else {
        throw new Error('No signing method available. Please unlock your wallet first.');
      }

      // Wait for Celo block confirmation (~5s)
      await new Promise(resolve => setTimeout(resolve, 6000));
      await fetchAllowance();
    } catch (err: any) {
      console.error('[useCeloApproval] Approval failed:', err);
      if (err?.code !== 4001) {
        setError(err?.message ?? 'Approval transaction failed');
      }
    } finally {
      setIsSending(false);
    }
  }, [walletAddress, decryptedPrivateKey, fetchAllowance]);

  return {
    isApproved,
    allowanceUsdt,
    isLoading,
    isSending,
    error,
    approve,
    refetch: fetchAllowance,
  };
}
