// Hook for managing API keys
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ApiKey {
  id: string;
  public_key: string;
  secret_key_preview: string;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface GeneratedKeys {
  publicKey: string;
  secretKey: string;
  secretKeyPreview: string;
}

export function useApiKeys(profileId: string | undefined) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!profileId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { action: 'list', profileId },
      });

      if (fnError) throw fnError;
      setKeys(data.keys || []);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
      setError('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  const generateKeys = useCallback(async (): Promise<GeneratedKeys | null> => {
    if (!profileId) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { action: 'generate', profileId },
      });

      if (fnError) throw fnError;
      
      // Refresh the keys list
      await fetchKeys();
      
      return {
        publicKey: data.publicKey,
        secretKey: data.secretKey,
        secretKeyPreview: data.secretKeyPreview,
      };
    } catch (err) {
      console.error('Failed to generate API keys:', err);
      setError('Failed to generate API keys');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profileId, fetchKeys]);

  const revokeKey = useCallback(async (publicKey: string) => {
    if (!profileId) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { action: 'revoke', profileId, publicKey },
      });

      if (fnError) throw fnError;
      
      // Refresh the keys list
      await fetchKeys();
      return true;
    } catch (err) {
      console.error('Failed to revoke API key:', err);
      setError('Failed to revoke API key');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profileId, fetchKeys]);

  const updateWebhook = useCallback(async (webhookUrl: string | null) => {
    if (!profileId) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { error: fnError } = await supabase.functions.invoke('api-keys', {
        body: { action: 'updateWebhook', profileId, webhookUrl },
      });

      if (fnError) throw fnError;
      
      // Refresh the keys list
      await fetchKeys();
      return true;
    } catch (err) {
      console.error('Failed to update webhook URL:', err);
      setError('Failed to update webhook URL');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profileId, fetchKeys]);

  const activeKey = keys.find(k => k.is_active);

  return {
    keys,
    activeKey,
    isLoading,
    error,
    fetchKeys,
    generateKeys,
    revokeKey,
    updateWebhook,
  };
}
