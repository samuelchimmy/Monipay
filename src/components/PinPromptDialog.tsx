import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface PinPromptDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
}

export function PinPromptDialog({
  open,
  title = "Enter your PIN",
  description = "Enter your PIN to authorize this transaction.",
  confirmLabel = "Confirm",
  onCancel,
  onSubmit,
}: PinPromptDialogProps) {
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      // Focus shortly after open so iOS PWA shows the keyboard reliably
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin.trim()) return;
    onSubmit(pin.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-[340px] rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Shield className="w-5 h-5 text-foreground" />
          </div>
          <DialogTitle className="text-center text-base">{title}</DialogTitle>
          <DialogDescription className="text-center text-xs leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <Input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="••••"
            maxLength={8}
            className="h-12 text-center text-lg font-bold tracking-[0.5em] rounded-xl"
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="h-11 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!pin.trim()}
              className="h-11 rounded-xl"
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
