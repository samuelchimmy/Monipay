/**
 * MiniPayWalkthrough — 3-step floating onboarding overlay.
 * Renders only on first MiniPay app open (localStorage flag). Watches app
 * state to auto-advance, and shows a celebratory completion screen.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const LS_KEY = 'minipay_walkthrough_done_v1';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap';

function ensureCaveat() {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = FONT_HREF;
  document.head.appendChild(l);
}

type Rect = { top: number; left: number; width: number; height: number };

function readRect(sel: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${sel}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface StepDef {
  id: 'monitag' | 'allowance' | 'socials';
  target: string;
  text: string;
  side: 'left' | 'right' | 'bottom-right';
}

const STEPS: StepDef[] = [
  {
    id: 'monitag',
    target: 'monitag-claim',
    text: 'First, claim your MoniTag™ — your name across MoniPay.',
    side: 'left',
  },
  {
    id: 'allowance',
    target: 'allowance-row',
    text: 'Next, approve a spending allowance so MoniBot can pay on your behalf.',
    side: 'bottom-right',
  },
  {
    id: 'socials',
    target: 'socials-row',
    text: 'Finally, link a social account so people can pay you by handle.',
    side: 'right',
  },
];

interface Props {
  walletAddress: `0x${string}`;
  payTag: string | null;
  socialCount: number;
}

export function MiniPayWalkthrough({ walletAddress, payTag, socialCount }: Props) {
  const [active, setActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [done, setDone] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [allowanceOk, setAllowanceOk] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    ensureCaveat();
  }, []);

  // Poll allowance state from wallet-session.
  useEffect(() => {
    if (!active || done) return;
    let cancelled = false;
    const check = async () => {
      try {
        const { data } = await supabase.functions.invoke('wallet-session', {
          body: { action: 'get', walletAddress },
        });
        const amt = Number((data as any)?.profile?.bot_allowance_amount ?? 0);
        if (!cancelled && amt > 0) setAllowanceOk(true);
      } catch {
        /* non-fatal */
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletAddress, active, done]);

  // Track step completion → auto-advance.
  const completed = useMemo(
    () => ({
      monitag: !!payTag,
      allowance: allowanceOk,
      socials: socialCount > 0,
    }),
    [payTag, allowanceOk, socialCount],
  );

  useEffect(() => {
    if (!active || done || transitioning) return;
    const cur = STEPS[stepIdx];
    if (cur && completed[cur.id]) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, stepIdx, active, done, transitioning]);

  // Re-read target rect on step change, resize, scroll.
  useLayoutEffect(() => {
    if (!active || done || transitioning) return;
    const cur = STEPS[stepIdx];
    if (!cur) return;
    let raf = 0;
    const update = () => {
      const r = readRect(cur.target);
      setRect(r);
    };
    update();
    // Retry a few times — target may mount after deps load.
    let tries = 0;
    const t = setInterval(() => {
      update();
      if (++tries > 20) clearInterval(t);
    }, 200);
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      clearInterval(t);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [stepIdx, active, done, transitioning]);

  function advance() {
    setTransitioning(true);
    setTimeout(() => {
      if (stepIdx >= STEPS.length - 1) {
        setDone(true);
        setTransitioning(false);
      } else {
        setStepIdx((i) => i + 1);
        setTransitioning(false);
      }
    }, 600);
  }

  function dismiss() {
    try {
      localStorage.setItem(LS_KEY, '1');
    } catch {
      /* ignore */
    }
    setActive(false);
  }

  if (!active) return null;

  if (done) return <CompletionScreen onClose={dismiss} />;

  const cur = STEPS[stepIdx];

  // Compute bubble position from target rect.
  const bubble = computeBubble(rect, cur.side);

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-none"
      style={{ fontFamily: '"Caveat", cursive' }}
      aria-live="polite"
    >
      {/* Soft scrim so the highlighted area pops */}
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />

      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter id="mp-wobble">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="1.6" />
          </filter>
          <marker
            id="mp-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L9,5 L0,10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
      </svg>

      {/* Skip — always tappable */}
      <button
        type="button"
        onClick={dismiss}
        className="pointer-events-auto absolute top-3 right-3 z-10 rounded-full bg-black/85 text-white dark:bg-white dark:text-black text-xs px-3 py-1.5 flex items-center gap-1 shadow"
        style={{ fontFamily: 'inherit', fontSize: 16 }}
      >
        Skip <X className="w-3.5 h-3.5" />
      </button>

      {/* Target pulse */}
      <AnimatePresence>
        {rect && !transitioning && (
          <motion.div
            key={`pulse-${cur.id}`}
            initial={{ opacity: 0, scale: 0.6 }}