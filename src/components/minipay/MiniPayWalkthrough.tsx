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