/**
 * gasGuard.ts
 *
 * Proactive low-gas detection that runs **before** the user is asked to sign
 * an approval (MagicPay router, CasualPay router, network activation, etc.).
 *
 * If the wallet's native balance on the target chain is below the activation
 * threshold, we call the existing `activation-funder` edge function which
 * tops up the wallet (bypassing the device rate-limit for known wallets via
 * its `isTopUp` branch). We then poll briefly so the caller can sign as soon
 * as gas lands.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupportedNetwork } from "@/config/chains";