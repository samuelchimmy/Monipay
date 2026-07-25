import { motion, useInView } from 'framer-motion';
import { ArrowLeft, Shield, Lock, Eye, Server, Globe, AtSign } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { getWebPageSchema } from '@/lib/schema';

const LAST_UPDATED_ISO = '2026-01-01';
const LAST_UPDATED_LABEL = 'January 2026';
import { Button } from '@/components/ui/button';
import { useMinipayReturn } from '@/hooks/useMinipayReturn';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Footer } from '@/components/Footer';
import { APP_CONFIG } from '@/config/app';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useRef } from 'react';

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay }} className={className}>
      {children}
    </motion.div>
  );
}

const sections = [
  { icon: Shield, title: 'Non-Custodial Security', content: `${APP_CONFIG.name} is a non-custodial wallet solution. Your private key is encrypted with your PIN and stored locally on your device. We never have access to your funds or your private key.` },
  { icon: Lock, title: 'Data We Collect', content: `We collect minimal data necessary to provide our service:\n\n• PayTag: Your unique identifier for payments\n• Transaction History: Records for your reference\n• Device Information: Basic info to optimize experience\n\nWe do NOT collect or have access to:\n• Your private keys\n• Your PIN\n• Your wallet contents` },
  { icon: Eye, title: 'How We Use Your Data', content: `Your data is used solely to:\n\n• Process and display your transactions\n• Enable peer-to-peer payments via PayTag\n• Improve app performance and user experience\n\nWe never sell your data to third parties.` },
  { icon: Server, title: 'Data Storage', content: 'Critical security data (private keys, PIN) is stored encrypted on your device only. Public transaction data may be synced to secure servers for backup and cross-device access. All data transmission is encrypted using industry-standard TLS encryption.' },
  { icon: Globe, title: 'Blockchain Data', content: `Transactions on supported blockchains are public and immutable. Your wallet address and transaction history are visible on the blockchain. Your PayTag provides a human-readable alias, but does not hide on-chain activity.` },
  { icon: AtSign, title: 'moniTag™ Identity Data', content: `When you register a moniTag™, Monipay collects and stores your chosen username, associated wallet address, registration timestamp, and device identifier. This information is stored on our servers and is necessary to operate the payment routing and identity resolution features of the Monipay platform.\n\nYour moniTag™ is a public identifier — it is visible to other Monipay users and may be visible to third parties who interact with Monipay's payment infrastructure. Do not register a moniTag™ that contains personal information you wish to keep private.\n\nIf you link social accounts (Twitter/X, Discord, Telegram) to your moniTag™, Monipay stores your social username and platform identifier for the purpose of enabling social payment commands via MoniBot AI. This data is not sold to third parties. You may unlink your social accounts at any time from the Settings screen.` },
];

export default function Privacy() {
  const { goBack } = useMinipayReturn();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-foreground selection:text-background">
      <PageMeta
        title="Privacy Policy"
        description="MoniPay privacy policy — your keys, your funds, your data. Non-custodial and privacy-first."
        path="/privacy"
        jsonLd={getWebPageSchema({ name: 'Privacy Policy', path: '/privacy', dateModified: LAST_UPDATED_ISO })}
        breadcrumbs={[
          { name: 'Home', url: 'https://monipay.xyz/' },
          { name: 'Privacy', url: 'https://monipay.xyz/privacy' },
        ]}
      />
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="rounded-none w-9 h-9 text-foreground/40"><ArrowLeft className="w-5 h-5" /></Button>
          <MoniPayLogo size={32} animationMode="idle" showText textSize={15} entranceOnMount />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-none w-9 h-9 text-foreground/40">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </header>

      <main className="flex-1">
        <section className="px-6 lg:px-16 py-16 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Legal</span>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-2">Privacy Policy</h1>
              <p className="text-xs text-foreground/30">Last updated: <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED_LABEL}</time></p>
            </motion.div>

            <Reveal>
              <div className="border border-foreground/10 bg-foreground p-6 text-background mb-8">
                <p className="text-sm text-background/60 leading-relaxed">
                  At {APP_CONFIG.name}, we take your privacy seriously. As a non-custodial wallet, we've designed our system so that you maintain full control over your funds and personal data.
                </p>
              </div>
            </Reveal>

            <div className="space-y-px border border-foreground/10 bg-foreground/10">
              {sections.map((section, i) => (
                <Reveal key={section.title} delay={i * 0.05}>
                  <div className="bg-background p-6 lg:p-8">
                    <div className="flex items-center gap-3 mb-3">
                      <section.icon className="w-4 h-4 text-foreground/20" />
                      <h2 className="text-sm font-bold text-foreground">{section.title}</h2>
                    </div>
                    <p className="text-[12px] text-foreground/50 whitespace-pre-line leading-relaxed pl-7">{section.content}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <div className="mt-8 text-center">
                <p className="text-xs text-foreground/30">Questions about our privacy practices?</p>
                <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-xs font-bold text-foreground/60 hover:text-foreground transition-colors">{APP_CONFIG.supportEmail}</a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer variant="full" />
    </div>
  );
}
