import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MoniBotMissionStats {
  total_budget: number;
  spent_budget: number;
  current_users: number;
  target_users: number;
  is_onboarded: boolean;
  last_tweet_at: string | null;
}

export function useMoniBotStats() {
  const [stats, setStats] = useState<MoniBotMissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use method: "GET" since the edge function only accepts GET requests
      const { data, error: invokeError } = await supabase.functions.invoke("monibot-stats", {
        method: "GET",
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStats(data as MoniBotMissionStats);
    } catch (err: any) {
      console.error("Failed to fetch MoniBot stats:", err);
      setError(err.message || "Failed to fetch mission stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
