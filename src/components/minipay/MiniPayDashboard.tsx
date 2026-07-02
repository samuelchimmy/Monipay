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