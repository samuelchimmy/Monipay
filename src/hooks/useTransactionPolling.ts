import { useState, useEffect, useCallback } from 'react';
import { notifyPaymentReceived } from '@/lib/notifications';
import { feedback } from '@/lib/feedback';
const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

interface PendingTransaction {
  txHash: string;
  amount: number;
  counterparty: string;
  startedAt: number;
}

export function useTransactionPolling() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [confirmedTxHash, setConfirmedTxHash] = useState<string | null>(null);

  const addPendingTransaction = useCallback((tx: PendingTransaction) => {
    setPendingTransactions(prev => [...prev, tx]);
  }, []);

  const removePendingTransaction = useCallback((txHash: string) => {
    setPendingTransactions(prev => prev.filter(tx => tx.txHash !== txHash));
  }, []);

  const checkTransactionStatus = useCallback(async (txHash: string): Promise<'pending' | 'confirmed' | 'failed'> => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/relay-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkTxStatus',
          message: { txHash },
        }),
      });

      if (!response.ok) {
        return 'pending';
      }

      const data = await response.json();
      return data.status || 'pending';
    } catch (error) {
      console.error('Failed to check transaction status:', error);
      return 'pending';
    }
  }, []);

  // Poll pending transactions
  useEffect(() => {
    if (pendingTransactions.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const tx of pendingTransactions) {
        // Check if we've exceeded max poll time
        const elapsed = Date.now() - tx.startedAt;
        if (elapsed > MAX_POLL_ATTEMPTS * POLL_INTERVAL) {
          removePendingTransaction(tx.txHash);
          continue;
        }

        const status = await checkTransactionStatus(tx.txHash);

        if (status === 'confirmed') {
          removePendingTransaction(tx.txHash);
          setConfirmedTxHash(tx.txHash);
          feedback('receive');
          notifyPaymentReceived(tx.amount, tx.counterparty);
          
          // Clear confirmation after 3 seconds
          setTimeout(() => setConfirmedTxHash(null), 3000);
        } else if (status === 'failed') {
          removePendingTransaction(tx.txHash);
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [pendingTransactions, checkTransactionStatus, removePendingTransaction]);

  return {
    pendingTransactions,
    confirmedTxHash,
    addPendingTransaction,
    removePendingTransaction,
    hasPending: pendingTransactions.length > 0,
  };
}
