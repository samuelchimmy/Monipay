import { motion, useInView } from 'framer-motion';
import {
  ArrowLeft,
  LifeBuoy,
  KeyRound,
  Wallet,
  ShieldAlert,
  Bot,
  Globe,
  MessageCircle,
  AtSign,
  CreditCard,
  Sun,
  Moon,
  Twitter,
  Mail,
} from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { getFAQPageSchema, getWebPageSchema } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { useMinipayReturn } from '@/hooks/useMinipayReturn';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Footer } from '@/components/Footer';
import { APP_CONFIG } from '@/config/app';
import { useTheme } from 'next-themes';
import { useRef } from 'react';

const LAST_UPDATED_ISO = '2026-05-15';
const LAST_UPDATED_LABEL = 'May 2026';

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const TOPICS = [
  {
    icon: KeyRound,
    title: 'I forgot my PIN. Can MoniPay reset it?',
    body: `No. Your private key is encrypted on your device with your PIN using AES-256-GCM. MoniPay never stores or sees your PIN, so we cannot reset it. If you have a Google Drive backup or your secret recovery phrase, you can restore your wallet by reinstalling the app and choosing "Import Wallet". Without either, the funds in that wallet are permanently inaccessible — this is the trade-off of true self-custody.`,
  },
  {
    icon: Wallet,
    title: 'My deposit hasn\'t arrived',
    body: `Stablecoin deposits are detected on-chain. Make sure you sent the right token (USDC on Base, USDT on BSC, AlphaUSD on Tempo, USDC SPL on Solana) on the matching network. Cross-network sends (e.g. USDC on Ethereum mainnet to a Base address) will not appear and may be unrecoverable. Confirmation usually takes under 30 seconds. If you can see the transaction on the block explorer but not in MoniPay after 5 minutes, contact support with the transaction hash.`,
  },
  {
    icon: ShieldAlert,
    title: 'I think my MoniTag is being used by someone else',
    body: `MoniTags are bound to a single wallet at creation. If you suspect compromise, do not use the wallet. Move any remaining funds to a new MoniPay wallet (with a new MoniTag) using your existing PIN to sign the withdrawal, then disable the old account from Settings. Email security@monipay.xyz with the affected MoniTag and any context.`,
  },
  {
    icon: Bot,
    title: 'MoniBot didn\'t process my payment',
    body: `MoniBot polls Twitter/X, Bluesky, Discord and Telegram every 30–60 seconds. Command parsing is advancing gradually and will soon include broader natural-language recognition and support for more languages. Discord remains the reference implementation and most reliable. For Twitter/X and Bluesky, your account must be public and the reply must be a direct response to a MoniBot-tracked post. For P2P commands, only the sender needs to have linked the relevant social platform to a MoniTag™. Recipients do not need a MoniPay account — MoniPay's MagicPay innovation lets them securely receive tips and payments from MoniPay senders without ever registering.`,
  },
  {
    icon: CreditCard,
    title: 'How do I withdraw to an exchange?',
    body: `Open Send, choose the destination chain, paste the exchange deposit address (must be the matching network), enter the amount, then confirm with your PIN. MoniPay sponsors gas on Base, BSC and Tempo via the relayer. Solana withdrawals use a fee-payer relay. Exchanges typically credit deposits within minutes once the chain confirms — check the exchange's required confirmation count.`,
  },
  {
    icon: Globe,
    title: 'Which countries does MoniPay support?',
    body: `MoniPay is a non-custodial wallet that runs entirely in your browser or installed app. There is no geographic gate on the wallet itself. However, on/off-ramp providers, exchanges, and our infrastructure providers may have their own restrictions. You are responsible for complying with the laws and tax rules of your jurisdiction.`,
  },
  {
    icon: AtSign,
    title: 'Can I change my MoniTag?',
    body: `MoniTags are permanent identifiers tied to your wallet at creation. You cannot rename one. If you need a different MoniTag, create a new wallet with the desired tag and move funds across. Reserved usernames (brand names, generic terms, ~150 blocked words) cannot be claimed.`,
  },
  {
    icon: MessageCircle,
    title: 'How do I contact a human?',
    body: `Email ${APP_CONFIG.supportEmail} for general support, or security@monipay.xyz for urgent security issues. Include your MoniTag (never your PIN, recovery phrase or private key — no MoniPay employee will ever ask). For developer questions, the integration docs at docs.monipay.xyz cover the Chrome extension, payment links and webhook signatures.`,
  },
];

const CHANNELS = [
  { label: 'General support', value: APP_CONFIG.supportEmail, href: `mailto:${APP_CONFIG.supportEmail}`, icon: Mail },
  { label: 'Security disclosures', value: 'security@monipay.xyz', href: 'mailto:security@monipay.xyz', icon: ShieldAlert },
  { label: 'Developer docs', value: 'docs.monipay.xyz', href: 'https://docs.monipay.xyz', icon: Globe },
  { label: 'Status & incidents', value: 'status.monipay.xyz', href: 'https://status.monipay.xyz', icon: LifeBuoy },
];

const SOCIALS = [
  { label: 'X (Twitter)', value: '@monipay_xyz', href: APP_CONFIG.social.twitter, icon: Twitter },
  { label: 'Discord', value: 'Join our server', href: APP_CONFIG.social.discord, icon: MessageCircle },
];

export default function Support() {
  const { goBack } = useMinipayReturn();
  const { theme, setTheme } = useTheme();

  const faqJsonLd = getFAQPageSchema(
    TOPICS.map((t) => ({ q: t.title, a: t.body })),
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-foreground selection:text-background">
      <PageMeta
        title="MoniPay Support — Help, FAQs & Contact"
        description="Get help with MoniPay. Recover wallets, troubleshoot deposits, fix MoniBot commands, and contact MoniPay support across Base, BSC, Solana and Tempo."
        path="/support"
        jsonLd={[
          getWebPageSchema({ name: 'MoniPay Support', path: '/support', dateModified: LAST_UPDATED_ISO }),
          faqJsonLd,
        ]}
        breadcrumbs={[
          { name: 'Home', url: 'https://monipay.xyz/' },
          { name: 'Support', url: 'https://monipay.xyz/support' },
        ]}
      />

      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="rounded-none w-9 h-9 text-foreground/40">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <MoniPayLogo size={32} animationMode="idle" showText textSize={15} entranceOnMount />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-none w-9 h-9 text-foreground/40"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </header>

      <main className="flex-1">
        <section className="px-6 lg:px-16 py-16 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Support</span>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-2">
                Help with MoniPay
              </h1>
              <p className="text-xs text-foreground/30">
                Last updated: <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED_LABEL}</time>
              </p>
            </motion.div>

            <Reveal>
              <div className="border border-foreground/10 bg-foreground p-6 text-background mb-8 flex items-start gap-4">
                <LifeBuoy className="w-5 h-5 text-background/60 shrink-0 mt-0.5" />
                <p className="text-sm text-background/70 leading-relaxed">
                  MoniPay is non-custodial. Support can guide you, but we cannot move your funds, reset your PIN, or recover a lost wallet without your backup. Read the topics below first — most issues resolve in a minute.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/40 mb-4">Contact channels</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 mb-8">
                {CHANNELS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <a
                      key={c.label}
                      href={c.href}
                      target={c.href.startsWith('http') ? '_blank' : undefined}
                      rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="bg-background p-5 hover:bg-foreground/5 transition-colors flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-foreground/30" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 mb-1">{c.label}</p>
                        <p className="text-sm font-bold text-foreground">{c.value}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </Reveal>

            <Reveal>
              <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/40 mb-4">Socials</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 mb-12">
                {SOCIALS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-background p-5 hover:bg-foreground/5 transition-colors flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-foreground/30" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 mb-1">{s.label}</p>
                        <p className="text-sm font-bold text-foreground">{s.value}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </Reveal>

            <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-foreground/40 mb-4">Frequently asked</h2>
            <div className="space-y-px border border-foreground/10 bg-foreground/10">
              {TOPICS.map((t, i) => (
                <Reveal key={t.title} delay={i * 0.04}>
                  <article className="bg-background p-6 lg:p-8">
                    <div className="flex items-center gap-3 mb-3">
                      <t.icon className="w-4 h-4 text-foreground/20" />
                      <h3 className="text-sm font-bold text-foreground">{t.title}</h3>
                    </div>
                    <p className="text-[12px] text-foreground/50 whitespace-pre-line leading-relaxed pl-7">
                      {t.body}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <div className="mt-12 border border-foreground/10 p-6 lg:p-8 text-center">
                <p className="text-xs text-foreground/40 mb-2">Still stuck?</p>
                <a
                  href={`mailto:${APP_CONFIG.supportEmail}`}
                  className="text-sm font-bold text-foreground hover:underline"
                >
                  {APP_CONFIG.supportEmail}
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer variant="full" />
    </div>
  );
}
