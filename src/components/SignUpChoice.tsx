/**
 * SignUpChoice — entry chooser shown after the user clicks "Get started"
 * on the public landing. Two clean options:
 *   1. Connect Wallet           → Path C (wallet-only session)
 *   2. Create a MoniPay Wallet  → legacy onboarding (PIN + paytag + backup)
 *
 * Visuals follow the /minipay clean professional style (light surface,
 * mp-card / mp-cta tokens), regardless of theme, so the entry feels premium.
 */
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { ArrowLeft, Wallet, UserRoundPlus, ArrowUpRight, Sun, Moon } from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { Footer } from './Footer';
import { feedback } from '@/lib/feedback';

interface Props {
  onConnectWallet: () => void;
  onCreateAccount: () => void;
  onBack: () => void;
}

function Backdrop() {
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

export function SignUpChoice({ onConnectWallet, onCreateAccount, onBack }: Props) {
  const { theme, setTheme } = useTheme();
  const handle = (fn: () => void) => () => {
    feedback('tap');
    fn();
  };

  return (
    <div
      data-minipay=""
      className="fixed inset-0 flex flex-col safe-top overflow-hidden"
      style={{ background: 'hsl(var(--mp-surface))', color: 'hsl(var(--mp-ink))' }}
    >
      <Backdrop />

      {/* Top pill */}
      <div className="relative z-10 px-3 sm:px-6 pt-3">
        <div className="mx-auto max-w-5xl">
          <div
            className="flex items-center justify-between gap-2 rounded-full pl-2 pr-2 py-2 backdrop-blur-xl"
            style={{
              background: 'hsl(var(--mp-surface-elev))',
              border: '1px solid hsl(var(--mp-border))',
              boxShadow: '0 8px 32px -12px rgba(0,0,0,0.25)',
            }}
          >
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10 transition-colors"
              style={{ color: 'hsl(var(--mp-ink))' }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <MoniPayLogo size={26} color="hsl(var(--mp-ink))" animationMode="header" entranceOnMount />
              <span className="font-bold tracking-tight text-[15px]" style={{ color: 'hsl(var(--mp-ink))' }}>
                Monipay
              </span>
            </div>
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10 transition-colors"
              style={{ color: 'hsl(var(--mp-ink))' }}
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
              Get started with{' '}
              <span style={{ color: 'hsl(var(--mp-primary))' }}>Monipay</span>
            </h1>
            <p
              className="text-sm mt-3 max-w-[300px] mx-auto"
              style={{ color: 'hsl(var(--mp-muted))' }}
            >
              Connect a wallet you already own, or create a new MoniPay wallet in 30 seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {/* Connect Wallet — primary CTA */}
            <button
              onClick={handle(onConnectWallet)}
              className="mp-cta w-full p-4 flex items-center gap-3 text-left !rounded-2xl"
              style={{ minHeight: 76 }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[inset_0_0_0_1px_hsl(var(--primary-foreground)/0.18)]"
                style={{ background: 'hsl(var(--primary-foreground) / 0.15)' }}
              >
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight">Connect Wallet</p>
                <p className="text-[12px] opacity-80 mt-0.5">
                  Use any EVM wallet you already own. Claim a moniTag™ to receive payments.
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 opacity-90 flex-shrink-0" />
            </button>

            {/* Create MoniPay Wallet */}
            <button
              onClick={handle(onCreateAccount)}
              className="mp-card w-full p-4 flex items-center gap-3 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ minHeight: 76 }}
            >
              <div className="mp-icon-frame w-11 h-11 flex-shrink-0">
                <UserRoundPlus className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
                  Create a MoniPay Wallet
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'hsl(var(--mp-muted))' }}>
                  Spin up a fresh non-custodial wallet, secured by a PIN. Backup to Google Drive.
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
            MoniPay is self-custodial. Your keys never leave your device.
          </motion.p>
        </div>
      </div>

      <div className="relative z-10">
        <Footer variant="minimal" />
      </div>
    </div>
  );
}