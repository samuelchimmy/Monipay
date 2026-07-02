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