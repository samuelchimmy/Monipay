import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { usePayTag } from "@/contexts/PayTagContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  Unlink,
  AlertTriangle,
  Wallet,
  Twitter,
  Shield,
  Settings2,
  RefreshCw,
  Zap,
  BadgeCheck,
  Globe,
  Send,
  ChevronDown,
  Info,
  Users,
  Sparkles,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { supabase } from "@/integrations/supabase/client";
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, erc20Abi, defineChain } from "viem";
import { base, bsc, celo, ink } from "viem/chains";
import { CHAIN_CONFIGS } from "@/config/chains";

const tempoTestnet = defineChain({
  id: 42431,
  name: "Tempo Testnet",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.moderato.tempo.xyz"] } },
});

function getViemChain(network: SupportedNetwork) {
  if (network === "bsc") return bsc;
  if (network === "tempo") return tempoTestnet;
  if (network === "celo") return celo;
  if (network === "ink") return ink;
  return base;
}

function getDefaultRpc(network: SupportedNetwork) {
  const cfg = (CHAIN_CONFIGS as any)[network];
  if (cfg?.rpcUrls?.[0]) return cfg.rpcUrls[0];
  if (network === "bsc") return "https://bsc-dataseed.binance.org";
  if (network === "tempo") return "https://rpc.moderato.tempo.xyz";
  return "https://mainnet.base.org";
}
import { decryptPrivateKey, getRpcOverride, setRpcOverride, getAvailableRpcEndpoints } from "@/lib/wallet";
import { privateKeyToAccount } from "viem/accounts";
import { getDeviceId } from "@/lib/deviceId";
import celoGlyph from "@/assets/celo-glyph.png";
import { VerifiedBadge } from "./VerifiedBadge";
import { PendingIOUsCard } from "./PendingIOUsCard";
import { NetworkToggle } from "./NetworkToggle";
import { PinPromptDialog } from "./PinPromptDialog";

// Import from centralized contract config
import { MONIBOT_ROUTER_ADDRESS, USDC_ADDRESS, getMoniBotConfig } from "@/lib/monibotContract";
import { APP_CONFIG } from "@/config/app";
import type { SupportedNetwork } from "@/config/chains";
import { getIOURegistryAddress, IOU_SUPPORTED_CHAINS } from "@/lib/iouRegistry";

// Create public client for reading blockchain state
const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

export interface SocialIdentity {
  x_username: string | null;
  x_user_id: string | null;
  x_verified: boolean;
  x_verification_code: string | null;
  bot_allowance_amount: number;
  discord_id: string | null;
  discord_username: string | null;
  telegram_id: string | null;
  telegram_username: string | null;
  bluesky_id: string | null;
  bluesky_username: string | null;
}

interface MoniBotSettingsProps {
  profileId: string;
}

export const socialIdentityCacheKey = (profileId: string) => `monipay_social_identity_${profileId}`;

// UUID validation helper
const isValidUUID = (id: string): boolean => {
  if (!id || typeof id !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// ─── X OAuth PKCE helpers ───────────────────────────────────────────────────

const X_CLIENT_ID = "OXhvZ21SV1QzWGhkYmdSNktWZ2Y6MTpjaQ";
const TELEGRAM_BOT_USERNAME = "monipaybot"; // Login Widget bot; must match TELEGRAM_BOT_TOKEN on the edge function

function shouldUseTelegramRedirectFlow(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as any).ethereum;
  const ua = navigator.userAgent || "";
  return Boolean(
    eth?.isMiniPay ||
      /MiniPay|Opera Mini|OPR\//i.test(ua),
  );
}

/** Generate a cryptographically random code verifier (URL-safe base64, up to 128 chars) */
function generateCodeVerifier(): string {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 128);
}

/** Synchronous pure JS SHA-256 implementation */
function sha256Sync(ascii: string): Uint8Array {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const lengthProperty = "length";
  let i: number, j: number;

  const words: number[] = [];
  const asciiLength = ascii[lengthProperty];
  
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  let candidate = 2;
  while (primeCounter < 64) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * 0x100000000) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * 0x100000000) | 0;
      primeCounter++;
    }
    candidate++;
  }

  let str = ascii + "\x80";
  while (str[lengthProperty] % 64 - 56) {
    str += "\x00";
  }

  for (i = 0; i < str[lengthProperty]; i++) {
    j = str.charCodeAt(i);
    if (j >> 8) return new Uint8Array(); // ASCII only
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiLength * 8) / 0x100000000) | 0;
  words[words[lengthProperty]] = (asciiLength * 8) | 0;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const temp2 = w[i - 16] + s0 + w[i - 7] + s1;
      
      const w_i = i < 16 ? w[i] : (w[i] = (temp2 | 0));

      const a = hash[0], e = hash[4];
      const s0_h = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const ch = (e & hash[5]) ^ (~e & hash[6]);
      const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ch + k[i] + w_i;
      
      const s1_h = s0_h + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + s1_h) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  const output = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    output[i * 4] = (hash[i] >>> 24) & 0xff;
    output[i * 4 + 1] = (hash[i] >>> 16) & 0xff;
    output[i * 4 + 2] = (hash[i] >>> 8) & 0xff;
    output[i * 4 + 3] = hash[i] & 0xff;
  }
  return output;
}

