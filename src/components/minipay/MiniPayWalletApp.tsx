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