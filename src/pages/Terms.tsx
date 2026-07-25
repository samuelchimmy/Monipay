import { motion, useInView } from 'framer-motion';
import { ArrowLeft, FileText, AlertTriangle, Scale, Wallet, Ban, Shield } from 'lucide-react';
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
  { icon: FileText, title: 'Acceptance of Terms', content: `By downloading, accessing, or using ${APP_CONFIG.name}, you agree to be bound by these Terms of Service.\n\n${APP_CONFIG.name} provides a non-custodial wallet and point-of-sale solution for stablecoin transactions across Base, BSC, and Tempo blockchains.` },
  { icon: Wallet, title: 'Non-Custodial Service', content: `${APP_CONFIG.name} is a non-custodial service:\n\n• You are solely responsible for your private keys and PIN\n• We cannot recover your funds if you lose access\n• You maintain full ownership and control of your assets\n• We do not hold, manage, or have access to your funds` },
  { icon: AlertTriangle, title: 'Risks', content: `Using ${APP_CONFIG.name} involves risks:\n\n• Cryptocurrency values can be volatile\n• Blockchain transactions are irreversible\n• You may lose access if you forget your PIN\n• Smart contract risks exist on any blockchain platform` },
  { icon: Scale, title: 'Platform Fees', content: `${APP_CONFIG.name} charges a ${APP_CONFIG.platformFee * 100}% platform fee on all transactions. This helps us:\n\n• Sponsor network (gas) fees for users\n• Maintain and improve the platform\n• Provide customer support` },
  { icon: Ban, title: 'Prohibited Uses', content: `You agree not to use MoniPay for:\n\n• Illegal activities or money laundering\n• Fraud or deceptive practices\n• Circumventing financial regulations\n• Any activity that violates applicable laws` },
  { icon: Shield, title: 'Reserved moniTags™ and Username Policy', content: `Monipay maintains a list of reserved moniTags™ that may not be registered by users. Reserved moniTags™ include but are not limited to usernames that:\n\n• Represent Monipay's brand, products, or team (e.g. "monipay", "monibot", "support", "admin")\n• Could be used to impersonate public figures, celebrities, or well-known entities in the cryptocurrency or technology industry\n• Are associated with blockchain networks, protocols, or tokens supported by Monipay\n• Could mislead users into believing they are interacting with an official Monipay account or representative\n\nMonipay reserves the right to reclaim, suspend, or reassign any moniTag™ at its sole discretion if it determines that the username violates this policy, is being used for fraud, impersonation, or any activity that harms Monipay users or the Monipay platform. Users whose moniTags™ are reclaimed will be notified where reasonably possible and given the opportunity to select a new moniTag™.\n\nMonipay may expand the reserved username list at any time without prior notice. Registration of a moniTag™ does not grant ownership of that username. Monipay retains all rights to usernames on the Monipay platform.` },
];

export default function Terms() {
  const { goBack } = useMinipayReturn();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-foreground selection:text-background">
      <PageMeta
        title="Terms of Service"
        description="MoniPay terms of service — understand your rights and responsibilities when using our platform."
        path="/terms"
        jsonLd={getWebPageSchema({ name: 'Terms of Service', path: '/terms', dateModified: LAST_UPDATED_ISO })}
        breadcrumbs={[
          { name: 'Home', url: 'https://monipay.xyz/' },
          { name: 'Terms', url: 'https://monipay.xyz/terms' },
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
              <h1 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-2">Terms of Service</h1>
              <p className="text-xs text-foreground/30">Last updated: <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED_LABEL}</time></p>
            </motion.div>

            <Reveal>
              <div className="border border-foreground/10 bg-foreground p-6 text-background mb-8">
                <p className="text-sm text-background/60 leading-relaxed">
                  Welcome to {APP_CONFIG.name} — the Gasless, Non-Custodial Payment Platform. Please read these terms carefully before using our service.
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
                <p className="text-xs text-foreground/30">Questions about these terms?</p>
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