/** Derive the PKCE S256 code challenge from a verifier synchronously */
function generateCodeChallengeSync(verifier: string): string {
  const digest = sha256Sync(verifier);
  return btoa(String.fromCharCode(...digest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ───────────────────────────────────────────────────────────────────────────

export function MoniBotSettings({ profileId }: MoniBotSettingsProps) {
  const { profile, setPreferredNetwork, refreshBalance } = usePayTag();
  const [identity, setIdentity] = useState<SocialIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [currentAllowance, setCurrentAllowance] = useState<string>("0");
  const [currentIouAllowance, setCurrentIouAllowance] = useState<string>("0");
  const [isApprovingAllowance, setIsApprovingAllowance] = useState(false);
  const [isApprovingIou, setIsApprovingIou] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState(false);
  const [iouApprovalSuccess, setIouApprovalSuccess] = useState(false);
  const [allowanceTooltipOpen, setAllowanceTooltipOpen] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ open: boolean; kind: "allowance" | "iou" | null }>({
    open: false,
    kind: null,
  });
  const [isUnlinkingX, setIsUnlinkingX] = useState(false);

  // Dynamic token selection for Celo V1 / V2 migration
  const [selectedToken, setSelectedToken] = useState<"USDT" | "G$" | "USDC" | "USDm">("USDT");

  // Admin/Dev tools state
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [currentRpc, setCurrentRpc] = useState<string | null>(null);
  const [customRpcInput, setCustomRpcInput] = useState("");

  const network = (profile?.preferredNetwork || "base") as SupportedNetwork;
  const isCelo = network === "celo";

  const celoTokenObj = isCelo
    ? CHAIN_CONFIGS.celo.supportedTokens?.find((t) => t.symbol === selectedToken)
    : null;

  const activeTokenAddress = isCelo && celoTokenObj
    ? celoTokenObj.address
    : getMoniBotConfig(network).tokenAddress;
  const activeDecimals = isCelo && celoTokenObj ? celoTokenObj.decimals : getMoniBotConfig(network).decimals;

  const activeRouter = isCelo
    ? (selectedToken === "USDT"
        ? (CHAIN_CONFIGS.celo.monibotRouterV1 as `0x${string}`)
        : (CHAIN_CONFIGS.celo.monibotRouter as `0x${string}`))
    : getMoniBotConfig(network).routerAddress;

  const iouRegistryAddr = getIOURegistryAddress(network as any);
  const activeIouRegistry = isCelo
    ? (selectedToken === "USDT"
        ? (CHAIN_CONFIGS.celo.iouRegistryV1 as `0x${string}`)
        : (CHAIN_CONFIGS.celo.iouRegistry as `0x${string}`))
    : iouRegistryAddr;

  // Validate profileId — use context profile.id as fallback
  const validProfileId = isValidUUID(profileId)
    ? profileId
    : profile?.id && isValidUUID(profile.id)
      ? profile.id
      : null;

  useEffect(() => {
    if (!isValidUUID(profileId)) {
      console.error(
        "MoniBotSettings: Invalid profileId provided:",
        profileId,
        "- Expected UUID format. Using context fallback:",
        profile?.id,
      );
    }
  }, [profileId, profile?.id]);

  useEffect(() => {
    setCurrentRpc(getRpcOverride());
  }, []);

  // Auto-detect G$ balance on Celo on load
  useEffect(() => {
    if (profile?.preferredNetwork === "celo" && profile?.wallet?.address) {
      const address = profile.wallet.address;
      import("@/lib/celoWallet").then(({ getCeloTokenBalance }) => {
        getCeloTokenBalance(address as `0x${string}`, "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", 18)
          .then((bal) => {
            if (bal > 0) {
              setSelectedToken("G$");
            }
          })
          .catch(() => {});
      });
    }
  }, [profile?.preferredNetwork, profile?.wallet?.address]);

  const isAdmin = profile?.payTag?.toLowerCase() === "monibot";

  useEffect(() => {
    if (validProfileId) {
      fetchIdentity();
      fetchCurrentAllowance();
    }
  }, [validProfileId, profile?.preferredNetwork, selectedToken]);

  const readCachedIdentity = useCallback((): SocialIdentity | null => {
    if (!validProfileId) return null;
    try {
      const raw = localStorage.getItem(socialIdentityCacheKey(validProfileId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as SocialIdentity;
    } catch {
      return null;
    }
  }, [validProfileId]);

  const writeCachedIdentity = useCallback(
    (next: SocialIdentity | null) => {
      if (!validProfileId) return;
      try {
        if (!next) {
          localStorage.removeItem(socialIdentityCacheKey(validProfileId));
          return;
        }
        localStorage.setItem(socialIdentityCacheKey(validProfileId), JSON.stringify(next));
      } catch {
        // Non-fatal
      }
    },
    [validProfileId],
  );

  const fetchIdentity = async () => {
    if (!validProfileId) return;
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: { action: "get", profileId: validProfileId },
      });

      if (response.error) throw response.error;

      const next = response.data as SocialIdentity;
      setIdentity(next);
      writeCachedIdentity(next);
    } catch (error) {
      console.error("Failed to fetch social identity:", error);
      const cached = readCachedIdentity();
      if (cached) setIdentity(cached);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentAllowance = async () => {
    if (!profile?.wallet?.address) return;

    try {
      const client = createPublicClient({
        chain: getViemChain(network),
        transport: http(getDefaultRpc(network)),
      });

      const [routerAllowance, iouAllowance] = await Promise.all([
        (client as any).readContract({
          address: activeTokenAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [profile.wallet.address as `0x${string}`, activeRouter],
        }),
        activeIouRegistry
          ? (client as any).readContract({
              address: activeTokenAddress,
              abi: erc20Abi,
              functionName: "allowance",
              args: [profile.wallet.address as `0x${string}`, activeIouRegistry as `0x${string}`],
            })
          : Promise.resolve(0n),
      ]);

      setCurrentAllowance(formatUnits(routerAllowance, activeDecimals));
      setCurrentIouAllowance(formatUnits(iouAllowance, activeDecimals));
    } catch (error) {
      console.error("Failed to fetch allowance:", error);
    }
  };

  // ── X unlink ────────────────────────────────────────────────────────────
  const handleUnlinkX = async () => {
    if (!validProfileId) return;
    setIsUnlinkingX(true);
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: {
          action: "unlink-x",
          profileId: validProfileId,
          walletAddress: profile?.wallet?.address,
        },
      });

      if (response.error) throw response.error;

      toast.success("X account unlinked");
      feedback("success");
      fetchIdentity();
    } catch (error: any) {
      console.error("Failed to unlink X:", error);
      toast.error(error.message || "Failed to unlink X account");
      feedback("error");
    } finally {
      setIsUnlinkingX(false);
    }
  };

  // ── Bot allowance ────────────────────────────────────────────────────────
  const handleApproveAllowance = async (pin: string) => {
    if (!profile?.wallet?.encryptedPrivateKey || !allowanceAmount) {
      toast.error("Please enter an amount");
      return;
    }

    const amount = parseFloat(allowanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!pin) return;

    setIsApprovingAllowance(true);
    try {
      const walletAddress = profile.wallet.address as `0x${string}`;
      const deviceId = getDeviceId();

      const network = (profile?.preferredNetwork || "base") as SupportedNetwork;

      const fundChain =
        network === "bsc"
          ? "BSC"
          : network === "celo"
            ? "CELO"
            : network === "ink"
              ? "INK"
              : network === "base"
                ? "BASE"
                : null;

      if (fundChain) {
        const checkClient = createPublicClient({
          chain: getViemChain(network),
          transport: http(getDefaultRpc(network)),
        });
        const nativeBalance = await checkClient.getBalance({ address: walletAddress });

        if (nativeBalance < 1_000_000_000_000n) {
          toast.loading("Preparing wallet for approval…", { id: "approval" });
          try {
            await supabase.functions.invoke("activation-funder", {
              body: { action: "fund", walletAddress, deviceId, chain: fundChain },
            });
          } catch (e) {
            console.warn("[approval] activation-funder call failed, will check balance anyway:", e);
          }

          const deadline = Date.now() + 12_000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500));
            const bal = await checkClient.getBalance({ address: walletAddress });
            if (bal > 0n) break;
          }
          const finalBal = await checkClient.getBalance({ address: walletAddress });
          if (finalBal === 0n) {
            const gasSymbol = network === "bsc" ? "BNB" : network === "celo" ? "CELO" : "ETH";
            toast.error(`Couldn't sponsor ${gasSymbol} gas right now. Please try again in a moment.`, {
              id: "approval",
            });
            setIsApprovingAllowance(false);
            return;
          }
        }
      }

      const privateKey = decryptPrivateKey(profile.wallet.encryptedPrivateKey, pin);
      const account = privateKeyToAccount(privateKey as `0x${string}`);

      const chainObj = getViemChain(network);

      const walletClient = createWalletClient({
        account,
        chain: chainObj,
        transport: http(getDefaultRpc(network)),
      });

      const amountInUnits = parseUnits(amount.toFixed(activeDecimals), activeDecimals);

      const hash = await (walletClient as any).writeContract({
        address: activeTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [activeRouter, amountInUnits],
        chain: chainObj,
        account,
      });

      toast.loading("Approving allowance...", { id: "approval" });

      const confirmClient = createPublicClient({
        chain: chainObj,
        transport: http(getDefaultRpc(network)),
      });
      const receipt = await confirmClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "reverted") {
        throw new Error(
          network === "bsc"
            ? "Transaction reverted. You may not have enough BNB for gas fees on BSC."
            : network === "tempo"
              ? "Transaction reverted. Visit faucet.tempo.xyz to get testnet gas funds first."
              : "Transaction reverted on-chain.",
        );
      }

      if (validProfileId) {
        await supabase.functions.invoke("social-identity", {
          body: {
            action: "update-allowance",
            profileId: validProfileId,
            walletAddress: profile?.wallet?.address,
            amount: amount,
          },
        });
      }

      toast.success("Allowance approved successfully!", { id: "approval" });
      feedback("success");
      setApprovalSuccess(true);
      setAllowanceAmount("");
      await fetchCurrentAllowance();
      fetchIdentity();
      setTimeout(() => setApprovalSuccess(false), 2200);
    } catch (error: any) {
      console.error("Failed to approve allowance:", error);
      toast.error(error.message || "Failed to approve allowance", { id: "approval" });
      feedback("error");
    } finally {
      setIsApprovingAllowance(false);
    }
  };

  // ── MagicPay (IOURegistry) allowance ────────────────────────────────────
  const handleApproveIouRegistry = async (pin: string) => {
    if (!profile?.wallet?.encryptedPrivateKey || !allowanceAmount) {
      toast.error("Please enter an amount");
      return;
    }
    const amount = parseFloat(allowanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!activeIouRegistry) {
      toast.error(`MagicPay is not deployed on ${network.toUpperCase()} yet`);
      return;
    }

    if (!pin) return;

    setIsApprovingIou(true);
    try {
      const walletAddress = profile.wallet.address as `0x${string}`;
      const deviceId = getDeviceId();

      const fundChain =
        network === "bsc"
          ? "BSC"
          : network === "celo"
            ? "CELO"
            : network === "ink"
              ? "INK"
              : network === "base"
                ? "BASE"
                : null;

      if (fundChain) {
        const checkClient = createPublicClient({
          chain: getViemChain(network),
          transport: http(getDefaultRpc(network)),
        });
        const nativeBalance = await checkClient.getBalance({ address: walletAddress });
        if (nativeBalance < 1_000_000_000_000n) {
          toast.loading("Preparing wallet for approval…", { id: "iou-approval" });
          try {
            await supabase.functions.invoke("activation-funder", {
              body: { action: "fund", walletAddress, deviceId, chain: fundChain },
            });
          } catch (e) {
            console.warn("[iou-approval] activation-funder call failed:", e);
          }
          const deadline = Date.now() + 12_000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500));
            const bal = await checkClient.getBalance({ address: walletAddress });
            if (bal > 0n) break;
          }
          const finalBal = await checkClient.getBalance({ address: walletAddress });
          if (finalBal === 0n) {
            const gasSymbol = network === "bsc" ? "BNB" : network === "celo" ? "CELO" : "ETH";
            toast.error(`Couldn't sponsor ${gasSymbol} gas right now. Please try again in a moment.`, {
              id: "iou-approval",
            });
            setIsApprovingIou(false);
            return;
          }
        }
      }

      const privateKey = decryptPrivateKey(profile.wallet.encryptedPrivateKey, pin);
      const account = privateKeyToAccount(privateKey as `0x${string}`);

      const chainObj = getViemChain(network);
      const walletClient = createWalletClient({
        account,
        chain: chainObj,
        transport: http(getDefaultRpc(network)),
      });

      const amountInUnits = parseUnits(amount.toFixed(activeDecimals), activeDecimals);

      toast.loading("Approving MagicPay…", { id: "iou-approval" });
      const hash = await (walletClient as any).writeContract({
        address: activeTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [activeIouRegistry as `0x${string}`, amountInUnits],
        chain: chainObj,
        account,
      });

      const confirmClient = createPublicClient({
        chain: chainObj,
        transport: http(getDefaultRpc(network)),
      });
      const receipt = await confirmClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("MagicPay approval reverted on-chain.");
      }

      toast.success("MagicPay approved! Bots can now create IOUs on your behalf.", { id: "iou-approval" });
      feedback("success");
      setIouApprovalSuccess(true);
      setAllowanceAmount("");
      await fetchCurrentAllowance();
      setTimeout(() => setIouApprovalSuccess(false), 2200);
    } catch (error: any) {
      console.error("Failed to approve MagicPay:", error);
      toast.error(error.message || "Failed to approve MagicPay", { id: "iou-approval" });
      feedback("error");
    } finally {
      setIsApprovingIou(false);
    }
  };

  const handleCheckSubscription = async () => {
    setIsCheckingSubscription(true);
    try {
      const response = await supabase.functions.invoke("twitter-subscription-manager", {
        body: { action: "check" },
      });

      if (response.error) throw response.error;

      if (response.data.subscribed) {
        toast.success("✅ Subscription is active!");
      } else {
        toast.warning("⚠️ No active subscription found");
        console.log("Subscription check details:", response.data);
      }
    } catch (error: any) {
      console.error("Failed to check subscription:", error);
      toast.error(error.message || "Failed to check subscription");
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  const handleCreateSubscription = async () => {
    setIsCreatingSubscription(true);
    try {
      const response = await supabase.functions.invoke("twitter-subscription-manager", {
        body: { action: "subscribe" },
      });

      if (response.error) throw response.error;

      if (response.data.success) {
        toast.success(`✅ ${response.data.message}`);
      } else {
        toast.error(`Failed: ${response.data.error}`);
        console.log("Create subscription details:", response.data);
      }
    } catch (error: any) {
      console.error("Failed to create subscription:", error);
      toast.error(error.message || "Failed to create subscription");
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasSocialLinked = Boolean(
    identity?.x_verified || identity?.discord_id || identity?.telegram_id || identity?.bluesky_id,
  );
  const canSetBotAllowance = isAdmin || hasSocialLinked;

  // ─── Network Theme ───────────────────────────────────────────────────────
  const tokenSymbol =
    network === "tempo"
      ? "αUSD"
      : network === "bsc"
        ? "USDT"
        : network === "celo"
          ? selectedToken
          : network === "ink"
            ? "USDT0"
            : network === "solana"
              ? "USDC"
              : "USDC";
  const iouRegistry = activeIouRegistry;

  const NETWORK_THEMES: Record<
    string,
    {
      bg: string;
      ring: string;
      chipBg: string;
      chipText: string;
      logo: string;
      label: string;
      textOnBg: string;
      subOnBg: string;
      tagline: string;
    }
  > = {
    base: {
      bg: "bg-[#0052FF]",
      ring: "ring-[#0052FF]/30",
      chipBg: "bg-[#0052FF]",
      chipText: "text-white",
      logo: "/chains/base-logo.svg",
      label: "Base",
      textOnBg: "text-white",
      subOnBg: "text-white/60",
      tagline: "Coinbase L2",
    },
    bsc: {
      bg: "bg-[#F0B90B]",
      ring: "ring-[#F0B90B]/30",
      chipBg: "bg-[#F0B90B]",
      chipText: "text-gray-950",
      logo: "/chains/bsc-logo.svg",
      label: "BSC",
      textOnBg: "text-gray-950",
      subOnBg: "text-gray-950/60",
      tagline: "BNB Smart Chain",
    },
    solana: {
      bg: "bg-gradient-to-br from-[#9945FF] to-[#14F195]",
      ring: "ring-[#9945FF]/30",
      chipBg: "bg-gradient-to-br from-[#9945FF] to-[#14F195]",
      chipText: "text-white",
      logo: "/chains/solana-logo.svg",
      label: "Solana",
      textOnBg: "text-white",
      subOnBg: "text-white/60",
      tagline: "Speed of Light",
    },
    ink: {
      bg: "bg-[#7B5EA7]",
      ring: "ring-[#7B5EA7]/30",
      chipBg: "bg-[#7B5EA7]",
      chipText: "text-white",
      logo: "/chains/ink-logo.webp",
      label: "Ink",
      textOnBg: "text-white",
      subOnBg: "text-white/60",
      tagline: "DeFi Native",
    },
    celo: {
      bg: "bg-[#FCFF52]",
      ring: "ring-[#FCFF52]/40",
      chipBg: "bg-[#FCFF52]",
      chipText: "text-gray-950",
      logo: "/chains/celo-logo.png",
      label: "Celo",
      textOnBg: "text-gray-950",
      subOnBg: "text-gray-950/60",
      tagline: "Mobile First",
    },
    tempo: {
      bg: "bg-foreground",
      ring: "ring-foreground/30",
      chipBg: "bg-foreground",
      chipText: "text-background",
      logo: "/chains/tempo-logo.svg",
      label: "Tempo",
      textOnBg: "text-background",
      subOnBg: "text-background/60",
      tagline: "Payment-Native",
    },
  };
  const theme = NETWORK_THEMES[network] || NETWORK_THEMES.base;

  const NETWORK_OPTIONS: SupportedNetwork[] = ["base", "bsc", "solana", "ink", "celo"];
  const selectableNetworks = NETWORK_OPTIONS.filter((n) => NETWORK_THEMES[n]);

  const isLightTheme = network === "celo" || network === "bsc";
  const innerSurface = isLightTheme ? "bg-black/5 border-black/10" : "bg-white/[0.08] border-white/10";
  const innerSurfaceSolid = isLightTheme ? "bg-black/[0.06]" : "bg-white/[0.07]";
  const dividerColor = isLightTheme ? "border-black/10" : "border-white/10";
  const mutedText = isLightTheme ? "text-gray-950/55" : "text-white/55";
  const strongText = isLightTheme ? "text-gray-950" : "text-white";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* ─── PendingIOUs sits OUTSIDE the master card ─── */}
        <PendingIOUsCard
          identities={
            [
              { platform: "discord" as const, userId: identity?.discord_id ?? null },
              { platform: "telegram" as const, userId: identity?.telegram_id ?? null },
              {
                platform: "twitter" as const,
                userId: identity?.x_verified ? (identity?.x_user_id ?? identity?.x_username ?? null) : null,
              },
            ].filter((i) => Boolean(i.userId)) as Array<{
              platform: "discord" | "telegram" | "twitter";
              userId: string;
            }>
          }
        />

        {/* ═══════════ MASTER CARD: themed network container ═══════════ */}
        <div className={`${theme.bg} rounded-2xl overflow-hidden transition-colors duration-300 shadow-xl`}>
          {/* HERO header */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                {network === "celo" ? (
                  <img
                    src={celoGlyph}
                    alt="Celo"
                    className="h-4 w-auto shrink-0 object-contain"
                  />
                ) : (
                  <>
                    <img src={theme.logo} alt={theme.label} className="w-5 h-5 rounded-[3px]" />
                    <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${theme.subOnBg}`}>
                      {theme.label}
                    </span>
                  </>
                )}
              </div>
              <span className={`text-2xl font-extrabold tracking-tight ${strongText}`}>{tokenSymbol}</span>
            </div>
            <h3 className={`text-sm font-bold mb-1 ${strongText} flex items-center gap-1.5`}>
              MoniBot AI <VerifiedBadge size={12} />
            </h3>
            <p className={`text-[11px] leading-relaxed ${mutedText} mb-4`}>
              {theme.tagline}. AI-powered social payments via Twitter, Discord, and Telegram.
            </p>

            <div className="pt-1">
              <NetworkToggle fullWidth />
            </div>
          </div>

          <div className={`mx-5 border-t ${dividerColor}`} />

          {/* ═══ SECTION 1: Approve AI Spending Allowance ═══ */}
          <div className="px-5 py-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`text-[10px] font-bold tracking-[0.2em] uppercase ${mutedText}`}>
                Approve AI Spending Allowance
              </h4>
              <button
                type="button"
                onClick={() => setAllowanceTooltipOpen(true)}
                className={`${mutedText} hover:${strongText} transition-colors -mr-1 p-1`}
                aria-label="About spending allowances"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {allowanceTooltipOpen && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in-0"
                  onClick={() => setAllowanceTooltipOpen(false)}
                >
                  <div
                    className="w-[300px] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3.5 text-[11px] leading-relaxed text-popover-foreground shadow-md animate-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">About</p>
                      <button
                        type="button"
                        onClick={() => setAllowanceTooltipOpen(false)}
                        className="-mr-1 -mt-1 p-1 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="font-bold mb-1">CasualPay</p>
                    <p className="mb-3 text-muted-foreground">
                      Send quick tips and everyday payments to moniTag™ users across social platforms, up to your set
                      limit.
                    </p>

                    <p className="font-bold mb-1">MagicPay</p>
                    <p className="mb-1.5 text-muted-foreground">
                      If the recipient isn't on MoniPay yet, your payment is securely held on chain. MoniBot shares a
                      claim link in the success message wherever the payment was made.
                    </p>
                    <p className="mb-3 text-muted-foreground">
                      The recipient can access their funds by visiting the link and linking their social account.
                      Unclaimed payments are refundable after 180 days.
                    </p>

                    <p className="text-muted-foreground">
                      Linking X, Discord, or Telegram is recommended for MoniBot identity, but approvals can still be
                      configured now. Each network requires its own approval. A 1% protocol fee applies to executed
                      transactions.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {network === "celo" && (
              <div className="grid grid-cols-4 gap-1 p-1 bg-black/10 dark:bg-white/10 rounded-lg text-[10px] font-bold">
                {(["USDT", "G$", "USDC", "USDm"] as const).map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => {
                      feedback("tap");
                      setSelectedToken(tok);
                    }}
                    className={`py-1 rounded transition-all text-center ${
                      selectedToken === tok
                        ? "bg-background text-foreground shadow-sm animate-in fade-in zoom-in-95 duration-200"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tok}
                  </button>
                ))}
              </div>
            )}

            {/* CasualPay + MagicPay tiles */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className={`rounded-xl p-3.5 border ${innerSurface}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-[10px] font-bold tracking-[0.18em] uppercase ${mutedText}`}>CasualPay</span>
                  <Sparkles className={`w-3 h-3 ${strongText} opacity-50`} />
                </div>
                <p className={`text-lg font-extrabold tabular-nums tracking-tight ${strongText}`}>
                  ${parseFloat(currentAllowance).toFixed(2)}
                </p>
                <p className={`text-[10px] mt-0.5 ${mutedText}`}>{tokenSymbol} approved</p>
              </div>

              <div
                className={`rounded-xl p-3.5 border ${iouRegistry ? innerSurface : `${innerSurface} opacity-60 border-dashed`}`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-[10px] font-bold tracking-[0.18em] uppercase ${mutedText}`}>MagicPay</span>
                  <Zap className={`w-3 h-3 ${strongText} opacity-50`} />
                </div>
                <p className={`text-lg font-extrabold tabular-nums tracking-tight ${strongText}`}>
                  {iouRegistry ? `$${parseFloat(currentIouAllowance).toFixed(2)}` : "—"}
                </p>
                <p className={`text-[10px] mt-0.5 ${mutedText}`}>
                  {iouRegistry ? `${tokenSymbol} approved` : "Not on this chain"}
                </p>
              </div>
            </div>

            {/* Amount input + dual approve buttons */}
            <div className={`rounded-xl p-3.5 border space-y-3 ${innerSurface}`}>
              <div>
                <label className={`text-[10px] font-bold tracking-[0.18em] uppercase mb-2 block ${mutedText}`}>
                  Approval amount ({tokenSymbol})
                </label>
                <Input
                  type="number"
                  value={allowanceAmount}
                  onChange={(e) => setAllowanceAmount(e.target.value)}
                  placeholder="100.00"
                  className={`h-11 text-base font-semibold tabular-nums border-0 ${innerSurfaceSolid} ${strongText}`}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setPinDialog({ open: true, kind: "allowance" })}
                  disabled={isApprovingAllowance || !allowanceAmount}
                  className={`h-11 text-xs font-bold justify-center gap-1.5 transition-all ${
                    approvalSuccess
                      ? "bg-emerald-500 text-white hover:bg-emerald-500"
                      : isLightTheme
                        ? "bg-gray-950 text-white hover:bg-gray-900"
                        : "bg-white text-gray-950 hover:bg-white/90"
                  }`}
                >
                  {isApprovingAllowance ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
                    </>
                  ) : approvalSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /> Success
                    </>
                  ) : (
                    "Approve CasualPay"
                  )}
                </Button>
                <Button
                  onClick={() => setPinDialog({ open: true, kind: "iou" })}
                  disabled={isApprovingIou || !allowanceAmount || !iouRegistry}
                  className={`h-11 text-xs font-bold justify-center gap-1.5 transition-all ${
                    iouApprovalSuccess
                      ? "bg-emerald-500 text-white hover:bg-emerald-500"
                      : isLightTheme
                        ? "bg-gray-950 text-white hover:bg-gray-900"
                        : "bg-white text-gray-950 hover:bg-white/90"
                  }`}
                >
                  {isApprovingIou ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
                    </>
                  ) : iouApprovalSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /> Success
                    </>
                  ) : (
                    "Approve MagicPay"
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className={`mx-5 border-t ${dividerColor}`} />

          {/* ═══ SECTION 2: Connect Social Accounts ═══ */}
          <div className="px-5 py-5">
            <ConnectSocialsSection
              identity={identity}
              isUnlinkingX={isUnlinkingX}
              handleUnlinkX={handleUnlinkX}
              validProfileId={validProfileId}
              walletAddress={profile?.wallet?.address}
              fetchIdentity={fetchIdentity}
              setIdentity={setIdentity}
              writeCachedIdentity={writeCachedIdentity}
              themeClasses={{ innerSurface, innerSurfaceSolid, dividerColor, mutedText, strongText, isLightTheme }}
            />
          </div>

          <div className={`mx-5 border-t ${dividerColor}`} />

          {/* ═══ SECTION 3: Add MoniBot to Server ═══ */}
          <div className="px-5 py-5">
            <h4 className={`text-[10px] font-bold tracking-[0.2em] uppercase ${mutedText} mb-3`}>
              Add MoniBot to Your Server
            </h4>
            <div className={`rounded-xl overflow-hidden border ${innerSurface}`}>
              {[
                {
                  href: "https://discord.com/oauth2/authorize?client_id=1473815294022520964&permissions=2147483648&scope=bot",
                  label: "Add to Discord",
                  sub: "Invite the bot to your guild",
                  icon: "discord" as const,
                },
                {
                  href: "https://t.me/monipaybot?startgroup=new",
                  label: "Add to Telegram",
                  sub: "Open in Telegram",
                  icon: "telegram" as const,
                },
                {
                  href: "https://x.com/intent/tweet?text=%40monibot%20",
                  label: "Tweet at MoniBot",
                  sub: "Send a public command",
                  icon: "twitter" as const,
                },
              ].map((item, idx, arr) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3.5 py-3 transition-colors ${idx < arr.length - 1 ? `border-b ${dividerColor}` : ""}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${innerSurfaceSolid}`}>
                    {item.icon === "discord" && (
                      <svg
                        viewBox="0 0 24 24"
                        className={`w-4 h-4 ${isLightTheme ? "fill-gray-950" : "fill-white"}`}
                        aria-hidden="true"
                      >
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                      </svg>
                    )}
                    {item.icon === "telegram" && <Send className={`w-4 h-4 ${strongText}`} />}
                    {item.icon === "twitter" && <Twitter className={`w-4 h-4 ${strongText}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${strongText}`}>{item.label}</p>
                    <p className={`text-[11px] truncate ${mutedText}`}>{item.sub}</p>
                  </div>
                  <ExternalLink className={`w-4 h-4 shrink-0 ${mutedText}`} />
                </a>
              ))}
            </div>
            <p className={`text-[10px] text-center pt-3 ${mutedText}`}>
              Once added, members can use MoniBot commands to send instant payments.
            </p>
          </div>
        </div>
      </div>

      <PinPromptDialog
        open={pinDialog.open}
        title={pinDialog.kind === "iou" ? "Approve MagicPay" : "Approve CasualPay"}
        description={
          pinDialog.kind === "iou"
            ? "Enter your PIN to authorize the MagicPay approval transaction."
            : "Enter your PIN to authorize the CasualPay approval transaction."
        }
        confirmLabel="Sign & Approve"
        onCancel={() => setPinDialog({ open: false, kind: null })}
        onSubmit={(pin) => {
          const kind = pinDialog.kind;
          setPinDialog({ open: false, kind: null });
          if (kind === "allowance") {
            void handleApproveAllowance(pin);
          } else if (kind === "iou") {
            void handleApproveIouRegistry(pin);
          }
        }}
      />
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// ConnectSocialsSection
// ─────────────────────────────────────────────────────────────

