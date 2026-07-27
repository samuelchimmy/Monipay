import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, Sparkles, Clock, Check, RotateCcw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePayTag } from "@/contexts/PayTagContext";

type IouChain = "celo" | string;

interface MagicPayIou {
  id: string;
  iou_id: string;
  status: "pending" | "claimed" | "expired" | "refunded";
  displayStatus: "pending" | "claimed" | "expired" | "refunded";
  amount: number;
  token_symbol: string;
  chain: IouChain;
  platform: string | null;
  recipient_identifier: string;
  expiry: string;
  created_at: string;
  claimed_at: string | null;
  tx_hash_create: string | null;
  tx_hash_claim: string | null;
}

function explorerForChain(chain: IouChain, hash: string): { url: string; label: string } {
  return { url: `https://celoscan.io/tx/${hash}`, label: "CeloScan" };
}

function platformLabel(p: string | null): string {
  if (!p) return "social";
  const lower = p.toLowerCase();
  if (lower === "x" || lower === "twitter") return "X";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function statusMeta(status: MagicPayIou["displayStatus"]) {
  switch (status) {
    case "claimed": return { Icon: Check, color: "text-success", bg: "bg-success/10", label: "Claimed" };
    case "refunded": return { Icon: RotateCcw, color: "text-muted-foreground", bg: "bg-muted", label: "Refunded" };
    case "expired": return { Icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Expired" };
    default: return { Icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", label: "Pending" };
  }
}

export function MagicPayReceiptsSection() {
  const { profile } = usePayTag();
  const [ious, setIous] = useState<MagicPayIou[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const profileId = (profile as any)?.id as string | undefined;

  useEffect(() => {
    if (!profileId) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("claim-iou", {
          body: { action: "list", profileId, limit: 50 },
        });
        if (cancelled) return;
        if (error) {
          console.warn("[MagicPayReceipts] load failed", error);
          setIous([]);
        } else {
          setIous(((data as any)?.ious || []) as MagicPayIou[]);
        }
      } catch (err) {
        console.warn("[MagicPayReceipts] error", err);
        if (!cancelled) setIous([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [(profile as any)?.id]);

  if (loading) return null;
  if (ious.length === 0) return null;

  const pendingCount = ious.filter(i => i.displayStatus === "pending").length;

  return (
    <div className="mb-4 border border-border rounded-2xl overflow-hidden bg-card">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-purple-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            MagicPay receipts
            <span className="text-[10px] font-normal text-muted-foreground">({ious.length})</span>
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {pendingCount > 0 ? `${pendingCount} awaiting claim` : "All settled"}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-3 pt-1 space-y-1.5">
              {ious.map((iou) => {
                const { Icon, color, bg, label } = statusMeta(iou.displayStatus);
                const txHash = iou.tx_hash_claim || iou.tx_hash_create;
                const explorer = txHash ? explorerForChain(iou.chain, txHash) : null;
                
                const isSent = (iou as any).sender_profile_id === profileId;
                const counterparty = isSent
                  ? (iou.recipient_identifier?.startsWith("@") ? iou.recipient_identifier : `@${iou.recipient_identifier}`)
                  : `@${(iou as any).sender_pay_tag || "unknown"}`;
                const directionLabel = isSent ? "Sent to" : "Received from";

                return (
                  <div
                    key={iou.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        <span className="text-xs text-muted-foreground mr-1.5 font-normal">{directionLabel}</span>
                        {counterparty}
                        <span className="text-[10px] text-muted-foreground ml-1.5 uppercase tracking-wide font-normal">
                          {platformLabel(iou.platform)} · {String(iou.chain).toUpperCase()}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {label} · {new Date(iou.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        ${Number(iou.amount).toFixed(2)}
                      </p>
                      {explorer && (
                        <button
                          onClick={() => window.open(explorer.url, "_blank")}
                          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 mt-0.5"
                        >
                          {explorer.label}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
