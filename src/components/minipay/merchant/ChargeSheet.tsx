/**
 * ChargeSheet — legacy-style merchant charge flow for MiniPay.
 *
 * Modes:
 *  - QR Charge: keypad → creates a MoniPay payment link → shows a
 *    branded QR + share/copy. Polls `orders` (merchant_profile_id +
 *    payment_link_id) every 4s. When an order is completed, shows the
 *    success modal (buyer's wallet receives a receipt automatically via
 *    the relay-payment + orders pipeline).
 *  - Invoice MoniTag: keypad → enters a MoniTag → creates an invoice
 *    via the `invoices` edge function. Buyer gets a Pay-now link they
 *    can open from their MiniPay dashboard.
 *
 * No PIN / signing is required for any of these DB writes — the
 * wallet session is the authorization.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Copy, Check, Share2, RotateCcw, Delete,
  QrCode, AtSign, ArrowLeft, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { BrandedQR } from '@/components/BrandedQR';
import { supabase } from '@/integrations/supabase/client';
import { signedInvoke } from '@/lib/signedFetch';
import { feedback } from '@/lib/feedback';

interface Props {
  open: boolean;
  onClose: () => void;
  profileId: string;
  payTag: string | null;
}

type Mode = 'pick' | 'qr' | 'monitag';
type Stage = 'compose' | 'await' | 'success';

export function ChargeSheet({ open, onClose, profileId, payTag }: Props) {
  const [mode, setMode] = useState<Mode>('pick');
  const [stage, setStage] = useState<Stage>('compose');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [recipientTag, setRecipientTag] = useState('');
  const [busy, setBusy] = useState(false);

  const [link, setLink] = useState<{ id: string; code: string; url: string } | null>(null);
  const [invoice, setInvoice] = useState<{ id: string; url: string } | null>(null);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setMode('pick'); setStage('compose');
      setAmount(''); setMemo(''); setRecipientTag('');
      setLink(null); setInvoice(null); setPaidBy(null);
      setBusy(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
  }, [open]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const num = Number(amount || '0');
  const valid = num > 0 && num < 100000;

  const press = (k: string) => {
    feedback('tap');
    if (k === 'back') return setAmount((a) => a.slice(0, -1));
    if (k === '.' && amount.includes('.')) return;
    if (k === '.' && amount === '') return setAmount('0.');
    const next = amount + k;
    if (next.includes('.') && next.split('.')[1].length > 2) return;
    setAmount(next);
  };

  const startPolling = (linkId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data, error } = await signedInvoke('orders', {
          body: { action: 'list', profileId, status: 'completed', limit: 10 },
        });
        if (error) return;
        const orders: any[] = (data as any)?.orders ?? [];
        const paid = orders.find((o) => o.payment_link_id === linkId && o.status === 'completed');
        if (paid) {
          setPaidBy(paid.payer_pay_tag ? `@${paid.payer_pay_tag}` : (paid.payer_wallet ?? null));
          setStage('success');
          feedback('success');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* keep polling */ }
    }, 4000);
  };

  const createQR = async () => {
    if (!valid) return toast.error('Enter a valid amount');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-links', {
        body: {
          action: 'create',
          profileId,
          name: memo || `Charge ${num.toFixed(2)} USDT`,
          description: memo || undefined,
          amount: num,
          usageLimit: 1,
        },
      });
      if (error) throw error;
      const pl = (data as any)?.paymentLink ?? data;
      const code = pl?.link_code;
      const id = pl?.id;
      if (!code || !id) throw new Error('No link returned');
      const url = `https://monipay.xyz/pay/${code}`;
      setLink({ id, code, url });
      setStage('await');
      feedback('modalOpen');
      startPolling(id);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not create charge');
    } finally {
      setBusy(false);
    }
  };

  const createInvoice = async () => {
    if (!valid) return toast.error('Enter a valid amount');
    const tag = recipientTag.trim().replace(/^@/, '').toLowerCase();
    if (!tag) return toast.error('Enter a MoniTag to invoice');
    setBusy(true);
    try {
      const { data, error } = await signedInvoke('invoices', {
        body: {
          action: 'create',
          senderProfileId: profileId,
          recipientPayTag: tag,
          amount: num,
          memo: memo || undefined,
        },
      });
      if (error) throw error;
      const inv = (data as any)?.invoice ?? data;
      const id = inv?.id;
      if (!id) throw new Error('No invoice id returned');
      const url = `https://monipay.xyz/invoice/${id}`;
      setInvoice({ id, url });
      setStage('success');
      setPaidBy(`@${tag}`);
      feedback('success');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not send invoice');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = link?.url ?? invoice?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Link copied');
    } catch { toast.error('Could not copy'); }
  };

  const share = async () => {
    const url = link?.url ?? invoice?.url;
    if (!url) return;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Pay with MoniPay',
          text: `Pay ${num.toFixed(2)} USDT`,
          url,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const reset = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setStage('compose');
    setAmount(''); setMemo(''); setRecipientTag('');
    setLink(null); setInvoice(null); setPaidBy(null);
  };

  const keys = useMemo(() => ['1','2','3','4','5','6','7','8','9','.','0','back'], []);

  const title =
    stage === 'success' ? 'Payment received'
    : mode === 'pick'   ? 'Charge customer'
    : mode === 'qr'     ? 'QR charge'
    :                     'Invoice MoniTag';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-[28px] border-t border-border/60 px-5 pt-6 pb-8">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            {mode !== 'pick' && stage === 'compose' && (
              <button
                type="button"
                onClick={() => setMode('pick')}
                className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
                aria-label="Back"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <SheetTitle className="text-base font-semibold tracking-tight">{title}</SheetTitle>
          </div>
        </SheetHeader>

        {/* SUCCESS */}
        {stage === 'success' && (
          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
              <Check className="w-8 h-8" strokeWidth={3} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">
                ${num.toFixed(2)} USDT
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                {invoice
                  ? <>Invoice sent to <span className="font-semibold text-foreground">{paidBy}</span></>
                  : <>Paid by <span className="font-semibold text-foreground">{paidBy ?? 'customer'}</span></>}
              </p>
              {memo && <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{memo}"</p>}
            </div>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              {invoice
                ? 'They\'ll see this invoice in their MiniPay dashboard. Receipt is automatic when they pay.'
                : 'Receipt was delivered to the buyer\'s wallet history.'}
            </p>
            <div className="w-full grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={reset}
                className="h-11 rounded-xl bg-muted text-foreground text-sm font-semibold flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" /> New charge
              </button>
              <button type="button" onClick={onClose}
                className="h-11 rounded-xl bg-foreground text-background text-sm font-semibold">
                Done
              </button>
            </div>
          </div>
        )}

        {/* MODE PICKER */}
        {stage === 'compose' && mode === 'pick' && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { feedback('tap'); setMode('qr'); }}
              className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-left active:scale-[0.98] transition-all"
            >
              <div className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center mb-2">
                <QrCode className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">QR charge</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Show a QR for in-person payment</p>
            </button>
            <button
              type="button"
              onClick={() => { feedback('tap'); setMode('monitag'); }}
              className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-left active:scale-[0.98] transition-all"
            >
              <div className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center mb-2">
                <AtSign className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">Invoice MoniTag</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Bill a customer by their @tag</p>
            </button>
            {payTag && (
              <p className="col-span-2 text-[11px] text-center text-muted-foreground pt-1">
                You're charging as <span className="font-semibold text-foreground">@{payTag}</span> on Celo
              </p>
            )}
          </div>
        )}

        {/* COMPOSE — QR or MONITAG (shared keypad) */}
        {stage === 'compose' && mode !== 'pick' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-muted/40 border border-border/60 px-4 py-6 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Amount (USDT)</p>
              <p className="mt-1 text-5xl font-extrabold tabular-nums text-foreground leading-none">
                ${amount || '0'}
              </p>
            </div>

            {mode === 'monitag' && (
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={recipientTag}
                  onChange={(e) => setRecipientTag(e.target.value.replace(/^@/, '').slice(0, 32))}
                  placeholder="customer-monitag"
                  className="h-11 pl-9"
                />
              </div>
            )}

            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 80))}
              placeholder="What's it for? (optional)"
              className="h-11"
            />
            <div className="grid grid-cols-3 gap-2">
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  className="h-12 rounded-xl bg-muted/60 hover:bg-muted text-foreground font-semibold text-lg active:scale-[0.97] transition-all flex items-center justify-center"
                >
                  {k === 'back' ? <Delete className="w-5 h-5" /> : k}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!valid || busy || (mode === 'monitag' && !recipientTag.trim())}
              onClick={mode === 'qr' ? createQR : createInvoice}
              className="w-full h-12 rounded-xl bg-foreground text-background text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy
                ? (mode === 'qr' ? 'Creating QR…' : 'Sending invoice…')
                : (mode === 'qr' ? 'Show QR' : 'Send invoice')}
            </button>
          </div>
        )}

        {/* AWAIT (QR + polling) */}
        {stage === 'await' && link && (
          <div className="mt-5 flex flex-col items-center gap-4">
            <BrandedQR
              value={link.url}
              payTag={payTag ?? 'charge'}
              subtitle={`$${num.toFixed(2)} USDT`}
              size={220}
              showActions={false}
              copyValue={link.url}
            />
            <div className="w-full rounded-xl border border-border/60 px-3 py-2 text-[12px] font-mono text-foreground/80 truncate">
              {link.url}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <Sparkles className="w-3.5 h-3.5" />
              Waiting for payment…
            </div>
            <div className="w-full grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="h-11 rounded-xl bg-muted text-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={share}
                className="h-11 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Cancel & start over
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}