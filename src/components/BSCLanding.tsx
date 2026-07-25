import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from './LanguageSelector';
import {
  Server, DollarSign, Users as UsersIcon, Zap, ExternalLink,
  Store, Users, Bot, ArrowRight, Check, X, Smartphone, Globe,
  CreditCard, ArrowUpRight, AtSign, Share2, Tag
} from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { ChainCrossLinks } from './ChainCrossLinks';

/* ─── Data ─── */

const chainFeatures = [
  { icon: Server, title: '11-Node RPC', stat: '11', desc: 'Multi-RPC redundancy 11 public endpoints for maximum uptime and reliability.' },
  { icon: DollarSign, title: 'USDT Familiarity', stat: 'USDT', desc: 'The most recognized stablecoin globally no onboarding friction for merchants.' },
  { icon: UsersIcon, title: 'Binance Ecosystem', stat: '200M+', desc: 'Direct bridge from Binance CEX the world\'s largest exchange with 200M+ users.' },
  { icon: Zap, title: 'Sub-Cent Fees', stat: '<$0.01', desc: 'Lowest absolute transaction costs of any major EVM chain.' },
];

const platformFeatures = [
  { icon: Store, title: 'Merchant POS', desc: 'Accept USDT on BSC with QR codes. Familiar currency, zero hardware.' },
  { icon: Smartphone, title: 'Tap & Scan', desc: 'Customers scan to pay fast and cheap on BNB Chain.' },
  { icon: Bot, title: 'MoniBot Agent', desc: 'Autonomous AI agent executing USDT transfers via Twitter on BSC.' },
  { icon: Users, title: 'P2P Transfers', desc: 'Send USDT to any MoniTag™ on BSC. No addresses needed.' },
  { icon: CreditCard, title: 'Payment Gateway', desc: 'Stripe-like API for online USDT payments on BNB Chain.' },
  { icon: Globe, title: 'Cross-Chain', desc: 'Same MoniTag™ works on BSC, Base, and Solana one identity.' },
];

const useCases = [
  { title: 'Binance Exchange Users', desc: 'Withdraw USDT from Binance directly to your MoniPay wallet on BSC the native CEX-to-DeFi bridge.', num: '01' },
  { title: 'Freelancers', desc: 'Get paid in USDT on BSC. Share your MoniTag™ the most widely used stablecoin, globally.', num: '02' },
  { title: 'Social Commerce', desc: 'Run Twitter campaigns with MoniBot. Distribute USDT grants to Asia & Africa\'s massive user base.', num: '03' },
  { title: 'Online Stores', desc: 'Integrate MoniPay checkout. Accept USDT on BSC familiar to every crypto user.', num: '04' },
];

const steps = [
  { num: '01', title: 'Create MoniTag™', desc: 'Sign up a wallet is generated locally, encrypted with your PIN.' },
  { num: '02', title: 'Fund with USDT', desc: 'Bridge USDT from Binance or any BSC wallet instant and sub-cent fees.' },
  { num: '03', title: 'Send & Receive', desc: 'Pay via MoniTag™. 1% fee transparent, no hidden gas costs.' },
  { num: '04', title: 'Automate', desc: 'Deploy MoniBot for campaigns, P2P transfers, and grant distributions on BSC.' },
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
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-0 left-0 w-px h-32 bg-foreground/10" />
      <div className="absolute top-0 left-0 w-32 h-px bg-foreground/10" />
      <div className="absolute top-0 right-0 w-px h-32 bg-foreground/10" />
      <div className="absolute top-0 right-0 w-32 h-px bg-foreground/10" />
      <div className="absolute bottom-0 left-0 w-px h-32 bg-foreground/10" />
      <div className="absolute bottom-0 left-0 w-32 h-px bg-foreground/10" />
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
        <h4 className="text-xs font-bold tracking-widest uppercase text-foreground/40 mb-6">Typical BSC Transfer</h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground/50">Transaction</span>
            <span className="text-sm font-bold text-foreground">$10.00</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-foreground/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-foreground/60">BNB Gas Fee</span>
            <span className="text-sm font-bold text-foreground">−$0.08</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-foreground/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-foreground/60">Requires BNB</span>
            <span className="text-sm font-bold text-foreground">Yes</span>
          </div>
          <div className="h-px bg-foreground/10" />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-foreground/40">Received</span>
            <span className="text-2xl font-extrabold tracking-tight text-foreground">$9.92</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-foreground/40 font-bold">
          <X className="w-3 h-3" />
          <span>Must hold BNB for gas</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="bg-foreground p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-xs font-bold tracking-widest uppercase text-background/60">MoniPay + BSC</h4>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-background/50">Transaction</span>
            <span className="text-sm font-bold text-background">$10.00</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-background/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-background/60">MoniPay Fee (1%)</span>
            <span className="text-sm font-bold text-background">−$0.10</span>
          </div>
          <div className="flex justify-between items-center border-l-2 border-background/30 pl-3 -ml-3">
            <span className="text-xs font-bold text-background/60">BNB Required</span>
            <span className="text-sm font-bold text-background">No</span>
          </div>
          <div className="h-px bg-background/10" />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-background/40">Received</span>
            <span className="text-2xl font-extrabold tracking-tight text-background">$9.90</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-background/60 font-bold">
          <Check className="w-3 h-3" />
          <span>1% fee no BNB needed</span>
        </div>
      </motion.div>
    </div>
  );
}

