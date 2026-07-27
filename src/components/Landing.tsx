import { XExhibitBadge } from '@/components/XExhibitBadge';
import { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useInView, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Zap, Shield, Bot, Globe, AtSign, Smartphone,
  Store, Users, CreditCard, QrCode, Check, X, ExternalLink,
  Heart, MessageCircle, ScanLine, ShieldCheck, Wallet,
  Nfc, Layers, FileText, Code, Puzzle, BarChart3, Receipt,
  Package, Tag, Clock, Send, Terminal, Webhook, Gift,
  DollarSign, Lock, CircleCheck, Crown, Sparkles, ArrowUpRight
} from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { ChainCrossLinks } from './ChainCrossLinks';
import { ReceiptCard } from './ReceiptCard';
import { LogoCarousel } from './showcase/LogoCarousel';
import { CrossChainShowcase } from './showcase/CrossChainShowcase';
import { LanguageSelector } from './LanguageSelector';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

const heroImage = '/monipay-phone.png';
import storeHeadphones from '@/assets/store-headphones.jpg';
import storeWatch from '@/assets/store-watch.jpg';
import storeSneaker from '@/assets/store-sneaker.jpg';
import storeSunglasses from '@/assets/store-sunglasses.jpg';
import storePerfume from '@/assets/store-perfume.jpg';
import storeShoe from '@/assets/store-shoe.jpg';
import storeCamera from '@/assets/store-camera.jpg';
import storeBag from '@/assets/store-bag.jpg';

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

/* ─── Reveal animation wrapper ─── */
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

/* ─── Grid background ─── */
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
    </div>
  );
}

