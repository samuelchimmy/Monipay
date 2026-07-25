// Hook for managing orders
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Order {
  id: string;
  order_ref: string;
  merchant_profile_id: string;
  payer_profile_id: string | null;
  payer_pay_tag: string | null;
  payer_wallet: string | null;
  payment_link_id: string | null;
  amount: number;
  fee: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  source: 'payment_link' | 'api' | 'qr' | 'invoice';
  tx_hash: string | null;
  callback_url: string | null;
  webhook_url: string | null;
  webhook_sent_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  payment_links?: {
    name: string;
  } | null;
}

interface CreateOrderParams {
  paymentLinkCode?: string;
  amount?: number;
  source?: 'payment_link' | 'api' | 'qr' | 'invoice';
  callbackUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

interface CompleteOrderParams {
  orderId: string;
  txHash: string;
  payerProfileId?: string;
  payerPayTag?: string;
  payerWallet?: string;
  fee?: number;
}

export function useOrders(profileId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    completed: 0,
    limit: 50,
    offset: 0,
  });

  const fetchOrders = useCallback(async (status?: string, limit = 50, offset = 0) => {
    if (!profileId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('orders', {
        body: { 
          action: 'list', 
          profileId,
          status,
          limit,
          offset,
        },
      });

      if (fnError) throw fnError;
      setOrders(data.orders || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const createOrder = useCallback(async (params: CreateOrderParams): Promise<{ order: Order; merchant: { payTag: string; walletAddress: string }; checkoutUrl: string } | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Only include profileId if it's defined (for API-created orders)
      // For payment link orders, the merchant profile is derived from the link
      const requestBody: Record<string, any> = { 
        action: 'create',
        ...params,
      };
      
      if (profileId) {
        requestBody.profileId = profileId;
      }
      
      const { data, error: fnError } = await supabase.functions.invoke('orders', {
        body: requestBody,
      });

      if (fnError) throw fnError;
      return data;
    } catch (err) {
      console.error('Failed to create order:', err);
      setError('Failed to create order');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const getOrder = useCallback(async (orderId?: string, orderRef?: string): Promise<{ order: Order; merchant: { payTag: string; walletAddress: string } } | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('orders', {
        body: { action: 'get', orderId, orderRef },
      });

      if (fnError) throw fnError;
      return data;
    } catch (err) {
      console.error('Failed to get order:', err);
      setError('Failed to load order');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeOrder = useCallback(async (params: CompleteOrderParams): Promise<{ order: Order; callbackUrl: string | null } | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('orders', {
        body: { 
          action: 'complete',
          ...params,
        },
      });

      if (fnError) {
        console.error('Order completion edge function error:', fnError);
        throw fnError;
      }

      if (!data || !data.success) {
        console.error('Order completion returned unexpected data:', data);
        throw new Error(data?.error || 'Order completion returned unexpected response');
      }
      
      // Update local state if we have orders loaded
      if (orders.length > 0) {
        setOrders(prev => prev.map(o => 
          o.id === params.orderId ? data.order : o
        ));
      }
      
      return data;
    } catch (err) {
      console.error('Failed to complete order:', err);
      setError('Failed to complete order');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [orders]);

  const failOrder = useCallback(async (orderId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error: fnError } = await supabase.functions.invoke('orders', {
        body: { action: 'fail', orderId },
      });

      if (fnError) throw fnError;
      
      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: 'failed' as const } : o
      ));
      
      return true;
    } catch (err) {
      console.error('Failed to mark order as failed:', err);
      setError('Failed to update order');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stats for merchant dashboard
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);
  const todayOrders = completedOrders.filter(o => {
    const orderDate = new Date(o.paid_at || o.created_at);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  return {
    orders,
    isLoading,
    error,
    pagination,
    fetchOrders,
    createOrder,
    getOrder,
    completeOrder,
    failOrder,
    // Stats
    completedOrders,
    totalRevenue,
    todayOrders,
  };
}
