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
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[26px] sm:text-[30px] font-black text-black/30 tracking-tight uppercase leading-tight"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  UNKNOWN
                </span>
                <button
                  type="button"
                  onClick={() => { feedback('tap'); setShowMonitag(true); }}
                  className="p-1 rounded-full hover:bg-black/10 transition-colors"
                  aria-label="Claim MoniTag"
                >
                  <Pencil className="w-3.5 h-3.5 text-black/40 hover:text-black" />
                </button>
              </div>
            )}
          </div>

          {/* Middle Row: 4-bullet animated board — fixed height prevents card resize */}
          <div className="mt-4">
            <BulletBoard phrases={typewriterMessages} />
          </div>

          {/* Bottom Row: Balance + hero subline + History */}
          <div className="mt-5 relative z-10 space-y-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/45 leading-none">
                {isInMiniPay ? 'Your MiniPay Portfolio' : 'Available Balance'}
              </p>
              <div className="flex items-baseline gap-1 mt-1.5">
                <h1 className="text-[34px] sm:text-[40px] leading-none font-black tracking-tight tabular-nums">
                  ${loadingBal || balance === null ? '\u2014' : <AnimatedBalance value={balance} />}
                </h1>
                <span className="text-[10px] font-black text-black/60 tracking-wider uppercase ml-1">
                  USD
                </span>
              </div>
            </div>

            {/* Multi-Token Asset Breakdown — MiniPay supports USDT, USDC, USDm only */}
            {walletAddress && (
              <CeloHoldingsCollapse
                walletAddress={walletAddress}
                forceTheme="light"
                tokens={['USDT', 'USDC', 'USDm']}
                title="Holdings"
              />
            )}

            {/* History — clean text link bottom-right */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => { feedback('tap'); setShowHistory(true); }}
                className="flex items-center gap-1 text-[11px] font-bold text-black/55 hover:text-black transition-colors"
                aria-label="Transaction History"
              >
                <History className="w-3.5 h-3.5" />
                History
              </button>
            </div>
          </div>
        </motion.section>

        {/* ── Quick actions — commented out until live ── */}
        {/*
        <section
          className="rounded-3xl border border-black/80 dark:border-white/80 p-3 dark:brightness-[0.72]"
          style={{
            background:
              'linear-gradient(160deg, #FCFF52 0%, #F4FB8E 55%, hsl(154 65% 82%) 100%)',
          }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-black px-2 pt-1 pb-3">
            Quick Actions
          </p>
          <div className="grid grid-cols-3 gap-2">
            <ActionTile icon={QrCode} label="Receive" hint="Soon" onClick={() => setShowReceive(true)} disabled comingSoon />
            <ActionTile icon={ScanLine} label="Pay" hint="Soon" onClick={() => setShowScanPay(true)} disabled comingSoon />
            <ActionTile icon={Send} label="Send" hint="Soon" onClick={() => setShowSend(true)} disabled comingSoon />
          </div>
        </section>
        */}

        {/* ── MoniBot (compact) ── */}
        {profileId ? (
          <>
          {/* ── Pending MagicPay / IOUs (auto-scans when socials linked) ── */}
          {identities.length > 0 && pendingIouCount !== 0 && (
            <motion.section
              variants={sectionItem}
              className="rounded-3xl border border-black/80 p-3 dark:brightness-[0.72]"
              style={{
                background:
                  'linear-gradient(160deg, hsl(154 75% 90%) 0%, hsl(154 65% 82%) 60%, #FCFF52 100%)',
              }}
            >
              <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                <Sparkles className="w-3.5 h-3.5 text-black" />
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-black">
                  Pending MagicPay
                </p>
              </div>
              <PendingIOUsCard identities={identities} onVisibleCountChange={setPendingIouCount} />
            </motion.section>
          )}
          <motion.section
            variants={sectionItem}
            className="rounded-3xl border border-black/80 overflow-hidden dark:brightness-[0.72]"
            style={{
              background:
                'linear-gradient(160deg, #FCFF52 0%, #F4FB8E 55%, hsl(154 65% 82%) 100%)',
              color: '#000',
            }}
          >
            <div className="px-5 pt-5 pb-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-[#FCFF52]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold tracking-tight text-black">MoniBot · Your MiniPay AI Agent</h3>
                <p className="text-[11px] text-black/70 leading-relaxed">
                  Delegate spending from your MiniPay wallet — pay anyone, anywhere, by social handle.
                </p>
              </div>
            </div>

            {/* What is MoniBot — opens modal */}
            <button
              type="button"
              onClick={() => { feedback('modalOpen'); setShowWhatIsMoniBot(true); }}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left border-b border-black/15 hover:bg-black/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-black text-[#FCFF52]">
                <Info className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-black">What is MoniBot</p>
                <p className="text-[11px] truncate text-black/65">How Monipay upgrades your MiniPay wallet</p>
              </div>
              <ExternalLink className="w-4 h-4 shrink-0 text-black/65" />
            </button>

            <MoniCollapsible
              icon={Wallet}
              title="Approve AI Spending Allowance"
              subtitle="Set how much MoniBot can move from your MiniPay wallet"
              open={openMoniSection === 'allowance'}
              dataTour="allowance-row"
              onToggle={() => {
                feedback(openMoniSection === 'allowance' ? 'collapse' : 'expand');
                setOpenMoniSection(openMoniSection === 'allowance' ? null : 'allowance');
              }}
            >
              <div className="minipay-tint-children">
                <WalletAllowanceCard
                  walletAddress={walletAddress}
                  profileId={profileId}
                  preferredNetwork="celo"
                  hideTokens={["G$"]}
                />
              </div>
            </MoniCollapsible>

            <MoniCollapsible
              icon={Link2}
              title="Connect Social Accounts"
              subtitle="Let your social handles route payments to your MiniPay wallet"
              open={openMoniSection === 'socials'}
              dataTour="socials-row"
              onToggle={() => {
                feedback(openMoniSection === 'socials' ? 'collapse' : 'expand');
                setOpenMoniSection(openMoniSection === 'socials' ? null : 'socials');
              }}
            >
              <div className="minipay-tint-children">
                <WalletMoniBotSettings
                  profileId={profileId}
                  walletAddress={walletAddress}
                  onIdentityChange={(id) => {
                    const ids: Array<{ platform: 'discord' | 'telegram' | 'twitter'; userId: string }> = [];
                    if (id?.discord_id) ids.push({ platform: 'discord', userId: String(id.discord_id) });
                    if (id?.telegram_id) ids.push({ platform: 'telegram', userId: String(id.telegram_id) });
                    if (id?.x_verified && (id?.x_user_id || id?.x_username)) {
                      ids.push({ platform: 'twitter', userId: String(id.x_user_id ?? id.x_username) });
                    }
                    setIdentities(ids);
                  }}
                />
              </div>
            </MoniCollapsible>

            <MoniCollapsible
              icon={Bot}
              title="Use MoniBot"
              subtitle="Activate MoniBot across your communities"
              open={openMoniSection === 'add'}
              onToggle={() => {
                feedback(openMoniSection === 'add' ? 'collapse' : 'expand');
                setOpenMoniSection(openMoniSection === 'add' ? null : 'add');
              }}
            >
              <div
                className="rounded-xl overflow-hidden border border-black/20"
                style={{
                  background:
                    'linear-gradient(160deg, hsl(60 100% 90%) 0%, hsl(80 70% 86%) 55%, hsl(154 65% 88%) 100%)',
                }}
              >
                {[
                  { href: 'https://discord.com/oauth2/authorize?client_id=1473815294022520964&permissions=2147483648&scope=bot', label: 'Add to Discord', sub: 'Invite the bot to your guild', kind: 'discord' as const },
                  { href: 'https://t.me/monipaybot?startgroup=new', label: 'Add to Telegram', sub: 'Open in Telegram', kind: 'telegram' as const },
                  { href: 'https://x.com/intent/tweet?text=%40monibot%20', label: 'Tweet at MoniBot', sub: 'Send a public command', kind: 'twitter' as const },
                ].map((it, i, arr) => (
                  <a
                    key={it.label}
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => feedback('tap')}
                    className={`flex items-center gap-3 px-3.5 py-3 ${i < arr.length - 1 ? 'border-b border-black/20' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-black text-[#FCFF52]">
                      {it.kind === 'discord' && (
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                        </svg>
                      )}
                      {it.kind === 'telegram' && <Send className="w-4 h-4" />}
                      {it.kind === 'twitter' && <Twitter className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-black">{it.label}</p>
                      <p className="text-[11px] truncate text-black/65">{it.sub}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 shrink-0 text-black/65" />
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-center pt-3 text-black/65">
                Once added, members can use MoniBot commands to send instant payments.
              </p>
            </MoniCollapsible>

            <MoniCollapsible
              icon={CalendarClock}
              title="Gated Access Manager"
              subtitle="Monetize your Telegram & Discord communities"
              badge="Coming Soon"
              open={openMoniSection === 'subscriptions'}
              onToggle={() => {
                feedback(openMoniSection === 'subscriptions' ? 'collapse' : 'expand');
                setOpenMoniSection(openMoniSection === 'subscriptions' ? null : 'subscriptions');
              }}
              last