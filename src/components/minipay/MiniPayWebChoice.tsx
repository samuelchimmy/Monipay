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
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 480px at 20% 0%, hsl(var(--mp-primary) / 0.10), transparent 60%), radial-gradient(700px 420px at 85% 8%, hsl(var(--mp-primary) / 0.07), transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
        style={{
          backgroundImage:
            'radial-gradient(hsl(var(--mp-ink) / 0.18) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 40%, transparent 90%)',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 40%, transparent 90%)',
        }}
      />
    </div>
  );
}

/* Official Google "G" mark (brand-compliant, inline SVG). */
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

export function MiniPayWebChoice({
  onCreateMoniTag,
  onLoginWithWallet,
  onCreateAccount,
  onGoogleRestore,
  onBack,
}: Props) {
  const { theme, setTheme } = useTheme();
  const handle = (fn: () => void) => () => { feedback('tap'); fn(); };

  return (
    <div
      data-minipay=""
      className="fixed inset-0 flex flex-col safe-top overflow-hidden"
      style={{ background: 'hsl(var(--mp-surface))', color: 'hsl(var(--mp-ink))' }}
    >
      <MiniPayBackdrop />

      {/* Yellow Celo pill header */}
      <div className="relative z-10 px-3 sm:px-6 pt-3">
        <div className="mx-auto max-w-5xl">
          <div
            className="flex items-center justify-between gap-2 rounded-full pl-2 pr-2 py-2 backdrop-blur-xl"
            style={{
              background: '#FCFF52',
              border: '1px solid #000',
              boxShadow: '0 8px 32px -12px rgba(0,0,0,0.25)',
            }}
          >
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <MoniPayLogo size={26} color="#000" animationMode="header" entranceOnMount />
              <span className="font-bold tracking-tight text-[15px] text-black">Monipay</span>
            </div>
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="max-w-md mx-auto w-full flex flex-col h-full justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center pb-7"
          >
            <h1
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight leading-[1.05]"
              style={{ color: 'hsl(var(--mp-ink))' }}
            >
              Welcome to{' '}
              <span style={{ color: 'hsl(var(--mp-primary))' }}>Monipay</span>
            </h1>
            <p className="mt-3 text-[13px]" style={{ color: 'hsl(var(--mp-muted))' }}>
              Pick how you want to get started.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {/* Create MoniTag — primary CTA */}
            <button
              onClick={handle(onCreateMoniTag)}
              className="mp-cta w-full p-4 flex items-center gap-3 text-left !rounded-2xl"
              style={{ minHeight: 72 }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[inset_0_0_0_1px_hsl(var(--primary-foreground)/0.18)]"
                style={{ background: 'hsl(var(--primary-foreground) / 0.15)' }}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight">Create MoniTag</p>
                <p className="text-[12px] opacity-80 mt-0.5">Get a payment username in seconds</p>
              </div>
              <ArrowUpRight className="h-5 w-5 opacity-90 flex-shrink-0" />
            </button>

            {/* Login with wallet */}
            <button
              onClick={handle(onLoginWithWallet)}
              className="mp-card w-full p-4 flex items-center gap-3 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ minHeight: 72 }}
            >
              <div className="mp-icon-frame w-11 h-11 flex-shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
                  Login with Wallet
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'hsl(var(--mp-muted))' }}>
                  Use MetaMask, Rabby, Coinbase, or WalletConnect
                </p>
              </div>
            </button>

            {/* Sign in with Google — restore from encrypted Drive backup */}
            <button
              onClick={handle(onGoogleRestore)}
              className="mp-card w-full p-4 flex items-center gap-3 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ minHeight: 72 }}
            >
              <div className="w-11 h-11 rounded-2xl bg-white border border-black/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                <GoogleG size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
                  Sign in with Google
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'hsl(var(--mp-muted))' }}>
                  Restore from your encrypted Drive backup
                </p>
              </div>
            </button>

            {/* Create MoniPay Account */}
            <button
              onClick={handle(onCreateAccount)}
              className="mp-card w-full p-4 flex items-center gap-3 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ minHeight: 72 }}
            >
              <div className="mp-icon-frame w-11 h-11 flex-shrink-0">
                <UserRoundPlus className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
                  Create MoniPay Account
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'hsl(var(--mp-muted))' }}>
                  Full account with PIN, recovery, cross-device sync
                </p>
              </div>
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="text-[11px] text-center mt-8 mb-6 max-w-[320px] mx-auto leading-relaxed"
            style={{ color: 'hsl(var(--mp-muted))' }}
          >
            You own your keys. MoniPay can't access your funds.
          </motion.p>
        </div>
      </div>

      <div className="relative z-10">
        <Footer variant="minimal" />
      </div>
    </div>
  );
}