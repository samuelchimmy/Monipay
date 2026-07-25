import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'submitting' }
  | { status: 'done' }
  | { status: 'already' }
  | { status: 'invalid' };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'invalid' });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } },
        );
        const data = await res.json();
        if (data.valid) setState({ status: 'ready' });
        else if (data.reason === 'already_unsubscribed') setState({ status: 'already' });
        else setState({ status: 'invalid' });
      } catch {
        setState({ status: 'invalid' });
      }
    })();
  }, [token]);

  async function confirm() {
    if (!token) return;
    setState({ status: 'submitting' });
    const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
      body: { token },
    });
    if (error || !data?.success) {
      if (data?.reason === 'already_unsubscribed') setState({ status: 'already' });
      else setState({ status: 'invalid' });
      return;
    }
    setState({ status: 'done' });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight">Email preferences</h1>

        {state.status === 'loading' && (
          <div className="mt-6 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Checking your link…</p>
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              You'll stop receiving MoniPay emails to this address.
            </p>
            <button
              onClick={confirm}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state.status === 'submitting' && (
          <div className="mt-6 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Updating your preferences…</p>
          </div>
        )}

        {state.status === 'done' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <Check className="h-6 w-6 text-primary" />
            <p className="text-sm">You've been unsubscribed. Sorry to see you go.</p>
          </div>
        )}

        {state.status === 'already' && (
          <div className="mt-6 flex flex-col items-center gap-3 text-muted-foreground">
            <Check className="h-6 w-6" />
            <p className="text-sm">You're already unsubscribed. No further action needed.</p>
          </div>
        )}

        {state.status === 'invalid' && (
          <div className="mt-6 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <p className="text-sm">This link is invalid or has expired.</p>
          </div>
        )}

        <div className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">Back to MoniPay</Link>
        </div>
      </div>
    </main>
  );
}