/**
 * WalletMoniBotSettings — MoniBot social-linking panel for wallet-only
 * sessions (Path B = MiniPay native, Path C = external wallet).
 *
 * No PIN, no encrypted-key decryption. Uses the wallet_profiles row created
 * by `wallet-session`. Re-uses the four LinkCards already shipped by
 * MoniBotSettings (X OAuth, Discord, Telegram, Bluesky) — those cards
 * call the social-identity edge function, which is wallet_profiles-aware.
 *
 * Bot on-chain allowance (approve TIP-20 / ERC-20) is intentionally
 * deferred — wallet-only users still get the full social handshake today,
 * which was the blocker the MiniPay refactor surfaced.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {