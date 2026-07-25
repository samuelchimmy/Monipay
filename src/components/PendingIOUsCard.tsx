import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPublicClient, http, formatUnits, defineChain } from "viem";
import { base, bsc, celo, ink } from "viem/chains";
import { Loader2, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { feedback, soundManager } from "@/lib/feedback";
import { supabase } from "@/integrations/supabase/client";
import { getRecipientId, IOU_REGISTRY_ABI, getIOURegistryAddress, IOU_SUPPORTED_CHAINS } from "@/lib/iouRegistry";
import { CHAIN_CONFIGS, type EvmNetwork } from "@/config/chains";
import { usePayTag } from "@/contexts/PayTagContext";

interface PendingIOUsCardProps {
  identities: Array<{ platform: "discord" | "telegram" | "twitter"; userId: string | null | undefined }>;
  onVisibleCountChange?: (count: number) => void;
  /**
   * Path C (external wallet) sessions don't have a `paytag_profile` in
   * localStorage, so `usePayTag()` returns no `profile.wallet.address`.
   * Callers in that flow pass the connected wallet here so MagicPay claims
   * still work end-to-end.
   */
  walletAddressOverride?: `0x${string}` | string | null;
}

interface IouDetail {
  id: bigint;
  sender: string;
  grossAmount: bigint;
  netAmount: bigint;
  expiry: bigint;
}

interface PendingGroup {
  chain: EvmNetwork;
  platform: string;
  userId: string;
  recipientId: `0x${string}`;
  iouIds: bigint[];
  iouDetails: IouDetail[];
  totalNet: number;
  symbol: string;
  decimals: number;
  senderLabel: string;
  /** Which IOU registry version these IOUs belong to (for claim routing) */
  registryVersion: "v1" | "v2";
  /** The actual registry address that was scanned */
  registryAddress: string;
}

const VIEM_CHAINS: Record<EvmNetwork, any> = {
  base,
  bsc,
  celo,
  ink,
  tempo: defineChain({
    id: 42431,
    name: "Tempo",
    nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.moderato.tempo.xyz"] } },
  }) as any,
  arbitrum: base,
  optimism: base,
  polygon: base,
  ethereum: base,
  arc: base,
};

const NETWORK_THEMES: Record<
  string,
  {
    bg: string;
    bgFrom: string;
    bgTo: string;
    illustrationOpacity: string;
    textPrimary: string;
    textSecondary: string;
    logo: string;
    label: string;
    badgeBg: string;
    activatedBg: string;
    buttonBg: string;
    buttonText: string;
    divider: string;
  }
> = {
  base: {
    bg: "linear-gradient(145deg, #0041cc 0%, #0052FF 60%, #2d7aff 100%)",
    bgFrom: "#0041cc",
    bgTo: "#2d7aff",
    illustrationOpacity: "0.07",
    textPrimary: "#ffffff",
    textSecondary: "rgba(255,255,255,0.55)",
    logo: "/chains/base-logo.svg",
    label: "BASE",
    badgeBg: "rgba(255,255,255,0.13)",
    activatedBg: "rgba(255,255,255,0.2)",
    buttonBg: "rgba(255,255,255,0.15)",
    buttonText: "#ffffff",
    divider: "rgba(255,255,255,0.12)",
  },
  bsc: {
    bg: "linear-gradient(145deg, #b8840a 0%, #F0B90B 60%, #f7d060 100%)",
    bgFrom: "#b8840a",
    bgTo: "#f7d060",
    illustrationOpacity: "0.08",
    textPrimary: "#1a1000",
    textSecondary: "rgba(0,0,0,0.45)",
    logo: "/chains/bsc-logo.svg",
    label: "BSC",
    badgeBg: "rgba(0,0,0,0.09)",
    activatedBg: "rgba(0,0,0,0.14)",
    buttonBg: "rgba(0,0,0,0.12)",
    buttonText: "#1a1000",
    divider: "rgba(0,0,0,0.1)",
  },
  celo: {
    bg: "linear-gradient(145deg, #c8cb00 0%, #FCFF52 60%, #ffff8a 100%)",
    bgFrom: "#c8cb00",
    bgTo: "#ffff8a",
    illustrationOpacity: "0.08",
    textPrimary: "#1a1a00",
    textSecondary: "rgba(0,0,0,0.45)",
    logo: "/chains/celo-logo.png",
    label: "CELO",
    badgeBg: "rgba(0,0,0,0.09)",
    activatedBg: "rgba(0,0,0,0.14)",
    buttonBg: "rgba(0,0,0,0.1)",
    buttonText: "#1a1a00",
    divider: "rgba(0,0,0,0.1)",
  },
  ink: {
    bg: "linear-gradient(145deg, #4a2d7a 0%, #7B5EA7 60%, #a07ecc 100%)",
    bgFrom: "#4a2d7a",
    bgTo: "#a07ecc",
    illustrationOpacity: "0.07",
    textPrimary: "#ffffff",
    textSecondary: "rgba(255,255,255,0.55)",
    logo: "/chains/ink-logo.webp",
    label: "INK",
    badgeBg: "rgba(255,255,255,0.13)",
    activatedBg: "rgba(255,255,255,0.2)",
    buttonBg: "rgba(255,255,255,0.15)",
    buttonText: "#ffffff",
    divider: "rgba(255,255,255,0.12)",
  },
};

const DEFAULT_THEME = {
  bg: "linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
  bgFrom: "#0f172a",
  bgTo: "#334155",
  illustrationOpacity: "0.06",
  textPrimary: "#ffffff",
  textSecondary: "rgba(255,255,255,0.5)",
  logo: "",
  label: "CHAIN",
  badgeBg: "rgba(255,255,255,0.1)",
  activatedBg: "rgba(255,255,255,0.16)",
  buttonBg: "rgba(255,255,255,0.12)",
  buttonText: "#ffffff",
  divider: "rgba(255,255,255,0.1)",
};

// ── Gift card background illustrations ──────────────────────────────────────

function GiftCardIllustrations({ opacity }: { opacity: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 380 220"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity }}
    >
      {/* Large gift box bottom-right */}
      <g transform="translate(270, 120)">
        <rect x="0" y="20" width="70" height="55" rx="4" fill="white" />
        <rect x="0" y="12" width="70" height="14" rx="3" fill="white" opacity="0.8" />
        <line x1="35" y1="12" x2="35" y2="75" stroke="white" strokeWidth="3" opacity="0.5" />
        <line x1="0" y1="19" x2="70" y2="19" stroke="white" strokeWidth="3" opacity="0.5" />
        <path d="M25,12 Q20,-2 35,0 Q50,-2 45,12" fill="none" stroke="white" strokeWidth="2.5" opacity="0.7" />
        <path d="M25,12 Q15,5 20,-4 Q28,-8 35,0" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
        <path d="M45,12 Q55,5 50,-4 Q42,-8 35,0" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
        <circle cx="35" cy="0" r="3" fill="white" opacity="0.6" />
      </g>
      {/* Parachute airdrop top-left */}
      <g transform="translate(18, 8)">
        <path d="M30,28 Q30,0 0,0 Q-30,0 -30,28" fill="none" stroke="white" strokeWidth="2" opacity="0.8" />
        <line x1="-30" y1="28" x2="0" y2="48" stroke="white" strokeWidth="1.5" opacity="0.6" />
        <line x1="30" y1="28" x2="0" y2="48" stroke="white" strokeWidth="1.5" opacity="0.6" />
        <line x1="0" y1="28" x2="0" y2="48" stroke="white" strokeWidth="1.5" opacity="0.5" />
        <rect x="-10" y="48" width="20" height="14" rx="3" fill="white" opacity="0.7" />
        <line x1="-6" y1="53" x2="6" y2="53" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="-6" y1="57" x2="6" y2="57" stroke="white" strokeWidth="1.5" opacity="0.4" />
      </g>
      {/* Small gift box top-right */}
      <g transform="translate(310, 10)">
        <rect x="0" y="10" width="36" height="28" rx="3" fill="white" opacity="0.9" />
        <rect x="0" y="4" width="36" height="10" rx="2" fill="white" opacity="0.7" />
        <line x1="18" y1="4" x2="18" y2="38" stroke="white" strokeWidth="2" opacity="0.4" />
        <path d="M12,4 Q10,-4 18,-2 Q26,-4 24,4" fill="none" stroke="white" strokeWidth="1.8" opacity="0.6" />
        <circle cx="18" cy="-2" r="2" fill="white" opacity="0.5" />
      </g>
      {/* Sparkles */}
      <g opacity="0.75">
        <g transform="translate(155, 22)">
          <line x1="0" y1="-7" x2="0" y2="7" stroke="white" strokeWidth="1.5" />
          <line x1="-7" y1="0" x2="7" y2="0" stroke="white" strokeWidth="1.5" />
          <line x1="-5" y1="-5" x2="5" y2="5" stroke="white" strokeWidth="1" />
          <line x1="5" y1="-5" x2="-5" y2="5" stroke="white" strokeWidth="1" />
        </g>
        <g transform="translate(240, 170)">
          <line x1="0" y1="-5" x2="0" y2="5" stroke="white" strokeWidth="1.2" />
          <line x1="-5" y1="0" x2="5" y2="0" stroke="white" strokeWidth="1.2" />
          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke="white" strokeWidth="0.8" />
          <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke="white" strokeWidth="0.8" />
        </g>
        <g transform="translate(90, 160)">
          <line x1="0" y1="-4" x2="0" y2="4" stroke="white" strokeWidth="1" />
          <line x1="-4" y1="0" x2="4" y2="0" stroke="white" strokeWidth="1" />
        </g>
        <circle cx="200" cy="55" r="2.5" fill="white" opacity="0.5" />
        <circle cx="130" cy="190" r="2" fill="white" opacity="0.4" />
        <circle cx="340" cy="90" r="2" fill="white" opacity="0.4" />
        <circle cx="60" cy="100" r="1.5" fill="white" opacity="0.35" />
        <circle cx="180" cy="130" r="1.5" fill="white" opacity="0.3" />
      </g>
      {/* Confetti */}
      <g opacity="0.4">
        <rect x="110" y="40" width="8" height="4" rx="1" fill="white" transform="rotate(25 110 40)" />
        <rect x="220" y="185" width="7" height="3" rx="1" fill="white" transform="rotate(-15 220 185)" />
        <rect x="160" y="175" width="6" height="3" rx="1" fill="white" transform="rotate(40 160 175)" />
        <rect x="290" y="50" width="5" height="3" rx="1" fill="white" transform="rotate(-30 290 50)" />
        <rect x="70" y="70" width="6" height="3" rx="1" fill="white" transform="rotate(15 70 70)" />
      </g>
      {/* Small parachute bottom-left */}
      <g transform="translate(50, 130)" opacity="0.6">
        <path d="M16,14 Q16,0 0,0 Q-16,0 -16,14" fill="none" stroke="white" strokeWidth="1.5" />
        <line x1="-16" y1="14" x2="0" y2="24" stroke="white" strokeWidth="1" />
        <line x1="16" y1="14" x2="0" y2="24" stroke="white" strokeWidth="1" />
        <rect x="-5" y="24" width="10" height="8" rx="2" fill="white" opacity="0.7" />
      </g>
    </svg>
  );
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatExpiry(expiry: bigint) {
  return new Date(Number(expiry) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSentDate(expiry: bigint) {
  const sentMs = Number(expiry) * 1000 - 180 * 24 * 60 * 60 * 1000;
  return new Date(sentMs).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntilExpiry(expiry: bigint) {
  return Math.max(0, Math.floor((Number(expiry) * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ── Main component ───────────────────────────────────────────────────────────

export function PendingIOUsCard({ identities, onVisibleCountChange, walletAddressOverride }: PendingIOUsCardProps) {
  const { profile, refreshBalance } = usePayTag() as any;
  const effectiveAddress: string | null =
    (profile?.wallet?.address as string | undefined) ?? (walletAddressOverride ?? null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());
  const [activationStatus, setActivationStatus] = useState<Record<string, boolean>>({});
  const [checkingActivation, setCheckingActivation] = useState<Record<string, boolean>>({});

  const identitiesKey = identities
    .filter((i) => i.userId)
    .map((i) => `${i.platform}:${i.userId}`)
    .sort()
    .join("|");

  const checkActivation = async (chain: EvmNetwork) => {
    if (!effectiveAddress) return;
    const stateKey = `activation_${chain}`;
    setCheckingActivation((prev) => ({ ...prev, [stateKey]: true }));
    try {
      const { data } = await supabase.functions.invoke("activation-funder", {
        body: { action: "check", walletAddress: effectiveAddress, chain: chain.toUpperCase() },
      });
      setActivationStatus((prev) => ({ ...prev, [chain]: data?.activated ?? false }));
    } catch {
      setActivationStatus((prev) => ({ ...prev, [chain]: false }));
    } finally {
      setCheckingActivation((prev) => ({ ...prev, [stateKey]: false }));
    }
  };

  const handleActivate = async (chain: EvmNetwork) => {
    if (!effectiveAddress) return;
    const stateKey = `activation_${chain}`;
    setCheckingActivation((prev) => ({ ...prev, [stateKey]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("activation-funder", {
        body: { action: "fund", walletAddress: effectiveAddress, chain: chain.toUpperCase() },
      });
      if (error) throw error;
      toast.success(`Wallet activated on ${chain.toUpperCase()}!`);
      setActivationStatus((prev) => ({ ...prev, [chain]: true }));
    } catch (e: any) {
      toast.error(e?.message || "Activation failed");
    } finally {
      setCheckingActivation((prev) => ({ ...prev, [stateKey]: false }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        // Build all (identity, chain) scan tasks and run them in parallel.
        const tasks: Array<Promise<PendingGroup | null>> = [];
        const chainsToActivate = new Set<EvmNetwork>();

        for (const identity of identities) {
          if (!identity.userId) continue;
          const recipientId = getRecipientId(identity.platform, identity.userId);
          for (const chainName of IOU_SUPPORTED_CHAINS) {
            const cfg = CHAIN_CONFIGS[chainName];

            // Build the list of registries to scan for this chain.
            // On Celo: scan both V1 (USDT) and V2 (G$/USDC/USDm) in parallel.
            const registriesToScan: Array<{ address: string; version: "v1" | "v2"; symbol: string; decimals: number }> = [];

            if (chainName === "celo") {
              if (cfg.iouRegistryV1) {
                registriesToScan.push({ address: cfg.iouRegistryV1, version: "v1", symbol: "USDT", decimals: 6 });
              }
              if (cfg.iouRegistry) {
                registriesToScan.push({ address: cfg.iouRegistry, version: "v2", symbol: "G$", decimals: 18 });
              }
            } else {
              const registry = getIOURegistryAddress(chainName);
              if (registry) {
                registriesToScan.push({ address: registry, version: "v1", symbol: cfg.currency, decimals: cfg.decimals });
              }
            }

            for (const regInfo of registriesToScan) {
              tasks.push((async (): Promise<PendingGroup | null> => {
                try {
                  const client: any = createPublicClient({
                    chain: VIEM_CHAINS[chainName],
                    transport: http(cfg.rpcUrls[0]),
                  });
                  const result = (await client.readContract({
                    address: regInfo.address as `0x${string}`,
                    abi: IOU_REGISTRY_ABI,
                    functionName: "getPendingIOUs",
                    args: [recipientId],
                  })) as readonly [readonly bigint[], bigint];

                  const [ids, count] = result;
                  if (count === 0n || ids.length === 0) return null;

                  const [iouResults, iouRowRes] = await Promise.all([
                    Promise.all(
                      ids.map((id) =>
                        client.readContract({
                          address: regInfo.address as `0x${string}`,
                          abi: IOU_REGISTRY_ABI,
                          functionName: "ious",
                          args: [id],
                        }) as Promise<readonly [string, bigint, bigint, string, bigint, boolean, boolean]>
                      )
                    ),
                    supabase
                      .from("ious")
                      .select("sender_pay_tag, recipient_identifier")
                      .eq("platform", identity.platform)
                      .eq("platform_user_id", identity.userId!)
                      .eq("chain", chainName)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle(),
                  ]);

                  let totalNetUnits = 0n;
                  const iouDetails: IouDetail[] = [];
                  ids.forEach((id, i) => {
                    const [sender, grossAmount, netAmount, , expiry, claimed, refunded] = iouResults[i];
                    if (!claimed && !refunded) {
                      totalNetUnits += netAmount;
                      iouDetails.push({ id, sender, grossAmount, netAmount, expiry });
                    }
                  });
                  if (totalNetUnits === 0n) return null;

                  let senderLabel = "";
                  const iouRow = iouRowRes?.data as any;
                  if (iouRow?.sender_pay_tag) {
                    senderLabel = `@${iouRow.sender_pay_tag}`;
                  } else if (iouRow?.recipient_identifier) {
                    const parts = String(iouRow.recipient_identifier).split(":");
                    if (parts.length >= 2 && parts[1]) senderLabel = `@${parts[1]}`;
                  }

                  chainsToActivate.add(chainName);

                  return {
                    chain: chainName,
                    platform: identity.platform,
                    userId: identity.userId!,
                    recipientId,
                    iouIds: [...ids],
                    iouDetails,
                    totalNet: parseFloat(formatUnits(totalNetUnits, regInfo.decimals)),
                    symbol: regInfo.symbol,
                    decimals: regInfo.decimals,
                    senderLabel,
                    registryVersion: regInfo.version,
                    registryAddress: regInfo.address,
                  };
                } catch (err) {
                  console.warn(`[PendingIOUs] scan failed for ${chainName}:${identity.platform} registry=${regInfo.version}`, err);
                  return null;
                }
              })());
            }
          }
        }

        const results = await Promise.all(tasks);
        if (cancelled) return;
        const found = results.filter((g): g is PendingGroup => g !== null);
        setGroups(found);
        // Dedupe activation checks: one per chain, in parallel.
        chainsToActivate.forEach((c) => checkActivation(c));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!identitiesKey) {
      setGroups([]);
      setLoading(false);
      return;
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identitiesKey]);

  const handleClaim = async (group: PendingGroup) => {
    if (!effectiveAddress) {
      toast.error("Wallet not loaded yet. Please refresh and try again.");
      return;
    }

    // MiniPay wallets are Celo-only. If a pending IOU is on another chain,
    // bail out with a clear, non-technical message instead of letting the
    // edge function fail with an opaque error.
    const isInMiniPay = !!(window as any).ethereum?.isMiniPay;
    if (isInMiniPay && group.chain !== "celo") {
      toast.error("MiniPay only supports Celo", {
        description: `This MagicPay is on ${String(group.chain).toUpperCase()}. Open MoniPay at monipay.xyz to claim it.`,
      });
      return;
    }

    const key = `${group.chain}:${group.platform}:${group.userId}`;
    setClaimingKey(key);
    try {
      const { data, error } = await supabase.functions.invoke("claim-social-funds", {
        body: {
          chain: group.chain,
          platform: group.platform,
          platformUserId: group.userId,
          iouIds: group.iouIds.map((b) => b.toString()),
          claimantAddress: effectiveAddress,
          // Pass the registry version so the edge function routes to the correct contract
          registryVersion: group.registryVersion ?? "v2",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Claimed $${group.totalNet.toFixed(2)} ${group.symbol}!`, {
        description: "Funds delivered to your wallet.",
      });
      feedback("success");
      try {
        soundManager.play("success" as any);
      } catch {}
      setClaimedKeys((s) => new Set(s).add(key));
      try {
        await refreshBalance?.();
      } catch {}
    } catch (e: any) {
      console.error("claim-social-funds error", e);
      toast.error(e?.message || "Claim failed");
      feedback("error");
    } finally {
      setClaimingKey(null);
    }
  };

  const visibleGroupsPreview = groups.filter((g) => !claimedKeys.has(`${g.chain}:${g.platform}:${g.userId}`));
  useEffect(() => {
    if (loading) return;
    onVisibleCountChange?.(visibleGroupsPreview.length);
  }, [loading, visibleGroupsPreview.length, onVisibleCountChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-1 py-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Scanning for pending MagicPay funds...</p>
      </div>
    );
  }

  const visibleGroups = visibleGroupsPreview;
  if (visibleGroups.length === 0) return null;

  return (
    <div className="space-y-5">
      <AnimatePresence>
        {visibleGroups.map((group) => {
          const key = `${group.chain}:${group.platform}:${group.userId}`;
          const isClaiming = claimingKey === key;
          const theme = NETWORK_THEMES[group.chain] ?? DEFAULT_THEME;
          const isActivated = activationStatus[group.chain] ?? false;
          const isCheckingAct = checkingActivation[`activation_${group.chain}`] ?? false;
          const firstIou = group.iouDetails[0];
          const expiryDays = firstIou ? daysUntilExpiry(firstIou.expiry) : 0;
          const isExpiringSoon = expiryDays < 14;
          const claimDisabled = isClaiming || (!isActivated && !isCheckingAct);
          const receiverLabel = profile?.payTag ? `@${profile.payTag}` : "—";

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.94 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            >
              {/* ══ GIFT CARD ════════════════════════════════════════════ */}
              <div
                className="relative w-full overflow-hidden"
                style={{
                  background: theme.bg,
                  borderRadius: "20px",
                }}
              >
                {/* Fun background illustrations */}
                <GiftCardIllustrations opacity={theme.illustrationOpacity} />

                {/* Subtle inner glow top */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.18) 0%, transparent 50%)",
                  }}
                />

                <div className="relative z-10 flex flex-col">
                  {/* ── TOP SECTION ─────────────────────────────────── */}
                  <div className="px-5 pt-5 pb-4">
                    {/* Row 1: Network logo + label | Activation badge */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        {theme.logo && (
                          <img
                            src={theme.logo}
                            alt={theme.label}
                            className="w-5 h-5 rounded-[3px] object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <span
                          className="text-[10px] font-black tracking-[0.28em] uppercase"
                          style={{ color: theme.textSecondary }}
                        >
                          {theme.label}
                        </span>
                      </div>

                      {/* Activation pill */}
                      {isCheckingAct ? (
                        <div
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                          style={{ background: theme.badgeBg }}
                        >
                          <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: theme.textSecondary }} />
                          <span className="text-[9px] font-semibold" style={{ color: theme.textSecondary }}>
                            Checking
                          </span>
                        </div>
                      ) : isActivated ? (
                        <div
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                          style={{ background: theme.activatedBg }}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" style={{ color: theme.textPrimary }} />
                          <span className="text-[9px] font-black tracking-widest" style={{ color: theme.textPrimary }}>
                            ACTIVATED
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleActivate(group.chain)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full transition-opacity hover:opacity-75 active:scale-95"
                          style={{ background: theme.badgeBg }}
                        >
                          <Zap className="w-2.5 h-2.5" style={{ color: theme.textPrimary }} />
                          <span className="text-[9px] font-black tracking-widest" style={{ color: theme.textPrimary }}>
                            ACTIVATE
                          </span>
                        </button>
                      )}
                    </div>

                    {/* MagicPay label + You received label */}
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className="text-[11px] font-bold tracking-[0.18em] uppercase"
                        style={{ color: theme.textSecondary }}
                      >
                        You received
                      </div>
                      <div className="text-[15px] font-black tracking-tight" style={{ color: theme.textPrimary }}>
                        ✦ MagicPay
                      </div>
                    </div>

                    {/* Amount — hero */}
                    <div
                      className="text-[42px] font-black tracking-tight leading-none tabular-nums"
                      style={{ color: theme.textPrimary }}
                    >
                      ${group.totalNet.toFixed(2)}
                      <span className="text-[16px] font-bold ml-2" style={{ color: theme.textSecondary }}>
                        {group.symbol}
                      </span>
                    </div>
                  </div>

                  {/* ── DIVIDER ──────────────────────────────────────── */}
                  <div style={{ height: "1px", background: theme.divider, margin: "0 20px" }} />

                  {/* ── META ROW ─────────────────────────────────────── */}
                  <div className="px-5 py-4 grid grid-cols-3 gap-2">
                    {/* From → To */}
                    <div>
                      <div
                        className="text-[8px] font-bold tracking-[0.18em] uppercase mb-1"
                        style={{ color: theme.textSecondary }}
                      >
                        From → To
                      </div>
                      <div
                        className="text-[11px] font-bold leading-tight truncate"
                        style={{ color: theme.textPrimary }}
                      >
                        {group.senderLabel || "—"}
                      </div>
                      <div
                        className="text-[11px] font-bold leading-tight truncate"
                        style={{ color: theme.textPrimary }}
                      >
                        {receiverLabel}
                      </div>
                      <div className="text-[10px] capitalize mt-0.5" style={{ color: theme.textSecondary }}>
                        via {group.platform}
                      </div>
                    </div>

                    {/* Sent */}
                    <div className="text-center">
                      <div
                        className="text-[8px] font-bold tracking-[0.18em] uppercase mb-1"
                        style={{ color: theme.textSecondary }}
                      >
                        Sent
                      </div>
                      <div className="text-[11px] font-semibold leading-tight" style={{ color: theme.textPrimary }}>
                        {firstIou ? formatSentDate(firstIou.expiry) : "—"}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: theme.textSecondary }}>
                        {group.iouIds.length} transfer{group.iouIds.length !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Expires */}
                    <div className="text-right">
                      <div
                        className="text-[8px] font-bold tracking-[0.18em] uppercase mb-1"
                        style={{ color: theme.textSecondary }}
                      >
                        Expires
                      </div>
                      <div
                        className="text-[11px] font-semibold leading-tight"
                        style={{ color: isExpiringSoon ? "#ff6b6b" : theme.textPrimary }}
                      >
                        {firstIou ? formatExpiry(firstIou.expiry) : "—"}
                      </div>
                      {isExpiringSoon && (
                        <div className="text-[10px] mt-0.5" style={{ color: "#ff6b6b" }}>
                          {expiryDays}d left!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── DIVIDER ──────────────────────────────────────── */}
                  <div style={{ height: "1px", background: theme.divider, margin: "0 20px" }} />

                  {/* ── CLAIM BUTTON (inside card) ────────────────────── */}
                  <div className="px-5 py-4">
                    {!isActivated && !isCheckingAct && (
                      <div className="flex items-start gap-2 mb-3">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed" style={{ color: theme.textSecondary }}>
                          Activate your wallet on {theme.label} first. Tap{" "}
                          <button
                            onClick={() => handleActivate(group.chain)}
                            className="underline underline-offset-2 font-semibold"
                            style={{ color: theme.textPrimary }}
                          >
                            Activate
                          </button>{" "}
                          above — takes a second.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => handleClaim(group)}
                      disabled={claimDisabled}
                      className="w-full h-12 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.98]"
                      style={{
                        background: claimDisabled ? theme.badgeBg : theme.buttonBg,
                        color: claimDisabled ? theme.textSecondary : theme.buttonText,
                        backdropFilter: "blur(8px)",
                        border: `1.5px solid ${theme.divider}`,
                      }}
                    >
                      {isClaiming ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Claim ${group.totalNet.toFixed(2)} {group.symbol}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
