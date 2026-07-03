/**
 * MiniPayDashboard — Path B (MiniPay native) wallet dashboard.
 *
 * Polished, MiniPay-themed dashboard rendered inside MiniPayThemeScope.
 * Layout:
 *   1. Yellow "Monipay | CELO" header pill (matches /minipay landing)
 *   2. Hero balance card (Celo-yellow gradient, live USDT balance)
 *   3. Quick actions: Receive · Fund · History · Send
 *   4. Compact MoniBot card (allowance + social link cards)
 *   5. Quick links: Invoices · Storefront · Merchant · Settings
 *
 * Supports light & dark theme via next-themes; all surfaces consume
 * the `[data-minipay]` design tokens (mp-primary, mp-surface, mp-ink, …).
 * Optimizations: Backdrop filters inside scrollable lists/sheets are removed
 * to eliminate mobile scrolling jitter, flickering, and square corner clipping artifacts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Copy, Check, QrCode, ArrowDownToLine, History, Send, X,
  Sun, Moon, ExternalLink, FileText, Store, Briefcase,
  Settings as SettingsIcon, Sparkles, User, Wrench, Pencil, Loader2,
  ChevronDown, Twitter, Wallet, Link2, Bot, Info, ScanLine, CalendarClock,
} from 'lucide-react';
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { celo } from 'viem/chains';
import { toast } from 'sonner';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue, type PanInfo, type Variants } from 'framer-motion';

import { MiniPayThemeScope } from '@/components/minipay/MiniPayThemeScope';
import { WalletAllowanceCard } from '@/components/WalletAllowanceCard';
import { WalletMoniBotSettings } from '@/components/WalletMoniBotSettings';
import { WhatIsMoniBotModal } from '@/components/minipay/WhatIsMoniBotModal';
import { LinkConflictModal, type LinkConflictDetail } from '@/components/minipay/LinkConflictModal';
import { MerchantActionGrid } from '@/components/minipay/merchant/MerchantActionGrid';
import { ScanPaySheet } from '@/components/minipay/ScanPaySheet';
import { PendingIOUsCard } from '@/components/PendingIOUsCard';
import { MiniPayWalkthrough } from '@/components/minipay/MiniPayWalkthrough';
import { usePayTag } from '@/contexts/PayTagContext';
import { feedback } from '@/lib/feedback';
import { Settings as SettingsPanel } from '@/components/Settings';
import { TransactionHistory } from '@/components/TransactionHistory';
import { MiniPayHistory } from '@/components/minipay/MiniPayHistory';
import { BrandedQR } from '@/components/BrandedQR';
import { BottomSheet } from '@/components/BottomSheet';
import { createPortal } from 'react-dom';
import { WithdrawModal } from '@/components/WithdrawModal';
import { InvoicesSection } from '@/components/InvoicesSection';
import { ProductCatalog, type Product } from '@/components/ProductCatalog';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getChainConfig } from '@/config/chains';
import { soundManager } from '@/lib/soundManager';
import celoGlyph from '@/assets/celo-glyph.png';
import { CeloHoldingsCollapse } from '@/components/CeloHoldingsCollapse';

interface Props {
  walletAddress: `0x${string}`;
  profileId: string | null;
  isLegacy?: boolean;
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* ──────────────────────────────────────────────────────────────
 * Motion: single source of truth for section entrance + stagger.
 * Uses the global --ease-out-quint token (mirrored here as the
 * cubic-bezier array because Framer Motion needs raw numbers).
 * ────────────────────────────────────────────────────────────── */
const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const sectionStaggerContainer: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const sectionItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT_QUINT },
  },
};

const CELO_CFG = getChainConfig('celo');
const CELO_RPCS = CELO_CFG.rpcUrls;

async function fetchCeloTokenBalance(address: `0x${string}`, tokenAddress: `0x${string}`, decimals: number): Promise<number> {
  for (const rpc of CELO_RPCS) {
    try {
      const client = createPublicClient({ chain: celo, transport: http(rpc) });
      const raw = await (client as any).readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      return Number(formatUnits(raw as bigint, decimals));
    } catch {
      /* try next */
    }
  }
  return 0;
}

async function fetchG$Price(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/v3/simple/price?ids=gooddollar&vs_currencies=usd");
    const json = await res.json();
    const price = json.gooddollar?.usd;
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  } catch (e) {
    console.warn("[G$ Price Fetch] Failed:", e);
  }
  return 0.00018; // Fallback reserve-backed estimate
}

/** BulletBoard — types one bullet at a time, dot appears when bullet starts, fixed height so card never reshapes */
interface BulletBoardProps {
  phrases: string[];
}

