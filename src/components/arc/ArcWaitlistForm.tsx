/**
 * ArcWaitlistForm.tsx
 * Inline early-access signup for the Arc landing page.
 * Writes to `arc_waitlist` (RLS: insert-only).
 */
import { useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RL_KEY = 'arc_waitlist_submits';
const RL_WINDOW_MS = 60_000; // 1 minute
const RL_MAX = 3; // max 3 submits per minute per browser

function getRecentSubmits(): number[] {
  try {
    const raw = localStorage.getItem(RL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as number[];
    const now = Date.now();
    return arr.filter((t) => now - t < RL_WINDOW_MS);
  } catch {
    return [];
  }
}

function recordSubmit() {
  try {
    const recent = getRecentSubmits();
    recent.push(Date.now());
    localStorage.setItem(RL_KEY, JSON.stringify(recent));
  } catch {
    /* ignore */
  }
}

function hasSeenEmail(value: string): boolean {
  try {
    return localStorage.getItem(`arc_waitlist_email:${value}`) === '1';
  } catch {
    return false;
  }
}

function markSeenEmail(value: string) {
  try {
    localStorage.setItem(`arc_waitlist_email:${value}`, '1');
  } catch {
    /* ignore */
  }
}

type Variant = 'light' | 'onPrimary';

export function ArcWaitlistForm({
  variant = 'light',
  source = 'arc_landing_hero',
  placeholder = 'you@domain.com',
  cta = 'Notify me',
}: {
  variant?: Variant;
  source?: string;
  placeholder?: string;
  cta?: string;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  const onPrimary = variant === 'onPrimary';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || value.length > 254) {
      toast.error('Enter a valid email address');
      return;
    }
    // Per-email memory: if this browser already submitted this address, short-circuit
    if (hasSeenEmail(value)) {
      setStatus('done');
      toast.success("You're already on the list — we'll ping you when Arc opens.");
      return;
    }
    // Per-browser rate limit
    const recent = getRecentSubmits();
    if (recent.length >= RL_MAX) {
      toast.error('Too many attempts. Please wait a minute and try again.');
      return;
    }
    setStatus('loading');
    recordSubmit();
    const { error } = await supabase.from('arc_waitlist').insert({
      email: value,
      source,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 256) : null,
    });
    const isDuplicate = error?.code === '23505';
    if (error && !isDuplicate) {
      setStatus('idle');
      toast.error('Could not join the list. Try again in a moment.');
      return;
    }
    markSeenEmail(value);
    // Fire-and-forget confirmation email (skipped on duplicate signup)
    if (!isDuplicate) {
      supabase.functions
        .invoke('send-transactional-email', {
          body: {
            templateName: 'arc-waitlist-confirmation',
            recipientEmail: value,
            idempotencyKey: `arc-waitlist-${value}`,
            templateData: { email: value },
          },
        })
        .then(({ error: fnError }) => {
          if (fnError) console.warn('[arc-waitlist] confirmation email failed', fnError);
        })
        .catch((err) => {
          console.warn('[arc-waitlist] confirmation email threw', err);
        });
    }
    setStatus('done');
    toast.success(
      isDuplicate
        ? "You're already on the list — we'll ping you when Arc opens."
        : "You're on the list. Check your inbox for confirmation.",
    );
  }

  if (status === 'done') {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-full px-5 h-12 text-sm font-semibold"
        style={{
          background: onPrimary ? 'white' : 'hsl(var(--mp-primary) / 0.08)',
          color: onPrimary ? 'hsl(var(--mp-primary-strong))' : 'hsl(var(--mp-primary-strong))',
        }}
      >
        <Check className="h-4 w-4" />
        {"You're on the list"}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-[440px] items-center gap-2 rounded-full p-1 pl-4"
      style={{
        background: onPrimary ? 'rgba(255,255,255,0.14)' : 'hsl(var(--mp-surface))',
        border: onPrimary ? '1px solid rgba(255,255,255,0.35)' : '1px solid hsl(var(--mp-border))',
        backdropFilter: 'blur(6px)',
      }}
    >
      <input
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-60"
        style={{
          color: onPrimary ? 'white' : 'hsl(var(--mp-ink))',
        }}
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1.5 rounded-full px-5 h-10 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
        style={{
          background: onPrimary ? 'white' : 'hsl(var(--mp-primary))',
          color: onPrimary ? 'hsl(var(--mp-primary-strong))' : 'white',
          boxShadow: onPrimary ? 'none' : '0 10px 22px -10px hsl(var(--mp-primary) / 0.55)',
        }}
      >
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {cta}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

export default ArcWaitlistForm;