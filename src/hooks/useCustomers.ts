import { useState, useEffect, useCallback } from 'react';

const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

export interface Customer {
  id: string;
  profile_id: string;
  pay_tag: string | null;
  wallet_address: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  total_spent: number;
  total_orders: number;
  last_purchase_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerStats {
  totalCustomers: number;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  repeatCustomers: number;
  repeatRate: number;
}

export function useCustomers(profileId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchCustomers = useCallback(async () => {
    if (!profileId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', profileId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const fetchStats = useCallback(async () => {
    if (!profileId) return;
    
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getStats', profileId }),
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch customer stats:', error);
    }
  }, [profileId]);

  const syncFromTransactions = useCallback(async () => {
    if (!profileId) return;
    
    setIsSyncing(true);
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'syncFromTransactions', profileId }),
      });

      if (response.ok) {
        await fetchCustomers();
        await fetchStats();
      }
    } catch (error) {
      console.error('Failed to sync customers:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [profileId, fetchCustomers, fetchStats]);

  const updateCustomer = useCallback(async (
    customerId: string,
    updates: Partial<Pick<Customer, 'name' | 'email' | 'phone' | 'notes' | 'tags'>>
  ) => {
    if (!profileId) return null;
    
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', profileId, customerId, ...updates }),
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(prev => prev.map(c => c.id === customerId ? data.customer : c));
        return data.customer;
      }
    } catch (error) {
      console.error('Failed to update customer:', error);
    }
    return null;
  }, [profileId]);

  const deleteCustomer = useCallback(async (customerId: string) => {
    if (!profileId) return false;
    
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', profileId, customerId }),
      });

      if (response.ok) {
        setCustomers(prev => prev.filter(c => c.id !== customerId));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
    return false;
  }, [profileId]);

  const addCustomer = useCallback(async (
    customer: Partial<Pick<Customer, 'pay_tag' | 'wallet_address' | 'name' | 'email' | 'phone' | 'notes' | 'tags'>>
  ) => {
    if (!profileId) return null;
    
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          profileId,
          payTag: customer.pay_tag,
          walletAddress: customer.wallet_address,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes,
          tags: customer.tags,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isNew) {
          setCustomers(prev => [data.customer, ...prev]);
        } else {
          setCustomers(prev => prev.map(c => c.id === data.customer.id ? data.customer : c));
        }
        return data.customer;
      }
    } catch (error) {
      console.error('Failed to add customer:', error);
    }
    return null;
  }, [profileId]);

  useEffect(() => {
    if (profileId) {
      fetchCustomers();
      fetchStats();
    }
  }, [profileId, fetchCustomers, fetchStats]);

  return {
    customers,
    stats,
    isLoading,
    isSyncing,
    fetchCustomers,
    fetchStats,
    syncFromTransactions,
    updateCustomer,
    deleteCustomer,
    addCustomer,
  };
}
