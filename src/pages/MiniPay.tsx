/**
 * MiniPay.tsx — Celo/MiniPay entry point
 * URL: monipay.xyz/minipay
 *
 * Follows the exact Tempo.tsx pattern:
 *   <PayTagProvider defaultNetwork="celo">
 *     → CeloLanding (Get Started / Sign In)
 *     → Onboarding / LockScreen / Dashboard
 *   </PayTagProvider>
 *
 * Works in any browser. When inside MiniPay, useMiniPay() handles
 * Celo chain switching and wallet injection automatically.
 */

import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { WagmiWrapper } from '@/components/WagmiWrapper';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';

import phoneMockupLight from '@/assets/minipay/monibot-phone-light.webp';
import phoneMockupDark from '@/assets/minipay/monibot-phone-dark.webp';

import { PageMeta } from '@/components/PageMeta';
import { getSoftwareApplicationSchema } from '@/lib/schema';
import { PayTagProvider, usePayTag } from '@/contexts/PayTagContext';

import { LockScreen } from '@/components/LockScreen';
import { Onboarding } from '@/components/Onboarding';
import { Dashboard } from '@/components/Dashboard';
import { MiniPayWalletApp } from '@/components/minipay/MiniPayWalletApp';
import { MiniPayWebChoice } from '@/components/minipay/MiniPayWebChoice';
import { WalletConnectGate } from '@/components/WalletConnectGate';
import { ExternalWalletApp } from '@/components/ExternalWalletApp';

import { MiniPayLanding } from '@/components/minipay/MiniPayLanding';
import { useWalletSession } from '@/hooks/useWalletSession';

/** Legacy MoniPay-account flow (Path A) — unchanged behaviour. */
function MiniPayLegacyApp() {