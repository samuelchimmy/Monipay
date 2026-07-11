import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BrandedQR } from '@/components/BrandedQR';

interface Props {
  open: boolean;
  onClose: () => void;
  walletAddress: `0x${string}`;
  payTag: string | null;
}

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

export function ReceiveQRSheet({ open, onClose, walletAddress, payTag }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-[28px] border-t border-border/60 px-5 pt-6 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base font-semibold tracking-tight">Receive USDT on Celo</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col items-center gap-4">
          <BrandedQR
            value={walletAddress}
            payTag={payTag ?? shortAddr(walletAddress)}
            subtitle="Celo · USDT"
            size={220}
            showActions
            copyValue={walletAddress}
          />
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Send USDT on Celo to this address. Other tokens or networks may be lost.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}