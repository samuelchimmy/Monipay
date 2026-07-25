import { useEffect, useState } from 'react';
import { WagmiWrapper } from '@/components/WagmiWrapper';
import { AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { PayTagProvider, usePayTag } from '@/contexts/PayTagContext';

import { LockScreen } from '@/components/LockScreen';
import { Onboarding } from '@/components/Onboarding';
import { Dashboard } from '@/components/Dashboard';
import { FeatureTour } from '@/components/FeatureTour';
import { WalletConnectGate } from '@/components/WalletConnectGate';
import { ExternalWalletApp } from '@/components/ExternalWalletApp';

import { PageMeta } from '@/components/PageMeta';
import { SplashScreen } from '@/components/SplashScreen';
import { useWalletSession } from '@/hooks/useWalletSession';
import {
  getOrganizationSchema,
  getWebSiteSchema,
  getSoftwareApplicationSchema,
} from '@/lib/schema';

const FEATURE_TOUR_KEY = 'monipay_feature_tour_done';
const WALLET_MODE_KEY = 'monipay_wallet_mode'; // '1' = user chose Path C

function useWalletModeOptIn(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('wallet') === 'connect') return true;
      return localStorage.getItem(WALLET_MODE_KEY) === '1';
    } catch { return false; }
  });
  const set = (next: boolean) => {
    try {
      if (next) localStorage.setItem(WALLET_MODE_KEY, '1');
      else localStorage.removeItem(WALLET_MODE_KEY);
    } catch { /* ignore */ }
    setOn(next);
  };
  return [on, set];
}

function AppContent() {
  const { currentScreen, isUnlocked } = usePayTag();
  const { sessionType, address } = useWalletSession();
  const [walletMode, setWalletMode] = useWalletModeOptIn();
  const [tourDone, setTourDone] = useState(() => {
    return localStorage.getItem(FEATURE_TOUR_KEY) === '1';
  });

  // If a wagmi wallet is connected, ALWAYS treat them as Path C and skip
  // the legacy lock/onboarding gates. Any stale `paytag_profile` left over
  // from a previous local account would otherwise re-trigger a PIN the
  // wallet user has no way to satisfy ("phantom PIN" lockout).
  useEffect(() => {
    if (sessionType === 'external_wallet') setWalletMode(true);
  }, [sessionType, setWalletMode]);

  // When wagmi reports disconnection, clear the Path C opt-in so a refresh
  // lands the user on the public homepage instead of the wallet gate.
  useEffect(() => {
    if (sessionType === 'detecting') return;
    if (sessionType !== 'external_wallet' && walletMode) {
      try { localStorage.removeItem(WALLET_MODE_KEY); } catch { /* ignore */ }
    }
  }, [sessionType, walletMode]);

  // Allow the in-onboarding "Connect Wallet" chooser to flip on Path C.
  useEffect(() => {
    const handler = () => setWalletMode(true);
    window.addEventListener('monipay:enable-wallet-mode', handler);
    return () => window.removeEventListener('monipay:enable-wallet-mode', handler);
  }, [setWalletMode]);

  const handleTourComplete = () => {
    localStorage.setItem(FEATURE_TOUR_KEY, '1');
    setTourDone(true);
  };

  // ── Path C: external wallet ────────────────────────────────────────────
  // Only when there is no legacy session in play (currentScreen is the
  // onboarding/lock surface). Once a legacy account exists, legacy wins.
  // Path C wins whenever a wagmi wallet is connected, regardless of any
  // stale legacy profile in localStorage.
  if (walletMode || sessionType === 'external_wallet') {
    if (sessionType === 'external_wallet' && address) {
      return <ExternalWalletApp address={address} />;
    }
    return (
      <WalletConnectGate
        onCreateMoniPayAccount={() => setWalletMode(false)}
      />
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {currentScreen === 'lock' && !isUnlocked && (
          <LockScreen key="lock" />
        )}
        {currentScreen === 'onboarding' && (
          <Onboarding key="onboarding" />
        )}
        {currentScreen === 'dashboard' && isUnlocked && !tourDone && (
          <FeatureTour key="tour" onComplete={handleTourComplete} />
        )}
        {currentScreen === 'dashboard' && isUnlocked && tourDone && (
          <Dashboard key="dashboard" />
        )}
      </AnimatePresence>

    </>
  );
}

const Index = () => {
  const [splashDone, setSplashDone] = useState(() => {
    return sessionStorage.getItem('monipay_splash_shown') === '1';
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('monipay_splash_shown', '1');
    setSplashDone(true);
  };

  return (
    <WagmiWrapper>
      <PayTagProvider>
        <PageMeta
          path="/"
          title="Gasless Multi-Chain Payments by Username"
          ogImage="https://monipay.xyz/og/default.png"
          jsonLd={[
            getOrganizationSchema(),
            getWebSiteSchema(),
            getSoftwareApplicationSchema('multi'),
          ]}
        />
        <Helmet>
          <link rel="preload" as="image" href="/monipay-phone.png" fetchPriority="high" />
        </Helmet>
        <div className="min-h-screen bg-background overflow-x-hidden">
          <AnimatePresence>
            {!splashDone && (
              <SplashScreen key="splash" onComplete={handleSplashComplete} />
            )}
          </AnimatePresence>
          {splashDone && (
            <AppContent />
          )}
        </div>
      </PayTagProvider>
    </WagmiWrapper>
  );
};

export default Index;