interface ConnectSocialsProps {
  identity: SocialIdentity | null;
  isUnlinkingX: boolean;
  handleUnlinkX: () => void;
  validProfileId: string | null;
  walletAddress?: string;
  fetchIdentity: () => void;
  setIdentity: React.Dispatch<React.SetStateAction<SocialIdentity | null>>;
  writeCachedIdentity: (next: SocialIdentity | null) => void;
  themeClasses: {
    innerSurface: string;
    innerSurfaceSolid: string;
    dividerColor: string;
    mutedText: string;
    strongText: string;
    isLightTheme: boolean;
  };
}

export function ConnectSocialsSection(props: ConnectSocialsProps) {
  const [expanded, setExpanded] = useState(false);
  const { identity, themeClasses: t } = props;
  const linkedCount =
    (identity?.x_verified ? 1 : 0) +
    (identity?.discord_id ? 1 : 0) +
    (identity?.telegram_id ? 1 : 0) +
    (identity?.bluesky_id ? 1 : 0);

  return (
    <div>
      <h4 className={`text-[10px] font-bold tracking-[0.2em] uppercase ${t.mutedText} mb-3`}>
        Connect Social Accounts
      </h4>
      <div className={`rounded-xl overflow-hidden border ${t.innerSurface}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-3 px-3.5 py-3 transition-colors ${expanded ? `border-b ${t.dividerColor}` : ""}`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.innerSurfaceSolid}`}>
            <Users className={`w-4 h-4 ${t.strongText}`} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className={`text-sm font-semibold ${t.strongText}`}>Linked accounts</p>
            <p className={`text-[11px] ${t.mutedText}`}>
              {linkedCount === 0 ? "No accounts linked yet" : `${linkedCount} of 4 connected`}
            </p>
          </div>
          <ChevronDown
            className={`w-4 h-4 ${t.mutedText} shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3.5 space-y-2.5">
                {/* ── X OAuth card (new) ── */}
                <XLinkCard
                  identity={props.identity}
                  isUnlinkingX={props.isUnlinkingX}
                  handleUnlinkX={props.handleUnlinkX}
                  validProfileId={props.validProfileId}
                  walletAddress={props.walletAddress}
                  fetchIdentity={props.fetchIdentity}
                  setIdentity={props.setIdentity}
                  writeCachedIdentity={props.writeCachedIdentity}
                  themeClasses={t}
                />

                {/* Discord (unchanged) */}
                <DiscordLinkCard
                  identity={props.identity}
                  validProfileId={props.validProfileId}
                  walletAddress={props.walletAddress}
                  fetchIdentity={props.fetchIdentity}
                  setIdentity={props.setIdentity}
                  writeCachedIdentity={props.writeCachedIdentity}
                  themeClasses={t}
                />

                {/* Telegram (unchanged) */}
                <TelegramLinkCard
                  identity={props.identity}
                  validProfileId={props.validProfileId}
                  walletAddress={props.walletAddress}
                  fetchIdentity={props.fetchIdentity}
                  setIdentity={props.setIdentity}
                  writeCachedIdentity={props.writeCachedIdentity}
                  themeClasses={t}
                />

                {/* Bluesky — handle + app password modal */}
                <BlueskyLinkCard
                  identity={props.identity}
                  validProfileId={props.validProfileId}
                  walletAddress={props.walletAddress}
                  fetchIdentity={props.fetchIdentity}
                  setIdentity={props.setIdentity}
                  writeCachedIdentity={props.writeCachedIdentity}
                  themeClasses={t}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// XLinkCard — OAuth popup flow (replaces tweet-verification)
// ─────────────────────────────────────────────────────────────

interface XLinkCardProps {
  identity: SocialIdentity | null;
  isUnlinkingX: boolean;
  handleUnlinkX: () => void;
  validProfileId: string | null;
  walletAddress?: string;
  fetchIdentity: () => void;
  setIdentity: React.Dispatch<React.SetStateAction<SocialIdentity | null>>;
  writeCachedIdentity: (next: SocialIdentity | null) => void;
  themeClasses: {
    innerSurface: string;
    innerSurfaceSolid: string;
    dividerColor: string;
    mutedText: string;
    strongText: string;
    isLightTheme: boolean;
  };
}

export function XLinkCard({
  identity,
  isUnlinkingX,
  handleUnlinkX,
  validProfileId,
  walletAddress,
  fetchIdentity,
  setIdentity,
  writeCachedIdentity,
  themeClasses: t,
}: XLinkCardProps) {
  const [isLinking, setIsLinking] = useState(false);

  // Listen for success postMessage from /x-callback
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "x-oauth-success") return;

      const { x_username, x_user_id } = event.data;

      setIdentity((prev) => {
        const next: SocialIdentity = {
          ...prev!,
          x_username,
          x_user_id,
          x_verified: true,
          x_verification_code: null,
        };
        writeCachedIdentity(next);
        return next;
      });

      toast.success(`X linked as @${x_username}!`);
      feedback("success");
      fetchIdentity();
      setIsLinking(false);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchIdentity, setIdentity, writeCachedIdentity]);

  const handleConnectX = async () => {
    console.log("handleConnectX fired", { validProfileId, walletAddress, X_CLIENT_ID });

    if (!validProfileId || !walletAddress) {
      toast.error("Please connect your wallet first.");
      return;
    }

    if (!X_CLIENT_ID) {
      toast.error("X OAuth is not configured.");
      return;
    }

    setIsLinking(true);

    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallengeSync(codeVerifier);

      const state = btoa(
        JSON.stringify({ profileId: validProfileId, walletAddress, codeVerifier })
      );

      const redirectUri = `${window.location.origin}/x-callback`;

      const params = new URLSearchParams({
        response_type: "code",
        client_id: X_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: "tweet.read users.read offline.access",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      const authUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`;

      console.log("Opening popup with authUrl:", authUrl);

      const width = 600;
      const height = 700;
      const left = Math.round(window.screen.width / 2 - width / 2);
      const top = Math.round(window.screen.height / 2 - height / 2);

      const popup = window.open(
        authUrl,
        "x-oauth",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        toast.error("Popup blocked! Please allow popups for this site.");
        setIsLinking(false);
        return;
      }

      console.log("Popup opened successfully");

      // Poll for popup close — when closed, fetch latest identity from DB
      // This is the reliable fallback in case postMessage is missed
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          // Wait for edge function to finish writing to DB then refresh
          setTimeout(async () => {
            await fetchIdentity();
            setIsLinking(false);
          }, 1500);
        }
      }, 500);
    } catch (err) {
      console.error("Failed to initiate X OAuth:", err);
      toast.error("Failed to start X authorization. Please try again.");
      setIsLinking(false);
    }
  };

  const linked = identity?.x_verified;

  return (
    <div className={`rounded-xl border p-3.5 ${t.innerSurface}`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.innerSurfaceSolid}`}>
          <Twitter className={`w-4 h-4 ${t.strongText}`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${t.strongText}`}>X (Twitter)</p>
          <p className={`text-[11px] ${t.mutedText}`}>One-click link</p>
        </div>
        {linked && (
          <span
            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${t.strongText}`}
          >
            <BadgeCheck className="w-3.5 h-3.5" /> Linked
          </span>
        )}
      </div>

      {linked ? (
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${t.strongText}`}>@{identity.x_username}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlinkX}
            disabled={isUnlinkingX}
            className={`h-8 text-[11px] gap-1.5 ${t.strongText} hover:${t.innerSurfaceSolid}`}
          >
            {isUnlinkingX ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Unlink className="w-3 h-3" />
            )}
            Unlink
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            onClick={handleConnectX}
            disabled={isLinking}
            size="sm"
            className={`h-9 gap-1.5 text-xs px-4 ${
              t.isLightTheme
                ? "bg-gray-950 text-white hover:bg-gray-900"
                : "bg-white text-gray-950 hover:bg-white/90"
            }`}
          >
            {isLinking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            Connect
          </Button>
        </div>
      )}
    </div>
  );
}
// ============ Discord Link Card (unchanged) ============

interface LinkCardThemeClasses {
  innerSurface: string;
  innerSurfaceSolid: string;
  dividerColor: string;
  mutedText: string;
  strongText: string;
  isLightTheme: boolean;
}

interface LinkCardProps {
  identity: SocialIdentity | null;
  validProfileId: string | null;
  walletAddress?: string;
  fetchIdentity: () => void;
  setIdentity: React.Dispatch<React.SetStateAction<SocialIdentity | null>>;
  writeCachedIdentity: (next: SocialIdentity | null) => void;
  themeClasses: LinkCardThemeClasses;
}

function DiscordGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05A19.9 19.9 0 0 0 6.7 19.5a.08.08 0 0 0 .08-.03c.46-.63.87-1.29 1.22-1.99.02-.04 0-.09-.04-.10a13.2 13.2 0 0 1-1.88-.89c-.04-.02-.04-.08 0-.11.13-.09.25-.19.37-.29.02-.01.05-.02.07-.01 3.93 1.79 8.18 1.79 12.06 0 .02-.01.05 0 .07.01.12.10.24.20.37.29.04.03.04.09 0 .11-.6.35-1.23.65-1.88.89-.04.01-.05.06-.04.10.36.70.77 1.36 1.22 1.99.02.03.06.04.08.03a19.84 19.84 0 0 0 6.0-3.04.05.05 0 0 0 .03-.05c.50-5.18-1.13-9.30-3.55-13.66Z" />
      <circle cx="9.0" cy="13.0" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="15.0" cy="13.0" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function DiscordLinkCard({
  identity,
  validProfileId,
  walletAddress,
  fetchIdentity,
  setIdentity,
  writeCachedIdentity,
  themeClasses: t,
}: LinkCardProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "discord-oauth-success") {
        setIsLinking(false);
        toast.success(`Discord linked as ${event.data.discord_username}!`);
        feedback("success");
        fetchIdentity();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchIdentity]);

  const handleLinkDiscord = () => {
    if (!validProfileId || !walletAddress) return;
    setIsLinking(true);

    const DISCORD_CLIENT_ID = "1473815294022520964";
    const redirectUri = `${window.location.origin}/discord-callback`;
    const state = btoa(JSON.stringify({ profileId: validProfileId, walletAddress }));
    const scope = "identify";

    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&prompt=consent`;
    const popup = window.open(url, "discord-oauth", "width=500,height=700,left=200,top=100");

    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        setIsLinking(false);
      }
    }, 500);
  };

  const handleUnlinkDiscord = async () => {
    if (!validProfileId) return;
    setIsUnlinking(true);
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: { action: "unlink-discord", profileId: validProfileId, walletAddress },
      });
      if (response.error) throw response.error;
      toast.success("Discord unlinked");
      feedback("success");
      setIdentity((prev) => {
        const next: SocialIdentity = { ...prev!, discord_id: null, discord_username: null };
        writeCachedIdentity(next);
        return next;
      });
      fetchIdentity();
    } catch (e: any) {
      toast.error(e.message || "Failed to unlink Discord");
      feedback("error");
    } finally {
      setIsUnlinking(false);
    }
  };

  const linked = Boolean(identity?.discord_id);

  return (
    <div className={`rounded-xl border p-3.5 ${t.innerSurface}`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.innerSurfaceSolid}`}>
          <DiscordGlyph className={`w-4 h-4 ${t.strongText}`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${t.strongText}`}>Discord</p>
          <p className={`text-[11px] ${t.mutedText}`}>One-click link</p>
        </div>
        {linked && (
          <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${t.strongText}`}>
            <BadgeCheck className="w-3.5 h-3.5" /> Linked
          </span>
        )}
      </div>

      {linked ? (
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs truncate ${t.strongText}`}>
            {identity?.discord_username || identity?.discord_id}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlinkDiscord}
            disabled={isUnlinking}
            className={`h-8 text-[11px] gap-1.5 ${t.strongText} hover:${t.innerSurfaceSolid}`}
          >
            {isUnlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
            Unlink
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            onClick={handleLinkDiscord}
            disabled={isLinking}
            size="sm"
            className={`h-9 gap-1.5 text-xs px-4 ${t.isLightTheme ? "bg-gray-950 text-white hover:bg-gray-900" : "bg-white text-gray-950 hover:bg-white/90"}`}
          >
            {isLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
            Connect
          </Button>
        </div>
      )}
    </div>
  );
}

