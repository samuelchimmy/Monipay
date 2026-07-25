/**
 * WalletActivation — first-run setup for wallet-only sessions (Path C).
 *
 * Shown by ExternalWalletApp the moment a wagmi wallet connects and a
 * `wallet_profiles` row exists but has no `pay_tag` yet. The flow:
 *
 *   1. Claim a moniTag™ (input → cross-table availability check → save)
 *   2. Surface auto-detected on-chain names (ENS, Base name…) so the user
 *      knows they can also be paid at those identifiers.
 *   3. Optional social linking (X / Discord / Telegram / Bluesky) — uses the
 *      existing WalletMoniBotSettings panel.
 *
 * Visual: /minipay clean professional aesthetic (mp-* tokens).
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useDisconnect } from 'wagmi';
import { AtSign, Check, Loader2, Sparkles, LogOut, ArrowRight, Globe2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOnChainIdentity } from '@/hooks/useOnChainIdentity';
import { WalletMoniBotSettings } from '@/components/WalletMoniBotSettings';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { feedback } from '@/lib/feedback';

interface Props {
  walletAddress: `0x${string}`;
  profileId: string;
  onActivated: (payTag: string) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  ens: 'ENS',
  basename: 'Base name',
  celoname: 'Celo',
  lens: 'Lens',
  farcaster: 'Farcaster',
};

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function WalletActivation({ walletAddress, profileId, onActivated }: Props) {
  const { disconnect } = useDisconnect();
  const { names, isLoading: namesLoading } = useOnChainIdentity(walletAddress);

  const [tag, setTag] = useState('');
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [availability, setAvailability] = useState<
    | { state: 'idle' }
    | { state: 'valid' }
    | { state: 'invalid'; message: string }
    | { state: 'taken'; message: string }
    | { state: 'available' }
  >({ state: 'idle' });
  const [claimed, setClaimed] = useState<string | null>(null);

  const onChange = (v: string) => {
    const next = v.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    setTag(next);
    if (!next) {
      setAvailability({ state: 'idle' });
      return;
    }
    if (next.length < 3 || next.length > 20) {
      setAvailability({ state: 'invalid', message: '3–20 characters' });
      return;
    }
    setAvailability({ state: 'valid' });
  };

  const checkAvailability = async () => {
    if (availability.state !== 'valid' || !tag) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-session', {
        body: { action: 'checkPayTag', walletAddress, payTag: tag },
      });
      if (error) throw error;
      const res = data as { available?: boolean; reserved?: boolean; error?: string };
      if (res.available) {
        setAvailability({ state: 'available' });
      } else if (res.reserved) {
        setAvailability({ state: 'taken', message: 'Reserved by MoniPay' });
      } else {
        setAvailability({ state: 'taken', message: res.error ?? 'Already taken' });
      }
    } catch (err: any) {
      setAvailability({ state: 'taken', message: err?.message ?? 'Could not check' });
    } finally {
      setChecking(false);
    }
  };

  const claim = async () => {
    if (availability.state !== 'available') {
      await checkAvailability();
      return;
    }
    setClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-session', {
        body: { action: 'updateSettings', walletAddress, pay_tag: tag },
      });
      if (error) throw error;
      const profile = (data as any)?.profile;
      if (!profile?.pay_tag) throw new Error('Claim did not return a moniTag');
      feedback('success');
      toast.success(`@${profile.pay_tag} is yours`);
      setClaimed(profile.pay_tag as string);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not claim moniTag');
    } finally {
      setClaiming(false);
    }
  };

  const finish = () => {
    if (claimed) onActivated(claimed);
  };

  // Safety: auto-advance after a successful claim so a flaky second click
  // can never strand the user on this screen.
  useEffect(() => {
    if (!claimed) return;
    const t = setTimeout(() => onActivated(claimed), 1200);
    return () => clearTimeout(t);
  }, [claimed, onActivated]);

  return (
    <div
      data-minipay=""
      className="min-h-screen flex flex-col"
      style={{ background: 'hsl(var(--mp-surface))', color: 'hsl(var(--mp-ink))' }}
    >
      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MoniPayLogo size={24} color="hsl(var(--mp-ink))" animationMode="header" entranceOnMount />
          <span className="font-bold tracking-tight text-[14px]">Monipay</span>
        </div>
        <button
          type="button"
          onClick={() => {
            try { disconnect(); } catch { /* ignore */ }
            try { localStorage.removeItem("monipay_wallet_mode"); } catch { /* ignore */ }
            window.location.assign("/");
          }}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'hsl(var(--mp-muted))' }}
          aria-label="Disconnect wallet"
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnect
        </button>
      </header>

      <main className="flex-1 px-5 pb-10 max-w-md w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-4 mb-6"
        >
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--mp-muted))' }}>
            Activate wallet · {shortAddr(walletAddress)}
          </p>
          <h1 className="mt-2 text-[26px] font-extrabold tracking-tight leading-[1.1]">
            Claim your <span style={{ color: 'hsl(var(--mp-primary))' }}>moniTag™</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: 'hsl(var(--mp-muted))' }}>
            Your moniTag™ is how friends and merchants pay you on MoniPay. One name, every chain you support.
          </p>
        </motion.div>

        {/* 1 — MoniTag claim card */}
        <section
          className="mp-card p-5 mb-4"
          style={{ background: 'hsl(var(--mp-surface-elev))', border: '1px solid hsl(var(--mp-border))' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AtSign className="w-4 h-4" style={{ color: 'hsl(var(--mp-primary))' }} />
            <h2 className="text-sm font-semibold">Pick a moniTag™</h2>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: 'hsl(var(--mp-surface))',
              border: `1px solid ${
                availability.state === 'available'
                  ? 'hsl(var(--mp-primary))'
                  : availability.state === 'taken' || availability.state === 'invalid'
                  ? 'hsl(0 84% 60%)'
                  : 'hsl(var(--mp-border))'
              }`,
            }}
          >
            <span className="text-base font-bold opacity-50">@</span>
            <input
              type="text"
              value={tag}
              onChange={(e) => onChange(e.target.value)}
              placeholder="yourname"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              disabled={Boolean(claimed)}
              className="flex-1 bg-transparent text-base font-semibold outline-none placeholder:opacity-40"
              style={{ color: 'hsl(var(--mp-ink))' }}
            />
            {checking && <Loader2 className="w-4 h-4 animate-spin opacity-60" />}
            {!checking && availability.state === 'available' && (
              <Check className="w-4 h-4" style={{ color: 'hsl(var(--mp-primary))' }} />
            )}
          </div>

          {availability.state === 'invalid' && (
            <p className="text-[12px] mt-2" style={{ color: 'hsl(0 84% 60%)' }}>
              {availability.message} · letters, numbers, underscore only.
            </p>
          )}
          {availability.state === 'taken' && (
            <p className="text-[12px] mt-2" style={{ color: 'hsl(0 84% 60%)' }}>
              {availability.message}. Try another.
            </p>
          )}
          {availability.state === 'available' && !claimed && (
            <p className="text-[12px] mt-2" style={{ color: 'hsl(var(--mp-primary))' }}>
              @{tag} is available — claim it.
            </p>
          )}
          {claimed && (
            <p className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: 'hsl(var(--mp-primary))' }}>
              <ShieldCheck className="w-3.5 h-3.5" /> @{tag} claimed and linked to {shortAddr(walletAddress)}.
            </p>
          )}

          {!claimed && (
            <button
              type="button"
              onClick={availability.state === 'available' ? claim : checkAvailability}
              disabled={
                claiming ||
                checking ||
                availability.state === 'idle' ||
                availability.state === 'invalid'
              }
              className="mp-cta w-full mt-3 h-11 flex items-center justify-center gap-2 !rounded-xl disabled:opacity-50"
            >
              {claiming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : availability.state === 'available' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Claim @{tag}
                </>
              ) : (
                <>Check availability</>
              )}
            </button>
          )}
        </section>

        {/* 2 — Detected on-chain identities */}
        <section
          className="mp-card p-5 mb-4"
          style={{ background: 'hsl(var(--mp-surface-elev))', border: '1px solid hsl(var(--mp-border))' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Globe2 className="w-4 h-4" style={{ color: 'hsl(var(--mp-primary))' }} />
            <h2 className="text-sm font-semibold">Your on-chain names</h2>
          </div>
          <p className="text-[12px] mb-3" style={{ color: 'hsl(var(--mp-muted))' }}>
            People can also pay you at any of these identifiers — we detect them automatically from public registries.
          </p>

          {namesLoading ? (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: 'hsl(var(--mp-muted))' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up ENS, Base name…
            </div>
          ) : names.length === 0 ? (
            <div
              className="rounded-xl px-3 py-3 text-[12px]"
              style={{ background: 'hsl(var(--mp-surface))', color: 'hsl(var(--mp-muted))' }}
            >
              No on-chain names yet. Mint an ENS or Base name later — they'll show up here automatically.
            </div>
          ) : (
            <ul className="space-y-2">
              {names.map((n) => (
                <li
                  key={`${n.type}-${n.name}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: 'hsl(var(--mp-surface))' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--mp-ink))' }}>
                      {n.name}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.14em] mt-0.5" style={{ color: 'hsl(var(--mp-muted))' }}>
                      {SOURCE_LABEL[n.type] ?? n.type} · {n.chain}
                    </p>
                  </div>
                  <Check className="w-4 h-4" style={{ color: 'hsl(var(--mp-primary))' }} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3 — Social usernames */}
        <section
          className="mp-card p-5 mb-4"
          style={{ background: 'hsl(var(--mp-surface-elev))', border: '1px solid hsl(var(--mp-border))' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4" style={{ color: 'hsl(var(--mp-primary))' }} />
            <h2 className="text-sm font-semibold">Link your social handles</h2>
          </div>
          <p className="text-[12px] mb-3" style={{ color: 'hsl(var(--mp-muted))' }}>
            Connect X, Discord, Telegram or Bluesky so you can use MoniBot AI features and securely pay any username on those platforms. No initial wallet is needed for recipients, and you can equally receive payments. Payments arrive in this wallet.
          </p>

          <WalletMoniBotSettings profileId={profileId} walletAddress={walletAddress} />
        </section>

        {/* Continue */}
        <button
          type="button"
          onClick={finish}
          disabled={!claimed}
          className="mp-cta w-full h-12 flex items-center justify-center gap-2 !rounded-2xl disabled:opacity-50"
        >
          Continue to dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
        {!claimed && (
          <p
            className="text-[11px] text-center mt-3"
            style={{ color: 'hsl(var(--mp-muted))' }}
          >
            Claim your moniTag™ above to continue. You can add socials anytime.
          </p>
        )}
      </main>
    </div>
  );
}