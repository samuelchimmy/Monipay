import { XExhibitBadge } from '@/components/XExhibitBadge';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from './LanguageSelector';
import {
  Zap, Layers, FileText, GitBranch, ExternalLink, Droplets,
  Store, Users, Bot, ArrowRight, Check, X, Smartphone, Globe,
  CreditCard, QrCode, Shield, ArrowUpRight
} from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { ChainCrossLinks } from './ChainCrossLinks';

interface TempoLandingProps {
  onGetStarted: () => void;
  onSignIn?: () => void;
}

/* ─── Data ─── */

const tempoFeatures = [
  { icon: Zap, title: 'Zero Gas', stat: '$0.00', desc: 'Native fee sponsorship — users never pay gas.' },
  { icon: Layers, title: 'Batch Payments', stat: '1 TX', desc: 'Multiple recipients in a single atomic call.' },
  { icon: FileText, title: 'TIP-20 Memos', stat: 'On-chain', desc: 'Invoice IDs & notes embedded in transfers.' },
  { icon: GitBranch, title: '2D Nonces', stat: '10×', desc: 'Concurrent transactions, maximum throughput.' },
];

const platformFeatures = [
  { icon: Store, title: 'Merchant POS', desc: 'Accept aUSD with QR codes. No hardware.' },
  { icon: Smartphone, title: 'Tap & Scan', desc: 'Customers scan to pay — instant, gasless.' },
  { icon: Bot, title: 'MoniBot Agent', desc: 'Autonomous on-chain agent via Twitter.' },
  { icon: Users, title: 'P2P Transfers', desc: 'Send to any MoniTag. No addresses needed.' },
  { icon: CreditCard, title: 'Payment Gateway', desc: 'Stripe-like API for online payments.' },
  { icon: Globe, title: 'Cross-Chain', desc: 'Tempo, Base, BSC — one wallet.' },
];

const useCases = [
  { title: 'Street Vendors', desc: 'Accept stablecoin payments with just a phone. No terminal, no bank, no fees.', num: '01' },
  { title: 'Freelancers', desc: 'Get paid instantly in aUSD. Share your MoniTag — receive payments globally.', num: '02' },
  { title: 'Social Commerce', desc: 'Run Twitter campaigns with MoniBot. Distribute grants and tips autonomously.', num: '03' },
  { title: 'Online Stores', desc: 'Integrate the MoniPay checkout API. Gasless stablecoin payments on your site.', num: '04' },
];

const steps = [
  { num: '01', title: 'Create MoniTag', desc: 'Sign up — a wallet is generated locally, encrypted with your PIN.' },
  { num: '02', title: 'Get Test Funds', desc: 'Visit the Tempo faucet for 1M aUSD on Moderato testnet.' },
  { num: '03', title: 'Send & Receive', desc: 'Pay via MoniTag. Zero gas — Tempo sponsors every transaction.' },
  { num: '04', title: 'Automate', desc: 'Deploy MoniBot for campaigns, P2P transfers, and grant distributions.' },
];

/* ─── Animated section wrapper ─── */
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

/* ─── Geometric grid background ─── */
function GridBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Fine grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-px h-32 bg-foreground/10" />
      <div className="absolute top-0 left-0 w-32 h-px bg-foreground/10" />
      <div className="absolute top-0 right-0 w-px h-32 bg-foreground/10" />
      <div className="absolute top-0 right-0 w-32 h-px bg-foreground/10" />
      <div className="absolute bottom-0 left-0 w-px h-32 bg-foreground/10" />
      <div className="absolute bottom-0 left-0 w-32 h-px bg-foreground/10" />
    </div>
  );
}