// ============ Telegram Link Card ============
export function TelegramLinkCard({
  identity,
  validProfileId,
  walletAddress,
  fetchIdentity,
  setIdentity,
  writeCachedIdentity,
  themeClasses: t,
}: LinkCardProps) {
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!widgetRef.current || !validProfileId || !walletAddress) return;
    if (identity?.telegram_id) return;
    widgetRef.current.innerHTML = "";

    const useRedirectFlow = shouldUseTelegramRedirectFlow();
    const callbackName = `__monipayTelegramAuth_${validProfileId.replace(/-/g, "_")}`;
    (window as any)[callbackName] = async (user: Record<string, string | number>) => {
      if (!user?.id || !validProfileId || !walletAddress) return;
      setIsLinking(true);
      try {
        const widgetPayload = Object.fromEntries(
          Object.entries(user).map(([key, value]) => [key, String(value)]),
        );
        const response = await supabase.functions.invoke("social-identity", {
          body: {
            action: "link-telegram",
            profileId: validProfileId,
            walletAddress,
            widgetPayload,
          },
        });

        let edgeErrorMessage = response.data?.error || response.error?.message;
        const errorContext = (response.error as any)?.context;
        if (errorContext && typeof errorContext.clone === "function") {
          try {
            const errorBody = await errorContext.clone().json();
            edgeErrorMessage = errorBody?.error || edgeErrorMessage;
          } catch {
            // Keep the SDK-provided message.
          }
        }
        const errMsg = edgeErrorMessage;
        if (errMsg) throw new Error(errMsg);

        const telegram_id = String(response.data?.telegram_id ?? user.id);
        const telegram_username = response.data?.telegram_username ?? user.username ?? user.first_name ?? null;
        setIdentity((prev: SocialIdentity | null) => {
          const next: SocialIdentity = {
            ...(prev as SocialIdentity),
            telegram_id,
            telegram_username: telegram_username ? String(telegram_username) : null,
          };
          writeCachedIdentity(next);
          return next;
        });
        toast.success(`Telegram linked as @${telegram_username || telegram_id}!`);
        feedback("success");
        fetchIdentity();
        window.postMessage(
          { type: "telegram-oauth-success", telegram_id, telegram_username },
          window.location.origin,
        );
      } catch (e: any) {
        toast.error(e?.message || "Failed to link Telegram");
        feedback("error");
      } finally {
        setIsLinking(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?23";
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    if (useRedirectFlow) {
      const state = btoa(JSON.stringify({ profileId: validProfileId, walletAddress }));
      const callbackUrl = `${window.location.origin}/telegram-callback?state=${encodeURIComponent(state)}`;
      script.setAttribute("data-auth-url", callbackUrl);
    } else {
      script.setAttribute("data-onauth", `${callbackName}(user)`);
    }
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-init-auth", "0");
    script.async = true;
    widgetRef.current.appendChild(script);

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source === window) return;
      if (event.data?.type !== "telegram-oauth-success") return;
      const { telegram_id, telegram_username } = event.data;
      setIdentity((prev: SocialIdentity | null) => {
        const next: SocialIdentity = {
          ...(prev as SocialIdentity),
          telegram_id,
          telegram_username,
        };
        writeCachedIdentity(next);
        return next;
      });
      toast.success(`Telegram linked as @${telegram_username || telegram_id}!`);
      feedback("success");
      fetchIdentity();
    };
    window.addEventListener("message", messageHandler);

    return () => {
      if (widgetRef.current) widgetRef.current.innerHTML = "";
      window.removeEventListener("message", messageHandler);
      try { delete (window as any)[callbackName]; } catch { (window as any)[callbackName] = undefined; }
    };
  }, [validProfileId, walletAddress, identity?.telegram_id, setIdentity, writeCachedIdentity]);

  const handleUnlinkTelegram = async () => {
    if (!validProfileId) return;
    setIsUnlinking(true);
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: { action: "unlink-telegram", profileId: validProfileId, walletAddress },
      });
      if (response.error) throw response.error;
      toast.success("Telegram unlinked");
      feedback("success");
      setIdentity((prev: SocialIdentity | null) => {
        const next: SocialIdentity = {
          ...prev!,
          telegram_id: null,
          telegram_username: null,
        };
        writeCachedIdentity(next);
        return next;
      });
      fetchIdentity();
    } catch (e: any) {
      toast.error(e.message || "Failed to unlink Telegram");
      feedback("error");
    } finally {
      setIsUnlinking(false);
    }
  };

  const linked = Boolean(identity?.telegram_id);

  return (
    <div className={`rounded-xl border p-3.5 ${t.innerSurface}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.innerSurfaceSolid}`}>
          <Send className={`w-4 h-4 ${t.strongText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${t.strongText}`}>Telegram</p>
          <p className={`text-[11px] ${t.mutedText}`}>One-click link</p>
        </div>
        {linked && (
          <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${t.strongText}`}>
            <BadgeCheck className="w-3.5 h-3.5" /> Linked
          </span>
        )}
      </div>

      {linked ? (
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs truncate ${t.strongText}`}>
            @{identity?.telegram_username || identity?.telegram_id}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlinkTelegram}
            disabled={isUnlinking}
            className={`h-8 text-[11px] gap-1.5 ${t.strongText} hover:${t.innerSurfaceSolid}`}
          >
            {isUnlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
            Unlink
          </Button>
        </div>
      ) : (
        <div className="flex justify-end items-center gap-2 min-h-10">
          {isLinking && <Loader2 className={`w-3.5 h-3.5 animate-spin ${t.strongText}`} />}
          <div ref={widgetRef} className="telegram-login-widget" />
        </div>
      )}
    </div>
  );
}

