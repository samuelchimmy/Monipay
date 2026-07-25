import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduledCampaign {
  id: string;
  type: string;
  status: string;
  scheduled_at: string;
  completed_at: string | null;
  payload: {
    message?: string;
    grant_amount?: number;
    max_participants?: number;
    budget?: number;
    time_slot?: string;
  };
  result?: {
    ready_for_social?: boolean;
    social_posted?: boolean;
    social_tweet_id?: string;
    triggered_by?: string;
  };
}

export interface MoniBotTransaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  tx_hash: string;
  receiver_id: string;
  payer_pay_tag: string | null;
  replied: boolean;
  tweet_id: string | null;
  created_at: string;
  status: string;
}

export interface Campaign {
  id: string;
  tweet_id: string | null;
  message: string | null;
  type: string;
  status: string;
  grant_amount: number;
  max_participants: number | null;
  budget_allocated: number;
  budget_spent: number | null;
  current_participants: number | null;
  posted_at: string | null;
  created_at: string | null;
}

interface InvokeOptions {
  walletAddress: string;
  signMessage: (message: string) => Promise<string>;
}

export function useMoniBotDashboard(options?: InvokeOptions) {
  const [schedule, setSchedule] = useState<ScheduledCampaign[]>([]);
  const [transactions, setTransactions] = useState<MoniBotTransaction[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invokeMoniBotCampaign = useCallback(
    async <T,>(action: string, body: Record<string, unknown>): Promise<T> => {
      // If no options provided, we can still fetch read-only data
      // but mutations will fail
      const timestamp = Date.now().toString();
      
      // For mutations, we need wallet signature
      let signature = "";
      const walletAddress = options?.walletAddress || "";
      
      if (options?.signMessage) {
        try {
          const signedMessage = `monibot-campaign:${action}:${timestamp}`;
          signature = await options.signMessage(signedMessage);
        } catch (err) {
          console.error("Failed to sign message:", err);
          throw new Error("Failed to sign request. Please try again.");
        }
      }

      const response = await fetch(
        "https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/monibot-campaign",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletAddress,
            "x-wallet-signature": signature,
          },
          body: JSON.stringify({
            action,
            timestamp,
            ...body,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      if (data?.error) {
        throw new Error(data.error);
      }

      return data as T;
    },
    [options],
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const activity = await invokeMoniBotCampaign<{ transactions: MoniBotTransaction[]; campaigns: Campaign[] }>(
        "get-activity",
        { limit: 30 },
      );

      setTransactions(activity.transactions || []);
      setCampaigns(activity.campaigns || []);

      const scheduleResp = await invokeMoniBotCampaign<{ schedule: ScheduledCampaign[] }>(
        "get-schedule",
        {},
      );

      if (scheduleResp?.schedule) {
        setSchedule(scheduleResp.schedule);
      }
    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [invokeMoniBotCampaign]);

  const triggerCampaign = async (payload?: {
    message?: string;
    grant_amount?: number;
    max_participants?: number;
    network?: string;
  }) => {
    if (!options?.signMessage) {
      return { success: false, error: "Wallet signature required. Please enter PIN." };
    }

    try {
      setTriggerLoading(true);

      const resp = await invokeMoniBotCampaign<{ message?: string }>(
        "trigger-campaign",
        { payload: payload || {} },
      );

      // Refresh data
      await fetchData();

      return { success: true, message: resp.message };
    } catch (err: any) {
      console.error("Failed to trigger campaign:", err);
      return { success: false, error: err.message };
    } finally {
      setTriggerLoading(false);
    }
  };

  const scheduleTodayCampaigns = async (grantAmount?: number, maxParticipants?: number) => {
    if (!options?.signMessage) {
      return { success: false, error: "Wallet signature required. Please enter PIN." };
    }

    try {
      setScheduleLoading(true);

      const resp = await invokeMoniBotCampaign<{ scheduled?: Array<{ id: string }> }>(
        "schedule-campaigns",
        {
          grant_amount: grantAmount || 1.0,
          max_participants: maxParticipants || 5,
        },
      );

      // Refresh schedule
      await fetchData();

      return { success: true, scheduled: resp.scheduled };
    } catch (err: any) {
      console.error("Failed to schedule campaigns:", err);
      return { success: false, error: err.message };
    } finally {
      setScheduleLoading(false);
    }
  };

  const cancelScheduledJob = async (jobId: string) => {
    if (!options?.signMessage) {
      return { success: false, error: "Wallet signature required" };
    }

    try {
      await invokeMoniBotCampaign<{ success: true }>(
        "cancel-schedule",
        { job_id: jobId },
      );

      // Refresh schedule
      await fetchData();

      return { success: true };
    } catch (err: any) {
      console.error("Failed to cancel job:", err);
      return { success: false, error: err.message };
    }
  };

  const deleteScheduledJob = async (jobId: string) => {
    if (!options?.signMessage) {
      return { success: false, error: "Wallet signature required" };
    }

    try {
      await invokeMoniBotCampaign<{ success: true }>(
        "delete-job",
        { job_id: jobId },
      );

      await fetchData();
      return { success: true };
    } catch (err: any) {
      console.error("Failed to delete job:", err);
      return { success: false, error: err.message };
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!options?.signMessage) {
      return { success: false, error: "Wallet signature required" };
    }
    try {
      await invokeMoniBotCampaign<{ success: true }>("delete-campaign", { campaign_id: campaignId });
      await fetchData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const markCampaignDone = async (campaignId: string) => {
    if (!options?.signMessage) {
      return { success: false, error: "Wallet signature required" };
    }
    try {
      await invokeMoniBotCampaign<{ success: true }>("mark-campaign-done", { campaign_id: campaignId });
      await fetchData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscription for transactions
  useEffect(() => {
    const channel = supabase
      .channel('monibot-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monibot_transactions'
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_jobs'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return {
    schedule,
    transactions,
    campaigns,
    loading,
    triggerLoading,
    scheduleLoading,
    error,
    refetch: fetchData,
    triggerCampaign,
    scheduleTodayCampaigns,
    cancelScheduledJob,
    deleteScheduledJob,
    deleteCampaign,
    markCampaignDone,
  };
}
