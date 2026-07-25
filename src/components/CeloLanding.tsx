import { XExhibitBadge } from '@/components/XExhibitBadge';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from './LanguageSelector';
import {
  Bot, Store, Users, Smartphone, CreditCard, Globe,
  ArrowRight, ExternalLink, Check, X, ArrowUpRight,
  AtSign, Share2, Tag, Zap, Shield, DollarSign
} from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { ChainCrossLinks } from './ChainCrossLinks';

/* ─── Celo Brand Colors ─── */
const CELO_YELLOW = '#FCFF52';
const CELO_BLACK = '#1a1a1a';

/* ─── Data ─── */

const chainFeatures = [
  { icon: Zap, title: 'Instant Finality', stat: '~5s', desc: 'Near-instant transaction confirmation on the Celo network.' },
  { icon: Shield, title: 'Carbon Negative', stat: 'Green', desc: 'Celo is one of the first carbon-negative blockchain networks.' },
  { icon: DollarSign, title: 'USDT Stablecoin', stat: 'USDT', desc: 'Globally recognized stablecoin for everyday payments and commerce.' },
  { icon: Globe, title: 'Mobile-First', stat: '6B+', desc: 'Built for mobile users phone-number-friendly payments for emerging markets.' },
];

const platformFeatures = [
  { icon: Bot, title: 'MoniBot AI Agent', desc: 'Autonomous AI executing USDT transfers via Twitter, Discord, and Telegram on Celo.' },
  { icon: Store, title: 'Merchant Suite', desc: 'Full POS, product catalog, invoicing, and payment links for Celo USDT merchants.' },
  { icon: Users, title: 'P2P Transfers', desc: 'Send USDT to any MoniTag™ on Celo. No wallet addresses, no mistakes.' },
  { icon: Smartphone, title: 'MiniPay Native', desc: 'Runs inside MiniPay wallet the gateway to 6 billion mobile users.' },
  { icon: CreditCard, title: 'Payment Gateway', desc: 'Stripe-like API for online USDT payments on Celo with merchant webhooks.' },
  { icon: Globe, title: 'Cross-Chain', desc: 'Same MoniTag™ works on Celo, Base, BSC, and Solana one identity.' },
];

const useCases = [
  { title: 'Emerging Market P2P', desc: 'Send and receive USDT across Africa, Latin America, and Southeast Asia mobile-first, low-cost.', num: '01' },
  { title: 'Freelancers', desc: 'Get paid in USDT on Celo. Share your MoniTag™ instant settlement, no bank needed.', num: '02' },
  { title: 'Social Commerce', desc: 'Run Twitter campaigns with MoniBot. Distribute USDT grants to your audience on Celo.', num: '03' },
  { title: 'Small Merchants', desc: 'Accept USDT with QR codes. Full merchant dashboard, invoicing, and product catalog.', num: '04' },
];

const steps = [
  { num: '01', title: 'Create MoniTag™', desc: 'Sign up a wallet is generated locally, encrypted with your PIN.' },
  { num: '02', title: 'Fund with USDT', desc: 'Send USDT from any Celo wallet or bridge from other chains.' },
  { num: '03', title: 'Send & Receive', desc: 'Pay via MoniTag™. 1% fee transparent, gasless for you.' },
  { num: '04', title: 'Go Merchant', desc: 'Enable merchant mode for POS, invoices, product catalog, and payment links.' },
];

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

function GridBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(${CELO_BLACK} 1px, transparent 1px), linear-gradient(90deg, ${CELO_BLACK} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-0 left-0 w-px h-32 bg-foreground/10" />
      <div className="absolute top-0 left-0 w-32 h-px bg-foreground/10" />
      <div className="absolute top-0 right-0 w-px h-32 bg-foreground/10" />
      <div className="absolute top-0 right-0 w-32 h-px bg-foreground/10" />
    </div>
  );
}

function FeeComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 0.6 } : {}}
        transition={{ duration: 0.5 }}
        className="bg-background p-8"
      >
        <h4 className="text-xs font-bold tracking-widest uppercase text-foreground/40 mb-6">Typical Celo Transfer</h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/50">Transaction</span>
            <span className="text-sm font-bold text-foreground">$10.00</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-foreground/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-foreground/60">Gas Fee</span>
            <span className="text-sm font-bold text-foreground">−$0.001</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-foreground/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-foreground/60">Requires CELO</span>
            <span className="text-sm font-bold text-foreground">Yes</span>
          </div>
          <div className="h-px bg-foreground/10" />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-foreground/40">Received</span>
            <span className="text-2xl font-extrabold tracking-tight text-foreground">$9.999</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-foreground/40 font-bold">
          <X className="w-3 h-3" />
          <span>Must hold CELO for gas</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="p-8"
        style={{ backgroundColor: CELO_BLACK }}
      >
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-xs font-bold tracking-widest uppercase" style={{ color: `${CELO_YELLOW}99` }}>MoniPay + Celo</h4>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Transaction</span>
            <span className="text-sm font-bold text-white">$10.00</span>
          </div>
          <div className="flex justify-between items-center border-l-2 pl-3 -ml-3" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>MoniPay Fee (1%)</span>
            <span className="text-sm font-bold text-white">−$0.10</span>
          </div>
          <div className="flex justify-between items-center border-l-2 pl-3 -ml-3" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>CELO Required</span>
            <span className="text-sm font-bold text-white">No</span>
          </div>
          <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>Received</span>
            <span className="text-2xl font-extrabold tracking-tight text-white">$9.90</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold" style={{ color: CELO_YELLOW }}>
          <Check className="w-3 h-3" />
          <span>1% fee · no CELO needed</span>
        </div>
      </motion.div>
    </div>
  );
}

