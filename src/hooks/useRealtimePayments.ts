import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePayTag } from '@/contexts/PayTagContext';
import { notifyPaymentReceived } from '@/lib/notifications';
import { feedback } from '@/lib/feedback';
import { toast } from '@/hooks/use-toast';

/**
 * Subscribes to Supabase Realtime on the transactions table.
 * When a new "received" transaction appears for the current profile,
 * it triggers a toast, native notification, and balance refresh.
 */
export function useRealtimePayments() {
  const { profile, syncTransactions, refreshBalance } = usePayTag();
  const profileIdRef = useRef(profile?.id);

  // Keep ref in sync
  useEffect(() => {
    profileIdRef.current = profile?.id;
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`realtime-payments-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `profile_id=eq.${profile.id}`,
        },
        (payload) => {
          const tx = payload.new as {
            type: string;
            amount: number;
            fee: number;
            counterparty: string;
            payer_pay_tag?: string;
          };

          // Only notify on received payments
          if (tx.type !== 'received') return;

          const netAmount = tx.amount - (tx.fee || 0);
          const from = tx.payer_pay_tag || tx.counterparty || 'Unknown';

          // Sound + haptic
          feedback('receive');

          // In-app toast
          toast({
            title: '💰 Payment Received',
            description: `$${netAmount.toFixed(2)} from @${from}`,
          });

          // Native push notification
          notifyPaymentReceived(netAmount, from);

          // Refresh data
          syncTransactions();
          refreshBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, syncTransactions, refreshBalance]);
}
