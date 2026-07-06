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
  const { currentScreen, isUnlocked, setCurrentScreen, setIsUnlocked } = usePayTag();
  const { sessionType, address } = useWalletSession();
  // Web chooser state: which path did the user pick on /minipay (outside MiniPay)?
  const [webChoice, setWebChoice] = useState<'none' | 'wallet'>(() => {
    try {
      const stored = sessionStorage.getItem('minipay_web_choice');
      if (stored === 'wallet') return 'wallet';
    } catch {}
    return 'none';
  });
  useEffect(() => {
    try { sessionStorage.setItem('minipay_web_choice', webChoice); } catch {}
  }, [webChoice]);
  const [showWebChooser, setShowWebChooser] = useState<boolean>(() => {
    try { return sessionStorage.getItem('minipay_web_chooser') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { sessionStorage.setItem('minipay_web_chooser', showWebChooser ? '1' : '0'); } catch {}
  }, [showWebChooser]);
  // Persist landing/flow state across refreshes and OAuth round-trips so
  // pressing refresh, returning from social-linking popups/redirects, or
  // using the device back button does not reset users to the landing view.
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem('minipay_show_landing');
      if (stored === '0') return false;
      if (stored === '1') return true;
    } catch {}
    // Default: skip landing if the user already has a profile on this device.
    try {
      if (localStorage.getItem('paytag_profile')) return false;
    } catch {}
    return true;
  });
  const [onboardingFlow, setOnboardingFlow] = useState<'create' | 'import'>(() => {
    try {
      const stored = sessionStorage.getItem('minipay_onboarding_flow');
      if (stored === 'import' || stored === 'create') return stored;
    } catch {}
    return 'create';