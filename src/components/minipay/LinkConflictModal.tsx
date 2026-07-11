/**
 * LinkConflictModal — friendly UI for the cross-context 409
 * returned by `social-identity` when a social account is already
 * linked to another MoniPay context (legacy <-> wallet_profiles).
 *
 * Triggered by a `social-link-conflict` postMessage from the OAuth
 * popup callbacks (Callback.tsx, TelegramCallback.tsx, x-callback.tsx).
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export interface LinkConflictDetail {
  message: string;
  payTag?: string | null;
  platform?: "x" | "discord" | "telegram";
}

interface Props {
  open: boolean;
  detail: LinkConflictDetail | null;
  onClose: () => void;
}

export function LinkConflictModal({ open, detail, onClose }: Props) {
  const platformLabel =
    detail?.platform === "x" ? "X" :
    detail?.platform === "discord" ? "Discord" :
    detail?.platform === "telegram" ? "Telegram" :
    "account";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-destructive" />
          </div>
          <DialogTitle className="text-base font-semibold">
            Account is linked to another user
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            This {platformLabel} account is already linked to
            {detail?.payTag ? <> <span className="font-semibold text-foreground">@{detail.payTag}</span></> : " another MoniPay user"}.
            Unlink it there first to use it here.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center pt-2">
          <Button onClick={onClose} className="w-full h-11 rounded-xl">
            Back to Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}