export function BSCLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col safe-top relative selection:bg-foreground selection:text-background" data-chain="bsc">

      <section className="sr-only" aria-label="MoniPay on BNB Chain Key Features">
        <h2>MoniPay on BNB Chain Key Features</h2>
        <ul>
          <li>Send USDT on BNB Chain with human-readable MoniTag™ identity</li>
          <li>MoniBot AI agent for automated payments and social commerce on BSC</li>
          <li>Non-custodial USDT wallet your keys, your funds</li>
          <li>1% transaction fee no hidden costs, no gas surprises</li>
          <li>Cross-chain: same MoniTag™ works on Base, BSC, and Solana</li>
          <li>MoniPay BSC smart contract: 0x557285AbC46038E898d90eB00943Ff42c4Fbcb54</li>
        </ul>
      </section>

      {/* ─── Header ─── */}
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <MoniPayLogo size={32} color="#F0B90B" animationMode="idle" showText textSize={16} />
          <div className="h-4 w-px bg-foreground/15" />
          <div className="flex items-center gap-2">
            <img src="/chains/bsc-logo.svg" alt="BSC" className="w-4 h-4 dark:hidden" />
            <img src="/chains/bsc-logo-gold.svg" alt="BSC" className="w-4 h-4 hidden dark:block" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#F0B90B' }}>
              BNB Chain
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-6 mr-6">
            {['Features', 'How it Works', 'MoniBot', 'Technical'].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s/g, '-')}`}
                className="text-xs font-medium tracking-wide text-foreground/40 hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
          <Button size="sm" asChild className="text-xs font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90 px-6 h-9">
            <a href="https://monipay.xyz">Open App</a>
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
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#F0B90B' }} />
                  Live on BNB Chain · Chain 56
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6"
              >
                Reach a Billion
                <br />
                Users on BNB.
                <br />
                <span className="text-foreground/25">Powered by MoniPay.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-sm text-foreground/50 mb-10 max-w-sm leading-relaxed"
              >
                Non-custodial USDT payments on BNB Smart Chain with MoniBot,
                the autonomous AI agent powering agentic commerce on social media.
                Access Binance's 200M+ user base.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="flex items-center gap-4">
                <Button asChild className="h-12 px-8 text-sm font-bold tracking-wide rounded-none text-black hover:opacity-90" style={{ backgroundColor: '#F0B90B' }}>
                  <a href="https://monipay.xyz">
                    Open App
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
                <a href="https://docs.monipay.xyz" className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/40 hover:text-foreground transition-colors">
                  Read Docs
                  <ExternalLink className="w-3 h-3" />
                </a>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="hidden lg:block">
              <div className="grid grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
                {[
                  { value: '56', label: 'Chain ID', sub: 'BNB Mainnet' },
                  { value: 'USDT', label: 'Token', sub: '18 Decimals' },
                  { value: '11', label: 'RPC Nodes', sub: 'Multi-Endpoint' },
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
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Why BNB Chain</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">The Binance Ecosystem</h2>
              </div>
              <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
                The largest CEX-native chain 200M+ users, USDT liquidity, and sub-cent fees.
              </span>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10 border border-foreground/10">
            {chainFeatures.map((f, i) => (
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

      {/* ─── Fee Comparison ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Transparent Pricing</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">1% Fee. No BNB Needed.</h2>
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
      <section id="how-it-works" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5 bg-foreground text-background">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-2">Process</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-background tracking-tight">How It Works</h2>
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

      {/* ─── MoniBot ─── */}
      <section id="monibot" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Social Financial Layer</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">MoniBot Agentic Commerce</h2>
              </div>
              <a href="https://x.com/maborngbot" target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-foreground/30 hover:text-foreground transition-colors">
                @monibot <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="border border-foreground/10 bg-background p-8 lg:p-10 mb-px max-w-4xl">
              <p className="text-sm text-foreground/60 leading-relaxed max-w-2xl">
                MoniBot is MoniPay's autonomous AI agent the intelligent social financial layer
                that transforms Twitter into a payment terminal. On BSC, MoniBot processes USDT
                transactions for Binance's massive user base across Asia and Africa 24/7, autonomous.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
            {[
              { label: 'P2P via Tweets', desc: '"@monibot send $5 to @alice" executed in USDT on BSC, reaching Binance\'s user base.', cmd: '@monibot send $5' },
              { label: 'Campaign Grants', desc: 'Launch Twitter campaigns. MoniBot distributes USDT to every participant on BSC.', cmd: 'Auto-distribute' },
              { label: 'Multi-Recipient', desc: 'Batch transfers to multiple users USDT on BSC with sub-cent network fees.', cmd: 'Batch TX' },
              { label: 'Cross-Chain Routing', desc: 'Smart-routes between BSC, Base, and Solana based on recipient network and balance.', cmd: 'Smart Route' },
              { label: 'Scheduled Tasks', desc: 'Queue payments for future execution. MoniBot handles timing and delivery.', cmd: 'Cron Jobs' },
              { label: 'Social Identity', desc: 'Links Twitter & Farcaster to MoniTag™ human-readable on-chain identity.', cmd: '@handle → $tag' },
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

      {/* ─── MoniTag™ Identity ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Identity</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">MoniTag™ Your Payment Handle</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
            {[
              { icon: AtSign, title: 'Human-Readable', desc: '@alice pays @bob no wallet addresses, no mistakes.' },
              { icon: Share2, title: 'Cross-Chain', desc: 'Same MoniTag™ works on Base, BSC, and Solana one identity everywhere.' },
              { icon: Tag, title: 'Social-Linked', desc: 'Link your Twitter handle to your MoniTag™ for seamless social payments.' },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <div className="bg-background p-6 lg:p-8 min-h-[160px] flex flex-col justify-between">
                  <item.icon className="w-5 h-5 text-foreground/20 mb-6" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">{item.title}</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">{item.desc}</p>
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
      <section id="technical" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
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
                    ['Chain', 'BNB Smart Chain'],
                    ['Chain ID', '56'],
                    ['Token', 'USDT (18 dec)'],
                    ['RPC', 'bsc-dataseed.binance.org'],
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
                    { label: 'MoniPayRouter', addr: '0x5572...cb54', url: 'https://bscscan.com/address/0x557285AbC46038E898d90eB00943Ff42c4Fbcb54' },
                    { label: 'MoniBotRouter', addr: '0x9EED...832E', url: 'https://bscscan.com/address/0x9EED3cF32690FfFaD0b8BB44CaC65B3B801c832E' },
                    { label: 'USDT', addr: '0x55d3...7955', url: 'https://bscscan.com/token/0x55d398326f99059fF775485246999027B3197955' },
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
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">Start Accepting USDT on BSC Today</h2>
              <p className="text-sm text-foreground/40 mb-4 max-w-md mx-auto leading-relaxed">Create a MoniTag™, receive USDT, and reach Binance's global user base.</p>
              <p className="text-xs text-foreground/30 mb-10">Already have MoniPay? Your MoniTag™ works here too.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="h-12 px-10 text-sm font-bold tracking-wide rounded-none text-black hover:opacity-90" style={{ backgroundColor: '#F0B90B' }}>
                  <a href="https://monipay.xyz">Open App <ArrowRight className="w-4 h-4 ml-2" /></a>
                </Button>
                <Button variant="outline" asChild className="h-12 px-10 text-sm font-bold tracking-wide rounded-none border-foreground/15 hover:bg-foreground hover:text-background">
                  <a href="https://docs.monipay.xyz">Read Docs</a>
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
            <MoniPayLogo size={20} color="#F0B90B" animationMode="idle" showText textSize={10} />
            <span className="text-[10px] text-foreground/30">× BNB Chain</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-foreground/30">
            <a href="https://bscscan.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">BscScan</a>
            <a href="https://docs.monipay.xyz" className="hover:text-foreground transition-colors">Docs</a>
            <a href="https://x.com/monipay_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a>
            <LanguageSelector variant="compact" />
            <span>© {new Date().getFullYear()} MoniPay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
