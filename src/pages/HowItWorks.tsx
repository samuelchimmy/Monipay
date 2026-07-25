import { useNavigate } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { getFAQPageSchema, getHowToSchema } from '@/lib/schema';
import { ArrowLeft, Wallet, QrCode, Zap, Shield, Bot, AtSign, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { XExhibitBadge } from '@/components/XExhibitBadge';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { motion, useInView } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useRef } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

const steps = [
  { icon: AtSign, num: '01', title: 'Create Your MoniTag', description: 'Sign up with a unique @tag. A secure wallet is generated locally — your private key is encrypted with your PIN and never leaves your device.', detail: 'No seed phrases, no complexity. Just a 4-digit PIN.' },
  { icon: Wallet, num: '02', title: 'Fund Your Wallet', description: 'Send USDC (Base), USDT (BSC), or aUSD (Tempo) from any exchange. Scan the QR or copy your address.', detail: 'Multi-chain support across three networks.' },
  { icon: QrCode, num: '03', title: 'Scan or Share QR', description: 'Merchants display a branded QR with amount. Customers scan to pay instantly. Or share your @tag for P2P transfers.', detail: 'Smart scanner auto-detects MoniPay QRs, wallet addresses, and payment links.' },
  { icon: Zap, num: '04', title: 'Gasless Settlement', description: 'Your payment is signed locally and relayed through our Paymaster. You never pay gas fees.', detail: 'Meta-transactions with a flat 1% platform fee.' },
  { icon: Bot, num: '05', title: 'MoniBot AI Agent', description: 'Use "@monibot send $5 to @alice" on Twitter, "/send $5 @alice" on Discord, or "/send 5 @alice" on Telegram. The autonomous agent handles resolution, signing, and on-chain execution.', detail: 'Multi-platform support with cross-chain routing, campaigns, and multi-recipient transfers.' },
  { icon: Shield, num: '06', title: 'Full Control', description: 'Non-custodial architecture means your keys stay on your device. Back up to Google Drive encrypted. Print receipts. Export history.', detail: 'Built on Base, BSC & Tempo for fast, reliable, secure transactions.' },
];

const faqs = [
  { category: 'Fees & Costs', questions: [
    { q: 'What are the fees?', a: 'A flat 1% platform fee on payments. No hidden fees, no monthly charges. Gas fees are fully sponsored.' },
    { q: 'Who pays the gas fees?', a: 'MoniPay covers all gas fees through our Paymaster system. You only need stablecoins.' },
    { q: 'Are there withdrawal fees?', a: 'No withdrawal fees from MoniPay. Standard network fees apply for external transfers.' },
  ]},
  { category: 'Security & Privacy', questions: [
    { q: 'Is MoniPay safe?', a: 'Fully non-custodial. Private keys are encrypted with AES-GCM using your PIN and stored only on your device.' },
    { q: 'What if I lose my phone?', a: 'Back up your private key during onboarding (Google Drive encrypted backup available). Import on any new device.' },
    { q: 'Which blockchains are supported?', a: 'Base (USDC), BNB Smart Chain (USDT), and Tempo (aUSD). All with fast confirmations.' },
  ]},
  { category: 'MoniBot & Social Payments', questions: [
    { q: 'How does MoniBot work?', a: 'MoniBot is an autonomous AI agent on Twitter, Discord, and Telegram. Use natural language commands to send payments, run campaigns, and manage your wallet across all three platforms.' },
    { q: 'Do I need the app to use MoniBot?', a: 'You need a MoniPay account with a MoniTag. Link your social accounts (X, Discord, Telegram) in Settings, set a bot allowance, and start sending payments from any platform.' },
    { q: 'What are campaigns?', a: 'MoniBot can run autonomous airdrop campaigns — posting tweets and distributing grants to participants who reply.' },
    { q: 'What is cross-chain routing?', a: 'If you have insufficient funds on one chain, MoniBot automatically checks your balance on other chains (Base, BSC, Tempo) and reroutes the payment to one with sufficient funds.' },
  ]},
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-foreground selection:text-background">
      <PageMeta
        title="How It Works"
        description="See how MoniPay enables gasless crypto payments — create a MoniTag, fund your wallet, and pay anyone instantly across Base, BSC, Solana, Tempo, Ink and Celo."
        path="/how-it-works"
        jsonLd={[
          getHowToSchema(
            'How to use MoniPay',
            steps.map((s) => ({ name: s.title, text: s.description }))
          ),
          getFAQPageSchema(
            faqs.flatMap((c) => c.questions.map((q) => ({ q: q.q, a: q.a })))
          ),
        ]}
        breadcrumbs={[
          { name: 'Home', url: 'https://monipay.xyz/' },
          { name: 'How it works', url: 'https://monipay.xyz/how-it-works' },
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
            {[{ label: 'About', href: '/about' }, { label: 'Use Cases', href: '/use-cases' }, { label: 'Docs', href: '/docs' }].map((link) => (
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
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-6">Step by Step</motion.span>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6">
              How It <span className="text-foreground/25">Works</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-sm text-foreground/50 max-w-xl mx-auto leading-relaxed">
              From creating your MoniTag to gasless payments and autonomous AI commerce — here's the complete journey.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-6 flex justify-center">
              <XExhibitBadge variant="pill" />
            </motion.div>
          </div>
        </section>

        {/* Steps */}
        <section className="px-6 lg:px-16 py-12 lg:py-20 border-t border-foreground/5">
          <div className="max-w-6xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
              {steps.map((step, i) => (
                <Reveal key={step.num} delay={i * 0.05}>
                  <div className="bg-background p-6 lg:p-8 min-h-[220px] flex flex-col justify-between group hover:bg-foreground hover:text-background transition-colors duration-300">
                    <div className="flex items-start justify-between mb-6">
                      <span className="text-4xl font-extrabold text-foreground/[0.06] group-hover:text-background/[0.08] leading-none transition-colors">{step.num}</span>
                      <step.icon className="w-5 h-5 text-foreground/20 group-hover:text-background/40 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-background mb-1.5 transition-colors">{step.title}</h3>
                      <p className="text-[11px] text-foreground/40 group-hover:text-background/50 leading-relaxed transition-colors">{step.description}</p>
                      <p className="text-[10px] text-foreground/25 group-hover:text-background/30 leading-relaxed mt-2 transition-colors">{step.detail}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5 bg-foreground text-background">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="mb-14">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-2">Support</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-background tracking-tight">FAQ</h2>
              </div>
            </Reveal>

            <div className="space-y-8">
              {faqs.map((category, ci) => (
                <Reveal key={category.category} delay={ci * 0.08}>
                  <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 mb-3">{category.category}</h3>
                  <Accordion type="single" collapsible className="space-y-1">
                    {category.questions.map((faq, i) => (
                      <AccordionItem key={i} value={`${category.category}-${i}`} className="border border-background/10 px-5 data-[state=open]:border-background/20">
                        <AccordionTrigger className="text-left text-background hover:no-underline py-4 text-sm font-bold">{faq.q}</AccordionTrigger>
                        <AccordionContent className="text-background/50 pb-4 text-sm leading-relaxed">{faq.a}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
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
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">Start Accepting Payments</h2>
              <p className="text-sm text-foreground/40 mb-10 max-w-md mx-auto">Create your MoniTag in 60 seconds. No hardware, no gas fees, no complexity.</p>
              <Button onClick={() => navigate('/')} className="h-12 px-10 text-sm font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90">
                SIGN UP <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer variant="full" />
    </div>
  );
}
