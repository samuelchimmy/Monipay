import { motion, useInView } from 'framer-motion';
import { PageMeta } from '@/components/PageMeta';
import { getWebPageSchema } from '@/lib/schema';
import { ArrowLeft, Sun, Moon, Zap, Shield, Bot, Globe, AtSign, Smartphone, QrCode, CreditCard, Users, Gift, Clock, Store, Wallet, TrendingUp, Megaphone, ShieldCheck, Rocket, ArrowRight, CheckCircle2, Star } from 'lucide-react';
import { CaseStudyCards } from '@/components/usecase/CaseStudyCards';
import { ComparisonTable } from '@/components/usecase/ComparisonTable';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Footer } from '@/components/Footer';
import { XExhibitBadge } from '@/components/XExhibitBadge';
import { useTheme } from 'next-themes';
import { useCallback, useRef } from 'react';

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

const USE_CASES = [
  { category: 'Merchant & POS', cases: [
    { icon: Smartphone, title: 'Street Vendors & Small Shops', problem: "Can't afford card terminals, lose customers who don't carry cash.", solution: 'Turn any phone into a POS terminal. Customer scans QR, payment settles in under 2 seconds.', why: 'No $300 terminal, no monthly fees, no chargebacks.' },
    { icon: Store, title: 'E-Commerce Checkout', problem: 'Crypto checkout is confusing: gas fees, wallet popups, network switching.', solution: "Embed MoniPay's hosted checkout or API. Customers pay with MoniTag or scan QR — gasless, instant, 1% fee.", why: 'Stripe-like simplicity for crypto payments.' },
    { icon: CreditCard, title: 'Freelancer Invoicing', problem: 'International payments take 3-5 days, wire fees eat into earnings.', solution: 'Send an invoice with a MoniTag. Client pays in USDC/USDT — settled instantly.', why: 'No SWIFT fees, no currency conversion, no waiting.' },
  ]},
  { category: 'Social & Community', cases: [
    { icon: Gift, title: 'Multi-Platform Giveaways', problem: 'Running crypto giveaways is manual, error-prone, requires collecting wallet addresses.', solution: 'Tweet "@monibot airdrop $2 to 50 people", or use /giveaway on Discord and Telegram. MoniBot autonomously verifies and distributes.', why: 'Fully autonomous across Twitter, Discord & Telegram.' },
    { icon: Users, title: 'P2P Social Payments', problem: 'Sending crypto requires copying long addresses, choosing networks, paying gas.', solution: 'Tweet "@monibot send $10 to @alice", use "/send $10 @alice" on Discord, or "/send 10 @alice" on Telegram. Cross-chain routing auto-reroutes if funds are low.', why: 'As easy as Venmo but on-chain — on any platform.' },
    { icon: Megaphone, title: 'Creator Campaigns', problem: 'Rewarding community engagement with crypto is expensive and slow.', solution: 'Create a campaign from admin dashboard. MoniBot posts and autonomously grants funds across Twitter, Discord, and Telegram communities.', why: 'Budget-controlled, cross-chain, with analytics.' },
  ]},
  { category: 'Crypto UX & Adoption', cases: [
    { icon: ShieldCheck, title: 'Onboarding Non-Crypto Users', problem: "Don't understand private keys, gas fees, seed phrases.", solution: 'User picks a MoniTag and a PIN. Key is generated, encrypted with AES-GCM, stored locally.', why: "The last mile of crypto adoption." },
    { icon: Zap, title: 'Gasless Transactions', problem: 'Users need to buy ETH/BNB just to move stablecoins.', solution: "MoniPay's Paymaster relayer sponsors all gas fees. Users sign, backend submits.", why: 'Zero friction. 1% platform fee covers everything.' },
    { icon: AtSign, title: 'Human-Readable Identity', problem: '0x742d35Cc... — nobody can remember that.', solution: 'MoniTag replaces addresses with @names. Share your tag on receipts, tweets, or business cards.', why: 'Like an email address for money.' },
  ]},
  { category: 'Business & Scale', cases: [
    { icon: Globe, title: 'Cross-Border Payments', problem: 'International transfers involve banks, conversion rates, multi-day settlement.', solution: 'Pay anyone with a MoniTag — Base (USDC), BSC (USDT), or Tempo (aUSD). Instant settlement.', why: 'One platform, three chains, global reach.' },
    { icon: TrendingUp, title: 'Merchant Analytics & CRM', problem: 'Crypto payments are hard to track — no customer data.', solution: 'Full merchant dashboard with customer management, transaction history, product catalog.', why: 'Real business tools for crypto merchants.' },
    { icon: Rocket, title: 'Payment Gateway API', problem: 'Integrating crypto payments requires deep blockchain knowledge.', solution: 'Generate API keys, create orders via REST, receive webhook callbacks — identical to Stripe.', why: 'Any developer can integrate MoniPay in an hour.' },
  ]},
];

