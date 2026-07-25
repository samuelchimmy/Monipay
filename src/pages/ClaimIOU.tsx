import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { MoniPayLogo } from "@/components/MoniPayLogo";
import { PageMeta } from "@/components/PageMeta";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  ArrowRight,
  Sun,
  Moon,
  Loader2,
  SearchX,
  PartyPopper,
  Shield,
  BadgeCheck,
  Link as LinkIcon,
  Twitter,
  Send,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayTagProvider, usePayTag } from "@/contexts/PayTagContext";
import { WagmiWrapper } from "@/components/WagmiWrapper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";

// ─── Network themes (mirrors MoniBotSettings) ───
const NETWORK_THEMES: Record<
  string,
  {
    bg: string;
    chipBg: string;
    chipText: string;
    logo: string;
    label: string;
    textOnBg: string;
    subOnBg: string;
    tagline: string;
    tokenSymbol: string;
  }
> = {
  base: {
    bg: "bg-[#0052FF]",
    chipBg: "bg-[#0052FF]",
    chipText: "text-white",
    logo: "/chains/base-logo.svg",
    label: "Base",
    textOnBg: "text-white",
    subOnBg: "text-white/60",
    tagline: "Coinbase L2",
    tokenSymbol: "USDC",
  },
  bsc: {
    bg: "bg-[#F0B90B]",
    chipBg: "bg-[#F0B90B]",
    chipText: "text-gray-950",
    logo: "/chains/bsc-logo.svg",
    label: "BSC",
    textOnBg: "text-gray-950",
    subOnBg: "text-gray-950/60",
    tagline: "BNB Smart Chain",
    tokenSymbol: "USDT",
  },
  solana: {
    bg: "bg-gradient-to-br from-[#9945FF] to-[#14F195]",
    chipBg: "bg-gradient-to-br from-[#9945FF] to-[#14F195]",
    chipText: "text-white",
    logo: "/chains/solana-logo.svg",
    label: "Solana",
    textOnBg: "text-white",
    subOnBg: "text-white/60",
    tagline: "Speed of Light",
    tokenSymbol: "USDC",
  },
  ink: {
    bg: "bg-[#7B5EA7]",
    chipBg: "bg-[#7B5EA7]",
    chipText: "text-white",
    logo: "/chains/ink-logo.webp",
    label: "Ink",
    textOnBg: "text-white",
    subOnBg: "text-white/60",
    tagline: "DeFi Native",
    tokenSymbol: "USDT0",
  },
  celo: {
    bg: "bg-[#FCFF52]",
    chipBg: "bg-[#FCFF52]",
    chipText: "text-gray-950",
    logo: "/chains/celo-logo.png",
    label: "Celo",
    textOnBg: "text-gray-950",
    subOnBg: "text-gray-950/60",
    tagline: "Mobile First",
    tokenSymbol: "USDT",
  },
  tempo: {
    bg: "bg-foreground",
    chipBg: "bg-foreground",
    chipText: "text-background",
    logo: "/chains/tempo-logo.svg",
    label: "Tempo",
    textOnBg: "text-background",
    subOnBg: "text-background/60",
    tagline: "Payment-Native",
    tokenSymbol: "αUSD",
  },
};

interface SocialIdentity {
  x_username: string | null;
  x_user_id: string | null;
  x_verified: boolean;
  discord_id: string | null;
  discord_username: string | null;
  telegram_id: string | null;
  telegram_username: string | null;
}

type Platform = "discord" | "telegram" | "x";

interface FoundIdentity {
  platform: Platform;
  platformUserId: string;
  username: string;
}

export default function ClaimIOU() {
  return (
    <WagmiWrapper>
      <PayTagProvider>
        <ClaimIOUContent />
      </PayTagProvider>
    </WagmiWrapper>
  );
}

