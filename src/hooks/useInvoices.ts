import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';

const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

// Notification sound for new invoices
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Could not play notification sound');
  }
};

// Warning sound for expiring invoices (lower pitch)
const playWarningSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Lower pitch warning tone
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(350, audioContext.currentTime + 0.15);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    console.log('Could not play warning sound');
  }
};

// Check if invoice expires within threshold (in minutes)
const expiresWithinMinutes = (expiresAt: string | null, minutes: number): boolean => {
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const thresholdMs = minutes * 60 * 1000;
  return expiryTime > now && expiryTime - now <= thresholdMs;
};

// Format time remaining
const formatTimeRemaining = (expiresAt: string): string => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  sender_profile_id: string;
  recipient_pay_tag: string;
  recipient_profile_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  items: InvoiceItem[] | null;
  memo: string | null;
  expires_at: string | null;
  paid_at: string | null;
  tx_hash: string | null;
  created_at: string;
  senderPayTag?: string;
}

interface UseInvoicesReturn {
  receivedInvoices: Invoice[];
  sentInvoices: Invoice[];
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
  fetchInvoices: () => Promise<void>;
  createInvoice: (params: {
    senderProfileId: string;
    recipientPayTag: string;
    amount: number;
    items?: InvoiceItem[];
    memo?: string;
  }) => Promise<{ success: boolean; invoice?: Invoice; error?: string }>;
  payInvoice: (params: {
    invoiceId: string;
    payerProfileId: string;
    network?: string;
    signature?: string;
    txHash?: string;
    message?: {
      from: string;
      to: string;
      amount: string;
      fee: string;
      nonce: string;
      deadline: string;
    };
  }) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  cancelInvoice: (invoiceId: string, profileId: string) => Promise<{ success: boolean; error?: string }>;
}

export function useInvoices(profileId: string | undefined): UseInvoicesReturn {
  const [receivedInvoices, setReceivedInvoices] = useState<Invoice[]>([]);
  const [sentInvoices, setSentInvoices] = useState<Invoice[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track known invoice IDs to detect new ones
  const knownInvoiceIds = useRef<Set<string>>(new Set());
  const warnedInvoiceIds = useRef<Set<string>>(new Set()); // Track invoices we've warned about
  const isFirstLoad = useRef(true);

  const fetchInvoices = useCallback(async () => {
    if (!profileId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch received invoices
      const receivedResponse = await fetch(`${SUPABASE_FUNCTIONS_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          profileId,
          type: 'received',
        }),
      });

      if (receivedResponse.ok) {
        const data = await receivedResponse.json();
        const invoices: Invoice[] = data.invoices || [];
        
        // Check for new pending invoices (not on first load)
        if (!isFirstLoad.current) {
          const newPendingInvoices = invoices.filter(
            (inv) => inv.status === 'pending' && !knownInvoiceIds.current.has(inv.id)
          );
          
          // Play sound and haptic for each new invoice (no toast)
          newPendingInvoices.forEach(() => {
            playNotificationSound();
            feedback('scan');
          });
        }
        
        // Update known IDs
        invoices.forEach((inv) => knownInvoiceIds.current.add(inv.id));
        isFirstLoad.current = false;
        
        setReceivedInvoices(invoices);
        // Only count pending invoices that haven't expired
        const activePending = invoices.filter((i) => 
          i.status === 'pending' && 
          (!i.expires_at || new Date(i.expires_at).getTime() > Date.now())
        );
        setPendingCount(activePending.length);
      }

      // Fetch sent invoices
      const sentResponse = await fetch(`${SUPABASE_FUNCTIONS_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          profileId,
          type: 'sent',
        }),
      });

      if (sentResponse.ok) {
        const data = await sentResponse.json();
        const invoices: Invoice[] = data.invoices || [];
        
        // Track sent invoice IDs too
        invoices.forEach((inv) => knownInvoiceIds.current.add(inv.id));
        
        setSentInvoices(invoices);
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const createInvoice = useCallback(async (params: {
    senderProfileId: string;
    recipientPayTag: string;
    amount: number;
    items?: InvoiceItem[];
    memo?: string;
  }) => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...params,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create invoice' };
      }

      // Refresh invoices
      await fetchInvoices();

      return { success: true, invoice: data.invoice };
    } catch (err) {
      console.error('Failed to create invoice:', err);
      return { success: false, error: 'Failed to create invoice' };
    }
  }, [fetchInvoices]);

  const payInvoice = useCallback(async (params: {
    invoiceId: string;
    payerProfileId: string;
    network?: string;
    signature?: string;
    txHash?: string;
    message?: {
      from: string;
      to: string;
      amount: string;
      fee: string;
      nonce: string;
      deadline: string;
    };
  }) => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay',
          ...params,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Payment failed' };
      }

      // Refresh invoices
      await fetchInvoices();

      return { success: true, txHash: data.txHash };
    } catch (err) {
      console.error('Failed to pay invoice:', err);
      return { success: false, error: 'Payment failed' };
    }
  }, [fetchInvoices]);

  const cancelInvoice = useCallback(async (invoiceId: string, profileId: string) => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          invoiceId,
          profileId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to cancel invoice' };
      }

      // Refresh invoices
      await fetchInvoices();

      return { success: true };
    } catch (err) {
      console.error('Failed to cancel invoice:', err);
      return { success: false, error: 'Failed to cancel invoice' };
    }
  }, [fetchInvoices]);

  // Fetch on mount and set up polling
  useEffect(() => {
    if (profileId) {
      fetchInvoices();

      // Poll for new invoices every 30 seconds
      const interval = setInterval(fetchInvoices, 30000);
      return () => clearInterval(interval);
    }
  }, [profileId, fetchInvoices]);

  // Check for expiring invoices every 15 seconds
  useEffect(() => {
    if (!profileId) return;

    const checkExpiringInvoices = () => {
      const pendingReceived = receivedInvoices.filter(inv => inv.status === 'pending');
      
      pendingReceived.forEach((inv) => {
        // Check if expiring within 1 minute and not yet warned
        if (
          inv.expires_at && 
          expiresWithinMinutes(inv.expires_at, 1) && 
          !warnedInvoiceIds.current.has(inv.id)
        ) {
          warnedInvoiceIds.current.add(inv.id);
          playWarningSound();
          feedback('tap');
          // Sound only, no toast notification
        }
      });
    };

    // Check immediately and then every 15 seconds
    checkExpiringInvoices();
    const interval = setInterval(checkExpiringInvoices, 15000);
    
    return () => clearInterval(interval);
  }, [profileId, receivedInvoices]);

  return {
    receivedInvoices,
    sentInvoices,
    pendingCount,
    isLoading,
    error,
    fetchInvoices,
    createInvoice,
    payInvoice,
    cancelInvoice,
  };
}
