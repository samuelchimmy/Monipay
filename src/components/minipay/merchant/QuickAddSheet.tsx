import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { signedInvoke } from '@/lib/signedFetch';

interface Props { open: boolean; onClose: () => void; profileId: string; isLegacy: boolean; }

export function QuickAddSheet({ open, onClose, profileId, isLegacy }: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const p = Number(price);
    if (!name.trim() || !(p > 0)) return toast.error('Enter name and price');
    setSaving(true);
    try {
      const { data, error } = await signedInvoke('products', {
        body: {
          action: 'create',
          profileId,
          product: {
            name: name.trim(),
            price: p,
            category: 'Other',
            icon: 'package',
            description: '',
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Product added');
      setName(''); setPrice(''); onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not add product');
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-[28px] border-t border-border/60 px-5 pt-6 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base font-semibold tracking-tight">Quick add product</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" className="h-11" />
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (USDT)" inputMode="decimal" className="h-11" />
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add to catalog
          </button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Saved to your storefront instantly. Open Catalog for images, categories and pinning.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}