function ClaimIOUContent() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { profile } = usePayTag();

  const [identity, setIdentity] = useState<SocialIdentity | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [checking, setChecking] = useState(false);
  const [foundIOUs, setFoundIOUs] = useState<any[]>([]);
  const [matchedIdentity, setMatchedIdentity] = useState<FoundIdentity | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const hasConfettied = useRef(false);

  const validProfileId = profile?.id;

  // ─── Fetch linked socials from profile via social-identity edge function ───
  const fetchIdentity = useCallback(async () => {
    if (!validProfileId) {
      setLoadingIdentity(false);
      return;
    }
    setLoadingIdentity(true);
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: { action: "get", profileId: validProfileId },
      });
      if (response.error) throw response.error;
      setIdentity(response.data as SocialIdentity);
    } catch (e) {
      console.error("Failed to fetch identity:", e);
      setIdentity(null);
    } finally {
      setLoadingIdentity(false);
    }
  }, [validProfileId]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  // ─── Pick first linked platform & check for pending IOUs ───
  const checkPendingIOUs = useCallback(async () => {
    if (!identity || !validProfileId) return;

    // Priority order: discord, telegram, x (verified)
    let target: FoundIdentity | null = null;
    if (identity.discord_id) {
      target = {
        platform: "discord",
        platformUserId: identity.discord_id,
        username: identity.discord_username || identity.discord_id,
      };
    } else if (identity.telegram_id) {
      target = {
        platform: "telegram",
        platformUserId: identity.telegram_id,
        username: identity.telegram_username || identity.telegram_id,
      };
    } else if (identity.x_verified && identity.x_user_id) {
      target = {
        platform: "x",
        platformUserId: identity.x_user_id,
        username: identity.x_username || identity.x_user_id,
      };
    }

    if (!target) {
      setHasChecked(true);
      return;
    }

    setChecking(true);
    setMatchedIdentity(target);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/claim-iou`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          action: "check",
          platform: target.platform,
          platformUserId: target.platformUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check");
      setFoundIOUs(data.pendingIOUs || []);
    } catch (e: any) {
      console.error("Check failed:", e);
      toast.error(e.message || "Failed to check for payments");
      setFoundIOUs([]);
    } finally {
      setChecking(false);
      setHasChecked(true);
    }
  }, [identity, validProfileId]);

  useEffect(() => {
    if (!loadingIdentity && identity && !hasChecked) {
      checkPendingIOUs();
    }
  }, [loadingIdentity, identity, hasChecked, checkPendingIOUs]);

  // ─── Confetti when IOUs found ───
  useEffect(() => {
    if (foundIOUs.length > 0 && !hasConfettied.current) {
      hasConfettied.current = true;
      const end = Date.now() + 2500;
      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ["#0052FF", "#10B981", "#F59E0B", "#8B5CF6"],
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ["#0052FF", "#10B981", "#F59E0B", "#8B5CF6"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [foundIOUs]);

  // ─── Claim all found IOUs ───
  async function handleClaimAll() {
    if (!validProfileId || foundIOUs.length === 0) return;
    setClaiming(true);
    try {
      let claimedCount = 0;
      for (const iou of foundIOUs) {
        const res = await supabase.functions.invoke("claim-iou", {
          body: { action: "claim", iouDbId: iou.id, claimantProfileId: validProfileId },
        });
        if (!res.error && !res.data?.error) claimedCount++;
      }
      if (claimedCount > 0) {
        toast.success(`Claimed ${claimedCount} payment${claimedCount > 1 ? "s" : ""}!`);
        feedback("success");
        setFoundIOUs([]);
        setTimeout(() => navigate("/"), 1500);
      } else {
        toast.error("Failed to claim payments");
        feedback("error");
      }
    } catch (e: any) {
      toast.error(e.message || "Claim failed");
      feedback("error");
    } finally {
      setClaiming(false);
    }
  }

  // ─── OAuth: Discord ───
  const handleConnectDiscord = () => {
    if (!validProfileId || !profile?.wallet?.address) {
      toast.error("Please sign in first");
      return;
    }
    const DISCORD_CLIENT_ID = "1473815294022520964";
    const redirectUri = `${window.location.origin}/discord-callback`;
    const state = btoa(
      JSON.stringify({ profileId: validProfileId, walletAddress: profile.wallet.address }),
    );
    const scope = "identify";
    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&prompt=consent`;
    const popup = window.open(url, "discord-oauth", "width=500,height=700,left=200,top=100");
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        // Refresh identity & re-check after popup closes
        setHasChecked(false);
        fetchIdentity();
      }
    }, 500);
  };

  // ─── Listen for Discord OAuth success ───
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "discord-oauth-success") {
        toast.success(`Discord linked as ${event.data.discord_username}!`);
        feedback("success");
        setHasChecked(false);
        fetchIdentity();
      }
      if (event.data?.type === "telegram-oauth-success") {
        toast.success(`Telegram linked as @${event.data.telegram_username}!`);
        feedback("success");
        setHasChecked(false);
        fetchIdentity();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchIdentity]);

  // ─── Telegram widget mount ───
  const tgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tgRef.current || !validProfileId || !profile?.wallet?.address) return;
    if (identity?.telegram_id) return;
    tgRef.current.innerHTML = "";
    const state = btoa(
      JSON.stringify({ profileId: validProfileId, walletAddress: profile.wallet.address }),
    );
    const callbackUrl = `${window.location.origin}/telegram-callback?state=${encodeURIComponent(state)}`;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "Monipay_monibot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", callbackUrl);
    script.setAttribute("data-request-access", "write");
    script.async = true;
    tgRef.current.appendChild(script);
    return () => {
      if (tgRef.current) tgRef.current.innerHTML = "";
    };
  }, [validProfileId, profile?.wallet?.address, identity?.telegram_id]);

  const handleConnectTelegram = () => {
    const iframe = tgRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
    if (iframe) iframe.click();
    else window.open(`https://t.me/Monipay_monibot?start=link`, "_blank");
  };

  // X verification routes through MoniBot settings (multi-step tweet flow)
  const handleConnectX = () => {
    navigate("/?openMoniBot=1");
  };

  // ─── Render branches ───
  const isSignedIn = Boolean(validProfileId);
  const hasAnyLinked = Boolean(
    identity?.discord_id || identity?.telegram_id || (identity?.x_verified && identity?.x_user_id),
  );

  return (
    <>
      <PageMeta path="/claim" noIndex />
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <header className="sticky top-0 z-30 w-full px-4 py-3 flex items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <MoniPayLogo size={28} animationMode="idle" showText textSize={13} />
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageSelector variant="compact" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="max-w-md mx-auto px-5 py-6 relative z-10">
          <AnimatePresence mode="wait">
            {/* ─── State 1: Loading identity ─── */}
            {loadingIdentity && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center pt-24 space-y-4"
              >
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading your account…</p>
              </motion.div>
            )}

            {/* ─── State 2: Not signed in ─── */}
            {!loadingIdentity && !isSignedIn && (
              <motion.div
                key="not-signed-in"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6 pt-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                  className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                >
                  <LogIn className="w-7 h-7 text-primary" />
                </motion.div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    Sign in to claim
                  </h1>
                  <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                    Create or unlock your MoniTag™ first. We'll auto-detect any pending payments
                    sent to your linked socials.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full h-12 gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-500 text-white font-semibold shadow-[0_0_30px_rgba(0,82,255,0.25)] border-0"
                >
                  Continue to MoniPay <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* ─── State 3: Signed in, no platform linked ─── */}
            {!loadingIdentity && isSignedIn && !hasAnyLinked && (
              <motion.div
                key="link-socials"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6 pt-2"
              >
                <div className="text-center space-y-3">
                  <h1 className="text-[26px] font-bold text-foreground tracking-tight leading-tight">
                    Link a social to{" "}
                    <span className="bg-gradient-to-r from-primary via-blue-400 to-emerald-400 bg-clip-text text-transparent">
                      claim
                    </span>
                  </h1>
                  <p className="text-sm text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
                    Connect Discord, Telegram, or X to detect payments sent to you. We never accept
                    typed usernames — only verified OAuth links.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {/* Discord */}
                  <button
                    onClick={handleConnectDiscord}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border/50 bg-card/60 hover:bg-card hover:border-border transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#5865F2]/15 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#5865F2">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">Connect Discord</p>
                      <p className="text-[11px] text-muted-foreground">One-click OAuth</p>
                    </div>
                    <LinkIcon className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {/* Telegram */}
                  <div className="w-full">
                    <button
                      onClick={handleConnectTelegram}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border/50 bg-card/60 hover:bg-card hover:border-border transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#26A5E4]/15 flex items-center justify-center shrink-0">
                        <Send className="w-5 h-5 text-[#26A5E4]" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-foreground">Connect Telegram</p>
                        <p className="text-[11px] text-muted-foreground">One-click via bot</p>
                      </div>
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <div ref={tgRef} className="hidden" />
                  </div>

                  {/* X */}
                  <button
                    onClick={handleConnectX}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border/50 bg-card/60 hover:bg-card hover:border-border transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
                      <Twitter className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">Connect X (Twitter)</p>
                      <p className="text-[11px] text-muted-foreground">Verify via tweet</p>
                    </div>
                    <LinkIcon className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground/60 text-center px-6 leading-relaxed flex items-center justify-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  Only the owner of a linked account can claim its funds.
                </p>
              </motion.div>
            )}

            {/* ─── State 4: Checking ─── */}
            {!loadingIdentity && isSignedIn && hasAnyLinked && checking && (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center pt-24 space-y-4"
              >
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Checking pending payments for @{matchedIdentity?.username}…
                </p>
              </motion.div>
            )}

            {/* ─── State 5: IOUs found — themed claim card ─── */}
            {!loadingIdentity && isSignedIn && hasAnyLinked && !checking && foundIOUs.length > 0 && (
              <ClaimCard
                ious={foundIOUs}
                matched={matchedIdentity!}
                claiming={claiming}
                onClaim={handleClaimAll}
              />
            )}

            {/* ─── State 6: Nothing found ─── */}
            {!loadingIdentity &&
              isSignedIn &&
              hasAnyLinked &&
              !checking &&
              hasChecked &&
              foundIOUs.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="text-center space-y-5 pt-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                    className="mx-auto w-16 h-16 rounded-full bg-muted/50 border border-border flex items-center justify-center"
                  >
                    <SearchX className="w-8 h-8 text-muted-foreground" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-foreground">Nothing pending</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    No payments are waiting for{" "}
                    <span className="text-foreground font-semibold">
                      @{matchedIdentity?.username}
                    </span>{" "}
                    on{" "}
                    {matchedIdentity?.platform === "x"
                      ? "X"
                      : matchedIdentity?.platform === "discord"
                        ? "Discord"
                        : "Telegram"}
                    .
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Button
                      onClick={() => {
                        setHasChecked(false);
                        checkPendingIOUs();
                      }}
                      variant="outline"
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" /> Check again
                    </Button>
                    <Button onClick={() => navigate("/")} variant="ghost" className="gap-2">
                      Back home
                    </Button>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// ClaimCard — themed network card matching MoniBotSettings design
// ─────────────────────────────────────────────────────────────

interface ClaimCardProps {
  ious: any[];
  matched: FoundIdentity;
  claiming: boolean;
  onClaim: () => void;
}

function ClaimCard({ ious, matched, claiming, onClaim }: ClaimCardProps) {
  // Use first IOU's chain to drive theme
  const chain = (ious[0]?.chain || "base").toLowerCase();
  const theme = NETWORK_THEMES[chain] || NETWORK_THEMES.base;

  const isLightTheme = chain === "celo" || chain === "bsc";
  const innerSurface = isLightTheme ? "bg-black/5 border-black/10" : "bg-white/[0.08] border-white/10";
  const innerSurfaceSolid = isLightTheme ? "bg-black/[0.06]" : "bg-white/[0.07]";
  const dividerColor = isLightTheme ? "border-black/10" : "border-white/10";
  const mutedText = isLightTheme ? "text-gray-950/55" : "text-white/55";
  const strongText = isLightTheme ? "text-gray-950" : "text-white";

  const totalAmount = ious.reduce((sum, i) => sum + Number(i.amount), 0);

  const platformLabel =
    matched.platform === "x" ? "X" : matched.platform === "discord" ? "Discord" : "Telegram";

  return (
    <motion.div
      key="found"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="space-y-4"
    >
      {/* ═══════════ MASTER CARD: themed network container ═══════════ */}
      <div
        className={`${theme.bg} rounded-3xl overflow-hidden transition-colors duration-300 shadow-2xl relative`}
      >
        {/* Decorative wave layers (cards-inspired texture) */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg viewBox="0 0 400 600" preserveAspectRatio="none" className="w-full h-full">
            <path
              d="M0,180 C100,120 200,260 400,180 L400,300 C300,360 100,260 0,320 Z"
              fill="currentColor"
              className={isLightTheme ? "text-black/[0.05]" : "text-white/[0.08]"}
            />
            <path
              d="M0,360 C150,300 250,440 400,360 L400,500 C250,540 150,460 0,500 Z"
              fill="currentColor"
              className={isLightTheme ? "text-black/[0.04]" : "text-white/[0.06]"}
            />
          </svg>
        </div>

        {/* HERO header */}
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <img src={theme.logo} alt={theme.label} className="w-5 h-5 rounded-[3px]" />
              <span
                className={`text-[10px] font-bold tracking-[0.2em] uppercase ${theme.subOnBg}`}
              >
                {theme.label}
              </span>
            </div>
            <span className={`text-2xl font-extrabold tracking-tight ${strongText}`}>
              {ious[0]?.token_symbol || theme.tokenSymbol}
            </span>
          </div>
          <h3 className={`text-sm font-bold mb-1 ${strongText} flex items-center gap-1.5`}>
            MagicPay Claim <BadgeCheck className="w-3.5 h-3.5" />
          </h3>
          <p className={`text-[11px] leading-relaxed ${mutedText}`}>
            Funds escrowed on-chain. Verified via your linked {platformLabel} account.
          </p>
        </div>

        <div className={`mx-5 border-t ${dividerColor} relative`} />

        {/* Amount hero */}
        <div className="relative px-5 py-6 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring" }}
            className={`mx-auto w-12 h-12 rounded-2xl ${innerSurfaceSolid} border ${dividerColor.replace("border-", "border-")} flex items-center justify-center mb-3`}
          >
            <PartyPopper className={`w-6 h-6 ${strongText}`} />
          </motion.div>

          <p
            className={`text-[10px] font-bold tracking-[0.25em] uppercase ${mutedText} mb-2`}
          >
            You're getting paid
          </p>
          <div className={`text-5xl font-extrabold tabular-nums tracking-tight ${strongText}`}>
            ${totalAmount.toFixed(2)}
          </div>
          <p className={`text-[11px] mt-2 ${mutedText}`}>
            {ious.length === 1
              ? `From @${ious[0].sender_pay_tag}`
              : `${ious.length} payments from ${ious
                  .slice(0, 2)
                  .map((i) => `@${i.sender_pay_tag}`)
                  .join(", ")}${ious.length > 2 ? ` +${ious.length - 2}` : ""}`}
          </p>
        </div>

        <div className={`mx-5 border-t ${dividerColor} relative`} />

        {/* IOU list */}
        <div className="relative px-5 py-4 space-y-2">
          <h4
            className={`text-[10px] font-bold tracking-[0.2em] uppercase ${mutedText} mb-2`}
          >
            Pending payments
          </h4>
          <div className={`rounded-xl overflow-hidden border ${innerSurface}`}>
            {ious.map((iou, idx) => (
              <div
                key={iou.id}
                className={`flex items-center justify-between px-3.5 py-3 ${
                  idx < ious.length - 1 ? `border-b ${dividerColor}` : ""
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-sm font-bold tabular-nums ${strongText}`}>
                    {Number(iou.amount).toFixed(2)} {iou.token_symbol}
                  </p>
                  <p className={`text-[11px] truncate ${mutedText}`}>
                    From @{iou.sender_pay_tag}
                  </p>
                </div>
                <span className={`text-[10px] tabular-nums shrink-0 ${mutedText}`}>
                  {new Date(iou.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="relative px-5 pb-5 pt-1 space-y-3">
          <Button
            onClick={onClaim}
            disabled={claiming}
            className={`w-full h-12 text-sm font-bold gap-2 ${
              isLightTheme
                ? "bg-gray-950 text-white hover:bg-gray-900"
                : "bg-white text-gray-950 hover:bg-white/90"
            }`}
          >
            {claiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Claiming…
              </>
            ) : (
              <>
                Claim ${totalAmount.toFixed(2)} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
          <p
            className={`text-[10px] text-center leading-relaxed ${mutedText} flex items-center justify-center gap-1.5`}
          >
            <Shield className="w-3 h-3" />
            Verified for @{matched.username} on {platformLabel}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
