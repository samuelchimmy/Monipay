import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from './LanguageSelector';
import {
  Zap, Shield, Wallet, Droplets, ExternalLink,
  Store, Users, Bot, ArrowRight, Check, X, Smartphone, Globe,
  CreditCard, ArrowUpRight, AtSign, Share2, Tag, CircleDollarSign
} from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { ChainCrossLinks } from './ChainCrossLinks';

/* ─── Data ─── */

const chainFeatures = [
  { icon: Shield, title: 'Account Abstraction', stat: 'EIP-4337', desc: 'Smart account ready batch operations and session keys built into the chain.' },
  { icon: Zap, title: 'Cheapest EVM Gas', stat: '<$0.01', desc: 'Sub-cent transaction fees on the most affordable EVM L2.' },
  { icon: Wallet, title: 'Coinbase Ecosystem', stat: '100M+', desc: 'Access to Coinbase\'s 100M+ verified users and onramp infrastructure.' },
  { icon: CircleDollarSign, title: 'Native USDC Liquidity', stat: 'USDC', desc: 'Circle-issued native USDC the deepest stablecoin liquidity on any L2.' },
];

const platformFeatures = [
  { icon: Store, title: 'Merchant POS', desc: 'Accept USDC on Base with QR codes. MoniPay\'s home chain.' },
  { icon: Smartphone, title: 'Tap & Scan', desc: 'Customers scan to pay gasless on Base via our paymaster.' },
  { icon: Bot, title: 'MoniBot Agent', desc: 'Autonomous AI agent executing USDC transfers via Twitter on Base.' },
  { icon: Users, title: 'P2P Transfers', desc: 'Send USDC to any MoniTag™ on Base. No addresses needed.' },
  { icon: CreditCard, title: 'Payment Gateway', desc: 'Stripe-like API for online USDC payments powered by Base.' },
  { icon: Globe, title: 'Cross-Chain', desc: 'Same MoniTag™ works on Base, BSC, and Solana one identity.' },
];

const useCases = [
  { title: 'DeFi-Native Checkout', desc: 'Tap into Base\'s deep DeFi ecosystem. Accept payments from any Base DeFi user seamlessly.', num: '01' },
  { title: 'Freelancers', desc: 'Get paid in USDC on Base. Share your MoniTag™ receive payments globally with sub-cent gas.', num: '02' },
  { title: 'Social Commerce', desc: 'Run Twitter campaigns with MoniBot. Distribute USDC grants on Base MoniPay\'s home chain.', num: '03' },
  { title: 'Online Stores', desc: 'Integrate MoniPay checkout. Gasless USDC payments powered by Base\'s paymaster infrastructure.', num: '04' },
];

const steps = [
  { num: '01', title: 'Create MoniTag™', desc: 'Sign up a wallet is generated locally, encrypted with your PIN.' },
  { num: '02', title: 'Fund with USDC', desc: 'Send USDC from Coinbase, any exchange, or bridge from another chain.' },
  { num: '03', title: 'Send & Receive', desc: 'Pay via MoniTag™. Gasless MoniPay\'s paymaster covers the gas on Base.' },
  { num: '04', title: 'Automate', desc: 'Deploy MoniBot for campaigns, P2P transfers, and grant distributions on Base.' },
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
          <h4 className="text-xs font-bold tracking-widest uppercase text-background/60">MoniPay + Base</h4>
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
            <span className="text-xs font-bold text-background/60">Gas Fee</span>
            <span className="text-sm font-bold text-background">$0.00</span>
          </div>
          <div className="h-px bg-background/10" />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-background/40">Received</span>
            <span className="text-2xl font-extrabold tracking-tight text-background">$9.90</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-background/60 font-bold">
          <Check className="w-3 h-3" />
          <span>Gasless paymaster covers gas</span>
        </div>
      </motion.div>
    </div>
  );
}

