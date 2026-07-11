/**
 * MiniPayOnboardChrome.tsx
 * Drop-in replacement for the Onboarding header strip + root background
 * when running under /minipay (isCeloMode). Renders the yellow Celo pill
 * header with theme toggle + back button, plus a soft mp-surface backdrop.
 *
 * Children render the existing Onboarding step content (form fields,
 * CTAs, etc.) — only chrome changes.
 */
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Footer } from '@/components/Footer';

interface MiniPayOnboardChromeProps {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  backDisabled?: boolean;
  children: React.ReactNode;
}

function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden -z-0"
    >
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

export function MiniPayOnboardChrome({
  step,
  totalSteps,
  onBack,
  backDisabled,
  children,
}: MiniPayOnboardChromeProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <div
      data-minipay=""
      className="fixed inset-0 flex flex-col safe-top overflow-hidden"
      style={{ background: 'hsl(var(--mp-surface))', color: 'hsl(var(--mp-ink))' }}
    >
      <Backdrop />

      {/* Yellow Celo pill header */}
      <div className="relative z-10 px-3 sm:px-6 pt-3 pb-2">
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
              aria-label={t('minipay_back')}
              onClick={onBack}
              disabled={backDisabled || !onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <MoniPayLogo size={26} color="#000" animationMode="header" entranceOnMount />
              <span className="font-bold tracking-tight text-[15px] text-black">Monipay</span>
            </div>
            <button
              type="button"
              aria-label={t('dark_mode')}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </button>
          </div>
        </div>

        {/* Progress dots — Celo green */}
        <div className="max-w-md mx-auto mt-4 px-1">
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const s = i + 1;
              return (
                <div
                  key={s}
                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                  style={{ background: 'hsl(var(--mp-faint))' }}
                >
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: step >= s ? '100%' : '0%' }}
                    transition={{ duration: 0.3 }}
                    className="h-full rounded-full"
                    style={{ background: 'hsl(var(--mp-primary))' }}
                  />
                </div>
              );
            })}
          </div>
          <p
            className="text-xs mt-2 text-center"
            style={{ color: 'hsl(var(--mp-muted))' }}
          >
            {t('step_of', { step, total: totalSteps })}
          </p>
        </div>
      </div>

      {/* Content slot */}
      <div className="relative z-10 flex-1 overflow-y-auto">{children}</div>

      <div className="relative z-10">
        <Footer variant="minimal" />
      </div>
    </div>
  );
}