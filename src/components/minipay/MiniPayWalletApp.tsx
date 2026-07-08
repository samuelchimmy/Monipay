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