/* ─── Chain badge ─── */
function ChainBadge({ chain, className = '' }: { chain: 'celo'; className?: string }) {
  const config = {
    celo: { label: 'Celo · USDT', bg: 'bg-[#FCFF52]', fg: 'text-gray-950', href: '/minipay' },
  }[chain];
  return (
    <a href={config.href} className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wide ${config.bg} ${config.fg} hover:opacity-80 transition-opacity ${className}`}>
      {config.label}
    </a>
  );
}

/* ─── MoniBot Tweet Cards ─── */
const TWEETS = [
  {
    id: 1, author: '@monibot', avatar: 'M',
    text: 'Campaign alert! First 5 to drop their monitag get $1 each 🔵',
    time: '2m', replies: 12, likes: 5, hasReply: false, reply: null,
  },
  {
    id: 2, author: '@jade_dev', avatar: 'J',
    text: '@monibot send $1 to @alice on tempo',
    time: '5m', replies: 1, likes: 2, hasReply: true,
    reply: { author: '@monibot', avatar: 'M', text: "Sent! αUSD landed safely in alice's wallet. Zero gas." },
  },
  {
    id: 3, author: '@crypto_mark', avatar: 'C',
    text: '@monibot send $5 to @bob, @carol each',
    time: '8m', replies: 1, likes: 3, hasReply: true,
    reply: { author: '@monibot', avatar: 'M', text: "Batch transfer confirmed ✅ 2 recipients on Base." },
  },
];

/* ─── Scan modes ─── */
const SCAN_MODES = [
  { label: 'MoniPay QR', desc: 'Auto-fill PayTag and amount, one-tap payment.', badge: 'Fastest' },
  { label: 'External Wallet', desc: 'Send stablecoins directly to any wallet address.', badge: 'Universal' },
  { label: 'Payment Link', desc: 'Complete merchant checkout instantly via QR.', badge: 'Commerce' },
];

/* ─── Animated Stat Counter ─── */
function AnimatedStat({ end, prefix = '', suffix = '' }: { end: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    if (end === 0) { setDisplay(0); return; }
    const duration = 1200;
    const steps = 30;
    const stepTime = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current++;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * end));
      if (current >= steps) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [isInView, end]);

  return (
    <span ref={ref} className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
      {prefix}{display}{suffix}
    </span>
  );
}

export function Landing({ onGetStarted, onSignIn }: LandingProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [logoHovered, setLogoHovered] = useState(false);
  const [dotPulse, setDotPulse] = useState(false);

  // Scroll-reactive logo color: blue → black past hero section
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [logoColor, setLogoColor] = useState('#0052FF');
  useEffect(() => {
    const unsub = scrollY.on('change', (y) => {
      // hero section is roughly 500px tall; transition over the next 200px
      const heroHeight = heroRef.current?.offsetHeight ?? 500;
      const progress = Math.min(Math.max((y - heroHeight * 0.6) / (heroHeight * 0.4), 0), 1);
      // Interpolate #0052FF → #000000
      const r = Math.round(0 + (0 - 0) * progress);
      const g = Math.round(82 + (0 - 82) * progress);
      const b = Math.round(255 + (0 - 255) * progress);
      setLogoColor(`rgb(${r},${g},${b})`);
    });
    return () => unsub();
  }, [scrollY]);

  // Hover: trigger a brief dot pulse
  const handleLogoMouseEnter = () => {
    setLogoHovered(true);
    setDotPulse(true);
    setTimeout(() => setDotPulse(false), 600);
  };
  const handleLogoMouseLeave = () => setLogoHovered(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col safe-top relative selection:bg-foreground selection:text-background">

      {/* ─── Header ─── */}
      <header className="w-full px-6 lg:px-16 py-4 flex items-center justify-between z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-md sticky top-0">
        <div
          className="flex items-center gap-2"
          onMouseEnter={handleLogoMouseEnter}
          onMouseLeave={handleLogoMouseLeave}
          style={{ cursor: 'pointer' }}
        >
          <MoniPayLogo
            size={36}
            color={logoColor}
            animationMode={dotPulse ? 'header' : 'idle'}
            showText
            textSize={17}
            entranceOnMount
          />
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold tracking-wide uppercase leading-none">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-6 mr-6">
            {[
              { label: t('landing_nav_about'), href: '/about' },
              { label: t('landing_nav_how'), href: '/how-it-works' },
              { label: t('landing_nav_usecases'), href: '/use-cases' },
              { label: 'Docs', href: 'https://docs.monipay.xyz', external: true },
              { label: 'Blog', href: 'https://blog.monipay.xyz', external: true },
            ].map((link) => (
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium tracking-wide text-foreground/40 hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-xs font-medium tracking-wide text-foreground/40 hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              )
            ))}
          </nav>
          <LanguageSelector variant="compact" />
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-none w-9 h-9 text-foreground/40">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={onSignIn} className="text-xs font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90 px-6 h-9">
            {t('landing_sign_in')}
          </Button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section ref={heroRef} className="relative px-6 lg:px-16 py-16 lg:py-24">
        <GridBg />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — text */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mb-6 flex items-center gap-2 flex-wrap"
              >
                {[
                  { label: 'Base', color: '#0052FF' },
                  { label: 'BSC', color: '#F0B90B' },
                  { label: 'Solana', color: '#9945FF' },
                  { label: 'Ink', color: '#7B5EA7' },
                  { label: 'Celo', color: '#FCFF52' },
                  { label: 'Tempo', color: undefined },
                ].map((chain, i) => (
                  <span key={chain.label} className="inline-flex items-center gap-2">
                    {i > 0 && <span className="w-px h-3 bg-foreground/10" />}
                    <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/40">
                      <span className={`w-1.5 h-1.5 rounded-full ${chain.label === 'Tempo' ? 'bg-foreground animate-pulse' : ''}`} style={chain.color ? { backgroundColor: chain.color } : undefined} />
                      {chain.label}
                    </span>
                  </span>
                ))}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-[1.05] tracking-tight mb-6"
              >
                 {t('landing_hero_title_1')}
                <br />
                {t('landing_hero_title_2')}
                <br />
                <span className="text-foreground/25">{t('landing_hero_title_3')}</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-sm text-foreground/50 mb-8 max-w-sm leading-relaxed"
              >
                {t('landing_hero_desc')}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="flex items-center gap-4"
              >
                <Button
                  onClick={onGetStarted}
                  className="h-12 px-8 text-sm font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90"
                >
                  {t('get_started')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <a
                  href="/about"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/40 hover:text-foreground transition-colors"
                >
                  {t('learn_more')}
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

              {/* Chain badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex gap-2 mt-8 flex-wrap"
              >
                <ChainBadge chain="celo" />
              </motion.div>
            </div>

            {/* Right — Phone mockup with floating cards + parallax */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              style={{ y: useTransform(scrollY, [0, 600], [0, -40]) }}
              className="relative flex items-center justify-center"
            >
              {/* Floating Receipt Card - LEFT (parallax offset) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                style={{ y: useTransform(scrollY, [0, 600], [0, 20]) }}
                className="absolute -left-[8%] top-[30%] -translate-y-1/2 z-20 hidden lg:block"
              >
                <ReceiptCard />
              </motion.div>

              {/* Phone */}
              <div className="relative w-full max-w-xs lg:max-w-sm mx-auto">
                {/* Background circle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[90%] aspect-square bg-foreground/5 translate-y-[15%]" style={{ clipPath: 'circle(50%)' }} />
                </div>

                <motion.img
                  initial={{ y: 30, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  src={heroImage}
                  alt="MoniPay mobile payment terminal"
                  className="relative z-10 w-full h-auto max-h-[70vh] object-contain pointer-events-none select-none"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>

              {/* Floating Spending Trend Card - RIGHT */}
              <motion.div
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                style={{ y: useTransform(scrollY, [0, 600], [0, 30]) }}
                className="absolute -right-[6%] top-[15%] z-20 bg-background border border-foreground/10 p-3 hidden lg:block"
              >
                <div className="flex items-center justify-between mb-2 gap-8">
                  <p className="text-[10px] font-bold tracking-wide text-foreground/40 uppercase">{t('landing_spending_trend')}</p>
                </div>
                <div className="flex gap-4 text-[9px] mb-2">
                   <div className="flex items-center gap-1">
                     <div className="w-2 h-2 bg-[#0052FF]" />
                     <span className="text-foreground/40">{t('landing_money_in')}</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <div className="w-2 h-2 bg-[#F0B90B]" />
                     <span className="text-foreground/40">{t('landing_money_out')}</span>
                   </div>
                </div>
                <div className="flex gap-4">
                  <p className="text-sm font-extrabold text-foreground tracking-tight">$550.00</p>
                  <p className="text-sm font-extrabold text-foreground tracking-tight">$950.00</p>
                </div>
                <div className="flex gap-0.5 mt-2">
                  {[40, 60, 45, 80, 65, 90, 70].map((h, i) => (
                    <div
                      key={i}
                      className="w-3"
                      style={{
                        height: `${h * 0.3}px`,
                        backgroundColor: i === 5 ? '#0052FF' : i === 3 ? '#F0B90B' : 'hsl(var(--foreground) / 0.1)',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="border-y border-foreground/5">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/5">
          {[
            { value: '$0', numericEnd: 0, prefix: '$', suffix: '', label: t('landing_stats_gas'), sub: t('sponsored') },
            { value: '6', numericEnd: 6, prefix: '', suffix: '', label: t('landing_stats_chains'), sub: 'Base · BSC · Solana · Ink · Celo · Tempo' },
            { value: '<2s', numericEnd: 2, prefix: '<', suffix: 's', label: t('landing_stats_settlement'), sub: t('landing_stats_instant') },
            { value: '1%', numericEnd: 1, prefix: '', suffix: '%', label: t('landing_stats_fee'), sub: t('landing_stats_transparent') },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-background p-6 lg:p-8 flex flex-col justify-between min-h-[120px]"
            >
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/30">{stat.label}</span>
              <div>
                <AnimatedStat end={stat.numericEnd} prefix={stat.prefix} suffix={stat.suffix} />
                <p className="text-[10px] text-foreground/30 mt-1">{stat.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Logo Carousel ─── */}
      <Reveal>
        <LogoCarousel />
      </Reveal>

      {/* ─── Multi-Chain Feature Grid ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">{t('landing_multichain_label')}</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  Six Chains. One MoniTag™
                </h2>
              </div>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
            {/* Base */}
            <Reveal delay={0}>
              <a href="/base" className="block bg-[#0052FF] p-6 lg:p-8 min-h-[220px] flex flex-col justify-between text-white hover:brightness-110 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <img src="/chains/base-logo.svg" alt="Base" className="w-5 h-5 rounded-[3px]" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">Base</span>
                  </div>
                  <span className="text-2xl font-extrabold tracking-tight">USDC</span>
                </div>
                <div>
                 <h3 className="text-sm font-bold mb-1">{t('landing_base_title')}</h3>
                  <p className="text-[11px] text-white/50 leading-relaxed">{t('landing_base_desc')}</p>
                </div>
              </a>
            </Reveal>

            {/* BSC */}
            <Reveal delay={0.06}>
              <a href="/bsc" className="block bg-[#F0B90B] p-6 lg:p-8 min-h-[220px] flex flex-col justify-between text-gray-950 hover:brightness-110 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <img src="/chains/bsc-logo.svg" alt="BSC" className="w-5 h-5" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-950/50">BSC</span>
                  </div>
                  <span className="text-2xl font-extrabold tracking-tight">USDT</span>
                </div>
                <div>
                 <h3 className="text-sm font-bold mb-1">{t('landing_bsc_title')}</h3>
                  <p className="text-[11px] text-gray-950/50 leading-relaxed">{t('landing_bsc_desc')}</p>
                </div>
              </a>
            </Reveal>

            {/* Solana */}
            <Reveal delay={0.12}>
              <a href="/solana" className="block bg-gradient-to-br from-[#9945FF] to-[#14F195] p-6 lg:p-8 min-h-[220px] flex flex-col justify-between text-white hover:brightness-110 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <img src="/chains/solana-logo.svg" alt="Solana" className="w-5 h-5" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">Solana</span>
                  </div>
                  <span className="text-2xl font-extrabold tracking-tight">USDC</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-1">Speed of Light</h3>
                  <p className="text-[11px] text-white/50 leading-relaxed">Sub-second finality with native USDC on the fastest L1.</p>
                </div>
              </a>
            </Reveal>

            {/* Ink */}
            <Reveal delay={0.18}>
              <a href="/ink" className="block bg-[#7B5EA7] p-6 lg:p-8 min-h-[220px] flex flex-col justify-between text-white hover:brightness-110 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <img src="/chains/ink-logo.webp" alt="Ink" className="w-5 h-5" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">Ink</span>
                  </div>
                  <span className="text-2xl font-extrabold tracking-tight">USDC</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-1">DeFi Native</h3>
                  <p className="text-[11px] text-white/50 leading-relaxed">Kraken's L2 built for DeFi. Sub-cent gas, instant finality.</p>
                </div>
              </a>
            </Reveal>

            {/* Celo */}
            <Reveal delay={0.24}>
              <a href="/minipay" className="block bg-[#FCFF52] p-6 lg:p-8 min-h-[220px] flex flex-col justify-between text-gray-950 hover:brightness-110 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <img src="/chains/celo-logo.png" alt="Celo" className="w-5 h-5" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-950/50">Celo</span>
                  </div>
                  <span className="text-2xl font-extrabold tracking-tight">USDT</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-1">Mobile First</h3>
                  <p className="text-[11px] text-gray-950/50 leading-relaxed">Phone-number payments and MiniPay integration for 2B+ unbanked users.</p>
                </div>
              </a>
            </Reveal>

            {/* Tempo */}
            <Reveal delay={0.30}>
              <a href="/tempo" className="block bg-foreground p-6 lg:p-8 min-h-[220px] flex flex-col justify-between text-background hover:opacity-90 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <img src="/chains/tempo-logo.svg" alt="Tempo" className="w-5 h-5 invert dark:invert-0" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/50">Tempo</span>
                  </div>
                  <span className="text-2xl font-extrabold tracking-tight">αUSD</span>
                </div>
                <div>
                 <h3 className="text-sm font-bold mb-1">{t('landing_tempo_title')}</h3>
                  <p className="text-[11px] text-background/50 leading-relaxed">{t('landing_tempo_desc')}</p>
                </div>
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Cross-Chain Deposit ─── */}
      <CrossChainShowcase />

      {/* ─── Gasless Comparison ─── */}
      <GaslessSection />

      {/* ─── Platform Features ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">{t('landing_platform_label')}</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  {t('landing_platform')}
                </h2>
              </div>
              <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
                {t('landing_platform_sub')}
              </span>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
            {[
              { icon: Store, title: t('landing_feat_pos'), desc: t('landing_feat_pos_desc') },
              { icon: Smartphone, title: t('landing_feat_scan'), desc: t('landing_feat_scan_desc') },
              { icon: Bot, title: t('landing_feat_bot'), desc: t('landing_feat_bot_desc') },
              { icon: Users, title: t('landing_feat_p2p'), desc: t('landing_feat_p2p_desc') },
              { icon: CreditCard, title: t('landing_feat_gateway'), desc: t('landing_feat_gateway_desc') },
              { icon: Globe, title: t('landing_feat_cross'), desc: t('landing_feat_cross_desc') },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="bg-background p-6 lg:p-8 min-h-[160px] flex flex-col justify-between group hover:bg-foreground hover:text-background transition-colors duration-300">
                  <f.icon className="w-5 h-5 text-foreground/20 group-hover:text-background/50 transition-colors mb-6" />
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

      {/* ─── Tap to Pay ─── */}
      <TapToPaySection />

      {/* ─── MoniBot Showcase ─── */}
      <MoniBotSection />

      {/* ─── MagicPay ─── */}
      <MagicPaySection />

      {/* ─── Subscription Manager (Coming Soon) ─── */}
      <SubscriptionManagerSection />

      {/* ─── Scan to Pay ─── */}
      <ScanToPaySection />

      {/* ─── Merchant Suite ─── */}
      <MerchantSection />

      {/* ─── Checkout API ─── */}
      <CheckoutAPISection />

      {/* ─── MoniTag Showcase ─── */}
      <MoniTagSection />

      {/* ─── Storefront ─── */}
      <StorefrontSection />

      {/* ─── Browser Extension ─── */}
      <BrowserExtensionSection />

      {/* ─── How It Works ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5 bg-foreground text-background">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-2">{t('landing_how_label')}</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-background tracking-tight">
                {t('landing_how_title')}
              </h2>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-background/10">
            {[
              { num: '01', title: t('landing_how_step1'), desc: t('landing_how_step1_desc') },
              { num: '02', title: t('landing_how_step2'), desc: t('landing_how_step2_desc') },
              { num: '03', title: t('landing_how_step3'), desc: t('landing_how_step3_desc') },
              { num: '04', title: t('landing_how_step4'), desc: t('landing_how_step4_desc') },
            ].map((s, i) => (
              <Reveal key={s.num} delay={i * 0.08}>
                <div className="bg-foreground p-6 lg:p-8 min-h-[180px] flex flex-col justify-between">
                  <span className="text-5xl font-extrabold text-background/[0.06] leading-none">{s.num}</span>
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

      {/* ─── Use Cases ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-14">
              <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">{t('landing_usecases_label')}</span>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                  {t('landing_use_cases')}
                </h2>
              </div>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
            {[
              { title: t('landing_uc_vendors'), desc: t('landing_uc_vendors_desc'), num: '01' },
              { title: t('landing_uc_freelancers'), desc: t('landing_uc_freelancers_desc'), num: '02' },
              { title: t('landing_uc_social'), desc: t('landing_uc_social_desc'), num: '03' },
              { title: t('landing_uc_stores'), desc: t('landing_uc_stores_desc'), num: '04' },
            ].map((uc, i) => (
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

      {/* ─── CTA ─── */}
      <section className="px-6 lg:px-16 py-20 lg:py-28 border-t border-foreground/5 relative">
        <GridBg />
        <div className="max-w-3xl mx-auto relative z-10">
          <Reveal>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                {t('landing_cta_title')}
              </h2>
              <p className="text-sm text-foreground/40 mb-10 max-w-md mx-auto leading-relaxed">
                {t('landing_cta_desc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={onGetStarted}
                  className="h-12 px-10 text-sm font-bold tracking-wide rounded-none bg-foreground text-background hover:bg-foreground/90"
                >
                  {t('get_started')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="h-12 px-10 text-sm font-bold tracking-wide rounded-none border-foreground/15 hover:bg-foreground hover:text-background"
                >
                  <a href="https://docs.monipay.xyz">
                    {t('api_documentation')}
                  </a>
                </Button>
              </div>
              <div className="flex justify-center gap-2 mt-8">
                <ChainBadge chain="celo" />
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
            <MoniPayLogo size={28} animationMode="idle" showText textSize={13} entranceOnView />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-foreground/30">
            <a href="/about" className="hover:text-foreground transition-colors">About</a>
            <a href="/how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="/use-cases" className="hover:text-foreground transition-colors">Use Cases</a>
            <a href="https://docs.monipay.xyz" className="hover:text-foreground transition-colors">Docs</a>
            <a href="/deck" className="hover:text-foreground transition-colors">Deck</a>
            <a href="/tempo" className="hover:text-foreground transition-colors">Tempo</a>
            <a href="/monibot" className="hover:text-foreground transition-colors">MoniBot</a>
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="https://x.com/monipay_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a>
            <a href="https://farcaster.xyz/monibot" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Farcaster</a>
            <span>© {new Date().getFullYear()} MoniPay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Gasless Comparison Section ─── */
function GaslessSection() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Zero Cost</span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
              {t('landing_gasless_title')}
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="grid md:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 0.6 } : {}}
              transition={{ duration: 0.5 }}
              className="bg-background p-8"
            >
              <h4 className="text-xs font-bold tracking-widest uppercase text-foreground/40 mb-6">{t('landing_traditional')}</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-foreground/50">{t('landing_transaction')}</span>
                  <span className="text-sm font-bold text-foreground">$10.00</span>
                </div>
                <div className="flex justify-between items-center border-l-2 border-foreground/30 pl-3 -ml-3">
                  <span className="text-xs font-bold text-foreground/60">{t('landing_gas_fee')}</span>
                  <span className="text-sm font-bold text-foreground">−$2.34</span>
                </div>
                <div className="h-px bg-foreground/10" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground/40">{t('landing_received')}</span>
                  <span className="text-2xl font-extrabold tracking-tight text-foreground">$7.66</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-foreground/40 font-bold">
                <X className="w-3 h-3" />
                <span>{t('landing_lost_gas')}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="bg-foreground p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xs font-bold tracking-widest uppercase text-background/60">MoniPay</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-background/50">{t('landing_transaction')}</span>
                  <span className="text-sm font-bold text-background">$10.00</span>
                </div>
                <div className="flex justify-between items-center border-l-2 border-background/30 pl-3 -ml-3">
                  <span className="text-xs font-bold text-background/60">{t('landing_gas_fee')}</span>
                  <span className="text-sm font-bold text-background">$0.00</span>
                </div>
                <div className="h-px bg-background/10" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-background/40">{t('landing_received')}</span>
                  <span className="text-2xl font-extrabold tracking-tight text-background">$10.00</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-background/60 font-bold">
                <Check className="w-3 h-3" />
                <span>{t('landing_gasless_delivered')}</span>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── MoniBot Section ─── */
function MoniBotSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [visibleTweets, setVisibleTweets] = useState<number[]>([]);

  useEffect(() => {
    if (!inView) return;
    // Stagger tweets loading in one by one
    TWEETS.forEach((_, i) => {
      setTimeout(() => {
        setVisibleTweets(prev => [...prev, i]);
      }, i * 800);
    });
  }, [inView]);

  return (
    <section ref={ref} className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Social Financial Layer</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                MoniBot Agentic Commerce
              </h2>
            </div>
            <a
              href="https://x.com/monibot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-foreground/30 hover:text-foreground transition-colors"
            >
              @monibot
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/monibot"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-foreground/70 transition-colors ml-4"
            >
              Explore MoniBot
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-5 gap-px bg-foreground/10 border border-foreground/10">
          {/* Feed — 3 cols */}
          <Reveal className="lg:col-span-3">
            <div className="bg-background p-6 lg:p-8">
              <p className="text-sm text-foreground/60 leading-relaxed mb-6 max-w-lg">
                MoniBot is MoniPay's autonomous AI agent, the intelligent social financial layer across 
                Twitter, Discord, and Telegram. P2P commands, campaign grants, multi-recipient transfers, 
                and cross-chain routing. All gasless, 24/7.
              </p>

              {/* Tweet feed — persistent cards */}
              <div className="border border-foreground/10 p-4 space-y-3">
                <div className="flex items-center gap-2 pb-3 border-b border-foreground/5">
                  <div className="w-7 h-7 bg-foreground/5 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-foreground/30" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">MoniBot Feed</p>
                    <p className="text-[9px] text-foreground/30">Live activity</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
                    <span className="text-[9px] text-[#0052FF] font-bold">Online</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {TWEETS.map((tweet, i) => (
                    <motion.div
                      key={tweet.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={visibleTweets.includes(i) ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.4 }}
                      className={`p-3 border border-foreground/5 bg-background ${!visibleTweets.includes(i) ? 'invisible' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="w-9 h-9 bg-foreground/5 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-extrabold text-foreground/50">{tweet.avatar}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-foreground">{tweet.author}</span>
                            <span className="text-[10px] text-foreground/30">· {tweet.time}</span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{tweet.text}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1 text-[10px] text-foreground/30">
                              <MessageCircle className="w-3 h-3" /> {tweet.replies}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-foreground/30">
                              <Heart className="w-3 h-3" /> {tweet.likes}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reply */}
                      {tweet.hasReply && tweet.reply && visibleTweets.includes(i) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ delay: 1.2, duration: 0.4 }}
                          className="mt-3 ml-6 pl-4 border-l-2 border-[#0052FF]/30"
                        >
                          <div className="flex gap-2 items-start">
                            <div className="w-6 h-6 bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[8px] font-extrabold text-[#0052FF]">{tweet.reply.avatar}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-[#0052FF]">{tweet.reply.author}</span>
                              <p className="text-xs text-foreground mt-0.5">{tweet.reply.text}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Capabilities — 2 cols */}
          <Reveal delay={0.1} className="lg:col-span-2">
            <div className="bg-foreground p-6 lg:p-8 h-full flex flex-col text-background">
              <h3 className="text-sm font-bold text-background mb-6 tracking-wide uppercase">Capabilities</h3>
              <div className="space-y-0 flex-1">
                {[
                  { icon: Send, label: 'Multi-Platform P2P', cmd: 'X · Discord · TG', desc: 'Natural language payments everywhere' },
                  { icon: Gift, label: 'Campaign Grants', cmd: 'Auto-distribute', desc: 'Airdrop to followers autonomously' },
                  { icon: Users, label: 'Multi-Recipient', cmd: 'Batch TX', desc: 'Send to many in one atomic transaction' },
                  { icon: Globe, label: 'Cross-Chain Routing', cmd: 'Smart Route', desc: 'Auto-reroutes across Base/BSC/Tempo' },
                  { icon: Clock, label: 'Scheduled Tasks', cmd: 'Cron Jobs', desc: 'Recurring payments and campaigns' },
                  { icon: AtSign, label: 'Social Identity', cmd: '@handle → $tag', desc: 'Link X, Discord & Telegram to MoniTag' },
                ].map((cap) => (
                  <div key={cap.label} className="flex items-center gap-3 py-3 border-b border-background/10 last:border-0 group">
                    <cap.icon className="w-3.5 h-3.5 text-background/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-background">{cap.label}</span>
                        <span className="text-[8px] font-mono font-bold tracking-wider text-background/20 uppercase">{cap.cmd}</span>
                      </div>
                      <p className="text-[10px] text-background/40 mt-0.5">{cap.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Social CTAs */}
              <div className="mt-4 pt-4 border-t border-background/10 space-y-2">
                <p className="text-[10px] font-bold text-background/30 uppercase tracking-wider">Use MoniBot on</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <a
                    href="https://x.com/monibot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 px-2 py-2.5 bg-background/10 hover:bg-background/20 transition-colors text-background group"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span className="text-[9px] font-bold opacity-60 group-hover:opacity-100 transition-opacity">Tweet</span>
                  </a>
                  <a
                    href="https://discord.com/oauth2/authorize?client_id=1473815294022520964&permissions=2147483648&scope=bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 px-2 py-2.5 bg-background/10 hover:bg-background/20 transition-colors text-background group"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                    </svg>
                    <span className="text-[9px] font-bold opacity-60 group-hover:opacity-100 transition-opacity">Discord</span>
                  </a>
                  <a
                    href="https://t.me/Monipay_monibot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 px-2 py-2.5 bg-background/10 hover:bg-background/20 transition-colors text-background group"
                  >
                    <Send className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    <span className="text-[9px] font-bold opacity-60 group-hover:opacity-100 transition-opacity">Telegram</span>
                  </a>
                </div>
              </div>

              {/* Networks */}
              <div className="mt-3 pt-3 border-t border-background/10 flex items-center gap-2">
                <span className="text-[10px] font-bold text-background/30">Networks:</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#0052FF] text-white">Base</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#F0B90B] text-gray-950">BSC</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-background text-foreground">Tempo</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── MagicPay Section ─── */
function MagicPaySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Non-Custodial Escrow</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                MagicPay
              </h2>
            </div>
            <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
              Send stablecoins to anyone on X, Discord, or Telegram. No wallet needed. No MoniPay account. Just a username.
            </span>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-5 gap-px bg-foreground/10 border border-foreground/10">
          {/* Copy + chains — 2 cols */}
          <Reveal className="lg:col-span-2">
            <div className="bg-background p-6 lg:p-8 h-full flex flex-col">
              <Sparkles className="w-5 h-5 text-foreground/30 mb-6" />
              <p className="text-sm text-foreground/70 leading-relaxed mb-6">
                MagicPay holds the funds in a non-custodial escrow contract until the recipient claims them with their MoniTag™. If they never claim, the sender refunds in one click.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'Send by @handle, no address required',
                  'Funds held on-chain in escrow until claim',
                  'Recipient onboards and claims in 30 seconds',
                  'Sender-refundable if unclaimed',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-foreground/60">
                    <Check className="w-3.5 h-3.5 text-foreground/40 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4 border-t border-foreground/10">
                <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-wider mb-2">Available on</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: 'Base', cls: 'bg-[#0052FF] text-white' },
                    { name: 'BSC', cls: 'bg-[#F0B90B] text-gray-950' },
                    { name: 'Celo', cls: 'bg-[#FCFF52] text-gray-950' },
                    { name: 'Ink', cls: 'bg-foreground text-background' },
                    { name: 'Solana', cls: 'bg-[#9945FF] text-white' },
                    { name: 'Tempo', cls: 'bg-background border border-foreground/20 text-foreground' },
                  ].map((c) => (
                    <span key={c.name} className={`text-[9px] font-bold px-1.5 py-0.5 ${c.cls}`}>{c.name}</span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Mock receipt — 3 cols */}
          <Reveal delay={0.1} className="lg:col-span-3">
            <div className="bg-foreground p-6 lg:p-8 h-full flex items-center justify-center">
              <div
                className="w-full max-w-md rounded-2xl p-6 text-white shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 60%, #14532d 100%)' }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">MagicPay</span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-white/15 rounded-full">Pending Claim</span>
                </div>
                <p className="text-[11px] opacity-70 mb-1">You received</p>
                <p className="text-4xl font-extrabold tracking-tight mb-1">$25.00</p>
                <p className="text-xs opacity-80 mb-6">USDC on Base · from @alex</p>
                <div className="space-y-2 text-[11px] opacity-80 mb-6">
                  <div className="flex justify-between"><span>Recipient</span><span className="font-mono">@you</span></div>
                  <div className="flex justify-between"><span>Escrow</span><span>Non-custodial</span></div>
                  <div className="flex justify-between"><span>Expires</span><span>in 7 days</span></div>
                </div>
                <button className="w-full bg-white text-green-800 font-bold text-sm py-3 rounded-full hover:bg-white/90 transition-colors">
                  Claim $25.00 →
                </button>
                <p className="text-[10px] opacity-60 text-center mt-3">No wallet? No problem. We'll create one for you.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Subscription Manager (Coming Soon) Section ─── */
function SubscriptionManagerSection() {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <section ref={ref} className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Coming Soon · MoniBot</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Subscription Manager
              </h2>
            </div>
            <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
              The full lifecycle of paid Discord and Telegram communities, on-chain.
            </span>
          </div>
        </Reveal>

        <Reveal>
          <div
            className="relative overflow-hidden border-4 border-foreground rounded-none"
            style={{ background: '#FCFF52' }}
          >
            {/* Coming Soon badge */}
            <div className="absolute top-6 right-6 z-10">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.2em] uppercase bg-black text-[#FCFF52] px-3 py-1.5">
                <Clock className="w-3 h-3" /> Coming Soon
              </span>
            </div>

            <div className="grid lg:grid-cols-5 gap-0">
              {/* Headline + copy */}
              <div className="lg:col-span-3 p-8 lg:p-12 text-gray-950">
                <Crown className="w-8 h-8 mb-6" />
                <h3 className="text-3xl lg:text-5xl font-black tracking-tight leading-[0.95] mb-6">
                  Run your paid community on autopilot.
                </h3>
                <p className="text-sm lg:text-base font-medium leading-relaxed mb-6 max-w-xl">
                  MoniBot is becoming the first non-custodial subscription manager for Discord and Telegram communities. The admin sets a fee, token, chain, and period. Members pay with one command. Roles are granted on-chain. Renewals, warnings, and revocations happen automatically.
                </p>
                <p className="text-sm lg:text-base font-medium leading-relaxed mb-8 max-w-xl">
                  No third-party subscription tool. No manual role management. No chasing members for payments. The contract handles enforcement so the admin does not have to.
                </p>
                <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider">
                  <span className="px-2.5 py-1 bg-black text-[#FCFF52]">Discord</span>
                  <span className="px-2.5 py-1 bg-black text-[#FCFF52]">Telegram</span>
                  <span className="px-2.5 py-1 border-2 border-black text-black">On-chain enforced</span>
                </div>
              </div>

              {/* Lifecycle list */}
              <div className="lg:col-span-2 p-8 lg:p-12 bg-black text-[#FCFF52] flex flex-col">
                <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase mb-6 opacity-70">Lifecycle</p>
                <ul className="space-y-4 flex-1">
                  {[
                    { t: 'Admin sets terms', d: 'Fee, token, chain, period — once.' },
                    { t: 'One-command pay', d: '/subscribe in Discord or Telegram.' },
                    { t: 'On-chain role grant', d: 'Role assigned the moment payment lands.' },
                    { t: 'Auto warnings', d: 'DM at 7d, 3d, and 24h before expiry.' },
                    { t: 'Auto revoke + grace', d: 'Role revoked after a 1–7d grace window.' },
                    { t: 'Live dashboard', d: 'MRR, churn, and renewals in real time.' },
                  ].map((s, i) => (
                    <li key={s.t} className="flex gap-3">
                      <span className="text-[10px] font-mono font-bold opacity-60 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <p className="text-xs font-extrabold">{s.t}</p>
                        <p className="text-[11px] opacity-70 leading-relaxed">{s.d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] mt-8 pt-6 border-t border-[#FCFF52]/20 opacity-70">
                  Follow <a href="https://x.com/monipay_xyz" target="_blank" rel="noopener noreferrer" className="font-bold underline">@monipay_xyz</a> on X for the launch.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Tap to Pay Section ─── */
function TapToPaySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setStep(prev => (prev < 3 ? prev + 1 : 0));
    }, 2000);
    return () => clearInterval(interval);
  }, [inView]);

  const steps = [
    { label: 'Enter Amount', value: '$12.50', Icon: DollarSign },
    { label: 'Tap Phone', value: 'NFC Ready', Icon: Smartphone },
    { label: 'Signed Locally', value: 'PIN Verified', Icon: Lock },
    { label: 'Confirmed', value: 'Gasless TX', Icon: CircleCheck },
  ];

  return (
    <section ref={ref} className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Point of Sale</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Tap to Pay
              </h2>
            </div>
            <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
              Turn any smartphone into a payment terminal — no hardware required.
            </span>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
          {/* POS Demo */}
          <Reveal className="lg:col-span-2">
            <div className="bg-background p-6 lg:p-8 min-h-[280px]">
              {/* Terminal mockup */}
              <div className="relative w-full aspect-[2/1] bg-foreground/[0.02] border border-foreground/5 overflow-hidden flex flex-col items-center justify-center p-6">
                <div className="flex items-center gap-1.5 mb-4">
                  <Nfc className="w-5 h-5 text-foreground/20" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">MoniPay POS</span>
                </div>

                <div className="flex gap-3 w-full max-w-xs">
                  {steps.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={false}
                      animate={{
                        opacity: step >= i ? 1 : 0.2,
                        scale: step === i ? 1.05 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className="flex-1 text-center"
                    >
                      <s.Icon className={`w-5 h-5 mb-1.5 ${step >= i ? 'text-foreground' : 'text-foreground/20'}`} />
                      <p className="text-[9px] font-bold text-foreground/60 truncate">{s.label}</p>
                      <p className="text-[10px] font-extrabold text-foreground tracking-tight">{s.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="flex gap-1 mt-4 w-full max-w-xs">
                  {steps.map((_, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 h-0.5"
                      initial={false}
                      animate={{
                        backgroundColor: step >= i ? '#0052FF' : 'hsl(var(--foreground) / 0.1)',
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Info */}
          <Reveal delay={0.1}>
            <div className="bg-background p-6 lg:p-8 h-full flex flex-col justify-between">
              {[
                { icon: Nfc, title: 'No Hardware', desc: 'Your phone is the terminal. No card reader needed.' },
                { icon: ShieldCheck, title: 'PIN Secured', desc: 'Every transaction signed with your encrypted key.' },
                { icon: Zap, title: 'Instant Settlement', desc: 'Gasless USDC/USDT/αUSD in under 2 seconds.' },
              ].map((f) => (
                <div key={f.title} className="py-3 border-b border-foreground/5 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <f.icon className="w-3.5 h-3.5 text-foreground/20" />
                    <span className="text-xs font-bold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-foreground/40 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Scan to Pay Section ─── */
function ScanToPaySection() {
  const [activeMode, setActiveMode] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setActiveMode((prev) => (prev + 1) % SCAN_MODES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <section ref={ref} className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Payments</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Scan to Pay
              </h2>
            </div>
            <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
              Smart QR recognition — auto-detects PayTag, wallet address, or payment link.
            </span>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
          {/* Scanner animation */}
          <Reveal className="lg:col-span-2">
            <div className="bg-background p-6 lg:p-8 min-h-[280px]">
              <div className="relative w-full aspect-[2/1] bg-foreground/[0.02] border border-foreground/5 overflow-hidden flex items-center justify-center mb-4">
                <motion.div
                  animate={{ y: [-40, 40, -40] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-[80%] h-0.5 bg-gradient-to-r from-transparent via-[#0052FF] to-transparent"
                />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <QrCode className="w-10 h-10 text-foreground/10" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeMode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="text-center"
                    >
                      <span className="inline-flex items-center bg-foreground text-background px-2.5 py-0.5 text-[10px] font-bold">
                        {SCAN_MODES[activeMode].badge}
                      </span>
                      <p className="text-sm font-bold text-foreground mt-1.5">{SCAN_MODES[activeMode].label}</p>
                      <p className="text-[11px] text-foreground/40 mt-0.5 max-w-[280px]">{SCAN_MODES[activeMode].desc}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex justify-center gap-1.5">
                {SCAN_MODES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveMode(i)}
                    className={`w-1.5 h-1.5 transition-all duration-300 ${i === activeMode ? 'bg-foreground w-5' : 'bg-foreground/20 hover:bg-foreground/40'}`}
                  />
                ))}
              </div>
            </div>
          </Reveal>

          {/* Info */}
          <Reveal delay={0.1}>
            <div className="bg-background p-6 lg:p-8 h-full flex flex-col justify-between">
              {[
                { icon: ScanLine, title: 'Smart Detection', desc: 'Auto-detects QR type — no manual selection.' },
                { icon: ShieldCheck, title: 'Secure Signing', desc: 'Signed locally with your encrypted key.' },
                { icon: Wallet, title: 'Multi-Wallet', desc: 'Scan QR from any wallet app.' },
              ].map((f) => (
                <div key={f.title} className="py-3 border-b border-foreground/5 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <f.icon className="w-3.5 h-3.5 text-foreground/20" />
                    <span className="text-xs font-bold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-foreground/40 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Merchant Section ─── */
function MerchantSection() {
  return (
    <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Commerce</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Merchant Suite
              </h2>
            </div>
            <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
              A complete commerce stack — no hardware, no bank, no middlemen.
            </span>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
          {[
            { icon: Store, title: 'POS Terminal', desc: 'Turn any phone into a point-of-sale. Accept stablecoin payments with a tap or scan — zero hardware required.', accent: true },
            { icon: Package, title: 'Product Catalog', desc: 'Create and manage products with categories, icons, and quick-add buttons for fast checkout.' },
            { icon: Receipt, title: 'Invoice System', desc: 'Send invoices to any MoniTag. Track status, set expiry dates, and auto-reconcile payments.' },
            { icon: BarChart3, title: 'Analytics & Reports', desc: 'Revenue trends, customer retention, heatmaps by day of week. Export to CSV anytime.' },
            { icon: Users, title: 'Customer CRM', desc: 'Track repeat buyers, total spend, tags, and notes. Auto-updates on every transaction.' },
            { icon: Tag, title: 'Payment Links', desc: 'Generate shareable payment links with custom amounts. Track usage and set limits.' },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className={`p-6 lg:p-8 min-h-[180px] flex flex-col justify-between group transition-colors duration-300 ${
                f.accent
                  ? 'bg-foreground text-background'
                  : 'bg-background hover:bg-foreground hover:text-background'
              }`}>
                <f.icon className={`w-5 h-5 mb-6 transition-colors ${
                  f.accent ? 'text-background/40' : 'text-foreground/20 group-hover:text-background/40'
                }`} />
                <div>
                  <h3 className={`text-sm font-bold mb-1.5 transition-colors ${
                    f.accent ? 'text-background' : 'text-foreground group-hover:text-background'
                  }`}>{f.title}</h3>
                  <p className={`text-[11px] leading-relaxed transition-colors ${
                    f.accent ? 'text-background/50' : 'text-foreground/40 group-hover:text-background/50'
                  }`}>{f.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Checkout API Section ─── */
function CheckoutAPISection() {
  return (
    <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5 bg-foreground text-background">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30 block mb-2">Developer</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-background tracking-tight">
                Checkout API
              </h2>
            </div>
            <a
              href="https://docs.monipay.xyz"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-background/30 hover:text-background transition-colors"
            >
              Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-px bg-background/10 border border-background/10 max-w-5xl">
          {/* Code preview */}
          <Reveal>
            <div className="bg-foreground p-6 lg:p-8">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-background/30" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-background/30">Integration</span>
              </div>
              <div className="font-mono text-[11px] leading-relaxed space-y-1 text-background/60">
                <p><span className="text-[#0052FF]">POST</span> /functions/v1/orders</p>
                <p className="text-background/30">───────────────────────</p>
                <p>{'{'}</p>
                <p className="pl-4">"amount": <span className="text-[#F0B90B]">25.00</span>,</p>
                <p className="pl-4">"currency": <span className="text-background/80">"USDC"</span>,</p>
                <p className="pl-4">"callback_url": <span className="text-background/80">"..."</span>,</p>
                <p className="pl-4">"webhook_url": <span className="text-background/80">"..."</span></p>
                <p>{'}'}</p>
                <p className="text-background/30 mt-3">───────────────────────</p>
                <p className="text-background/40">→ Returns checkout URL</p>
                <p className="text-background/40">→ Webhook on completion</p>
                <p className="text-background/40">→ HMAC-SHA256 verified</p>
              </div>
            </div>
          </Reveal>

          {/* Features */}
          <Reveal delay={0.1}>
            <div className="bg-foreground p-6 lg:p-8 flex flex-col justify-between h-full">
              {[
                { icon: Code, title: 'REST API', desc: 'Simple JSON endpoints. Generate API keys (pk_live / sk_live) from dashboard.' },
                { icon: Webhook, title: 'Webhooks', desc: 'Real-time notifications on payment status. HMAC-SHA256 signature verification.' },
                { icon: CreditCard, title: 'Hosted Checkout', desc: 'Redirect users to /pay. Supports QR, MoniTag login, and external wallets.' },
                { icon: Globe, title: 'Multi-Chain', desc: 'Accept USDC, USDT, or aUSD. Auto-settle to your preferred stablecoin.' },
              ].map((f) => (
                <div key={f.title} className="py-3 border-b border-background/10 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <f.icon className="w-3.5 h-3.5 text-background/30" />
                    <span className="text-xs font-bold text-background">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-background/40 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── MoniTag Section ─── */
function MoniTagSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [typedTag, setTypedTag] = useState('');
  const [resolved, setResolved] = useState(false);
  const fullTag = '@alice';

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    setTypedTag('');
    setResolved(false);
    const interval = setInterval(() => {
      if (i < fullTag.length) {
        setTypedTag(fullTag.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setResolved(true), 600);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <section ref={ref} className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Identity Layer</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                MoniTag
              </h2>
            </div>
            <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
              Human-readable on-chain identity. Replace wallet addresses with @tags.
            </span>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
          {/* Live lookup demo */}
          <Reveal className="lg:col-span-2">
            <div className="bg-background p-6 lg:p-8 min-h-[280px]">
              {/* Search bar mockup */}
              <div className="border border-foreground/10 p-5">
                <div className="flex items-center gap-2 pb-4 border-b border-foreground/5 mb-5">
                  <AtSign className="w-4 h-4 text-foreground/20" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">MoniTag Lookup</span>
                </div>

                {/* Input */}
                <div className="flex items-center gap-3 border border-foreground/10 px-4 py-3 mb-5">
                  <AtSign className="w-4 h-4 text-foreground/20 flex-shrink-0" />
                  <span className="text-sm font-bold text-foreground font-mono">
                    {typedTag}
                    {!resolved && <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="inline-block w-0.5 h-4 bg-foreground ml-0.5 align-middle" />}
                  </span>
                </div>

                {/* Result */}
                <AnimatePresence>
                  {resolved && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border border-foreground/10 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-foreground/5 flex items-center justify-center text-lg">👩‍💻</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">@alice</span>
                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-foreground text-background">Verified</span>
                          </div>
                          <span className="text-[10px] text-foreground/30 font-mono">0x4f2e...a3b1</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground">$142.50</p>
                          <p className="text-[9px] text-foreground/30">Balance</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-foreground/5">
                        <div className="flex-1 h-7 bg-foreground flex items-center justify-center cursor-pointer hover:bg-foreground/90 transition-colors">
                          <span className="text-[9px] font-bold text-background">Send Payment</span>
                        </div>
                        <div className="flex-1 h-7 bg-foreground/5 flex items-center justify-center cursor-pointer hover:bg-foreground/10 transition-colors">
                          <span className="text-[9px] font-bold text-foreground/50">View Profile</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Directory preview */}
                <div className="mt-5 space-y-2">
                  {[
                    { tag: '@merchant_xyz', status: 'Merchant', emoji: '🏪' },
                    { tag: '@jade_dev', status: 'Verified', emoji: '💎' },
                  ].map((user, i) => (
                    <motion.div
                      key={user.tag}
                      initial={{ opacity: 0 }}
                      animate={inView ? { opacity: 0.5 } : {}}
                      transition={{ delay: 2.5 + i * 0.3 }}
                      className="flex items-center gap-3 py-2 px-3 bg-foreground/[0.02]"
                    >
                      <span className="text-sm">{user.emoji}</span>
                      <span className="text-[11px] font-bold text-foreground/40">{user.tag}</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-foreground/5 text-foreground/30 ml-auto">{user.status}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Features */}
          <Reveal delay={0.1}>
            <div className="bg-background p-6 lg:p-8 h-full flex flex-col justify-between">
              {[
                { icon: AtSign, title: 'Human-Readable', desc: 'Replace 42-char hex addresses with simple @tags.' },
                { icon: Globe, title: 'Cross-Platform', desc: 'Works across app, Twitter, payment links, and API.' },
                { icon: ScanLine, title: 'Instant Lookup', desc: 'Type any @tag to resolve address and initiate payment.' },
                { icon: Shield, title: 'On-Chain Registry', desc: 'Immutable, no duplicates, fully verifiable identity.' },
              ].map((f) => (
                <div key={f.title} className="py-3 border-b border-foreground/5 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <f.icon className="w-3.5 h-3.5 text-foreground/20" />
                    <span className="text-xs font-bold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-foreground/40 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Storefront Section ─── */
function StorefrontSection() {
  const [activeSet, setActiveSet] = useState(0);

  const PRODUCT_SETS = [
    [
      { name: 'Studio Headphones', price: '$79.99', tag: 'Electronics', img: storeHeadphones },
      { name: 'Classic Watch', price: '$129.00', tag: 'Accessories', img: storeWatch },
    ],
    [
      { name: 'Running Sneakers', price: '$95.00', tag: 'Footwear', img: storeSneaker },
      { name: 'Aviator Sunglasses', price: '$54.99', tag: 'Eyewear', img: storeSunglasses },
    ],
    [
      { name: 'Luxury Perfume', price: '$68.00', tag: 'Fragrance', img: storePerfume },
      { name: 'Retro Camera', price: '$149.00', tag: 'Photography', img: storeCamera },
    ],
    [
      { name: 'Sport Shoes', price: '$110.00', tag: 'Footwear', img: storeShoe },
      { name: 'Leather Bag', price: '$89.00', tag: 'Bags', img: storeBag },
    ],
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSet((s) => (s + 1) % PRODUCT_SETS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const products = PRODUCT_SETS[activeSet];

  return (
    <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Storefront</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Your Store. On-Chain.
              </h2>
            </div>
            <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-foreground/30 bg-foreground/5 px-3 py-1.5">
              <Store className="w-3 h-3" /> PRO
            </span>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10">
          {/* Store preview mockup */}
          <Reveal className="lg:col-span-2">
            <div className="bg-background p-6 lg:p-8 min-h-[340px]">
              {/* Store header */}
              <div className="border border-foreground/10 p-5">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-foreground/5">
                  <div className="w-10 h-10 bg-foreground flex items-center justify-center">
                    <span className="text-sm font-extrabold text-background">S</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground">@shop_demo</h3>
                    <p className="text-[10px] text-foreground/30">Premium merchant store</p>
                  </div>
                  <span className="ml-auto text-[8px] font-bold bg-foreground text-background px-2 py-1">PRO ✦</span>
                </div>

                {/* Animated product grid */}
                <div className="grid grid-cols-2 gap-3">
                  <AnimatePresence mode="wait">
                    {products.map((p, i) => (
                      <motion.div
                        key={`${activeSet}-${i}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.4, delay: i * 0.1 }}
                        className="border border-foreground/5 p-3 group hover:border-foreground/20 transition-colors"
                      >
                        <div className="w-full aspect-square bg-foreground/[0.03] mb-2 overflow-hidden">
                          <img
                            src={p.img}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-foreground truncate">{p.name}</p>
                            <span className="text-[8px] text-foreground/30">{p.tag}</span>
                          </div>
                          <span className="text-[11px] font-extrabold text-foreground whitespace-nowrap">{p.price}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Cycling indicator dots */}
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {PRODUCT_SETS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSet(i)}
                      className={`w-1.5 h-1.5 transition-all duration-300 ${i === activeSet ? 'bg-foreground w-4' : 'bg-foreground/20'}`}
                    />
                  ))}
                </div>

                {/* Payment bar */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                  className="mt-4 pt-3 border-t border-foreground/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-[10px] text-foreground/30">
                    <Lock className="w-3 h-3" />
                    Payments via MoniPay
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-[8px] font-bold bg-[#0052FF] text-white px-1.5 py-0.5">USDC</span>
                    <span className="text-[8px] font-bold bg-[#F0B90B] text-gray-950 px-1.5 py-0.5">USDT</span>
                    <span className="text-[8px] font-bold bg-foreground text-background px-1.5 py-0.5">αUSD</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </Reveal>

          {/* Features */}
          <Reveal delay={0.1}>
            <div className="bg-background p-6 lg:p-8 h-full flex flex-col justify-between">
              {[
                { icon: Store, title: 'Public Storefront', desc: 'Shareable /store/@tag URL. Product catalog with images, prices, and categories.' },
                { icon: Package, title: 'Product Catalog', desc: 'Add products with photos, descriptions, and pricing. Drag to reorder.' },
                { icon: CreditCard, title: 'Stablecoin Checkout', desc: 'Customers pay in USDC, USDT, or αUSD. Gasless, instant settlement.' },
                { icon: BarChart3, title: 'Sales Analytics', desc: 'Track revenue, orders, and customers. Export CSV reports anytime.' },
              ].map((f) => (
                <div key={f.title} className="py-3 border-b border-foreground/5 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <f.icon className="w-3.5 h-3.5 text-foreground/20" />
                    <span className="text-xs font-bold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-foreground/40 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Browser Extension Section ─── */
function BrowserExtensionSection() {
  return (
    <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Extension</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Chrome Extension
              </h2>
            </div>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 max-w-4xl">
          {/* Extension preview */}
          <Reveal className="lg:col-span-2">
            <div className="bg-background p-6 lg:p-8 min-h-[280px]">
              <div className="border border-foreground/10 p-5">
                {/* Browser bar mockup */}
                <div className="flex items-center gap-2 pb-4 border-b border-foreground/5 mb-4">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                  </div>
                  <div className="flex-1 bg-foreground/5 h-6 flex items-center px-3">
                    <span className="text-[9px] text-foreground/30 font-mono">merchant-store.com/checkout</span>
                  </div>
                  <div className="w-7 h-7 bg-foreground flex items-center justify-center">
                    <span className="text-[10px] font-extrabold text-background">M</span>
                  </div>
                </div>

                {/* Extension popup mockup */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="ml-auto max-w-[220px] border border-foreground/10 bg-background p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 bg-foreground flex items-center justify-center">
                      <span className="text-[8px] font-extrabold text-background">M</span>
                    </div>
                    <span className="text-[10px] font-bold text-foreground">MoniPay</span>
                    <span className="ml-auto text-[8px] bg-foreground/5 px-1.5 py-0.5 text-foreground/40 font-bold">Connected</span>
                  </div>
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-foreground/40">Amount</span>
                      <span className="font-bold text-foreground">$25.00 USDC</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-foreground/40">Merchant</span>
                      <span className="font-bold text-foreground">@shop</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-foreground/40">Gas Fee</span>
                      <span className="font-bold text-foreground">$0.00</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-7 bg-foreground/5 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-foreground/40">Reject</span>
                    </div>
                    <div className="flex-1 h-7 bg-foreground flex items-center justify-center">
                      <span className="text-[9px] font-bold text-background">Approve</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </Reveal>

          {/* Info */}
          <Reveal delay={0.1}>
            <div className="bg-background p-6 lg:p-8 h-full flex flex-col justify-between">
              {[
                { icon: Puzzle, title: 'Manifest V3', desc: 'Modern Chrome extension architecture with secure background service worker.' },
                { icon: ShieldCheck, title: 'PIN Secured', desc: 'AES-256-GCM encrypted wallet. PIN unlock for every payment.' },
                { icon: Code, title: 'JS API', desc: 'Merchants call window.monipay.requestPayment(). Extension handles the rest.' },
                { icon: Zap, title: 'Gasless', desc: 'EIP-712 signed, relayed to MoniPay backend. Zero gas for users.' },
              ].map((f) => (
                <div key={f.title} className="py-3 border-b border-foreground/5 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <f.icon className="w-3.5 h-3.5 text-foreground/20" />
                    <span className="text-xs font-bold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-foreground/40 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
