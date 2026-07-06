/**
 * MiniPayWalletApp — Path B (MiniPay native) experience.
 *
 * Auto-registers the injected wallet address with the `wallet-session` edge
 * function and renders the wallet-mode dashboard. No PIN, no encrypted key.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WalletDashboard } from "@/components/WalletDashboard";
import { MiniPayDashboard } from "@/components/minipay/MiniPayDashboard";

interface Props {
  address: `0x${string}`;
}

interface WalletSessionResponse {
  profileId: string;
  payTag?: string | null;
  walletAddress: string;
  isLegacy: boolean;
  isNew: boolean;
  preferredName?: string | null;
  preferredNetwork?: string;
}

export function MiniPayWalletApp({ address }: Props) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke<WalletSessionResponse>(
          "wallet-session",
          { body: { action: "upsert", walletAddress: address, source: "minipay" } },
        );
        if (cancelled) return;
        if (invokeErr) throw invokeErr;
        if (!data) throw new Error("No response from wallet-session");
        setProfileId(data.profileId);
        setIsLegacy(data.isLegacy);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[MiniPayWalletApp] upsert failed:", e);
        setError(e?.message ?? "Failed to initialise wallet session");
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-semibold">Couldn't start your session</h1>