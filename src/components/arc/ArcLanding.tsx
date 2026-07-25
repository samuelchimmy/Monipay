import { XExhibitBadge } from '@/components/XExhibitBadge';
/**
 * ArcLanding.tsx
 * /minipay marketing experience. Strictly Celo. No mention of other chains.
 */
import { LanguageSelector } from '../LanguageSelector';
import { useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ArrowRight, ArrowUpRight, Send, Wand2, Users, AtSign,
  Bot, Store, CreditCard, Smartphone, Zap, Leaf, DollarSign,
  Sun, Moon, Check, X, CalendarClock, Repeat2, Sparkles,
} from 'lucide-react';
import discordSvg from '@/assets/discord-logo.svg';
import telegramSvg from '@/assets/telegram-logo.svg';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Link } from 'react-router-dom';
import arcLogo from '@/assets/arc/logo-ondark.svg';
import { ArcWaitlistForm } from '@/components/arc/ArcWaitlistForm';
import phoneMockupLight from '@/assets/minipay/monibot-phone-light.webp';
import phoneMockupDark from '@/assets/minipay/monibot-phone-dark.webp';
import avatar1 from '@/assets/minipay/avatars/avatar-1.jpg';
import avatar2 from '@/assets/minipay/avatars/avatar-2.jpg';
import avatar3 from '@/assets/minipay/avatars/avatar-3.jpg';
import avatar4 from '@/assets/minipay/avatars/avatar-4.jpg';
import avatar5 from '@/assets/minipay/avatars/avatar-5.jpg';
import avatar6 from '@/assets/minipay/avatars/avatar-6.jpg';

/* ── Inline brand glyphs ── */
const XIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M18.244 2H21l-6.51 7.44L22 22h-6.79l-4.71-6.18L4.95 22H2.19l6.97-7.96L2 2h6.91l4.27 5.65L18.244 2Zm-2.38 18h1.88L7.27 4H5.27l10.594 16Z" />
  </svg>
);
const BlueskyIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M5.5 4.5C8 6.2 10.7 9.5 12 11.4c1.3-1.9 4-5.2 6.5-6.9 1.8-1.2 4.5-2.1 4.5 1 0 .6-.3 5.2-.5 6-.7 2.6-3.3 3.2-5.7 2.8 4.1.7 5.2 3 2.9 5.3-4.3 4.4-6.2-1.1-6.7-2.5l-.1-.3-.1.3c-.5 1.4-2.4 6.9-6.7 2.5C3.8 17.4 4.9 15.1 9 14.4c-2.4.4-5-.2-5.7-2.8-.2-.8-.5-5.4-.5-6 0-3.1 2.7-2.2 4.5-1Z" />
  </svg>
);
const TelegramIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M21.94 4.32a1 1 0 0 0-1.36-1.05L2.9 10.06c-.93.36-.92 1.7.02 2.04l4.4 1.6 1.7 5.45a1 1 0 0 0 1.66.43l2.5-2.3 4.4 3.23a1 1 0 0 0 1.57-.6L21.94 4.4v-.08ZM9.6 14.18l8.2-7.04-6.4 8.06-.06.07-.3 3.2-1.44-4.29Z" />
  </svg>
);
const DiscordIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 127 96" fill="currentColor" className={className} aria-hidden>
    <path d="M81.15,0c-1.24,2.2-2.35,4.47-3.36,6.79-9.6-1.44-19.37-1.44-28.99,0-.99-2.32-2.12-4.6-3.36-6.79-9.02,1.54-17.81,4.24-26.14,8.06C2.78,32.53-1.69,56.37.53,79.89c9.67,7.15,20.51,12.6,32.05,16.09,2.6-3.49,4.9-7.2,6.87-11.06-3.74-1.39-7.35-3.13-10.81-5.15.91-.66,1.79-1.34,2.65-2,20.28,9.55,43.77,9.55,64.08,0,.86.71,1.74,1.39,2.65,2-3.46,2.05-7.07,3.76-10.83,5.18,1.97,3.86,4.27,7.58,6.87,11.06,11.54-3.49,22.38-8.92,32.05-16.06,2.63-27.28-4.5-50.92-18.82-71.86-8.33-3.81-17.12-6.51-26.14-8.03ZM42.28,65.41c-6.24,0-11.42-5.66-11.42-12.65s4.98-12.68,11.39-12.68,11.52,5.71,11.42,12.68c-.1,6.97-5.03,12.65-11.39,12.65ZM84.36,65.41c-6.26,0-11.39-5.66-11.39-12.65s4.98-12.68,11.39-12.68,11.49,5.71,11.39,12.68c-.1,6.97-5.03,12.65-11.39,12.65Z"/>
  </svg>
);
/* Arc brand mark — uploaded glyph. Flatten the white→transparent gradient
 * to a solid ink in light mode and solid white in dark mode. */
