/**
 * OnChainIdentitySelector — modal for wallet-only sessions to pick a
 * display name resolved from on-chain sources (ENS, Base name, etc.).
 *
 * Persists the choice as `preferred_name` on the matching `wallet_profiles`
 * row via the `wallet-session` edge function (action: updateSettings).
 */

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnChainIdentity, type OnChainName } from "@/hooks/useOnChainIdentity";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: `0x${string}`;
  currentPreferredName: string | null;
  onSaved?: (next: string | null) => void;
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const SOURCE_LABEL: Record<string, string> = {
  ens: "ENS",
  basename: "Base name",
  celoname: "Celo",
  lens: "Lens",
  farcaster: "Farcaster",
};

export function OnChainIdentitySelector({
  open,
  onOpenChange,
  walletAddress,
  currentPreferredName,
  onSaved,
}: Props) {
  const { names, isLoading } = useOnChainIdentity(open ? walletAddress : null);
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (next: string | null) => {
    setSaving(next ?? "__address__");
    try {
      const { error } = await supabase.functions.invoke("wallet-session", {
        body: {
          action: "updateSettings",
          walletAddress,
          preferred_name: next,
        },
      });
      if (error) throw error;
      toast.success(next ? `Now showing as ${next}` : "Cleared display name");
      onSaved?.(next);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save");
    } finally {
      setSaving(null);
    }
  };

  const options: Array<OnChainName | { name: null; type: "address"; chain: "—" }> = [
    ...names,
    { name: null, type: "address", chain: "—" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Display name</DialogTitle>
          <DialogDescription className="text-xs">
            Pick a name to show across MoniPay. Resolved from public on-chain registries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Resolving on-chain names…
            </div>
          )}

          {!isLoading && options.map((opt) => {
            const isCurrent =
              (opt.name ?? null) === (currentPreferredName ?? null);
            const label = opt.name ?? shortAddr(walletAddress);
            const key = opt.name ?? "__address__";

            return (
              <button
                key={key}
                type="button"
                onClick={() => save(opt.name)}
                disabled={saving !== null}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors text-left disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">
                    {opt.type === "address"
                      ? "Address (default)"
                      : `${SOURCE_LABEL[opt.type] ?? opt.type} · ${opt.chain}`}
                  </p>
                </div>
                {saving === key ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : isCurrent ? (
                  <Check className="w-4 h-4 text-foreground" />
                ) : null}
              </button>
            );
          })}

          {!isLoading && names.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              No on-chain names found. Mint an ENS or Base name to claim one.
            </p>
          )}
        </div>

        <div className="flex justify-end mt-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
