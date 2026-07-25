import { useState, useEffect, useCallback, useRef } from 'react';
import { getTokenBalance } from '@/lib/wallet';
import { notifyDepositConfirmed } from '@/lib/notifications';
import type { SupportedNetwork } from '@/config/chains';

interface UseDepositDetectionOptions {
  address: string | undefined;
  network?: SupportedNetwork;
  enabled?: boolean;
  pollInterval?: number;
  onDeposit?: (amount: number, newBalance: number) => void;
}

export function useDepositDetection({
  address,
  network = 'base',
  enabled = true,
  pollInterval = 5000,
  onDeposit,
}: UseDepositDetectionOptions) {
  const [isPolling, setIsPolling] = useState(false);
  const [lastBalance, setLastBalance] = useState<number | null>(null);
  const [depositDetected, setDepositDetected] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkBalance = useCallback(async () => {
    if (!address) return;

    try {
      const newBalance = await getTokenBalance(address as `0x${string}`, network);

      // Ignore unreliable reads (NaN) to prevent false deposit triggers.
      if (!Number.isFinite(newBalance)) return;

      if (lastBalance !== null && newBalance > lastBalance) {
        const amount = newBalance - lastBalance;
        setDepositAmount(amount);
        setDepositDetected(true);
        notifyDepositConfirmed(amount);

        // Auto-hide after 4 seconds
        setTimeout(() => {
          setDepositDetected(false);
          setDepositAmount(0);
        }, 4000);

        onDeposit?.(amount, newBalance);
      }

      setLastBalance(newBalance);
    } catch (error) {
      console.error('Failed to check balance:', error);
    }
  }, [address, network, lastBalance, onDeposit]);

  const startPolling = useCallback(() => {
    if (!enabled || !address || intervalRef.current) return;
    
    setIsPolling(true);
    // Initial check
    checkBalance();
    
    // Set up polling
    intervalRef.current = setInterval(checkBalance, pollInterval);
  }, [enabled, address, checkBalance, pollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Auto-start/stop based on enabled and address
  useEffect(() => {
    // Reset baseline when switching wallets or networks to avoid comparing across accounts.
    setLastBalance(null);

    if (enabled && address) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, address, network]);

  return {
    isPolling,
    depositDetected,
    depositAmount,
    startPolling,
    stopPolling,
  };
}
