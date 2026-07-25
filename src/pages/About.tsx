import { motion } from 'framer-motion';
import { ArrowLeft, Smartphone, Zap, Shield, Globe, Bot, AtSign, ArrowRight, Sparkles, Wallet, Layers, Store, Receipt, QrCode, Link2, MessageSquare, Gift, Repeat, Users } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { getAboutPageSchema, getOrganizationSchema } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Footer } from '@/components/Footer';
import { XExhibitBadge } from '@/components/XExhibitBadge';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useRef } from 'react';
import { useInView } from 'framer-motion';

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay }} className={className}>
      {children}
    </motion.div>
  );
}

function GridBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
    </div>
  );
}

const PILLARS = [
  { icon: Zap, title: 'Gasless By Default', description: 'Every send is sponsored by a Paymaster relayer. Users hold stablecoins, never gas tokens, and pay zero network fees at the confirm screen.' },
  { icon: Shield, title: 'Non-Custodial Keys', description: 'Private keys are generated on-device, encrypted with your PIN using AES-GCM, and optionally backed up to your own Google Drive appDataFolder. Monipay cannot move your funds.' },
  { icon: AtSign, title: 'MoniTag Identity', description: 'One human-readable @tag resolves to your address on every supported chain. Link X, Discord, Telegram and Bluesky so anyone can pay you by social handle.' },
  { icon: Zap, title: 'CasualPay Instant P2P', description: 'The everyday rail. Send by @MoniTag to anyone already on Monipay or MiniPay and it settles on-chain in under two seconds with zero fees to the sender.' },
  { icon: Sparkles, title: 'MagicPay Social Escrow', description: 'Send stablecoins to someone who does not have a wallet yet. Funds sit in an on-chain IOU registry for 180 days and settle the moment the recipient claims their MoniTag.', href: 'https://blog.monipay.xyz/magicpay-is-live-tip-pay-anyone-on-x-discord-or-telegram-with-no-wallet-required' },
  { icon: Bot, title: 'MoniBot Agentic Commerce', description: 'A financial agent on X, Discord and Telegram that parses natural language, runs campaigns, airdrops and P2P sends, and now schedules conditional payments that fire on real world triggers.', href: '/monibot' },
  { icon: Layers, title: 'Conditional Payment Engine', description: 'Pre-approve the router once, then queue payments that release only when a condition resolves. Sports P2P is the first live use case. Price, weather, GitHub, creator, flight and IoT triggers are next.', href: 'https://blog.monipay.xyz/introducing-conditional-sports-p2p-smart-world-cup-2026-rewards' },
  { icon: Wallet, title: 'Three Ways In', description: 'Monipay Legacy is the flagship non-custodial app. WalletConnect brings any external wallet into the same tag and MagicPay rails. MiniPay ships Monipay as a mini-app inside Opera on Celo.' },
  { icon: Globe, title: 'Multi-Chain Rails', description: 'Live on Celo (USDm and MiniPay stablecoins), BSC (USDT), Base (USDC) and Ink (USDC). Arc, Solana and Tempo are in the works. Cross-chain routing picks the chain with funds.' },
  { icon: Smartphone, title: 'SoftPOS Terminal', description: 'Any phone becomes a payment terminal. Merchants type an amount, customers scan a QR or tap a monipay:// deep link, and settlement is on-chain in under two seconds. No hardware, no card rails.' },
  { icon: Store, title: 'Merchant Tools', description: 'Invoices, customers, orders, revenue analytics, CSV exports, refunds and multi-cashier roles. Full accounting-grade ledger with on-chain receipts for every line item.' },
  { icon: Receipt, title: 'Storefronts & Payment Links', description: 'Spin up monipay.xyz/store/@yourtag in one click. Products, carts, shipping, checkout, webhooks, API keys and hosted pay pages at monipay.xyz/pay. Stripe-style, on-chain settlement.', href: 'https://docs.monipay.xyz' },
];