interface CeloLandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function CeloLanding({ onGetStarted, onSignIn }: CeloLandingProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col safe-top relative selection:bg-foreground selection:text-background" data-chain="celo">

      <section className="sr-only" aria-label="MoniPay on Celo Key Features">
        <h2>MoniPay on Celo Key Features</h2>
        <ul>
          <li>Send USDT on Celo with human-readable MoniTag™ identity</li>
          <li>MoniBot AI agent for automated payments on Celo</li>
          <li>Non-custodial USDT wallet your keys, your funds</li>
          <li>1% transaction fee no hidden costs, no gas surprises</li>
          <li>MiniPay native integration for mobile-first emerging markets</li>
        </ul>
      </section>

      {/* ─── Header ─── */}
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-black/10 sticky top-0" style={{ backgroundColor: CELO_YELLOW }}>
        <div className="flex items-center gap-3">
          <MoniPayLogo size={32} color={CELO_BLACK} animationMode="idle" showText textSize={16} />
          <div className="h-4 w-px bg-black/20" />
          <div className="flex items-center gap-2">
            <img src="/chains/celo-logo.png" alt="Celo" className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: CELO_BLACK }}>
              Celo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-6 mr-6">
            {['Features', 'How it Works', 'MoniBot'].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s/g, '-')}`}
                className="text-xs font-medium tracking-wide transition-colors"
                style={{ color: `${CELO_BLACK}99` }}
              >
                {label}
              </a>
            ))}
          </nav>
          <Button size="sm" onClick={onSignIn} className="text-xs font-bold tracking-wide rounded-none px-6 h-9 text-white hover:opacity-90" style={{ backgroundColor: CELO_BLACK }}>
            Sign In
          </Button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative px-6 lg:px-16 py-20 lg:py-32">
        <GridBg />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
                <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/40">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: CELO_YELLOW }} />
                  Live on Celo · Chain 42220
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6"
              >
                Payments for
                <br />
                Everyone.
                <br />
                <span className="text-foreground/25">Powered by Celo.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-sm text-foreground/50 mb-10 max-w-sm leading-relaxed"
              >
                Non-custodial USDT payments on Celo with MoniBot AI agent
                and full merchant suite. Built for mobile-first emerging markets.
                Runs natively inside MiniPay.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Button onClick={onGetStarted} className="h-12 px-8 text-sm font-bold tracking-wide rounded-none text-black hover:opacity-90" style={{ backgroundColor: CELO_YELLOW }}>
                  SIGN UP
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mt-6"
              >
                <XExhibitBadge variant="pill" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-8 inline-flex items-center gap-2 text-[10px] font-bold tracking-wider text-foreground/25"
              >
                Powered by Celo · MiniPay
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="hidden lg:block">
              <div className="grid grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
                {[
                  { value: '42220', label: 'Chain ID', sub: 'Celo Mainnet' },
                  { value: 'USDT', label: 'Token', sub: '6 Decimals' },
                  { value: '~5s', label: 'Finality', sub: 'Near-Instant' },
                  { value: 'Mainnet', label: 'Network', sub: 'Production Ready' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-background p-8 flex flex-col justify-between min-h-[140px]">
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30">{stat.label}</span>
                    <div>
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">{stat.value}</span>
                      <p className="text-[10px] text-foreground/30 mt-1">{stat.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Chain Features ─── */}
      <section id="features" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Why Celo</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Mobile-First Blockchain</h2>
              </div>
              <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
                Built for real-world use fast, low-cost, and carbon-negative.
              </span>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10 border border-foreground/10">
            {chainFeatures.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="bg-background p-6 lg:p-8 min-h-[200px] flex flex-col justify-between group hover:text-background transition-colors duration-300" style={{ ['--hover-bg' as string]: CELO_BLACK }}>
                  <div className="flex items-start justify-between mb-6">
                    <f.icon className="w-5 h-5 text-foreground/30 transition-colors" />
                    <span className="text-2xl font-extrabold tracking-tight text-foreground transition-colors">{f.stat}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1 transition-colors">{f.title}</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed transition-colors">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Fee Comparison ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Transparent Pricing</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">1% Fee. No CELO Needed.</h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}><FeeComparison /></Reveal>
        </div>
      </section>

      {/* ─── Platform Features ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Platform</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Everything You Need</h2>
              </div>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
            {platformFeatures.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="bg-background p-6 lg:p-8 min-h-[160px] flex flex-col justify-between">
                  <f.icon className="w-5 h-5 text-foreground/20 mb-6" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5" style={{ backgroundColor: CELO_BLACK, color: 'white' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Process</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">How It Works</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.08}>
                <div className="p-6 lg:p-8 min-h-[180px] flex flex-col justify-between" style={{ backgroundColor: CELO_BLACK }}>
                  <span className="text-5xl font-extrabold leading-none" style={{ color: 'rgba(255,255,255,0.06)' }}>{s.num}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">{s.title}</h4>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MoniBot ─── */}
      <section id="monibot" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">AI-Powered Payments</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">MoniBot on Celo</h2>
              </div>
              <a href="https://x.com/maborngbot" target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-foreground/30 hover:text-foreground transition-colors">
                @monibot <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="border border-foreground/10 bg-background p-8 lg:p-10 mb-px max-w-4xl">
              <p className="text-sm text-foreground/60 leading-relaxed max-w-2xl">
                MoniBot is MoniPay's autonomous AI agent — the social financial layer
                that turns Twitter, Discord, and Telegram into payment terminals. On Celo,
                MoniBot processes USDT for mobile-first markets across Africa and Latin America.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
            {[
              { label: 'P2P via Tweets', desc: '"@monibot send $5 to @alice" executed in USDT on Celo, reaching mobile-first users.', cmd: '@monibot send $5' },
              { label: 'Campaign Grants', desc: 'Launch Twitter campaigns. MoniBot distributes USDT to participants on Celo.', cmd: 'Auto-distribute' },
              { label: 'Multi-Recipient', desc: 'Batch transfers to multiple users USDT on Celo with near-zero network fees.', cmd: 'Batch TX' },
              { label: 'Cross-Chain Routing', desc: 'Smart-routes between Celo, Base, BSC, and Solana based on recipient balance.', cmd: 'Smart Route' },
              { label: 'Discord & Telegram', desc: 'Same MoniBot commands work across Discord and Telegram — not just Twitter.', cmd: 'Multi-Platform' },
              { label: 'Social Identity', desc: 'Links Twitter, Discord & Telegram to MoniTag™ — human-readable on-chain identity.', cmd: '@handle → $tag' },
            ].map((cap, i) => (
              <Reveal key={cap.label} delay={i * 0.05}>
                <div className="bg-background p-6 lg:p-8 min-h-[160px] flex flex-col justify-between group">
                  <div className="flex items-start justify-between">
                    <Bot className="w-4 h-4 text-foreground/15" />
                    <span className="text-[9px] font-mono font-bold tracking-wider text-foreground/20 uppercase">{cap.cmd}</span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-foreground mb-1">{cap.label}</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">{cap.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use Cases ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Applications</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Built for Everyone</h2>
              </div>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
            {useCases.map((uc, i) => (
              <Reveal key={uc.num} delay={i * 0.06}>
                <div className="bg-background p-6 lg:p-8 min-h-[160px] flex flex-col justify-between">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-foreground/20">{uc.num}</span>
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-foreground mb-1">{uc.title}</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">{uc.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Technical ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Specs</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Technical Details</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 max-w-3xl">
            <Reveal>
              <div className="bg-background p-6 lg:p-8">
                <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 mb-6">Network</h4>
                <div className="space-y-3">
                  {[
                    ['Chain', 'Celo Mainnet'],
                    ['Chain ID', '42220'],
                    ['Token', 'USDT (6 dec)'],
                    ['RPC', 'forno.celo.org'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-baseline">
                      <span className="text-[11px] text-foreground/30">{k}</span>
                      <span className="text-xs font-mono font-bold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="bg-background p-6 lg:p-8">
                <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 mb-6">Contracts</h4>
                <div className="space-y-4">
                  {[
                    { label: 'MoniPayRouter', addr: '0xd66C...Bd2b0', url: 'https://celoscan.io/address/0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0' },
                    { label: 'MoniBotRouter', addr: '0x2a6F...8B9e', url: 'https://celoscan.io/address/0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e' },
                    { label: 'USDT', addr: '0x4806...3D5e', url: 'https://celoscan.io/token/0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' },
                  ].map((c) => (
                    <div key={c.label}>
                      <span className="text-[10px] text-foreground/30 block mb-0.5">{c.label}</span>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                        {c.addr} <ArrowUpRight className="w-3 h-3 text-foreground/30" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-28 border-t border-foreground/5 relative">
        <GridBg />
        <div className="max-w-3xl mx-auto relative z-10">
          <Reveal>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">Start Paying on Celo Today</h2>
              <p className="text-sm text-foreground/40 mb-4 max-w-md mx-auto leading-relaxed">Create a MoniTag™, receive USDT, and reach mobile-first markets worldwide.</p>
              <p className="text-xs text-foreground/30 mb-10">Already have MoniPay? Your MoniTag™ works here too.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={onGetStarted} className="h-12 px-10 text-sm font-bold tracking-wide rounded-none text-black hover:opacity-90" style={{ backgroundColor: CELO_YELLOW }}>
                  SIGN UP <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button onClick={onSignIn} variant="outline" className="h-12 px-10 text-sm font-bold tracking-wide rounded-none border-foreground/15 hover:bg-foreground hover:text-background">
                  Sign In
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Cross-Chain Links ─── */}
      <ChainCrossLinks />

      {/* ─── Footer ─── */}
      <footer className="px-6 lg:px-16 py-8 border-t border-black/10" style={{ backgroundColor: CELO_YELLOW }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MoniPayLogo size={20} color={CELO_BLACK} animationMode="idle" showText textSize={10} />
            <span className="text-[10px]" style={{ color: `${CELO_BLACK}80` }}>× Celo</span>
          </div>
          <div className="flex items-center gap-6 text-[11px]" style={{ color: `${CELO_BLACK}80` }}>
            <a href="https://celoscan.io" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ color: CELO_BLACK }}>CeloScan</a>
            <a href="https://docs.monipay.xyz" className="hover:opacity-100 transition-opacity" style={{ color: CELO_BLACK }}>Docs</a>
            <a href="https://x.com/monipay_xyz" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ color: CELO_BLACK }}>Twitter</a>
            <LanguageSelector variant="compact" />
            <span style={{ color: CELO_BLACK }}>© {new Date().getFullYear()} MoniPay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