// ============ Bluesky Link Card (handle + app password modal) ============

function BlueskyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 530" className={className} aria-hidden="true" fill="currentColor">
      <path d="M135.7 44.2c70.6 53 146.5 160.6 174.3 218.3 27.7-57.7 103.7-165.3 174.3-218.3C534.8 6.5 614.7-22.8 614.7 67.6c0 18.1-10.4 152.4-16.5 174.3-21.2 76-99 95.4-168.4 83.6 121.3 20.6 152.1 89.1 85.5 157.6-126.5 130.1-181.7-32.6-195.9-74.5-2.6-7.6-3.8-11.2-3.8-8.2 0-3-1.2.6-3.8 8.2-14.2 41.9-69.4 204.6-195.9 74.5-66.6-68.5-35.8-137 85.5-157.6-69.4 11.8-147.2-7.6-168.4-83.6C26.9 220 16.5 85.7 16.5 67.6c0-90.4 79.9-61.1 119.2-23.4Z"/>
    </svg>
  );
}

export function BlueskyLinkCard({
  identity,
  validProfileId,
  walletAddress,
  fetchIdentity,
  setIdentity,
  writeCachedIdentity,
  themeClasses: t,
}: LinkCardProps) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleLink = async () => {
    if (!validProfileId || !walletAddress) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!handle.trim() || !appPassword.trim()) {
      toast.error("Enter your handle and app password.");
      return;
    }
    setIsLinking(true);
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: {
          action: "link-bluesky",
          profileId: validProfileId,
          walletAddress,
          blueskyHandle: handle.trim(),
          blueskyAppPassword: appPassword.trim(),
        },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      const { bluesky_id, bluesky_username } = response.data;
      setIdentity((prev) => {
        const next: SocialIdentity = { ...prev!, bluesky_id, bluesky_username };
        writeCachedIdentity(next);
        return next;
      });
      toast.success(`Bluesky linked as @${bluesky_username}!`);
      feedback("success");
      setOpen(false);
      setHandle("");
      setAppPassword("");
      fetchIdentity();
    } catch (e: any) {
      toast.error(e.message || "Failed to link Bluesky");
      feedback("error");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!validProfileId) return;
    setIsUnlinking(true);
    try {
      const response = await supabase.functions.invoke("social-identity", {
        body: { action: "unlink-bluesky", profileId: validProfileId, walletAddress },
      });
      if (response.error) throw response.error;
      toast.success("Bluesky unlinked");
      feedback("success");
      setIdentity((prev) => {
        const next: SocialIdentity = { ...prev!, bluesky_id: null, bluesky_username: null };
        writeCachedIdentity(next);
        return next;
      });
      fetchIdentity();
    } catch (e: any) {
      toast.error(e.message || "Failed to unlink Bluesky");
      feedback("error");
    } finally {
      setIsUnlinking(false);
    }
  };

  const linked = Boolean(identity?.bluesky_id);

  return (
    <>
      <div className={`rounded-xl border p-3.5 ${t.innerSurface}`}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.innerSurfaceSolid}`}>
            <BlueskyGlyph className={`w-4 h-4 ${t.strongText}`} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${t.strongText}`}>Bluesky</p>
            <p className={`text-[11px] ${t.mutedText}`}>App password</p>
          </div>
          {linked && (
            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${t.strongText}`}>
              <BadgeCheck className="w-3.5 h-3.5" /> Linked
            </span>
          )}
        </div>

        {linked ? (
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs truncate ${t.strongText}`}>
              @{identity?.bluesky_username}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={isUnlinking}
              className={`h-8 text-[11px] gap-1.5 ${t.strongText} hover:${t.innerSurfaceSolid}`}
            >
              {isUnlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
              Unlink
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              onClick={() => setOpen(true)}
              size="sm"
              className={`h-9 gap-1.5 text-xs px-4 ${t.isLightTheme ? "bg-gray-950 text-white hover:bg-gray-900" : "bg-white text-gray-950 hover:bg-white/90"}`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Connect
            </Button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!isLinking) setOpen(v); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl overflow-hidden p-0 gap-0">
          {/* Header card — polished like MoniBot AI chains cards */}
          <div className="relative bg-gradient-to-br from-[#1185FE]/10 via-[#0052FF]/5 to-background px-6 pt-8 pb-6 text-center">
            {/* Subtle glow orb behind icon */}
            <div className="absolute left-1/2 top-6 -translate-x-1/2 w-20 h-20 rounded-full bg-[#1185FE]/20 blur-2xl pointer-events-none" />

            <div className="relative mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1185FE] to-[#0052FF] flex items-center justify-center shadow-lg shadow-[#1185FE]/25 ring-1 ring-white/20 mb-4">
              <BlueskyGlyph className="w-7 h-7 text-white" />
            </div>

            <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">
              Connect Bluesky
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1.5 max-w-[280px] mx-auto leading-relaxed">
              Sign in with your Bluesky handle and an app password. We never store your main account password.
            </DialogDescription>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Handle</label>
              <Input
                placeholder="yourname.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                autoComplete="off"
                disabled={isLinking}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">App password</label>
              <Input
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                autoComplete="off"
                disabled={isLinking}
                onKeyDown={(e) => { if (e.key === "Enter") handleLink(); }}
                className="rounded-xl h-11"
              />
              <a
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Generate an app password <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-0 gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLinking} className="rounded-xl h-11 flex-1">
              Cancel
            </Button>
            <Button onClick={handleLink} disabled={isLinking || !handle.trim() || !appPassword.trim()} className="rounded-xl h-11 flex-1 bg-gradient-to-r from-[#1185FE] to-[#0052FF] hover:from-[#1185FE]/90 hover:to-[#0052FF]/90 text-white shadow-[0_0_20px_rgba(17,133,254,0.25)] border-0">
              {isLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <LinkIcon className="w-3.5 h-3.5 mr-1.5" />}
              Link account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
