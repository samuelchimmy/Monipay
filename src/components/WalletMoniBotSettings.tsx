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
  XLinkCard,
  DiscordLinkCard,
  TelegramLinkCard,
  socialIdentityCacheKey,
  type SocialIdentity,
} from "@/components/MoniBotSettings";

interface Props {
  profileId: string;
  walletAddress: `0x${string}`;
  onIdentityChange?: (identity: SocialIdentity | null) => void;
}

// Light-on-yellow palette so the cards sit cleanly inside the MoniBot AI
// yellow surface in /minipay (matches the "Use MoniBot" card next to it).
const themeClasses = {
  innerSurface: "bg-white/85 border-black/15",
  innerSurfaceSolid: "bg-black/[0.06]",
  dividerColor: "border-black/15",
  mutedText: "text-black/65",
  strongText: "text-black",
  isLightTheme: true,
};

export function WalletMoniBotSettings({ profileId, walletAddress, onIdentityChange }: Props) {
  const [identity, setIdentity] = useState<SocialIdentity | null>(null);
  const [isUnlinkingX, setIsUnlinkingX] = useState(false);

  // Use a ref to ensure onIdentityChange can be called inside stable callbacks
  // without triggering infinite loops or re-evaluating useCallback dependencies.
  const onIdentityChangeRef = useRef(onIdentityChange);
  onIdentityChangeRef.current = onIdentityChange;

  const writeCachedIdentity = useCallback(
    (next: SocialIdentity | null) => {
      try {
        if (!next) {
          localStorage.removeItem(socialIdentityCacheKey(profileId));
          return;
        }
        localStorage.setItem(socialIdentityCacheKey(profileId), JSON.stringify(next));
      } catch {
        /* non-fatal */
      }
    },
    [profileId],
  );

  const fetchIdentity = useCallback(async () => {
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: { action: "get", profileId },
      });
      if (response.error) throw response.error;
      const next = response.data as SocialIdentity;
      setIdentity(next);
      writeCachedIdentity(next);
      onIdentityChangeRef.current?.(next);
    } catch (err) {
      console.error("WalletMoniBotSettings: fetch identity failed", err);
    }
  }, [profileId, writeCachedIdentity]);

  const handleIdentityChange = useCallback(
    (next: SocialIdentity | null) => {
      setIdentity(next);
      writeCachedIdentity(next);
      onIdentityChangeRef.current?.(next);
    },
    [writeCachedIdentity],
  );

  // Hydrate from cache immediately, then refresh in background — no blocking
  // spinner, the panel opens instantly.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(socialIdentityCacheKey(profileId));
      if (raw) {
        const parsed = JSON.parse(raw);
        setIdentity(parsed);
        onIdentityChangeRef.current?.(parsed);
      }
    } catch { /* ignore */ }
    fetchIdentity();
  }, [profileId, fetchIdentity]);

  const handleUnlinkX = async () => {
    setIsUnlinkingX(true);
    try {