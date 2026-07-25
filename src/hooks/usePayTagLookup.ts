import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TTL_MS = 60_000; // 60 second cache TTL

interface CacheEntry {
  value: string | null;
  timestamp: number;
}

/**
 * Hook for looking up PayTags from wallet addresses with TTL-based caching (60s)
 */
export function usePayTagLookup() {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const isExpired = (entry: CacheEntry): boolean => {
    return Date.now() - entry.timestamp > TTL_MS;
  };

  /**
   * Look up a single wallet address and return the pay_tag if found
   */
  const lookupPayTag = useCallback(async (walletAddress: string): Promise<string | null> => {
    if (!walletAddress || !walletAddress.startsWith('0x')) return null;

    const normalized = walletAddress.toLowerCase();
    
    // Check cache (with TTL)
    const cached = cacheRef.current.get(normalized);
    if (cached && !isExpired(cached)) {
      return cached.value;
    }

    try {
      const { data } = await supabase.functions.invoke('check-paytag', {
        body: { action: 'lookup', walletAddress: normalized },
      });

      const payTag = data?.profile?.pay_tag || null;
      cacheRef.current.set(normalized, { value: payTag, timestamp: Date.now() });
      return payTag;
    } catch (error) {
      console.error('Failed to lookup PayTag:', error);
      cacheRef.current.set(normalized, { value: null, timestamp: Date.now() });
      return null;
    }
  }, []);

  /**
   * Batch look up multiple wallet addresses
   */
  const batchLookupPayTags = useCallback(async (walletAddresses: string[]): Promise<Map<string, string>> => {
    const results = new Map<string, string>();
    const addressesToLookup: string[] = [];

    for (const addr of walletAddresses) {
      if (!addr || !addr.startsWith('0x')) continue;
      
      const normalized = addr.toLowerCase();
      const cached = cacheRef.current.get(normalized);
      if (cached && !isExpired(cached)) {
        if (cached.value) results.set(normalized, cached.value);
      } else {
        addressesToLookup.push(normalized);
      }
    }

    if (addressesToLookup.length > 0) {
      setIsLoading(true);
      try {
        const lookups = await Promise.all(
          addressesToLookup.map(async (addr) => {
            const payTag = await lookupPayTag(addr);
            return { addr, payTag };
          })
        );

        for (const { addr, payTag } of lookups) {
          if (payTag) results.set(addr, payTag);
        }
      } finally {
        setIsLoading(false);
      }
    }

    return results;
  }, [lookupPayTag]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    lookupPayTag,
    batchLookupPayTags,
    clearCache,
    isLoading,
  };
}