/* ─── Gasless comparison ─── */
function GaslessComparison() {
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
        <h4 className="text-xs font-bold tracking-widest uppercase text-foreground/40 mb-6">Traditional Crypto</h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/50">Transaction</span>
            <span className="text-sm font-bold text-foreground">$10.00</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-foreground/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-foreground/60">Gas Fee</span>
            <span className="text-sm font-bold text-foreground">−$2.34</span>
          </div>
          <div className="h-px bg-foreground/10" />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-foreground/40">Received</span>
            <span className="text-2xl font-extrabold tracking-tight text-foreground">$7.66</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-foreground/40 font-bold">
          <X className="w-3 h-3" />
          <span>23% lost to gas</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="bg-foreground p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-xs font-bold tracking-widest uppercase text-background/60">MoniPay + Tempo</h4>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-background/50">Transaction</span>
            <span className="text-sm font-bold text-background">$10.00</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-background/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-background/60">Gas Fee</span>
            <span className="text-sm font-bold text-background">$0.00</span>
          </div>
          <div className="h-px bg-background/10" />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-background/40">Received</span>
            <span className="text-2xl font-extrabold tracking-tight text-background">$10.00</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-background/60 font-bold">
          <Check className="w-3 h-3" />
          <span>100% delivered — gas sponsored</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Component ─── */
export function TempoLanding({ onGetStarted, onSignIn }: TempoLandingProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col safe-top relative selection:bg-foreground selection:text-background">

      {/* ─── Header ─── */}
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <MoniPayLogo size={32} color="#0052FF" animationMode="idle" showText textSize={16} />
          <div className="h-4 w-px bg-foreground/15" />
          <div className="flex items-center gap-2">
            <img src="/chains/tempo-logo.svg" alt="Tempo" className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/50">
              Tempo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-6 mr-6">
            {['Features', 'How it Works', 'Use Cases', 'Technical'].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s/g, '-')}`}
                className="text-xs font-medium tracking-wide text-foreground/40 hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
          <Button
            size="sm"
            onClick={onSignIn || onGetStarted}
            className="text-xs font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90 px-6 h-9"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative px-6 lg:px-16 py-20 lg:py-32">
        <GridBg />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mb-8"
              >
                <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/40">
                  <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                  Live on Tempo Testnet · Chain 42431
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6"
              >
                Gasless
                <br />
                Commerce.
                <br />
                <span className="text-foreground/25">Powered by Tempo.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-sm text-foreground/50 mb-10 max-w-sm leading-relaxed"
              >
                The gasless, non-custodial payment platform — with MoniBot, 
                the autonomous AI agent powering agentic commerce on social media. 
                Now on Tempo with native fee sponsorship.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="flex items-center gap-4"
              >
                  <Button
                    onClick={onGetStarted}
                    className="h-12 px-8 text-sm font-bold tracking-wide rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    SIGN UP
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                <a
                  href="https://faucet.tempo.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/40 hover:text-foreground transition-colors"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  Get Testnet Funds
                  <ExternalLink className="w-3 h-3" />
                </a>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mt-6"
              >
                <XExhibitBadge variant="pill" />
              </motion.div>
            </div>

            {/* Right — stats grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="hidden lg:block"
            >
              <div className="grid grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
                {[
                  { value: '$0', label: 'Gas Fees', sub: 'Fee Sponsored' },
                  { value: '42431', label: 'Chain ID', sub: 'Moderato Testnet' },
                  { value: '18', label: 'Decimals', sub: 'aUSD (TIP-20)' },
                  { value: '<1s', label: 'Finality', sub: 'Instant Settlement' },
                ].map((stat, i) => (
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

      {/* ─── Tempo Features ─── */}
      <section id="features" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Why Tempo</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  Built for Payments
                </h2>
              </div>
              <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
                A blockchain designed specifically for payments — MoniPay leverages every primitive.
              </span>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10 border border-foreground/10">
            {tempoFeatures.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="bg-background p-6 lg:p-8 min-h-[200px] flex flex-col justify-between group hover:bg-foreground hover:text-background transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <f.icon className="w-5 h-5 text-foreground/30 group-hover:text-background/50 transition-colors" />
                    <span className="text-2xl font-extrabold tracking-tight text-foreground group-hover:text-background transition-colors">{f.stat}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-background mb-1 transition-colors">{f.title}</h3>
                    <p className="text-[11px] text-foreground/40 group-hover:text-background/50 leading-relaxed transition-colors">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Gasless Comparison ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Zero Cost</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Gasless Transactions
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <GaslessComparison />
          </Reveal>
        </div>
      </section>

      {/* ─── Platform Features ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Platform</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  Everything You Need
                </h2>
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
      <section id="how-it-works" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5 bg-foreground text-background">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-2">Process</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-background tracking-tight">
                How It Works
              </h2>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-background/10">
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.08}>
                <div className="bg-foreground p-6 lg:p-8 min-h-[180px] flex flex-col justify-between">
                  <span className="text-5xl font-extrabold text-background/8 leading-none">{s.num}</span>
                  <div>
                    <h4 className="text-sm font-bold text-background mb-1">{s.title}</h4>
                    <p className="text-[11px] text-background/40 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MoniBot: Agentic Commerce ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Social Financial Layer</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  MoniBot — Agentic Commerce
                </h2>
              </div>
              <a
                href="https://x.com/monibot"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-foreground/30 hover:text-foreground transition-colors"
              >
                @monibot
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </Reveal>

          {/* Agent description */}
          <Reveal delay={0.05}>
            <div className="border border-foreground/10 bg-background p-8 lg:p-10 mb-px max-w-4xl">
              <p className="text-sm text-foreground/60 leading-relaxed max-w-2xl">
                MoniBot is MoniPay's autonomous AI agent — the intelligent social financial layer 
                that transforms Twitter into a payment terminal. It executes on-chain transactions 
                24/7 without human intervention: processing P2P commands, distributing campaign grants, 
                and automating multi-recipient transfers — all gasless on Tempo.
              </p>
            </div>
          </Reveal>

          {/* Agent capabilities grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
            {[
              { 
                label: 'P2P via Tweets', 
                desc: '"@monibot send $5 to @alice" — executed on-chain in seconds, zero gas.', 
                cmd: '@monibot send $5' 
              },
              { 
                label: 'Campaign Grants', 
                desc: 'Launch Twitter campaigns. MoniBot autonomously distributes aUSD to every participant.', 
                cmd: 'Auto-distribute' 
              },
              { 
                label: 'Multi-Recipient', 
                desc: 'Batch transfers to multiple users in a single atomic Tempo transaction.', 
                cmd: 'Batch TX' 
              },
              { 
                label: 'Cross-Chain Routing', 
                desc: 'Smart-routes between Tempo, Base, and BSC based on recipient network and balance.', 
                cmd: 'Smart Route' 
              },
              { 
                label: 'Scheduled Tasks', 
                desc: 'Queue payments for future execution. MoniBot handles timing and delivery.', 
                cmd: 'Cron Jobs' 
              },
              { 
                label: 'Social Identity', 
                desc: 'Links Twitter & Farcaster to MoniTags — human-readable on-chain identity.', 
                cmd: '@handle → $tag' 
              },
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
      <section id="use-cases" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Applications</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  Built for Everyone
                </h2>
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
      <section id="technical" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Specs</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Technical Details
              </h2>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 max-w-3xl">
            <Reveal>
              <div className="bg-background p-6 lg:p-8">
                <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 mb-6">Network</h4>
                <div className="space-y-3">
                  {[
                    ['Chain', 'Tempo Testnet (Moderato)'],
                    ['Chain ID', '42431'],
                    ['Stablecoin', 'aUSD (18 dec)'],
                    ['RPC', 'rpc.moderato.tempo.xyz'],
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
                    { label: 'MoniPayRouter', addr: '0xa39C...BDb9', url: 'https://explore.tempo.xyz/address/0xa39C3B7e02686cf7F226337525515c694318BDb9' },
                    { label: 'MoniBotRouter', addr: '0x78A8...49fc', url: 'https://explore.tempo.xyz/address/0x78A824fDE7Ee3E69B2e2Ee52d1136EECD76749fc' },
                    { label: 'aUSD', addr: '0x20c0...0001', url: 'https://explore.tempo.xyz/address/0x20c0000000000000000000000000000000000001' },
                  ].map((c) => (
                    <div key={c.label}>
                      <span className="text-[10px] text-foreground/30 block mb-0.5">{c.label}</span>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                        {c.addr}
                        <ArrowUpRight className="w-3 h-3 text-foreground/30" />
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
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                Start Building on Tempo
              </h2>
              <p className="text-sm text-foreground/40 mb-10 max-w-md mx-auto leading-relaxed">
                Create a wallet, grab testnet aUSD, and experience zero-fee payments.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={onGetStarted}
                    className="h-12 px-10 text-sm font-bold tracking-wide rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    SIGN UP
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                <Button
                  variant="outline"
                  asChild
                  className="h-12 px-10 text-sm font-bold tracking-wide rounded-none border-foreground/15 hover:bg-foreground hover:text-background"
                >
                  <a href="https://faucet.tempo.xyz" target="_blank" rel="noopener noreferrer">
                    <Droplets className="w-4 h-4 mr-2" />
                    Get Testnet Funds
                  </a>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Cross-Chain Links ─── */}
      <ChainCrossLinks />

      {/* ─── Footer ─── */}
      <footer className="px-6 lg:px-16 py-8 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MoniPayLogo size={20} color="#0052FF" animationMode="idle" showText textSize={10} />
            <span className="text-[10px] text-foreground/30">× Tempo</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-foreground/30">
            <a href="https://explore.tempo.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Explorer</a>
            <a href="https://faucet.tempo.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Faucet</a>
            <a href="https://x.com/monipay_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a>
            <LanguageSelector variant="compact" />
            <span>© {new Date().getFullYear()} MoniPay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
