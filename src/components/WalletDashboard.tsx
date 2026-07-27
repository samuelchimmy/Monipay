/**
 * WalletDashboard — compact, MoniBot-centric dashboard for wallet-only sessions
 * (Path B = MiniPay native, Path C = external wallet).
 *
 * Differences vs the legacy `UserDashboard`:
 *   - No PIN, no encrypted-key concerns
 *   - No inline transaction history (button opens existing TransactionHistory modal)
 *   - MoniBot Settings is the primary surface
 *   - Identity header shows short address + selected on-chain name + network
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useDisconnect } from "wagmi";
import { useTheme } from "next-themes";
import {
  Bot,
  Copy,
  History,
  LogOut,
  Sparkles,
  Wallet,
  Eye,
  EyeOff,
  Coins,
  ShieldCheck,
  Moon,
  Sun,
  Info,
  ExternalLink,
  Send,
  Twitter,
  Zap,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { MoniBotSettings } from "@/components/MoniBotSettings";
import { WalletMoniBotSettings } from "@/components/WalletMoniBotSettings";
import { WalletAllowanceCard } from "@/components/WalletAllowanceCard";
import { OnChainIdentitySelector } from "@/components/OnChainIdentitySelector";
import { TransactionHistory } from "@/components/TransactionHistory";
import { PendingIOUsCard } from "@/components/PendingIOUsCard";
import { MoniPayLogo } from "@/components/MoniPayLogo";
import { CeloHoldingsCollapse } from "@/components/CeloHoldingsCollapse";
import { WhatIsMoniBotModal } from "@/components/minipay/WhatIsMoniBotModal";
import { useOnChainIdentity } from "@/hooks/useOnChainIdentity";
import type { SessionType } from "@/hooks/useWalletSession";
import { supabase } from "@/integrations/supabase/client";
import { ensureGasForApproval } from "@/lib/gasGuard";
import {
  CHAIN_CONFIGS,
  type SupportedNetwork,
  type EvmNetwork,
} from "@/config/chains";
import { wagmiChainFromNetwork } from "@/lib/wagmiConfig";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  walletAddress: `0x${string}`;
  profileId: string | null;
  sessionType: SessionType;
  isLegacy?: boolean;
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// Networks surfaced in the wallet-connect dashboard selector. MoniPay is
// Celo-only.
const WALLET_NETWORKS: EvmNetwork[] = ["celo"];

const RPC: Record<string, string> = {
  celo: "https://forno.celo.org",
};

export function WalletDashboard({ walletAddress, profileId, sessionType, isLegacy }: Props) {
  const { disconnect } = useDisconnect();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { names } = useOnChainIdentity(walletAddress);
  const [showHistory, setShowHistory] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showWhatIsMoniBot, setShowWhatIsMoniBot] = useState(false);
  const [pendingIouCount, setPendingIouCount] = useState(0);
  const [preferredName, setPreferredName] = useState<string | null>(null);
  const [preferredNetwork, setPreferredNetwork] = useState<SupportedNetwork>("celo");
  const [payTag, setPayTag] = useState<string | null>(null);
  const [identities, setIdentities] = useState<
    Array<{ platform: "discord" | "telegram" | "twitter"; userId: string }>
  >([]);
  const [balanceUsd, setBalanceUsd] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [activating, setActivating] = useState(false);
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [checkingActivation, setCheckingActivation] = useState(false);

  // Load profile (works for both legacy `profiles` rows and Path B/C
  // `wallet_profiles` rows — wallet-session `get` returns whichever exists)
  // so we can populate preferences AND linked social identities. The
  // identities are what PendingIOUsCard scans to find MagicPay IOUs sent
  // to your X / Discord / Telegram handles.
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("wallet-session", {
          body: { action: "get", walletAddress },
        });
        if (error) throw error;
        if (cancelled) return;
        const p = (data as any)?.profile;
        if (!p) return;
        if (!isLegacy) {
          setPreferredName(p.preferred_name ?? null);
          setPreferredNetwork((p.preferred_network as SupportedNetwork) ?? "celo");
        }
        setPayTag(p.pay_tag ?? null);
        const ids: Array<{ platform: "discord" | "telegram" | "twitter"; userId: string }> = [];
        if (p.discord_id) ids.push({ platform: "discord", userId: String(p.discord_id) });
        if (p.telegram_id) ids.push({ platform: "telegram", userId: String(p.telegram_id) });
        if (p.x_verified && (p.x_user_id || p.x_username)) {
          ids.push({ platform: "twitter", userId: String(p.x_user_id ?? p.x_username) });
        }
        setIdentities(ids);
      } catch {
        /* non-fatal */
      }
    };
    loadProfile();
    // Refresh whenever a social account is linked/unlinked in this session
    // (X/Discord/Telegram callbacks all postMessage on success).
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const t = event.data?.type;
      if (
        t === "x-oauth-success" ||
        t === "discord-oauth-success" ||
        t === "telegram-oauth-success"
      ) {
        loadProfile();
      }
    };
    window.addEventListener("message", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("message", handler);
    };
  }, [walletAddress, isLegacy]);

  const displayName = useMemo(
    () => (payTag ? `@${payTag}` : preferredName ?? names[0]?.name ?? null),
    [payTag, preferredName, names],
  );

  const handleCopy = async () => {
    const value = walletAddress;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for non-secure contexts / older in-app browsers
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand failed");
      }
      toast.success("Address copied", { description: shortAddr(value) });
    } catch {
      toast.error("Could not copy address");
    }
  };

  const handleSignOut = () => {
    if (sessionType === "external_wallet") {
      try { disconnect(); } catch { /* ignore */ }
      try { localStorage.removeItem("monipay_wallet_mode"); } catch { /* ignore */ }
      // Hard navigation to homepage so any stale wallet-mode state is cleared.
      window.location.assign("/");
      return;
    }
    // MiniPay session cannot be "disconnected" — user closes the mini-app.
  };

  // Persist network selection so reconnects/refreshes remember the choice.
  const handleNetworkChange = async (next: EvmNetwork) => {
    setPreferredNetwork(next);
    setBalanceUsd(null); // trigger refetch via effect
    if (isLegacy) return;
    try {
      await supabase.functions.invoke("wallet-session", {
        body: { action: "updateSettings", walletAddress, preferred_network: next },
      });
    } catch {
      /* non-fatal */
    }
  };

  const isMiniPay = sessionType === "minipay";
  const activeChain = CHAIN_CONFIGS[preferredNetwork as EvmNetwork] ?? CHAIN_CONFIGS.celo;

  // Celo keeps the default green from the [data-minipay] scope.
  const CHAIN_ACCENT: Record<EvmNetwork, { light: [string, string, string]; dark: [string, string, string] } | null> = {
    celo: null, // keep default green from [data-minipay]
  };
  const accent = CHAIN_ACCENT[preferredNetwork as EvmNetwork] ?? null;
  const accentTriplet = accent ? (isDark ? accent.dark : accent.light) : null;
  const accentTokens: React.CSSProperties = accentTriplet
    ? ({
        ["--mp-primary" as any]: accentTriplet[0],
        ["--mp-primary-strong" as any]: accentTriplet[1],
        ["--mp-primary-soft" as any]: accentTriplet[2],
      } as React.CSSProperties)
    : {};

  // Visual scope: inherit the mp-* tokens used on the "Claim your moniTag™"
  // page. When dark mode is active, override the same tokens locally so the
  // dashboard becomes a near-black surface with a green-tinted accent — the
  // exact palette of the landing page in dark mode.
  const darkTokens: React.CSSProperties = isDark
    ? ({
        ["--mp-ink" as any]: "0 0% 98%",
        ["--mp-muted" as any]: "0 0% 64%",
        ["--mp-surface" as any]: "0 0% 4%", // #0a0a0a-ish
        ["--mp-surface-elev" as any]: "0 0% 7%",
        ["--mp-border" as any]: "145 40% 28% / 0.45",
        ["--mp-faint" as any]: "0 0% 12%",
      } as React.CSSProperties)
    : {};

  const pageStyle: React.CSSProperties = {
    ...darkTokens,
    ...accentTokens,
    background:
      `radial-gradient(ellipse 70% 50% at 50% -10%, hsl(var(--mp-primary) / ${isDark ? 0.22 : 0.16}), transparent 70%), ` +
      `radial-gradient(ellipse 60% 40% at 100% 100%, hsl(var(--mp-primary) / ${isDark ? 0.14 : 0.08}), transparent 70%), ` +
      `radial-gradient(ellipse 60% 40% at 0% 80%, hsl(var(--mp-primary) / ${isDark ? 0.10 : 0.06}), transparent 70%), ` +
      `radial-gradient(circle at 1px 1px, hsl(var(--mp-primary) / ${isDark ? 0.14 : 0.06}) 1px, transparent 0) 0 0/22px 22px, ` +
      `hsl(var(--mp-surface))`,
    color: "hsl(var(--mp-ink))",
  };

  // ── Balance fetcher — re-runs on network/address change ──
  useEffect(() => {
    let cancelled = false;
    const rpc = RPC[preferredNetwork] ?? RPC.celo;
    setBalanceLoading(true);
    (async () => {
      try {
        const client = createPublicClient({
          chain: wagmiChainFromNetwork(preferredNetwork),
          transport: http(rpc),
        });
        const tokens =
          activeChain.supportedTokens && activeChain.supportedTokens.length > 0
            ? activeChain.supportedTokens.map((t) => ({
                address: t.address as `0x${string}`,
                decimals: t.decimals,
              }))
            : [{ address: activeChain.token, decimals: activeChain.decimals }];
        const results = await Promise.all(
          tokens.map(async (t) => {
            try {
              const v = await (client as any).readContract({
                address: t.address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [walletAddress],
              });
              return parseFloat(formatUnits(v as bigint, t.decimals));
            } catch { return 0; }
          }),
        );
        if (cancelled) return;
        setBalanceUsd(results.reduce((a, b) => a + b, 0));
      } catch {
        if (!cancelled) setBalanceUsd(0);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [preferredNetwork, walletAddress, activeChain]);

  // Check if wallet is activated on the current preferredNetwork
  useEffect(() => {
    if (!walletAddress) {
      return;
    }
    let cancelled = false;
    const checkActivation = async () => {
      setCheckingActivation(true);
      try {
        const { data, error } = await supabase.functions.invoke("activation-funder", {
          body: {
            action: "checkGasBalance",
            walletAddress,
            chain: preferredNetwork.toUpperCase(),
          },
        });
        if (error) throw error;
        if (cancelled) return;
        setIsActivated(!!data?.hasEnoughForActivation);
      } catch (err) {
        console.warn("[WalletDashboard] Failed to check activation:", err);
      } finally {
        if (!cancelled) setCheckingActivation(false);
      }
    };
    checkActivation();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, preferredNetwork]);

  const balanceLabel = activeChain.supportedTokens && activeChain.supportedTokens.length > 1
    ? "USD"
    : activeChain.currency;

  return (
    <div data-minipay="" className="wallet-dashboard-surface min-h-screen overflow-x-hidden" style={pageStyle}>
      {/* Header */}
      <header
        className="px-5 pt-6 pb-4"
        style={{ borderBottom: "1px solid hsl(var(--mp-border))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <MoniPayLogo size={28} />
            <span className="font-bold tracking-tight text-[14px]" style={{ color: "hsl(var(--mp-ink))" }}>
              Monipay
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors"
              style={{
                border: "1px solid hsl(var(--mp-border))",
                background: "transparent",
                color: "hsl(var(--mp-ink))",
              }}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            {sessionType === "external_wallet" && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors"
                style={{ background: "hsl(var(--mp-surface-elev))", color: "hsl(var(--mp-ink))" }}
                aria-label="Disconnect"
              >
                <LogOut className="w-3.5 h-3.5" /> Disconnect
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="px-5 py-6 space-y-6 max-w-xl mx-auto">
        {/* Balance card — user identity + multi-chain balance + network pills */}
        <section
          className="mp-card p-6"
          style={{ background: "hsl(var(--mp-surface-elev))" }}
        >
          {/* Identity row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {isLegacy && (
                <p
                  className="text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "hsl(var(--mp-muted))" }}
                >
                  Wallet · linked
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <h1 className="text-[20px] font-extrabold tracking-tight truncate" style={{ color: "hsl(var(--mp-ink))" }}>
                  {displayName ?? shortAddr(walletAddress)}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[11px] font-mono" style={{ color: "hsl(var(--mp-muted))" }}>
                  {shortAddr(walletAddress)}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-black/5 transition-colors"
                  style={{ color: "hsl(var(--mp-muted))" }}
                  aria-label="Copy wallet address"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHideBalance((v) => !v)}
              className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
              style={{ color: "hsl(var(--mp-muted))" }}
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Balance */}
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "hsl(var(--mp-muted))" }}>
              Balance
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className="text-[34px] font-extrabold tracking-tight tabular-nums"
                style={{ color: "hsl(var(--mp-ink))" }}
              >
                {hideBalance
                  ? "••••"
                  : balanceLoading && balanceUsd === null
                  ? "—"
                  : `$${(balanceUsd ?? 0).toFixed(2)}`}
              </span>
              <span className="text-[12px] font-semibold" style={{ color: "hsl(var(--mp-muted))" }}>
                {balanceLabel}
              </span>
              <button
                type="button"
                disabled={activating || isActivated || checkingActivation}
                onClick={async () => {
                  if (activating || isActivated || checkingActivation) return;
                  setActivating(true);
                  const chainLabel = (CHAIN_CONFIGS[preferredNetwork] as any)?.name
                    ?? preferredNetwork.toUpperCase();
                  const tId = toast.loading(`Activating on ${chainLabel}…`);
                  try {
                    const res = await ensureGasForApproval(preferredNetwork, walletAddress);
                    if (res.funded) {
                      setIsActivated(true);
                      toast.success(
                        res.alreadyFunded
                          ? `Already activated on ${chainLabel}`
                          : `Activated on ${chainLabel}`,
                        { id: tId },
                      );
                    } else {
                      toast.error(res.reason || "Activation failed", { id: tId });
                    }
                  } catch (e: any) {
                    toast.error(e?.message || "Activation failed", { id: tId });
                  } finally {
                    setActivating(false);
                  }
                }}
                className="ml-auto inline-flex items-center gap-1 text-[9px] px-1.5 h-5 rounded-full font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-80"
                style={
                  isActivated
                    ? {
                        background: "hsl(var(--mp-primary) / 0.2)",
                        color: "hsl(var(--mp-primary-strong))",
                        border: "1px solid hsl(var(--mp-primary) / 0.5)",
                      }
                    : {
                        background: "hsl(var(--mp-primary) / 0.12)",
                        color: "hsl(var(--mp-primary))",
                        border: "1px solid hsl(var(--mp-primary) / 0.35)",
                      }
                }
                aria-label={
                  isActivated
                    ? `Wallet activated on ${preferredNetwork}`
                    : `Activate wallet on ${preferredNetwork}`
                }
              >
                {checkingActivation ? (
                  "Checking…"
                ) : activating ? (
                  "Activating…"
                ) : isActivated ? (
                  <>
                    <Check className="w-2.5 h-2.5" /> Activated
                  </>
                ) : (
                  <>
                    <Zap className="w-2.5 h-2.5" /> Activate
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Network pills */}
          <div className="mt-5 pt-5" style={{ borderTop: "1px dashed hsl(var(--mp-border))" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "hsl(var(--mp-muted))" }}>
                Network
              </p>
              <span
                className="text-[10px] uppercase tracking-[0.16em] font-semibold"
                style={{ color: "hsl(var(--mp-primary))" }}
              >
                {balanceLabel}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                {WALLET_NETWORKS.map((net) => {
                const cfg = CHAIN_CONFIGS[net];
                const selected = preferredNetwork === net;
                return (
                  <button
                    key={net}
                    type="button"
                    onClick={() => handleNetworkChange(net)}
                    className="px-3.5 h-8 rounded-full text-[11px] font-bold uppercase tracking-[0.10em] transition-all"
                    style={{
                      background: selected ? "hsl(var(--mp-primary) / 0.12)" : "hsl(var(--mp-surface))",
                      color: selected ? "hsl(var(--mp-primary))" : "hsl(var(--mp-ink))",
                      border: `1px solid ${selected ? "hsl(var(--mp-primary) / 0.45)" : "hsl(var(--mp-border))"}`,
                    }}
                  >
                    {cfg.name}
                  </button>
                );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                style={{
                  background: "hsl(var(--mp-surface))",
                  border: "1px solid hsl(var(--mp-border))",
                  color: "hsl(var(--mp-ink))",
                }}
                aria-label="Transaction history"
                title="Transaction history"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Celo holdings breakdown — only when Celo is the active network */}
          {preferredNetwork === "celo" && (
            <div className="mt-5 pt-5" style={{ borderTop: "1px dashed hsl(var(--mp-border))" }}>
              <CeloHoldingsCollapse walletAddress={walletAddress} forceTheme={isDark ? 'dark' : 'light'} />
            </div>
          )}
        </section>

        {/* Pending MagicPay funds — only render the section when there is at
            least one pending claim, so empty-state never shows. We mount the
            card off-screen to detect count, then reveal it once populated. */}
        {profileId && !isMiniPay && (
          <section
            className={pendingIouCount > 0 ? "mp-card p-6" : "hidden"}
            style={{ background: "hsl(var(--mp-surface-elev))" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full"
                style={{ background: "hsl(var(--mp-primary) / 0.12)", color: "hsl(var(--mp-primary))" }}
              >
                <Coins className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-sm font-semibold" style={{ color: "hsl(var(--mp-ink))" }}>
                MagicPay
              </h2>
            </div>
            <PendingIOUsCard
              identities={identities}
              walletAddressOverride={walletAddress}
              onVisibleCountChange={setPendingIouCount}
            />
          </section>
        )}

        {/* MoniBot — primary surface */}
        <section
          className="mp-card p-6"
          style={{ background: "hsl(var(--mp-surface-elev))" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full"
              style={{ background: "hsl(var(--mp-primary) / 0.12)", color: "hsl(var(--mp-primary))" }}
            >
              <Bot className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight" style={{ color: "hsl(var(--mp-ink))" }}>
              MoniBot
            </h2>
          </div>

          {profileId && isLegacy ? (
            <MoniBotSettings profileId={profileId} />
          ) : profileId ? (
            <div className="space-y-4">
              <WalletAllowanceCard
                walletAddress={walletAddress}
                profileId={profileId}
                preferredNetwork={preferredNetwork}
              />
              <WalletMoniBotSettings
                profileId={profileId}
                walletAddress={walletAddress}
              />
            </div>
          ) : (
            <div
              className="rounded-2xl p-5 text-center text-sm"
              style={{
                border: "1px solid hsl(var(--mp-border))",
                color: "hsl(var(--mp-muted))",
                background: "hsl(var(--mp-surface))",
              }}
            >
              Setting up your wallet profile…
            </div>
          )}
        </section>

        {/* More — single sheet, no 404 dead-ends */}
        <section
          className="mp-card p-6"
          style={{ background: "hsl(var(--mp-surface-elev))" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full"
              style={{ background: "hsl(var(--mp-primary) / 0.12)", color: "hsl(var(--mp-primary))" }}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-sm font-semibold" style={{ color: "hsl(var(--mp-ink))" }}>
              More
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors"
            style={{
              border: "1px solid hsl(var(--mp-border))",
              background: "hsl(var(--mp-surface))",
              color: "hsl(var(--mp-ink))",
            }}
          >
            <span className="flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4" style={{ color: "hsl(var(--mp-primary))" }} />
              Merchant tools & storefront
            </span>
            <span className="text-[11px]" style={{ color: "hsl(var(--mp-muted))" }}>
              Coming soon
            </span>
          </button>
        </section>

        {/* What is MoniBot — opens the shared modal */}
        <section
          className="mp-card p-6"
          style={{ background: "hsl(var(--mp-surface-elev))" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full"
              style={{ background: "hsl(var(--mp-primary) / 0.12)", color: "hsl(var(--mp-primary))" }}
            >
              <Info className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-sm font-semibold" style={{ color: "hsl(var(--mp-ink))" }}>
              What is MoniBot AI
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowWhatIsMoniBot(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors"
            style={{
              border: "1px solid hsl(var(--mp-border))",
              background: "hsl(var(--mp-surface))",
              color: "hsl(var(--mp-ink))",
            }}
          >
            <span className="flex items-center gap-2 font-medium">
              <Bot className="w-4 h-4" style={{ color: "hsl(var(--mp-primary))" }} />
              How MoniBot upgrades your wallet
            </span>
            <ExternalLink className="w-4 h-4" style={{ color: "hsl(var(--mp-muted))" }} />
          </button>
        </section>

        {/* Use MoniBot — quick-add to Discord / Telegram / X */}
        <section
          className="mp-card p-6"
          style={{ background: "hsl(var(--mp-surface-elev))" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full"
              style={{ background: "hsl(var(--mp-primary) / 0.12)", color: "hsl(var(--mp-primary))" }}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-sm font-semibold" style={{ color: "hsl(var(--mp-ink))" }}>
              Use MoniBot
            </h2>
          </div>
          <div className="space-y-2">
            {[
              { href: 'https://discord.com/oauth2/authorize?client_id=1473815294022520964&permissions=2147483648&scope=bot', label: 'Add to Discord', sub: 'Invite the bot to your guild', kind: 'discord' as const },
              { href: 'https://t.me/monipaybot?startgroup=new', label: 'Add to Telegram', sub: 'Open in Telegram', kind: 'telegram' as const },
              { href: 'https://x.com/intent/tweet?text=%40monibot%20', label: 'Tweet at MoniBot', sub: 'Send a public command', kind: 'twitter' as const },
            ].map((it) => (
              <a
                key={it.label}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors"
                style={{
                  border: "1px solid hsl(var(--mp-border))",
                  background: "hsl(var(--mp-surface))",
                  color: "hsl(var(--mp-ink))",
                }}
              >
                <span
                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                  style={{ background: "hsl(var(--mp-primary) / 0.12)", color: "hsl(var(--mp-primary))" }}
                >
                  {it.kind === 'discord' && (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                    </svg>
                  )}
                  {it.kind === 'telegram' && <Send className="w-4 h-4" />}
                  {it.kind === 'twitter' && <Twitter className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <p className="font-medium leading-tight">{it.label}</p>
                  <p className="text-[11px] truncate" style={{ color: "hsl(var(--mp-muted))" }}>{it.sub}</p>
                </span>
                <ExternalLink className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--mp-muted))" }} />
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Transaction history modal */}
      <AnimatePresence>
        {showHistory && (
          <TransactionHistory onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>

      {/* More sheet — clean explanation instead of dead routes */}
      <Sheet open={showMore} onOpenChange={setShowMore}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>More features</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Merchant tools, hosted storefront and on-chain profile pages
              require a full MoniPay account (encrypted local key + PIN).
              They're coming to wallet-connect users next — for now you can
              still receive and send via your wallet and the MoniBot card
              above.
            </p>
            <div className="rounded-xl p-4" style={{ background: "hsl(var(--mp-surface))" }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: "hsl(var(--mp-ink))" }}>
                Want the full dashboard now?
              </p>
              <p className="text-[12px] mb-3" style={{ color: "hsl(var(--mp-muted))" }}>
                Create a MoniPay account on top of this wallet — your wallet
                stays connected and your moniTag carries over.
              </p>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.removeItem("monipay_wallet_mode"); } catch { /* ignore */ }
                  window.location.assign("/?onboard=1");
                }}
                className="mp-cta w-full h-10 inline-flex items-center justify-center gap-2 !rounded-xl"
              >
                <Wallet className="w-4 h-4" /> Create MoniPay account
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {!isLegacy && (
        <OnChainIdentitySelector
          open={showIdentity}
          onOpenChange={setShowIdentity}
          walletAddress={walletAddress}
          currentPreferredName={preferredName}
          onSaved={(next) => setPreferredName(next)}
        />
      )}

      <WhatIsMoniBotModal open={showWhatIsMoniBot} onOpenChange={setShowWhatIsMoniBot} />
    </div>
  );
}