const ArcLogo = ({ className = '' }: { className?: string }) => (
  <img
    src={arcLogo}
    alt="Arc"
    className={`${className} [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)]`}
  />
);

/* ── Pro backdrop: soft mesh radial + faint dot grid ── */
function ArcBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[120vh] overflow-hidden -z-0"
    >
      {/* radial mesh */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 480px at 20% 0%, hsl(var(--mp-primary) / 0.10), transparent 60%), radial-gradient(700px 420px at 85% 8%, hsl(var(--mp-primary) / 0.07), transparent 60%)',
        }}
      />
      {/* faint dot grid */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
        style={{
          backgroundImage:
            'radial-gradient(hsl(var(--mp-ink) / 0.18) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 40%, transparent 90%)',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 40%, transparent 90%)',
        }}
      />
    </div>
  );
}

/* ── Reveal helper ── */
function Reveal({ children, className = '', delay = 0, y = 24 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, scale: 0.97, filter: 'blur(8px)' }}
      animate={inView ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Header ── */
function ArcHeader({ onSignIn }: { onSignIn: () => void }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="sticky top-3 z-50 px-3 sm:px-6 pt-3">
      <div className="mx-auto max-w-5xl">
        <div
          className="flex items-center justify-between gap-2 rounded-full pl-2 pr-2 py-2 border border-black dark:border-white"
          style={{
            background: 'hsl(var(--mp-surface))',
            boxShadow: '0 8px 32px -12px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-center gap-2 pl-1">
            <MoniPayLogo size={26} color="hsl(var(--mp-ink))" animationMode="header" entranceOnMount />
            <span className="font-bold tracking-tight text-[15px]" style={{ color: 'hsl(var(--mp-ink))' }}>Monipay</span>
            <span className="mx-1" style={{ color: 'hsl(var(--mp-ink) / 0.3)' }}>|</span>
            <ArcLogo className="h-5" />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[hsl(var(--mp-faint))] transition-colors" style={{ color: 'hsl(var(--mp-ink))' }}
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex h-9 sm:h-10 items-center gap-1 rounded-full pl-4 pr-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'hsl(var(--mp-primary))' }}
            >
              {'Sign in'}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hero halo ── */
const SOCIAL_BUBBLES = [
  { id: 'x',        Icon: XIcon,       label: 'X',        color: 'hsl(var(--mp-ink))' },
  { id: 'discord',  Icon: DiscordIcon, label: 'Discord',  color: '#5865F2' },
  { id: 'telegram', Icon: TelegramIcon,label: 'Telegram', color: '#229ED9' },
  { id: 'bluesky',  Icon: BlueskyIcon, label: 'Bluesky',  color: '#1185FE' },
];

function SocialHaloPhone() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: '-80px' });
  const phoneX = 300;
  const phoneTopY = 240;
  // Geometric arc: 4 points evenly distributed across a 120° arc
  // centered above the phone notch. Position = polar(center, radius, angle).
  // Arc center sits BELOW the icons (and just above the phone notch). Lowering
  // arcCenter.y while keeping radius lifts every icon UP by the same amount,
  // so they balance precisely on top of the connector tips without breaking
  // the equal-angular spacing.
  const arcCenter = { x: 264, y: 200 };
  const arcRadius = 175;
  const arcAngles = [-48, -16, 16, 48]; // evenly spaced across a 96° arc
  const bubblePositions = arcAngles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: arcCenter.x + arcRadius * Math.sin(rad),
      y: arcCenter.y - arcRadius * Math.cos(rad),
    };
  });
  // Dotted reference arc — extends ~10° past the outer icons so they sit cleanly on the curve.
  const arcStart = {
    x: arcCenter.x + arcRadius * Math.sin((-58 * Math.PI) / 180),
    y: arcCenter.y - arcRadius * Math.cos((-58 * Math.PI) / 180),
  };
  const arcEnd = {
    x: arcCenter.x + arcRadius * Math.sin((58 * Math.PI) / 180),
    y: arcCenter.y - arcRadius * Math.cos((58 * Math.PI) / 180),
  };
  const arcPath = `M ${arcStart.x},${arcStart.y} A ${arcRadius},${arcRadius} 0 0 1 ${arcEnd.x},${arcEnd.y}`;

  return (
    <div ref={containerRef} className="relative w-full max-w-[640px] mx-auto select-none pb-[460px] sm:pb-[560px] md:pb-[660px]">
      {/* Arc layer — sized to the SVG's intrinsic 600:720 ratio so the bubble overlay
          uses the SAME coordinate space as the SVG (otherwise % top of the outer
          container — which includes the phone padding — pushes bubbles off the arc). */}
      <div className="relative w-full" style={{ aspectRatio: '600 / 720' }}>
      <svg viewBox="0 0 600 720" className="absolute inset-0 w-full h-full" aria-hidden>
        <path
          d={arcPath}
          fill="none"
          stroke="hsl(var(--mp-border))"
          strokeWidth="1.2"
          strokeDasharray="3 6"
          opacity="0.7"
        />
        {bubblePositions.map((p, i) => {
          // Connector tip starts at the BOTTOM EDGE of the icon bubble (~32px
          // radius) so the icon visually balances on the tip of the line.
          const dx = (phoneX - p.x) * 0.45;
          const d = `M ${p.x} ${p.y + 32} C ${p.x + dx} ${p.y + 120}, ${phoneX - dx * 0.3} ${phoneTopY - 60}, ${phoneX} ${phoneTopY}`;
          return (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke="hsl(var(--mp-primary))"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="400"
                strokeDashoffset={inView ? 0 : 400}
                style={{ transition: `stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1) ${0.2 + i * 0.12}s` }}
              />
              <circle
                r="3.5"
                fill="hsl(var(--mp-primary))"
                style={{
                  offsetPath: `path('${d}')`,
                  // @ts-ignore vendor
                  WebkitOffsetPath: `path('${d}')`,
                  animation: inView ? `mp-pulse-dot 2.4s ${1.4 + i * 0.25}s linear infinite` : undefined,
                  opacity: 0,
                }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 pointer-events-none">
        {bubblePositions.map((p, i) => {
          const b = SOCIAL_BUBBLES[i];
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 12,
                mass: 0.7,
                delay: 0.25 + i * 0.12,
              }}
              className="absolute"
              style={{
                left: `${(p.x / 600) * 100}%`,
                top: `${(p.y / 720) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              aria-label={b.label}
            >
              <div
                className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center pointer-events-auto bg-white dark:bg-black shadow-[0_0_0_2px_hsl(var(--mp-primary)),0_0_0_3.5px_#fff,0_14px_30px_-10px_hsl(var(--mp-ink)/0.28)] dark:shadow-[0_0_0_2px_hsl(var(--mp-primary)),0_14px_30px_-10px_hsl(var(--mp-ink)/0.6)]"
              >
                <span className="text-black dark:text-white" aria-label={b.label}>
                  <b.Icon className="h-5 w-5 sm:h-7 sm:w-7" />
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 flex justify-center"
          style={{ top: 'calc((min(100vw - 32px, 640px) * 0.3667) - 24px)' }}
        >
          <div className="relative flex justify-center">
            <img
              src={phoneMockupLight}
              alt="MoniBot social payments shown inside a phone"
              className="block dark:hidden h-auto max-w-none select-none"
              style={{ width: 'min(98vw, 620px)' }}
              draggable={false}
            />
            <img
              src={phoneMockupDark}
              alt="MoniBot social payments shown inside a phone"
              className="hidden dark:block h-auto max-w-none select-none"
              style={{ width: 'min(98vw, 620px)' }}
              draggable={false}
            />
            {/* Cloud fade — soft gradient in the EXACT page bg color so the phone's
                bottom edge dissolves into the surface. Short height, no blur halo. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[12%]"
              style={{
                background:
                  'linear-gradient(to bottom, hsl(var(--mp-surface) / 0) 0%, hsl(var(--mp-surface) / 0.85) 65%, hsl(var(--mp-surface)) 100%)',
              }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ArcHero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="relative px-4 sm:px-6 pt-10 sm:pt-16 pb-12">
      <ArcBackdrop />
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <Reveal>
          <span
            className="inline-flex items-center gap-2 rounded-full pl-1 pr-4 py-1 text-[12px] font-bold tracking-tight"
            style={{
              background: 'hsl(var(--mp-surface))',
              color: 'hsl(var(--mp-ink))',
              border: '1px solid hsl(var(--mp-border))',
              boxShadow: '0 6px 18px -8px hsl(var(--mp-ink) / 0.18)',
            }}
          >
            <img
              src={AVATAR_MAP['ai-pill']}
              alt=""
              className="h-5 w-5 rounded-full object-cover bg-white"
              style={{ boxShadow: '0 0 0 1.25px #fff, 0 0 0 2.25px hsl(var(--mp-primary))' }}
            />
            {'Coming soon to Arc Testnet'}
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1
            className="mt-5 text-[30px] sm:text-[44px] md:text-[54px] leading-[1.04] font-extrabold tracking-tight"
            style={{ color: 'hsl(var(--mp-ink))' }}
          >
            {'Payments, native.'}
            <br />
            <span style={{ color: 'hsl(var(--mp-primary))' }}>{'Powered by Arc.'}</span>
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p
            className="mx-auto mt-4 max-w-[600px] text-[15px] sm:text-base"
            style={{ color: 'hsl(var(--mp-muted))' }}
          >
            {'Send USDC to anyone just by posting and chatting on X, Discord, Telegram, or Bluesky. Built on Arc, Circle’s payment-native L1. No addresses. No gas. No friction.'}
          </p>
        </Reveal>

        <Reveal delay={0.15} className="mt-6 flex flex-col items-center gap-2">
          <ArcWaitlistForm source="arc_landing_hero" cta="Notify me" />
          <span className="text-[12px]" style={{ color: 'hsl(var(--mp-muted))' }}>
            {'Be first in line when MoniPay opens on Arc.'}
          </span>
        </Reveal>
        <Reveal delay={0.18} className="mt-4 flex justify-center">
          <XExhibitBadge variant="pill" />
        </Reveal>

        <Reveal delay={0.2} className="mt-10 sm:mt-14 flex justify-center">
          <div className="w-full max-w-[640px] mx-auto">
            <SocialHaloPhone />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Avatar helper: real pfp with theme frame ── */
const AVATAR_MAP: Record<string, string> = {
  'alex-x': avatar1,
  'mara-d': avatar2,
  'nora-t': avatar6,
  'monibot': avatar4,
  'ai-pill': avatar3,
  'extra-1': avatar5,
};

function Pfp({ seed, size = 28 }: { seed: string; size?: number }) {
  const url = AVATAR_MAP[seed] ?? avatar5;
  return (
    <img
      src={url}
      alt={seed}
      width={size}
      height={size}
      className="rounded-full shrink-0 bg-white object-cover"
      style={{
        width: size,
        height: size,
        boxShadow: '0 0 0 2px #fff, 0 0 0 3.5px hsl(var(--mp-primary))',
      }}
    />
  );
}

/* ── Phone mockup shell (theme-aware) ── */
function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[380px] sm:max-w-[420px]">
      <div
        className="relative rounded-[3rem] p-3 shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #2a2f3a 0%, #14171d 60%, #0a0c10 100%)',
          boxShadow: '0 40px 80px -30px rgba(0,0,0,0.55), 0 8px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* side buttons */}
        <span aria-hidden className="absolute left-[-2px] top-[110px] h-7 w-[3px] rounded-l bg-zinc-700" />
        <span aria-hidden className="absolute left-[-2px] top-[160px] h-12 w-[3px] rounded-l bg-zinc-700" />
        <span aria-hidden className="absolute left-[-2px] top-[220px] h-12 w-[3px] rounded-l bg-zinc-700" />
        <span aria-hidden className="absolute right-[-2px] top-[180px] h-16 w-[3px] rounded-r bg-zinc-700" />

        <div
          className="relative rounded-[2.4rem] overflow-hidden"
          style={{ background: 'hsl(var(--mp-surface))' }}
        >
          {/* dynamic island */}
          <div className="absolute left-1/2 top-2 -translate-x-1/2 z-10 h-[26px] w-[110px] rounded-full bg-black flex items-center justify-end pr-2.5">
            <span className="h-2 w-2 rounded-full bg-zinc-700" />
          </div>
          <div className="px-4 pt-12 pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Chat demos ── */
const CHAT_DEMOS = [
  {
    network: 'X',
    Icon: XIcon,
    handle: '@alex',
    user: 'amazing thread, here is a tip 🙌  @MoniPay send $5 to @alex',
    bot: 'Done. $5 USDC sent to @alex on Arc. Gas sponsored. Receipt 🔗',
    seed: 'alex-x',
  },
  {
    network: 'Discord',
    img: discordSvg,
    handle: '#design-team',
    user: '@MoniBot split $40 between @lara, @sam, @jude for lunch',
    bot: 'Sent $13.33 USDC to 3 recipients on Arc. One transaction, zero fees.',
    seed: 'mara-d',
  },
  {
    network: 'Telegram',
    img: telegramSvg,
    handle: '@nora',
    user: '@MoniBot pay @nora $10 for the design',
    bot: 'Paid. $10 USDC delivered on Arc. Nora does not need a MoniPay account yet. MagicPay handled it.',
    seed: 'nora-t',
  },
];

function ChatDemos() {
  return (
    <section className="relative px-4 sm:px-6 py-16 sm:py-24" style={{ background: 'hsl(var(--mp-surface))' }}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center mb-6 sm:mb-8">
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'hsl(var(--mp-primary-strong))' }}>
            {'See it in action'}
          </span>
          <h2 className="mt-2 text-[22px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
            {'Just type. We handle the money.'}
          </h2>
          <p className="mt-2 max-w-xl mx-auto text-sm" style={{ color: 'hsl(var(--mp-muted))' }}>
            {'Real commands, real receipts. No wallets, no addresses, no gas.'}
          </p>
        </Reveal>

        <Reveal>
          <PhoneMockup>
            <div className="space-y-5">
              {CHAT_DEMOS.map((c) => (
                <div
                  key={c.network}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'hsl(var(--mp-surface-elev))',
                    border: '1px solid hsl(var(--mp-border))',
                  }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b"
                    style={{ borderColor: 'hsl(var(--mp-border))' }}
                  >
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <div className="ml-1.5 flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'hsl(var(--mp-muted))' }}>
                      {c.img ? (
                        <img src={c.img} alt={c.network} className={`h-3 w-3 ${c.network === 'Discord' ? 'dark:[filter:invert(1)_brightness(2)]' : ''}`} />
                      ) : (
                        c.Icon && <c.Icon className="h-3 w-3" />
                      )}
                      {c.network} · {c.handle}
                    </div>
                  </div>
                  <div className="p-3 space-y-2.5">
                    <div className="flex items-end gap-2">
                      <Pfp seed={c.seed} size={26} />
                      <div
                        className="rounded-2xl rounded-bl-sm px-3 py-2 text-[12px] leading-snug max-w-[82%]"
                        style={{ background: 'hsl(var(--mp-faint))', color: 'hsl(var(--mp-ink))' }}
                      >
                        {c.user}
                      </div>
                    </div>
                    <div className="flex items-end gap-2 justify-end">
                      <div
                        className="rounded-2xl rounded-br-sm px-3 py-2 text-[12px] leading-snug max-w-[82%] text-white"
                        style={{ background: 'hsl(var(--mp-primary))' }}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[9px] font-bold uppercase tracking-wider opacity-90">
                          <Check className="h-2.5 w-2.5" /> MoniBot
                        </div>
                        {c.bot}
                      </div>
                      <img
                        src={AVATAR_MAP['monibot']}
                        alt="MoniBot"
                        className="h-6 w-6 rounded-full shrink-0 bg-white object-cover"
                        style={{ boxShadow: '0 0 0 2px #fff, 0 0 0 3px hsl(var(--mp-primary))' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PhoneMockup>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Social payment cards (6) ── */
const SOCIAL_CARDS = [
  { Icon: Send,          name: 'CasualPay',       headlineKey: 'Tip any MoniPay user by their @MoniTag',       descKey: 'Post a standalone command, a quote post, or a reply: "@MoniPay send $5 to @alex". The tip lands instantly in their MoniPay wallet on Arc.' },
  { Icon: Wand2,         name: 'MagicPay',        headlineKey: 'Pay people who do not have MoniPay yet',        descKey: 'Recipients without an account still get paid. They claim with one tap, on their schedule. No onboarding required up front.' },
  { Icon: Users,         name: 'GroupPay',        headlineKey: 'Pay everyone at once',        descKey: 'One command, many recipients. Try "@MoniBot split $30 between @lara, @sam, @jude" or run a giveaway: "@MoniBot drop $50 to the next 25 repliers". Atomic in a single Arc transaction.' },
  { Icon: AtSign,        name: 'TagPay',          headlineKey: 'One @MoniTag, no addresses',          descKey: 'Send to a username instead of a wallet string. Your @MoniTag is your identity for receiving USDC on Arc.' },
  { Icon: CalendarClock, name: 'SchedulePay',     headlineKey: 'Send later, automatically',     descKey: 'Queue a future payment from chat: "@MoniBot pay @kai $200 on Friday". MoniPay holds the instruction and executes on Arc when the time arrives.' },
  { Icon: Repeat2,       name: 'SubscriptionPay', headlineKey: 'Recurring payments by chat', descKey: 'Subscribe with a single command: "@MoniBot subscribe me to @cryptoalpha for 1 month". Auto-renews on Arc until you cancel.' },
];

function SocialPaymentCards() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center mb-10 sm:mb-14">
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'hsl(var(--mp-primary-strong))' }}>
            {'The main stage'}
          </span>
          <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
            {'Payments that live where you talk.'}
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-base" style={{ color: 'hsl(var(--mp-muted))' }}>
            {'Six ways to move money inside conversations.'}
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {SOCIAL_CARDS.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.06}>
              <div
                className="group h-full rounded-3xl p-6 sm:p-7 transition-all hover:-translate-y-1"
                style={{
                  background: 'hsl(var(--mp-surface-elev))',
                  border: '1px solid hsl(var(--mp-border))',
                  boxShadow: '0 1px 0 hsl(var(--mp-border) / 0.5)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-11 w-11 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'hsl(var(--mp-primary))',
                      boxShadow: '0 8px 22px -10px hsl(var(--mp-primary) / 0.7)',
                    }}
                  >
                    <c.Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
                  </div>
                  <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'hsl(var(--mp-muted))' }}>
                    {c.name}
                  </span>
                </div>
                <h3 className="mt-5 text-xl sm:text-2xl font-extrabold tracking-tight leading-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
                  {c.headlineKey}
                </h3>
                <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: 'hsl(var(--mp-muted))' }}>
                  {c.descKey}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Chain stats ── */
const STATS = [
  { Icon: Zap,        titleKey: 'Instant Finality', stat: '~5s',   descKey: 'Sub-second confirmation on Arc, optimized for payment workflows.' },
  { Icon: Leaf,       titleKey: 'USDC-Native',  statKey: 'USDC', descKey: 'Arc treats stablecoins as a first-class primitive, not an afterthought.' },
  { Icon: DollarSign, titleKey: 'No Gas Token',    stat: 'USDT',  descKey: 'Fees paid directly in USDC. No separate gas asset to manage.' },
  { Icon: Smartphone, titleKey: 'Circle-Backed',  stat: '6B+',   descKey: 'Arc is purpose-built by Circle for the next era of global payments.' },
];

function ChainStats() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24" style={{ background: 'hsl(var(--mp-surface-elev))' }}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
            {'Built on Arc for a reason.'}
          </h2>
          <p className="mt-3 text-base max-w-lg mx-auto" style={{ color: 'hsl(var(--mp-muted))' }}>
            {'Payment-native rails from Circle. Fast finality, USDC as the unit of account, fees abstracted.'}
          </p>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STATS.map((s, i) => (
            <Reveal key={s.titleKey} delay={i * 0.06}>
              <div
                className="rounded-2xl p-5 h-full"
                style={{ background: 'hsl(var(--mp-surface))', border: '1px solid hsl(var(--mp-border))' }}
              >
                <s.Icon className="h-5 w-5" style={{ color: 'hsl(var(--mp-primary))' }} />
                <div className="mt-4 text-2xl font-extrabold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>{s.statKey || s.stat}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--mp-muted))' }}>{s.titleKey}</div>
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'hsl(var(--mp-muted))' }}>{s.descKey}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Fee compare ── */
function FeeCompare() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
            {'Zero fees you can feel.'}
          </h2>
          <p className="mt-3 text-base" style={{ color: 'hsl(var(--mp-muted))' }}>
            {'Gas is sponsored. The amount you send is the amount they get.'}
          </p>
        </Reveal>
        <Reveal>
          <div
            className="grid sm:grid-cols-2 rounded-3xl overflow-hidden"
            style={{ border: '1px solid hsl(var(--mp-border))' }}
          >
            <div className="p-7" style={{ background: 'hsl(var(--mp-surface-elev))' }}>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--mp-muted))' }}>
                <X className="h-3 w-3" /> {'Typical On-chain transfer'}
              </div>
              <div className="mt-5 space-y-2 text-sm" style={{ color: 'hsl(var(--mp-ink))' }}>
                <Row label={'Send'} value="$10.00" />
                <Row label={'Gas fee'} value="−$0.001" />
                <Row label={'Needs gas token'} value={'Yes'} />
              </div>
              <div className="mt-5 pt-4 border-t" style={{ borderColor: 'hsl(var(--mp-border))' }}>
                <div className="text-xs uppercase tracking-wider" style={{ color: 'hsl(var(--mp-muted))' }}>{'Recipient gets'}</div>
                <div className="text-3xl font-extrabold mt-1" style={{ color: 'hsl(var(--mp-ink))' }}>$9.999</div>
              </div>
            </div>
            <div className="p-7" style={{ background: 'hsl(var(--mp-primary))', color: 'white' }}>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-90">
                <Check className="h-3 w-3" /> {'MoniPay on Arc'}
              </div>
              <div className="mt-5 space-y-2 text-sm">
                <Row label={'Send'} value="$10.00" tone="dark" />
                <Row label={'Gas fee'} value={'Sponsored'} tone="dark" />
                <Row label={'Needs gas token'} value={'Never'} tone="dark" />
              </div>
              <div className="mt-5 pt-4 border-t border-white/20">
                <div className="text-xs uppercase tracking-wider opacity-80">{'Recipient gets'}</div>
                <div className="text-3xl font-extrabold mt-1">$10.00</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
function Row({ label, value, tone }: { label: string; value: string; tone?: 'dark' }) {
  return (
    <div className="flex items-center justify-between">
      <span className={tone === 'dark' ? 'opacity-80' : ''} style={tone === 'dark' ? {} : { color: 'hsl(var(--mp-muted))' }}>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

/* ── Platform features (Celo only) ── */
const PLATFORM = [
  { Icon: Bot,        titleKey: 'MoniBot AI Agent',     descKey: 'Autonomous AI executing USDC transfers across X, Discord, Telegram, and Bluesky on Arc.' },
  { Icon: Store,      titleKey: 'Merchant Suite',   descKey: 'POS, product catalog, invoicing, and payment links for Arc USDC merchants.' },
  { Icon: Users,      titleKey: 'P2P Transfers',     descKey: 'Send USDC to any @MoniTag on Arc. No wallet addresses, no mistakes.' },
  { Icon: Smartphone, titleKey: 'Arc-Native Rails', descKey: 'Built around Arc primitives: USDC-denominated fees, payment-native settlement, no gas token.' },
  { Icon: CreditCard, titleKey: 'Payment Gateway', descKey: 'Stripe-style API for online USDC payments on Arc with merchant webhooks.' },
  { Icon: AtSign,     titleKey: '@MoniTag Identity',     descKey: 'Your username is your wallet. One tag, every conversation, every chain.' },
];

function PlatformGrid() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24" style={{ background: 'hsl(var(--mp-surface-elev))' }}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
            {'Everything else MoniPay does.'}
          </h2>
          <p className="mt-3 text-base max-w-lg mx-auto" style={{ color: 'hsl(var(--mp-muted))' }}>
            {'Social payments are the headline. Here is the full toolkit underneath.'}
          </p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {PLATFORM.map((f, i) => (
            <Reveal key={f.titleKey} delay={i * 0.05}>
              <div className="rounded-2xl p-5 sm:p-6 h-full transition-colors hover:bg-[hsl(var(--mp-faint))]"
                style={{ background: 'hsl(var(--mp-surface))', border: '1px solid hsl(var(--mp-border))' }}>
                <div
                  className="h-11 w-11 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'hsl(var(--mp-primary))',
                    boxShadow: '0 8px 22px -10px hsl(var(--mp-primary) / 0.7)',
                  }}
                >
                  <f.Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>{f.titleKey}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'hsl(var(--mp-muted))' }}>{f.descKey}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ── */
const STEPS = [
  { num: '01', titleKey: 'Claim your @MoniTag', descKey: 'Create your @MoniTag in seconds. A wallet is generated locally and encrypted with your PIN.' },
  { num: '02', titleKey: 'Link your socials', descKey: 'Connect X, Discord, Telegram, or Bluesky so people can pay you by handle.' },
  { num: '03', titleKey: 'Reply to pay', descKey: 'Just type "@MoniPay send $5 to @alex" on any supported network. We route it through Arc.' },
  { num: '04', titleKey: 'Cash out anywhere', descKey: 'Spend, swap, or withdraw your USDC to any wallet you control.' },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>
            {'From hello to paid in 30 seconds.'}
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.07}>
              <div className="rounded-3xl p-6 sm:p-7 h-full"
                style={{ background: 'hsl(var(--mp-surface-elev))', border: '1px solid hsl(var(--mp-border))' }}>
                <div className="text-[11px] font-bold tracking-widest" style={{ color: 'hsl(var(--mp-primary-strong))' }}>{s.num}</div>
                <h3 className="mt-2 text-xl font-bold tracking-tight" style={{ color: 'hsl(var(--mp-ink))' }}>{s.titleKey}</h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'hsl(var(--mp-muted))' }}>{s.descKey}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ── */
function FinalCTA({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24">
      <Reveal className="mx-auto max-w-5xl">
        <div
          className="relative overflow-hidden rounded-[32px] p-8 sm:p-14 text-center"
          style={{ background: 'hsl(var(--mp-primary))' }}
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(600px circle at 20% 0%, white, transparent 60%)' }} />
          <h2 className="relative text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            {'The first social wallet on Arc.'}
          </h2>
          <p className="relative mt-3 text-white/85 max-w-md mx-auto">
            {'Arc is still warming up. Be first in line when MoniPay opens on Circle’s payment-native L1.'}
          </p>
          <div className="relative mt-7 flex flex-col gap-3 items-center justify-center">
            <ArcWaitlistForm
              variant="onPrimary"
              source="arc_landing_final_cta"
              cta="Notify me"
            />
            <a
              href="https://docs.monipay.xyz"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full px-5 h-12 text-sm font-semibold text-white border border-white/40 hover:bg-white/10"
            >
              {'Read Arc docs'} <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Footer (Celo-only, no chain cross-links) ── */
function ArcFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-6 lg:px-16 py-10 border-t" style={{ borderColor: 'hsl(var(--mp-border))' }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MoniPayLogo size={22} color="hsl(var(--mp-ink))" animationMode="idle" />
          <span className="font-bold tracking-tight text-[13px]" style={{ color: 'hsl(var(--mp-ink))' }}>Monipay</span>
          <span className="mx-1" style={{ color: 'hsl(var(--mp-muted))' }}>|</span>
          <ArcLogo className="h-4" />
        </div>
        <div className="flex items-center gap-5 text-[12px]" style={{ color: 'hsl(var(--mp-muted))' }}>
          <Link to="/privacy" className="hover:text-[hsl(var(--mp-ink))] transition-colors">{'Privacy'}</Link>
          <Link to="/terms" className="hover:text-[hsl(var(--mp-ink))] transition-colors">{'Terms'}</Link>
          <a href="https://discord.gg/kSAwXzeRDB" target="_blank" rel="noreferrer" className="hover:text-[hsl(var(--mp-ink))] transition-colors">{'Support'}</a>
        </div>
        <LanguageSelector variant="compact" />
        <span className="text-[11px]" style={{ color: 'hsl(var(--mp-muted))' }}>© {year} MoniPay</span>
      </div>
    </footer>
  );
}

/* ── Root ── */
export function ArcLanding({
  onGetStarted = () => { window.location.href = '/'; },
  onSignIn = () => { window.location.href = '/'; },
}: {
  onGetStarted?: () => void;
  onSignIn?: () => void;
} = {}) {
  useEffect(() => {
    document.documentElement.setAttribute('data-arc-route', 'true');
    return () => document.documentElement.removeAttribute('data-arc-route');
  }, []);

  return (
    <div data-arc className="min-h-screen overflow-x-hidden">
      <ArcHeader onSignIn={onSignIn} />
      <ArcHero onGetStarted={onGetStarted} />
      <SocialPaymentCards />
      <ChainStats />
      <FeeCompare />
      <PlatformGrid />
      <HowItWorks />
      <FinalCTA onGetStarted={onGetStarted} />
      <ArcFooter />
    </div>
  );
}

export default ArcLanding;