const WHY_BETTER = [
  { icon: Zap, title: 'Zero Gas', desc: 'Users never touch ETH or BNB.' },
  { icon: Shield, title: 'Non-Custodial', desc: 'Keys never leave the device.' },
  { icon: Bot, title: 'AI-Powered', desc: 'MoniBot on X, Discord & TG.' },
  { icon: Globe, title: 'Multi-Chain', desc: 'Base + BSC + Tempo.' },
  { icon: Smartphone, title: 'No Hardware', desc: 'Any phone is a terminal.' },
  { icon: Star, title: '1% Flat Fee', desc: 'Transparent pricing.' },
];

export default function UseCases() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const scrollTo = useCallback((id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-foreground selection:text-background">
      <PageMeta
        title="Use Cases"
        description="How street vendors, freelancers, creators, e-commerce merchants and payroll teams use MoniPay for gasless crypto payments."
        path="/use-cases"
        jsonLd={getWebPageSchema({ name: 'MoniPay Use Cases', path: '/use-cases' })}
        breadcrumbs={[
          { name: 'Home', url: 'https://monipay.xyz/' },
          { name: 'Use cases', url: 'https://monipay.xyz/use-cases' },
        ]}
      />
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-none w-9 h-9 text-foreground/40"><ArrowLeft className="w-5 h-5" /></Button>
          <MoniPayLogo size={32} animationMode="idle" showText textSize={15} entranceOnMount />
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-6 mr-4">
            {[{ label: 'About', href: '/about' }, { label: 'How it Works', href: '/how-it-works' }, { label: 'Docs', href: '/docs' }].map((link) => (
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
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-6">Applications</motion.span>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6">
              Real-World<br /><span className="text-foreground/25">Crypto Adoption</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-sm text-foreground/50 max-w-xl mx-auto leading-relaxed">
              MoniPay solves the last mile of crypto UX. From street vendors to global brands, from Twitter giveaways to enterprise APIs.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-6 flex justify-center">
              <XExhibitBadge variant="pill" />
            </motion.div>
          </div>
        </section>

        {/* Use Case Categories */}
        {USE_CASES.map((category, catIdx) => (
          <section key={category.category} id={catIdx === 0 ? 'use-cases' : undefined} className="px-6 lg:px-16 pb-16 border-t border-foreground/5 pt-16">
            <div className="max-w-6xl mx-auto">
              <Reveal>
                <div className="mb-10">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">{String(catIdx + 1).padStart(2, '0')}</span>
                  <h2 className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">{category.category}</h2>
                </div>
              </Reveal>
              <div className="grid lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
                {category.cases.map((uc, i) => (
                  <Reveal key={uc.title} delay={i * 0.05}>
                    <div className="bg-background p-6 lg:p-8 min-h-[280px] flex flex-col justify-between group hover:bg-foreground hover:text-background transition-colors duration-300">
                      <uc.icon className="w-5 h-5 text-foreground/20 group-hover:text-background/40 transition-colors mb-4" />
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-foreground group-hover:text-background mb-3 transition-colors">{uc.title}</h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-foreground/30 group-hover:text-background/30 mb-1 transition-colors">Problem</p>
                            <p className="text-[11px] text-foreground/40 group-hover:text-background/50 leading-relaxed transition-colors">{uc.problem}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-foreground/30 group-hover:text-background/30 mb-1 transition-colors">Solution</p>
                            <p className="text-[11px] text-foreground/40 group-hover:text-background/50 leading-relaxed transition-colors">{uc.solution}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-foreground/5 group-hover:border-background/10 transition-colors">
                        <CheckCircle2 className="w-3 h-3 text-foreground/20 group-hover:text-background/30 mt-0.5 flex-shrink-0 transition-colors" />
                        <p className="text-[10px] text-foreground/40 group-hover:text-background/50 leading-relaxed font-bold transition-colors">{uc.why}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* Case Studies */}
        <div id="case-studies" className="scroll-mt-28"><CaseStudyCards /></div>

        {/* Comparison */}
        <div id="comparison" className="scroll-mt-28"><ComparisonTable /></div>

        {/* Why MoniPay */}
        <section id="why-monipay" className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5 bg-foreground text-background scroll-mt-28">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="mb-14 text-center">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-2">Advantages</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-background tracking-tight">Why MoniPay?</h2>
              </div>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-background/10">
              {WHY_BETTER.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.05}>
                  <div className="bg-foreground p-6 text-center">
                    <item.icon className="w-5 h-5 text-background/30 mx-auto mb-3" />
                    <h3 className="text-xs font-bold text-background mb-1">{item.title}</h3>
                    <p className="text-[10px] text-background/40">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-16 py-20 lg:py-28 relative">
          <GridBg />
          <div className="max-w-3xl mx-auto relative z-10 text-center">
            <Reveal>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">Ready to Start?</h2>
              <p className="text-sm text-foreground/40 mb-10 max-w-md mx-auto">Create your MoniTag, accept your first payment, or run an airdrop campaign.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/')} className="h-12 px-10 text-sm font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90">
                  Get Started <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => navigate('/how-it-works')} className="h-12 px-10 text-sm font-bold tracking-wide rounded-none border-foreground/15 hover:bg-foreground hover:text-background">
                  How it Works
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer variant="full" />
    </div>
  );
}
