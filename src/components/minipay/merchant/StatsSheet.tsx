import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';

interface Props { open: boolean; onClose: () => void; profileId: string; }

interface Stats { revenue: number; orders: number; customers: number; }

export function StatsSheet({ open, onClose, profileId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke('orders', {
          body: { action: 'stats', profileId },
        });
        const s = (data as any)?.stats;
        if (s) setStats({ revenue: Number(s.revenue ?? 0), orders: Number(s.orders ?? 0), customers: Number(s.customers ?? 0) });
        else setStats({ revenue: 0, orders: 0, customers: 0 });
      } catch { setStats({ revenue: 0, orders: 0, customers: 0 }); }
      finally { setLoading(false); }
    })();
  }, [open, profileId]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-t border-border/60 px-5 pt-6 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base font-semibold tracking-tight">Business stats</SheetTitle>
        </SheetHeader>
        {loading || !stats ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Revenue" value={`$${stats.revenue.toFixed(2)}`} />
            <Stat label="Orders" value={String(stats.orders)} />
            <Stat label="Customers" value={String(stats.customers)} />
          </div>
        )}
        <p className="mt-6 text-[11px] text-center text-muted-foreground">
          Live from your MiniPay merchant ledger.
        </p>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-foreground">{value}</p>
    </div>
  );
}