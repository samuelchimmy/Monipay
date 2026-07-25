// Hook for managing payment links
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentLink {
  id: string;
  profile_id: string;
  product_id: string | null;
  link_code: string;
  name: string;
  description: string | null;
  amount: number;
  is_active: boolean;
  usage_limit: number | null;
  usage_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  url?: string;
  products?: {
    name: string;
    icon: string;
  } | null;
}

interface CreatePaymentLinkParams {
  name: string;
  amount: number;
  productId?: string;
  description?: string;
  usageLimit?: number;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export function usePaymentLinks(profileId: string | undefined) {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!profileId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('payment-links', {
        body: { action: 'list', profileId },
      });

      if (fnError) throw fnError;
      setLinks(data.links || []);
    } catch (err) {
      console.error('Failed to fetch payment links:', err);
      setError('Failed to load payment links');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const createLink = useCallback(async (params: CreatePaymentLinkParams): Promise<PaymentLink | null> => {
    if (!profileId) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('payment-links', {
        body: { 
          action: 'create', 
          profileId,
          ...params,
        },
      });

      if (fnError) throw fnError;
      
      // Add to local state
      const newLink = data.link;
      setLinks(prev => [newLink, ...prev]);
      
      return newLink;
    } catch (err) {
      console.error('Failed to create payment link:', err);
      setError('Failed to create payment link');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const getLink = useCallback(async (linkCode: string): Promise<{ link: PaymentLink; merchant: { payTag: string; walletAddress: string } } | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('payment-links', {
        body: { action: 'get', linkCode },
      });

      if (fnError) throw fnError;
      return data;
    } catch (err) {
      console.error('Failed to get payment link:', err);
      setError('Failed to load payment link');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateLink = useCallback(async (linkCode: string, updates: Partial<CreatePaymentLinkParams & { isActive: boolean }>): Promise<boolean> => {
    if (!profileId) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('payment-links', {
        body: { 
          action: 'update', 
          profileId,
          linkCode,
          ...updates,
        },
      });

      if (fnError) throw fnError;
      
      // Update local state
      setLinks(prev => prev.map(l => 
        l.link_code === linkCode ? data.link : l
      ));
      
      return true;
    } catch (err) {
      console.error('Failed to update payment link:', err);
      setError('Failed to update payment link');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const deactivateLink = useCallback(async (linkCode: string): Promise<boolean> => {
    if (!profileId) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { error: fnError } = await supabase.functions.invoke('payment-links', {
        body: { action: 'deactivate', profileId, linkCode },
      });

      if (fnError) throw fnError;
      
      // Update local state
      setLinks(prev => prev.map(l => 
        l.link_code === linkCode ? { ...l, is_active: false } : l
      ));
      
      return true;
    } catch (err) {
      console.error('Failed to deactivate payment link:', err);
      setError('Failed to deactivate payment link');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  return {
    links,
    isLoading,
    error,
    fetchLinks,
    createLink,
    getLink,
    updateLink,
    deactivateLink,
  };
}