export function BaseLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col safe-top relative selection:bg-foreground selection:text-background" data-chain="base">

      <section className="sr-only" aria-label="MoniPay on Base Key Features">
        <h2>MoniPay on Base Key Features</h2>
        <ul>
          <li>Send USDC on Base with human-readable MoniTag™ identity</li>
          <li>MoniBot AI agent for automated payments and social commerce on Base</li>
          <li>Non-custodial USDC wallet your keys, your funds</li>
          <li>1% transaction fee no hidden costs, no gas surprises</li>
          <li>Cross-chain: same MoniTag™ works on Base, BSC, and Solana</li>
          <li>MoniPay Base smart contract: 0x4048d18F71E723647f83B61202362425C5a7D2c0</li>
        </ul>
      </section>

      {/* ─── Header ─── */}
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <MoniPayLogo size={32} color="#0052FF" animationMode="idle" showText textSize={16} />
          <div className="h-4 w-px bg-foreground/15" />
          <div className="flex items-center gap-2">
            <img src="/chains/base-logo.svg" alt="Base" className="w-4 h-4 rounded-[3px]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#0052FF' }}>
              Base
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
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#0052FF' }} />
                  Live on Base Mainnet · Chain 8453
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6"
              >
                Base is MoniPay's
                <br />
                Home Chain.
                <br />
                <span className="text-foreground/25">Built for Payments.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-sm text-foreground/50 mb-10 max-w-sm leading-relaxed"
              >
                The gasless, non-custodial payment platform with the MoniBot AI Agent,
                the autonomous AI agent powering agentic commerce on social media.
                Built on Coinbase's L2 with native USDC liquidity.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="flex items-center gap-4">
                <Button asChild className="h-12 px-8 text-sm font-bold tracking-wide rounded-none text-white hover:opacity-90" style={{ backgroundColor: '#0052FF' }}>
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
                  { value: '8453', label: 'Chain ID', sub: 'Base Mainnet' },
                  { value: 'USDC', label: 'Token', sub: '6 Decimals' },
                  { value: '1%', label: 'Fee', sub: 'Transparent Pricing' },
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
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Why Base</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">The Coinbase L2</h2>
              </div>
              <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
                Coinbase's L2 brings 100M+ users, native USDC, and the cheapest EVM gas to MoniPay.
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
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Zero Cost</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Gasless Transactions</h2>
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
                that transforms Twitter into a payment terminal. Base is MoniPay's canonical home chain  -
                MoniBot executes gasless USDC transactions 24/7 with the deepest liquidity and lowest fees.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
            {[
              { label: 'P2P via Tweets', desc: '"@monibot send $5 to @alice" gasless on Base, MoniPay\'s home chain.', cmd: '@monibot send $5' },
              { label: 'Campaign Grants', desc: 'Launch Twitter campaigns. MoniBot distributes USDC gaslessly to every participant on Base.', cmd: 'Auto-distribute' },
              { label: 'Multi-Recipient', desc: 'Batch transfers to multiple users all gasless on Base via our paymaster.', cmd: 'Batch TX' },
              { label: 'Cross-Chain Routing', desc: 'Smart-routes between Base, BSC, and Solana based on recipient network and balance.', cmd: 'Smart Route' },
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
                    ['Chain', 'Base Mainnet'],
                    ['Chain ID', '8453'],
                    ['Token', 'USDC (6 dec)'],
                    ['RPC', 'base-rpc.publicnode.com'],
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
                    { label: 'MoniPayRouter', addr: '0x4048...7D2c0', url: 'https://basescan.org/address/0x4048d18F71E723647f83B61202362425C5a7D2c0' },
                    { label: 'MoniBotRouter', addr: '0xBEE3...A516', url: 'https://basescan.org/address/0xBEE37c2f3Ce9a48D498FC0D47629a1E10356A516' },
                    { label: 'USDC', addr: '0x8335...2913', url: 'https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
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
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">Start Accepting USDC on Base Today</h2>
              <p className="text-sm text-foreground/40 mb-4 max-w-md mx-auto leading-relaxed">Create a MoniTag™, receive USDC gaslessly, and join MoniPay's home chain.</p>
              <p className="text-xs text-foreground/30 mb-10">Already have MoniPay? Your MoniTag™ works here too.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="h-12 px-10 text-sm font-bold tracking-wide rounded-none text-white hover:opacity-90" style={{ backgroundColor: '#0052FF' }}>
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
            <MoniPayLogo size={20} color="#0052FF" animationMode="idle" showText textSize={10} />
            <span className="text-[10px] text-foreground/30">× Base</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-foreground/30">
            <a href="https://basescan.org" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Basescan</a>
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