function BulletBoard({ phrases }: BulletBoardProps) {
  const [activeRow, setActiveRow] = useState(0); // 0, 1, 2, 3
  const [charsCount, setCharsCount] = useState(0);
  const [rotOffset, setRotOffset] = useState(0); // index in rotating phrases
  const [rotState, setRotState] = useState<'typing' | 'holding' | 'fading'>('typing');

  const fixedPhrases = useMemo(() => phrases.slice(0, 3), [phrases]);
  const rotatingPhrases = useMemo(() => phrases.slice(3), [phrases]);

  // Reset if phrases change
  useEffect(() => {
    setActiveRow(0);
    setCharsCount(0);
    setRotOffset(0);
    setRotState('typing');
  }, [phrases]);

  useEffect(() => {
    if (activeRow < 3) {
      // Fixed rows typing sequence
      const targetText = fixedPhrases[activeRow] ?? '';
      if (charsCount < targetText.length) {
        const t = setTimeout(() => {
          setCharsCount(prev => prev + 1);
        }, 15 + Math.random() * 15);
        return () => clearTimeout(t);
      } else {
        // Pause between bullets
        const t = setTimeout(() => {
          setActiveRow(prev => prev + 1);
          setCharsCount(0);
        }, 400);
        return () => clearTimeout(t);
      }
    } else {
      // Rotating row 3 (4th bullet)
      const currentPhrase = rotatingPhrases[rotOffset] ?? '';
      if (rotState === 'typing') {
        if (charsCount < currentPhrase.length) {
          const t = setTimeout(() => {
            setCharsCount(prev => prev + 1);
          }, 15 + Math.random() * 15);
          return () => clearTimeout(t);
        } else {
          setRotState('holding');
        }
      } else if (rotState === 'holding') {
        const t = setTimeout(() => {
          setRotState('fading');
        }, 6000); // hold for 6 seconds
        return () => clearTimeout(t);
      } else if (rotState === 'fading') {
        const t = setTimeout(() => {
          setRotOffset(prev => (rotatingPhrases.length > 0 ? (prev + 1) % rotatingPhrases.length : 0));
          setCharsCount(0);
          setRotState('typing');
        }, 300); // 300ms fade
        return () => clearTimeout(t);
      }
    }
  }, [activeRow, charsCount, rotOffset, rotState, fixedPhrases, rotatingPhrases]);

  return (
    <div className="w-full space-y-1.5 min-h-[145px]">
      {Array.from({ length: 4 }).map((_, i) => {
        let phrase = '';
        let isDone = false;
        let isActive = false;
        let hasStarted = false;
        let displayText = '';

        if (i < 3) {
          phrase = fixedPhrases[i] ?? '';
          isDone = i < activeRow;
          isActive = i === activeRow;
          hasStarted = isDone || isActive;
          displayText = isDone ? phrase : isActive ? phrase.substring(0, charsCount) : '';
        } else {
          phrase = rotatingPhrases[rotOffset] ?? '';
          isDone = false;
          isActive = activeRow === 3;
          hasStarted = activeRow >= 3;
          displayText = isActive ? phrase.substring(0, charsCount) : '';
        }

        const isFading = i === 3 && rotState === 'fading';

        return (
          <div
            key={i}
            className={`flex items-start gap-2 transition-opacity duration-300 ${
              isFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="h-[18px] flex items-center shrink-0">
              <span
                className="w-1.5 h-1.5 rounded-full transition-opacity duration-150"
                style={{
                  opacity: hasStarted ? 1 : 0,
                  backgroundColor: '#000000',
                }}
              />
            </div>
            <span className="text-[12px] leading-snug text-black/75 font-medium select-none flex-1 py-0.5">
              {displayText}
              {isActive && charsCount < phrase.length && (
                <span className="inline-block w-0.5 h-[13px] bg-black animate-pulse ml-0.5 align-middle" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AnimatedBalance({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    stiffness: 70,
    damping: 15,
    mass: 1,
  });

  const displayValue = useTransform(springValue, (latest) => {
    return latest.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span>{displayValue}</motion.span>;
}

interface HistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string | null;
}

function HistorySheet({ isOpen, onClose, profileId }: HistorySheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 50 || info.velocity.y > 200) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.05}
            dragSnapToOrigin={false}
            onDragEnd={handleDragEnd}
            className="pointer-events-auto bg-background w-full max-w-xl rounded-t-[28px] border-t border-border/60 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden h-[90vh] relative z-10"
          >
            {/* Drag Handle / Header */}
            <div className="flex flex-col px-5 pt-4 pb-2 shrink-0 cursor-grab active:cursor-grabbing border-b border-border/10">
              <div className="flex justify-center pb-3">
                <div className="w-10 h-1 rounded-full bg-foreground/15" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold tracking-tight text-foreground">Transaction history</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {profileId ? (
                <MiniPayHistory onClose={onClose} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No profile linked yet.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function MiniPayDashboard({ walletAddress, profileId, isLegacy }: Props) {
  // Detect if running inside the MiniPay app (window.ethereum.isMiniPay)
  const isInMiniPay = useMemo(() => !!(window as any).ethereum?.isMiniPay, []);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { setProfile, syncTransactions } = usePayTag();

  const [balance, setBalance] = useState<number | null>(null);
  const [balances, setBalances] = useState<{ USDT: number; USDC: number; USDm: number; G$: number }>({
    USDT: 0,
    USDC: 0,
    USDm: 0,
    G$: 0,
  });
  const [g$Price, setG$Price] = useState<number>(0.00018);
  const [loadingBal, setLoadingBal] = useState(true);
  const [payTag, setPayTag] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [identities, setIdentities] = useState<Array<{ platform: 'discord' | 'telegram' | 'twitter'; userId: string }>>([]);

  const [showHistory, setShowHistory] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showScanPay, setShowScanPay] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showMonitag, setShowMonitag] = useState(false);
  const [mode, setMode] = useState<'personal' | 'merchant'>(() => {
    try { return (localStorage.getItem('minipay_mode') as any) === 'merchant' ? 'merchant' : 'personal'; }
    catch { return 'personal'; }
  });
  const [merchantSheet, setMerchantSheet] = useState<null | 'invoices' | 'storefront' | 'merchant' | 'settings'>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [openMoniSection, setOpenMoniSection] = useState<null | 'allowance' | 'socials' | 'add' | 'subscriptions'>(null);
  const [showWhatIsMoniBot, setShowWhatIsMoniBot] = useState(false);
  const [pendingIouCount, setPendingIouCount] = useState<number | null>(null);
  const [linkConflict, setLinkConflict] = useState<LinkConflictDetail | null>(null);

  // Listen for cross-context 409 from OAuth popup callbacks.
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const d = ev.data;
      if (d?.type === 'social-link-conflict') {
        toast.error('This account is linked to another user');
        setLinkConflict({
          message: d.message ?? 'Account is linked to another user',
          payTag: d.payTag ?? null,
          platform: d.platform ?? undefined,
        });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('minipay_mode', mode); } catch { /* */ }
  }, [mode]);

  // Load Outfit font for greetings
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&display=swap';
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }, []);

  // Populate PayTagContext so PendingIOUsCard can access wallet address
  useEffect(() => {
    if (!walletAddress) return;
    
    setProfile({
      id: profileId || undefined,
      payTag: payTag || '',
      pin: '', // Not used in wallet-only mode
      preferredMode: 'user',
      preferredNetwork: 'celo',
      balance: balance || 0,
      merchantBalance: 0,
      wallet: {
        address: walletAddress,
        encryptedPrivateKey: '', // Not used in wallet-only mode
      },
    });
  }, [walletAddress, payTag, balance, profileId, setProfile]);

  // Sync transactions once we have a profileId (Path B never goes through
  // verifyPin, which is where the legacy flow triggers syncTransactions).
  useEffect(() => {
    if (!profileId) return;
    syncTransactions().catch(() => { /* non-fatal */ });
  }, [profileId, syncTransactions]);

  // Load wallet_profiles for pay_tag / preferred name
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('wallet-session', {
          body: { action: 'get', walletAddress },
        });
        const p = (data as any)?.profile;
        if (!cancelled && p) {
          if (p.pay_tag) setPayTag(p.pay_tag);
          const ids: Array<{ platform: 'discord' | 'telegram' | 'twitter'; userId: string }> = [];
          if (p.discord_id) ids.push({ platform: 'discord', userId: String(p.discord_id) });
          if (p.telegram_id) ids.push({ platform: 'telegram', userId: String(p.telegram_id) });
          if (p.x_verified && (p.x_user_id || p.x_username)) {
            ids.push({ platform: 'twitter', userId: String(p.x_user_id ?? p.x_username) });
          }
          setIdentities(ids);
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [walletAddress]);

  const refreshBalance = useCallback(async () => {
    setLoadingBal(true);
    try {
      const [usdt, usdc, usdm, g$, price] = await Promise.all([
        fetchCeloTokenBalance(walletAddress, "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", 6),
        fetchCeloTokenBalance(walletAddress, "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", 6),
        fetchCeloTokenBalance(walletAddress, "0x765DE816845861e75A25fCA122bb6898B8B1282a", 18),
        fetchCeloTokenBalance(walletAddress, "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", 18),
        fetchG$Price(),
      ]);

      const tokenBalances = { USDT: usdt, USDC: usdc, USDm: usdm, G$: g$ };
      setBalances(tokenBalances);
      setG$Price(price);

      const totalUsd = usdt + usdc + usdm + (g$ * price);
      setBalance(totalUsd);
    } catch (err) {
      console.error("[MiniPayDashboard] Failed to refresh balances:", err);
    } finally {
      setLoadingBal(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refreshBalance();
    const id = setInterval(refreshBalance, 30_000);
    return () => clearInterval(id);
  }, [refreshBalance]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      feedback('copy');
      toast.success('Address copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const formattedBalance = useMemo(() => {
    if (balance === null) return '—';
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [balance]);

  const [greeting, setGreeting] = useState('');

  // Simple timezone-aware greeting
  useEffect(() => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) {
      setGreeting('Good morning');
    } else if (hr >= 12 && hr < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  const [allowanceApproved, setAllowanceApproved] = useState(false);

  // Poll allowance on-chain for Celo USDT
  const checkAllowance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const router = CELO_CFG.monibotRouter as `0x${string}`;
      const iou = CELO_CFG.iouRegistry as `0x${string}`;
      const token = CELO_CFG.token as `0x${string}`;

      for (const rpc of CELO_RPCS) {
        try {
          const client = createPublicClient({ chain: celo, transport: http(rpc) });
          let routerAll = 0n;
          if (router) {
            routerAll = await (client as any).readContract({
              address: token,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [walletAddress, router],
            }) as bigint;
          }
          let iouAll = 0n;
          if (iou) {
            iouAll = await (client as any).readContract({
              address: token,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [walletAddress, iou],
            }) as bigint;
          }
          if (routerAll > 0n || iouAll > 0n) {
            setAllowanceApproved(true);
            return;
          }
        } catch {
          // ignore and try next RPC
        }
      }
      setAllowanceApproved(false);
    } catch {
      setAllowanceApproved(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    checkAllowance();
    const id = setInterval(checkAllowance, 15_000);
    return () => clearInterval(id);
  }, [checkAllowance]);

  // Compile smart guide messages based on status
  const typewriterMessages = useMemo(() => {
    const list: string[] = [];

    // Bullet 1 (Fixed)
    list.push("Monipay is an AI-powered social payment layer built on Celo.");

    // Bullet 2 (Fixed)
    if (isInMiniPay) {
      list.push("Your MiniPay wallet, supercharged by Monipay.");
    } else {
      list.push("Your wallet, supercharged by Monipay.");
    }

    // Bullet 3 (Fixed)
    list.push("Send and receive money using plain language.");

    // Bullet 4 and onwards (Rotating)
    list.push("Monipay connects to your social accounts so payments flow naturally through your existing communities.");
    list.push("MoniBot only spends what you approve. You stay in control.");

    if (!payTag) {
      list.push("Step 1: Claim your MoniTag — your social payment handle on Monipay.");
      list.push("Tap the copy icon near your greeting to copy your MoniTag once claimed.");
      list.push("With a MoniTag, anyone can pay you by name — no wallet address needed.");
    } else if (!allowanceApproved) {
      list.push(`Welcome, @${payTag}. Step 2: Approve a spending allowance so MoniBot can send payments on your behalf.`);
      list.push("Your allowance is a cap, not a balance — MoniBot can only spend what you authorize.");
      list.push("You remain in full control — MoniBot cannot exceed the allowance you approve.");
      list.push("Tip a creator on X right now. Just say: Send $5 to @username");
      list.push("Automate a sports payout — MoniBot holds it until the result is confirmed.");
      list.push("Set up a recurring payment with one line. Try: Send $20 to @username every month, 5 times");
      list.push("Schedule a future payment effortlessly. Try: Send $20 to @username on Friday");
      list.push("Pay multiple people in a single command. Try: Send $10 each to @Jade, @Mike and @Alice");
      list.push("Send money to anyone — even without a wallet. MagicPay lets them claim it by linking their social account.");
      list.push("Monetize your community. Gate your Telegram group or Discord server with automated subscription access.");
    } else if (identities.length === 0) {
      list.push(`Welcome, @${payTag}. Step 3: Connect your social accounts so people can find and pay you by handle.`);
      list.push("Once linked, MoniBot listens for payment commands in your chats and acts on them instantly.");
      list.push("Once connected, anyone on X, Discord, or Telegram can send you money using your social handle.");
      list.push("Tip a creator on X right now. Just say: Send $5 to @username");
      list.push("Automate a sports payout — MoniBot holds it until the result is confirmed.");
      list.push("Set up a recurring payment with one line. Try: Send $20 to @username every month, 5 times");
      list.push("Schedule a future payment effortlessly. Try: Send $20 to @username on Friday");
      list.push("Pay multiple people in a single command. Try: Send $10 each to @Jade, @Mike and @Alice");
      list.push("Send money to anyone — even without a wallet. MagicPay lets them claim it by linking their social account.");
      list.push("Monetize your community. Gate your Telegram group or Discord server with automated subscription access.");
    } else {
      list.push(`You're all set, @${payTag}. Send your first payment right now — just say: Send $5 to @username`);
      list.push("MoniBot is active and ready to execute your payment commands across X, Discord, and Telegram.");
      list.push("Empower your wallet by delegating spending to your AI agent — the future of payments is social and agentic.");
      list.push("Use Monipay to tip creators, fund communities, manage subscriptions, and split bills — all in plain language.");
      list.push("Tip a creator on X right now. Just say: Send $5 to @username");
      list.push("Automate a sports payout — MoniBot holds it until the result is confirmed.");
      list.push("Set up a recurring payment with one line. Try: Send $20 to @username every month, 5 times");
      list.push("Schedule a future payment effortlessly. Try: Send $20 to @username on Friday");
      list.push("Pay multiple people in a single command. Try: Send $10 each to @Jade, @Mike and @Alice");
      list.push("Send money to anyone — even without a wallet. MagicPay lets them claim it by linking their social account.");
      list.push("Monetize your community. Gate your Telegram group or Discord server with automated subscription access.");
    }

    return list;
  }, [payTag, allowanceApproved, identities, isInMiniPay]);

  return (
    <MiniPayThemeScope className="min-h-screen pb-12 relative">
      {/* ── Subtle green page wash (matches /minipay landing) ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            'radial-gradient(900px 480px at 20% 0%, hsl(var(--mp-primary) / 0.10), transparent 60%), radial-gradient(700px 420px at 85% 8%, hsl(var(--mp-primary) / 0.07), transparent 60%)',
        }}
      />
      {/* ── Header pill (yellow Celo) ── */}
      <div className="sticky top-3 z-40 px-3 pt-3">
        <div className="mx-auto max-w-xl">
          <div
            className="flex items-center justify-between gap-2 rounded-full pl-2 pr-2 py-2 backdrop-blur-xl border border-black/80 dark:border-white/80"
            style={{ background: '#FCFF52', boxShadow: '0 8px 32px -12px rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-center gap-2 pl-1 min-w-0">
              <MoniPayLogo size={24} color="#000" animationMode="header" />
              <span className="font-bold tracking-tight text-[14px] text-black">Monipay</span>
              <span className="mx-1 text-black/30">|</span>
              <img src={celoGlyph} alt="Celo" className="h-4 w-auto object-contain shrink-0" />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors"
              >
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="h-4 w-4 hidden dark:block" />
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors"
                aria-label="Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <motion.main
        className="mx-auto max-w-xl px-4 pt-5 space-y-5"
        variants={sectionStaggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* ── Balance hero (Celo yellow gradient) ── */}
        <motion.section
          variants={sectionItem}
          className="relative overflow-hidden rounded-[28px] p-5 text-black border border-black/80 dark:border-white/80 dark:brightness-[0.72]"
          style={{
            background:
              'linear-gradient(135deg, #FCFF52 0%, #FDFF7A 40%, hsl(154 65% 82%) 100%)',
          }}
        >
          {/* watermark sparkles */}
          <Sparkles
            aria-hidden
            className="absolute -right-3 -top-3 w-28 h-28 text-black/[0.06] pointer-events-none"
          />

          {/* Top Row: Greeting + MoniTag (CAPS, no @) */}
          <div className="relative z-10 flex flex-wrap items-baseline gap-x-2">
            <h2
              className="text-[26px] sm:text-[30px] font-black italic text-black leading-tight tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {greeting},
            </h2>
            {payTag ? (
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[26px] sm:text-[30px] font-black text-black tracking-tight uppercase leading-tight"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {payTag.replace(/^@/, '').toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(payTag.startsWith('@') ? payTag : `@${payTag}`);
                      toast.success('MoniTag copied');
                      feedback('copy');
                    } catch {
                      toast.error('Failed to copy MoniTag');
                    }
                  }}
                  className="p-1 rounded-full hover:bg-black/10 transition-colors"
                  aria-label="Copy MoniTag"
                >
                  <Copy className="w-3.5 h-3.5 text-black/40 hover:text-black" />
                </button>
              </div>
            ) : (