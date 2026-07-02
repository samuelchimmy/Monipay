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
