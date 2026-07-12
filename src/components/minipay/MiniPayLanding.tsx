/**
 * MiniPayLanding.tsx
 * /minipay marketing experience. Strictly Celo. No mention of other chains.
 */
import { LanguageSelector } from '../LanguageSelector';
import { useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, ArrowUpRight, Send, Wand2, Users, AtSign,
  Bot, Store, CreditCard, Smartphone, Zap, Leaf, DollarSign,
  Sun, Moon, Check, X, CalendarClock, Repeat2, Sparkles,
} from 'lucide-react';
import discordSvg from '@/assets/discord-logo.svg';
import telegramSvg from '@/assets/telegram-logo.svg';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { Link } from 'react-router-dom';
import { XExhibitBadge } from '@/components/XExhibitBadge';
import celoGlyph from '@/assets/celo-glyph.png';
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
/* Celo brand mark - uploaded glyph */
const CeloLogo = ({ className = '', size = 20 }: { className?: string; size?: number }) => (
  <img 
    src={celoGlyph} 
    alt="Celo" 
    className={`shrink-0 w-auto object-contain ${className}`} 
    width={size} 
    height={size} 
  />
);

/* ── Pro backdrop: soft mesh radial + faint dot grid ── */
function MiniPayBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none !absolute inset-x-0 top-0 h-screen overflow-hidden z-0"
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
function MiniPayHeader({ onSignIn }: { onSignIn: () => void }) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <div className="sticky top-3 z-50 px-3 sm:px-6 pt-3">
      <div className="mx-auto max-w-5xl">
        <div
          className="flex items-center justify-between gap-2 rounded-full pl-2 pr-2 py-2 border border-black dark:border-white"
          style={{
            background: '#FCFF52',
            boxShadow: '0 8px 32px -12px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-center gap-2 pl-1">
            <MoniPayLogo size={26} color="#000" animationMode="header" entranceOnMount />
            <span className="font-bold tracking-tight text-[15px] text-black">Monipay</span>
            <span className="mx-1 text-black/30">|</span>
            <CeloLogo className="h-5" size={20} />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex h-9 sm:h-10 items-center gap-1 rounded-full pl-4 pr-3 text-sm font-semibold text-[#FCFF52] bg-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('minipay_sign_in')}
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
              aria-hidden="true"
            >
              <div
                className="h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center pointer-events-auto bg-white dark:bg-black shadow-[0_0_0_2px_hsl(var(--mp-primary)),0_0_0_3.5px_#fff,0_14px_30px_-10px_hsl(var(--mp-ink)/0.28)] dark:shadow-[0_0_0_2px_hsl(var(--mp-primary)),0_14px_30px_-10px_hsl(var(--mp-ink)/0.6)]"
              >
                <span className="text-black dark:text-white">
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
              width="620"
              height="1102"
              fetchPriority="high"
            />
            <img
              src={phoneMockupDark}
              alt="MoniBot social payments shown inside a phone"
              className="hidden dark:block h-auto max-w-none select-none"
              style={{ width: 'min(98vw, 620px)' }}
              width="620"
              height="1102"
              fetchPriority="high"
            />
            {/* Cloud fade — soft gradient in the EXACT page bg color so the phone's
                bottom edge dissolves into the surface. Short height, no blur halo. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[12%]"
              style={{
                background:
                  'linear-gradient(to bottom, hsl(var(--mp-surface) / 0) 0%, hsl(var(--mp-surface) / 0.85) 65%, hsl(var(--mp-surface)) 100%)',