const STATS = [
  { value: '$0', label: 'Gas Fees', sub: 'Fully sponsored' },
  { value: '4', label: 'Live Chains', sub: 'Celo, BSC, Base, Ink' },
  { value: '3', label: 'Ways In', sub: 'Legacy, WalletConnect, MiniPay' },
  { value: '<2s', label: 'Settlement', sub: 'On-chain, verifiable' },
];

const BOTTOM_CTAS = [
  { label: 'Read the docs', href: 'https://docs.monipay.xyz', external: true },
  { label: 'Read the blog', href: 'https://blog.monipay.xyz', external: true },
  { label: 'Meet MoniBot', href: '/monibot' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Use cases', href: '/use-cases' },
  { label: 'MiniPay mini-app', href: '/minipay' },
  { label: 'Celo', href: '/celo' },
  { label: 'Base', href: '/base' },
  { label: 'BSC', href: '/bsc' },
  { label: 'Ink', href: '/ink' },
  { label: 'Live stats', href: '/stats' },
  { label: 'Support', href: '/support' },
];

export default function About() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-foreground selection:text-background">
      <PageMeta
        title="About Monipay | Non-Custodial Social Payment Layer"
        description="Monipay is a non-custodial social payment layer. Gasless stablecoin sends by MoniTag, MagicPay social escrow, MoniBot agentic commerce and a Conditional Payment Engine across Celo, BSC, Base and Ink."
        path="/about"
        ogImage="https://monipay.xyz/og/default.png"
        jsonLd={[getAboutPageSchema(), getOrganizationSchema()]}
        breadcrumbs={[
          { name: 'Home', url: 'https://monipay.xyz/' },
          { name: 'About', url: 'https://monipay.xyz/about' },
        ]}
      />
      {/* Header */}
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-none w-9 h-9 text-foreground/40">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <MoniPayLogo size={32} animationMode="idle" showText textSize={15} entranceOnMount />
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-6 mr-4">
            {[{ label: 'How it Works', href: '/how-it-works' }, { label: 'Use Cases', href: '/use-cases' }, { label: 'Docs', href: '/docs' }].map((link) => (
              <a key={link.label} href={link.href} className="text-xs font-medium tracking-wide text-foreground/40 hover:text-foreground transition-colors">{link.label}</a>
            ))}
          </nav>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-none w-9 h-9 text-foreground/40">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative px-6 lg:px-16 py-20 lg:py-28">
          <GridBg />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 mb-6 block">About Monipay</motion.span>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6">
              The Social<br /><span className="text-foreground/25">Payment Layer</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-sm text-foreground/50 mb-10 max-w-xl mx-auto leading-relaxed">
              Monipay turns any social handle into a payment address for users, merchants and creators. Gasless stablecoin sends, walletless social escrow, merchant tools, and an agent that executes on-chain from a tweet, a Discord message or a Telegram chat. You hold the keys. The protocol holds the rails.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex items-center gap-4 justify-center">
              <Button onClick={() => navigate('/')} className="h-12 px-8 text-sm font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90">SIGN UP <ArrowRight className="w-4 h-4 ml-2" /></Button>
              <a href="/how-it-works" className="text-xs font-medium text-foreground/40 hover:text-foreground transition-colors">How it Works →</a>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-10 max-w-md mx-auto">
              <XExhibitBadge variant="card" />
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-foreground/5">
          <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/5">
            {STATS.map((stat) => (
              <Reveal key={stat.label}>
                <div className="bg-background p-6 lg:p-8 flex flex-col justify-between min-h-[120px]">
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30">{stat.label}</span>
                  <div>
                    <span className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">{stat.value}</span>
                    <p className="text-[10px] text-foreground/30 mt-1">{stat.sub}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-b border-foreground/5">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="border border-foreground/10 bg-foreground p-8 lg:p-12 text-background">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-4">Our Mission</span>
                <h2 className="text-2xl lg:text-3xl font-extrabold text-background tracking-tight mb-4">Payments That Move Like Messages</h2>
                <p className="text-sm text-background/50 leading-relaxed max-w-2xl">
                  A payment should feel like sending a message. No seed phrases, no gas top-ups, no 42 character addresses, no hardware terminals. Monipay abstracts the chain into a single tap while keeping every private key on the user's device.
                </p>
                <p className="text-sm text-background/50 leading-relaxed max-w-2xl mt-4">
                  <a href="https://blog.monipay.xyz/magicpay-is-live-tip-pay-anyone-on-x-discord-or-telegram-with-no-wallet-required" target="_blank" rel="noopener noreferrer" className="text-background underline decoration-background/30 underline-offset-2 hover:decoration-background font-bold transition-colors">MagicPay</a> lets anyone receive stablecoins before they even own a wallet. <strong className="text-background">MoniBot</strong> turns tweets and chat commands into signed on-chain transactions. Our <strong className="text-background">Conditional Payment Engine</strong> queues payments that fire only when a real world event resolves, starting with sports P2P and expanding to price, weather, code, creator, travel and IoT triggers.
                </p>
                <p className="text-sm text-background/50 leading-relaxed max-w-2xl mt-4">
                  Live today on Celo, BSC, Base and Ink. Arc, Solana and Tempo are in the works. Cross-chain routing picks whichever chain has funds so the sender never thinks about networks.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Access Model */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-b border-foreground/5">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Three Ways In</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">One Identity, Three Front Doors</h2>
                <p className="text-sm text-foreground/40 mt-3 max-w-2xl leading-relaxed">Every access mode resolves to the same MoniTag, the same MagicPay rails and the same MoniBot agent. Pick the door that fits the user.</p>
              </div>
            </Reveal>
            <div className="grid sm:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
              {[
                { tag: 'Flagship', title: 'Monipay Legacy', body: 'The non-custodial app on monipay.xyz. Local key generation, PIN encryption, Google Drive backup, full merchant tooling, storefronts, invoices and MoniBot management. This is the moat.' },
                { tag: 'Bring Your Wallet', title: 'WalletConnect', body: 'Any external wallet plugs into Monipay to claim a MoniTag, send MagicPay escrows and pay by social handle. Same identity graph, no new key material.' },
                { tag: 'Distribution', title: 'MiniPay Mini-app', body: 'Monipay runs inside Opera MiniPay on Celo, bringing MoniTag, MagicPay and MoniBot to the wallet the world already uses. Balances shown as USD across the stablecoins MiniPay supports.' },
              ].map((item) => (
                <Reveal key={item.title}>
                  <div className="bg-background p-6 lg:p-8 min-h-[200px] flex flex-col justify-between">
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30">{item.tag}</span>
                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">{item.title}</h3>
                      <p className="text-[11px] text-foreground/40 leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Conditional Payment Engine */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-b border-foreground/5">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-3">New Primitive</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">The Conditional Payment Engine</h2>
              <p className="text-sm text-foreground/50 leading-relaxed mb-6 max-w-2xl">
                Most on-chain "if this then pay" systems force you to lock funds upfront. Ours does not. Monibot registers the intent, watches the trigger through a modular oracle layer, and pulls the payment from a pre-approved router allowance the instant the condition resolves. Your funds stay in your wallet until the moment of payout. It is designed for influencer follower rewards and community incentives, not bets or obligations. Capital efficient, non-custodial, and cancellable at any time by revoking the allowance.
              </p>
              <p className="text-sm text-foreground/50 leading-relaxed mb-6 max-w-2xl">
                <a href="https://blog.monipay.xyz/introducing-conditional-sports-p2p-smart-world-cup-2026-rewards" target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground font-bold transition-colors">Conditional Sports P2P</a> is the first live surface. A creator tweets <span className="font-mono text-foreground">@monibot send $20 to @jade if Germany wins Curacao</span> and the bot handles parsing, resolution, execution and receipt. Followers who predicted correctly get rewarded automatically. The same engine will power price limit orders, weather payouts, GitHub bounties, creator milestones, flight delay refunds and IoT delivery release.
              </p>
              <p className="text-[11px] text-foreground/30 leading-relaxed max-w-2xl">One engine, many triggers. Every payout is a real on-chain transfer with a verifiable receipt.</p>
            </Reveal>
          </div>
        </section>

        {/* Payment Rails: CasualPay + MagicPay */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-b border-foreground/5">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Payment Rails</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Two Rails, One Handle</h2>
                <p className="text-sm text-foreground/40 mt-3 max-w-2xl leading-relaxed">Every send flows through one of two rails. Both resolve @MoniTag to an on-chain address, both are gasless, both settle in seconds.</p>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
              <Reveal>
                <div className="bg-background p-8 lg:p-10 min-h-[260px] flex flex-col justify-between">
                  <div>
                    <Zap className="w-5 h-5 text-foreground/30 mb-6" />
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30 block mb-2">CasualPay</span>
                    <h3 className="text-xl font-bold text-foreground mb-3">Instant P2P by @MoniTag</h3>
                    <p className="text-xs text-foreground/50 leading-relaxed mb-3">The everyday rail. If the recipient already has a MoniTag or MiniPay wallet, the transfer lands on-chain the moment you tap send. No wrapped tokens, no bridges, no waiting screens.</p>
                    <p className="text-xs text-foreground/50 leading-relaxed">Powers P2P inside the app, MoniBot tweet commands, Discord and Telegram sends, storefront checkout and merchant SoftPOS.</p>
                  </div>
                  <a href="/how-it-works" className="text-[11px] font-medium text-foreground mt-6">See the flow →</a>
                </div>
              </Reveal>
              <Reveal>
                <div className="bg-background p-8 lg:p-10 min-h-[260px] flex flex-col justify-between">
                  <div>
                    <Sparkles className="w-5 h-5 text-foreground/30 mb-6" />
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30 block mb-2">MagicPay</span>
                    <h3 className="text-xl font-bold text-foreground mb-3">Walletless Social Escrow</h3>
                    <p className="text-xs text-foreground/50 leading-relaxed mb-3">Pay a social handle that has no wallet yet. Funds park in the on-chain IOU registry for 180 days and release the second the recipient claims their MoniTag. No custodian in the middle.</p>
                    <p className="text-xs text-foreground/50 leading-relaxed">Works across X, Discord, Telegram and Bluesky. Every IOU is verifiable on-chain and refundable to the sender if unclaimed.</p>
                  </div>
                  <a href="/use-cases" className="text-[11px] font-medium text-foreground mt-6">See use cases →</a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* MoniBot Capabilities */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-b border-foreground/5">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">MoniBot</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">The Agent That Pays</h2>
                <p className="text-sm text-foreground/40 mt-3 max-w-2xl leading-relaxed">MoniBot lives on X, Discord and Telegram. It reads natural language, resolves identities, signs on-chain and replies with a receipt. One agent, many verbs.</p>
              </div>
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
              {[
                { icon: MessageSquare, title: 'Natural Language P2P', body: 'Tweet, DM or chat "@monibot send $5 to @alice on base" and it just happens. Multi-recipient, cross-chain, and gasless.' },
                { icon: Gift, title: 'Campaigns & Airdrops', body: 'Launch reply-to-earn or first-N campaigns from a single tweet. MoniBot scores replies, prevents Sybil and drops stablecoins to winners.' },
                { icon: Users, title: 'Group Splits & Tips', body: 'Split a tab across mentions, tip creators, or reward a Discord role. Every leg is one atomic on-chain transfer.' },
                { icon: Repeat, title: 'Recurring Payments', body: 'Schedule salaries, subscriptions or allowances. Sender approves once, MoniBot fires each run and logs it to history.' },
                { icon: Layers, title: 'Conditional Sports P2P', body: 'The first conditional trigger. Reward followers for correct predictions by tagging the bot. Payouts settle from a pre-approved allowance the moment the result is final.', href: 'https://blog.monipay.xyz/introducing-conditional-sports-p2p-smart-world-cup-2026-rewards' },
                { icon: Shield, title: 'ERC-8004 Reputation', body: 'Every executed intent writes a signed feedback prompt to the ERC-8004 registry so agents earn a verifiable, portable trust score.', href: 'https://8004scan.io/agents/base/51818' },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 0.05}>
                  {f.href ? (
                    <a
                      href={f.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-background p-6 lg:p-8 min-h-[180px] flex flex-col justify-between cursor-pointer hover:bg-foreground hover:text-background transition-colors duration-300"
                    >
                      <f.icon className="w-5 h-5 text-foreground/20 mb-6" />
                      <div>
                        <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
                        <p className="text-[11px] text-foreground/40 leading-relaxed">{f.body}</p>
                      </div>
                    </a>
                  ) : (
                    <div className="bg-background p-6 lg:p-8 min-h-[180px] flex flex-col justify-between">
                      <f.icon className="w-5 h-5 text-foreground/20 mb-6" />
                      <div>
                        <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
                        <p className="text-[11px] text-foreground/40 leading-relaxed">{f.body}</p>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
            <Reveal>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-foreground/40">
                <a href="/monibot" className="hover:text-foreground transition-colors">MoniBot overview →</a>
                <a href="https://docs.monipay.xyz/docs/monibot" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs: MoniBot →</a>
                <a href="https://docs.monipay.xyz/docs/monibot/discord" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">MoniBot for Discord →</a>
                <a href="https://docs.monipay.xyz/docs/monibot/telegram" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">MoniBot for Telegram →</a>
                <a href="https://docs.monipay.xyz/docs/monibot/twitter" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">MoniBot for X →</a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Merchants: SoftPOS + Storefronts + Gateway */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-b border-foreground/5">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">For Merchants</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">In-Person, Online, Everywhere</h2>
                <p className="text-sm text-foreground/40 mt-3 max-w-2xl leading-relaxed">A full commerce stack sitting on top of the same MoniTag rails. No terminals to buy, no processor to integrate with, no chargebacks.</p>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
              <Reveal>
                <div className="bg-background p-8 min-h-[240px] flex flex-col justify-between">
                  <QrCode className="w-5 h-5 text-foreground/30 mb-6" />
                  <div>
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30 block mb-1">SoftPOS</span>
                    <h3 className="text-base font-bold text-foreground mb-2">Any Phone Is A Terminal</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">Type an amount, show a QR or share a monipay:// deep link. Customer taps, signs on their device, funds land in your wallet on-chain in under two seconds. Zero hardware, zero card rails, zero chargebacks.</p>
                  </div>
                </div>
              </Reveal>
              <Reveal>
                <div className="bg-background p-8 min-h-[240px] flex flex-col justify-between">
                  <Store className="w-5 h-5 text-foreground/30 mb-6" />
                  <div>
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30 block mb-1">Storefronts</span>
                    <h3 className="text-base font-bold text-foreground mb-2">monipay.xyz/store/@yourtag</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">Hosted storefront with products, carts, optional shipping, order tracking and customer records. One-click setup from the merchant dashboard, no code and no separate hosting.</p>
                  </div>
                </div>
              </Reveal>
              <Reveal>
                <div className="bg-background p-8 min-h-[240px] flex flex-col justify-between">
                  <Link2 className="w-5 h-5 text-foreground/30 mb-6" />
                  <div>
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30 block mb-1">Payment Gateway</span>
                    <h3 className="text-base font-bold text-foreground mb-2">Stripe-Style Checkout</h3>
                    <p className="text-[11px] text-foreground/40 leading-relaxed">Public and secret API keys, hosted /pay checkout, HMAC-signed webhooks, order callbacks and a Chrome extension that exposes window.monipay.requestPayment(). Drop it into any site.</p>
                  </div>
                </div>
              </Reveal>
            </div>
            <Reveal>
              <div className="mt-10 grid md:grid-cols-2 gap-6">
                <div className="border border-foreground/10 p-6">
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30 block mb-2">Merchant Dashboard</span>
                  <p className="text-[11px] text-foreground/50 leading-relaxed">Invoices, customers, orders, refunds, revenue analytics, CSV exports, multi-cashier roles and an accounting-grade ledger where every line item points back to an on-chain receipt.</p>
                </div>
                <div className="border border-foreground/10 p-6">
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30 block mb-2">Payment Links</span>
                  <p className="text-[11px] text-foreground/50 leading-relaxed">Shareable pl_[code] links that open a hosted checkout, deep-link into Monipay Legacy or the MiniPay mini-app, and fall back gracefully to any WalletConnect wallet.</p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-foreground/40">
                <a href="/use-cases" className="hover:text-foreground transition-colors">Merchant use cases →</a>
                <a href="https://docs.monipay.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Gateway docs →</a>
                <a href="https://blog.monipay.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Merchant stories →</a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Pillars */}
        <section className="px-6 lg:px-16 py-20 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Architecture</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Core Pillars</h2>
              </div>
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
              {PILLARS.map((pillar, i) => (
                <Reveal key={pillar.title} delay={i * 0.05}>
                  {pillar.href ? (
                    <a
                      href={pillar.href}
                      target={pillar.href.startsWith('http') ? '_blank' : undefined}
                      rel={pillar.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="block bg-background p-6 lg:p-8 min-h-[180px] flex flex-col justify-between group hover:bg-foreground hover:text-background transition-colors duration-300 cursor-pointer"
                    >
                      <pillar.icon className="w-5 h-5 text-foreground/20 group-hover:text-background/50 transition-colors mb-6" />
                      <div>
                        <h3 className="text-sm font-bold text-foreground group-hover:text-background mb-1 transition-colors">{pillar.title}</h3>
                        <p className="text-[11px] text-foreground/40 group-hover:text-background/50 leading-relaxed transition-colors">{pillar.description}</p>
                      </div>
                    </a>
                  ) : (
                    <div className="bg-background p-6 lg:p-8 min-h-[180px] flex flex-col justify-between group hover:bg-foreground hover:text-background transition-colors duration-300">
                      <pillar.icon className="w-5 h-5 text-foreground/20 group-hover:text-background/50 transition-colors mb-6" />
                      <div>
                        <h3 className="text-sm font-bold text-foreground group-hover:text-background mb-1 transition-colors">{pillar.title}</h3>
                        <p className="text-[11px] text-foreground/40 group-hover:text-background/50 leading-relaxed transition-colors">{pillar.description}</p>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
            <Reveal>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                {BOTTOM_CTAS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold tracking-wide border border-foreground/20 text-foreground hover:bg-foreground hover:text-background transition-colors"
                  >
                    {link.label}
                    <ArrowRight className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-16 py-20 lg:py-28 border-t border-foreground/5 relative">
          <GridBg />
          <div className="max-w-3xl mx-auto relative z-10 text-center">
            <Reveal>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">Claim Your MoniTag</h2>
              <p className="text-sm text-foreground/40 mb-10 max-w-md mx-auto leading-relaxed">One handle. Every chain we support. Gasless sends, social escrow, an agent that pays for you, and a payment engine that waits for the right moment.</p>
              <Button onClick={() => navigate('/')} className="h-12 px-10 text-sm font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90">
                Create Your MoniTag <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer variant="full" />
    </div>
  );
}
