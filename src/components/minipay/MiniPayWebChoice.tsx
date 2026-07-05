/**
 * MiniPayWebChoice.tsx
 *
 * Three-option chooser shown on /minipay when accessed OUTSIDE the MiniPay
 * WebView (regular browsers). Mirrors `MiniPaySignInChoice` aesthetics
 * (yellow Celo pill, MiniPay backdrop, mp-cta / mp-card buttons) but offers
 * the web-appropriate paths:
 *
 *   1. Create MoniTag      → onboarding `create` flow
 *   2. Login with Wallet   → Path C external wallet (WalletConnectGate)
 *   3. Create MoniPay Acct → onboarding `import` flow (legacy account)
 */
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { ArrowLeft, Wallet, UserRoundPlus, Sparkles, ArrowUpRight, Sun, Moon } from 'lucide-react';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Footer } from '@/components/Footer';
import { feedback } from '@/lib/feedback';

interface Props {
  onCreateMoniTag: () => void;
  onLoginWithWallet: () => void;
  onCreateAccount: () => void;
  onGoogleRestore: () => void;
  onBack: () => void;
}

function MiniPayBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
      <div