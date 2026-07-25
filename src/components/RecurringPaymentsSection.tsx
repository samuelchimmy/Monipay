/**
 * RecurringPaymentsSection
 *
 * Surfaces active recurring payment series (a series = many pre-scheduled
 * one-off jobs sharing the same `seriesId`) at the top of Transaction
 * History on both MoniPay and MiniPay. Senders see series they originated
 * (with a Cancel action); recipients see series destined for their
 * MoniTag™.
 *
 * Data is fetched from the `list-recurring-payments` edge function because
 * the underlying `scheduled_jobs` table is RLS deny-all.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  RefreshCw, ChevronDown, ChevronUp, Clock, ArrowUpRight, ArrowDownLeft,
  X, Loader2, Check, AlertCircle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePayTag } from "@/contexts/PayTagContext";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

interface RecurringSeries {
  seriesId: string;
  direction: "sent" | "received" | "both";
  platform: string | null;
  chain: string | null;
  amountPerRun: number | null;
  recipients: string[];
  senderPayTag: string | null;
  senderWallet: string | null;
  senderId: string | null;
  originalText: string | null;
  intervalMs: number | null;
  intervalLabel: string | null;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string | null;
  canCancel: boolean;
  status?: "active" | "completed" | "cancelled" | "mixed";
}

interface RunDetail {
  id: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  amount: number | null;
  chain: string | null;
  recipients: string[];
  txHash: string | null;
  error: string | null;
  runIndex: number | null;
}

function currencyForChain(chain: string | null): string {
  switch ((chain || "").toLowerCase()) {
    case "bsc": return "USDT";
    case "celo": return "USDT";
    case "tempo": return "αUSD";
    case "solana": return "USDC";
    default: return "USDC";
  }
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const fmt = (n: number, u: string) => `${n}${u}`;
  const future = ms >= 0;
  if (abs < 60_000) return future ? "in <1m" : "just now";
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return future ? `in ${fmt(m, "m")}` : `${fmt(m, "m")} ago`;
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000);
    return future ? `in ${fmt(h, "h")}` : `${fmt(h, "h")} ago`;
  }
  const d = Math.round(abs / 86_400_000);
  return future ? `in ${fmt(d, "d")}` : `${fmt(d, "d")} ago`;
}

function platformLabel(p: string | null): string {
  if (!p) return "social";
  const l = p.toLowerCase();
  if (l === "x" || l === "twitter") return "X";
  return l.charAt(0).toUpperCase() + l.slice(1);
}

const PAGE_SIZE = 10;
const UPCOMING_TOAST_WINDOW_MS = 60 * 60 * 1000; // 1h
const TOASTED_STORAGE_KEY = "monipay_recurring_toasted_v1";

function loadToastedFromSession(): Set<string> {
  try {
    const raw = sessionStorage.getItem(TOASTED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistToasted(set: Set<string>) {
  try {
    sessionStorage.setItem(TOASTED_STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* */ }
}

export function RecurringPaymentsSection() {
  const { profile } = usePayTag() as any;
  // Pull primitive values so the load effect doesn't refire on every
  // profile-object identity change (the main flicker source).
  const profileId: string | undefined = profile?.id;
  const payTag: string | undefined = profile?.payTag;
  const walletAddress: string | undefined = profile?.wallet?.address;

  const [tab, setTab] = useState<"active" | "past">("active");
  const [series, setSeries] = useState<RecurringSeries[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Details drawer
  const [openSeries, setOpenSeries] = useState<RecurringSeries | null>(null);
  const [runs, setRuns] = useState<RunDetail[] | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);

  // Track which "next upcoming" we've already toasted so we don't spam.
  // Persisted in sessionStorage so the toast doesn't re-fire on every
  // remount of the history sheet within the same browser session.
  const toastedRef = useRef<Set<string>>(loadToastedFromSession());

  const fetchPage = useCallback(
    async (filter: "active" | "past", offset: number) => {
      const { data, error } = await supabase.functions.invoke(
        "list-recurring-payments",
        {
          body: {
            action: "list",
            profileId,
            payTag,
            walletAddress,
            filter,
            limit: PAGE_SIZE,
            offset,
          },
        }
      );
      if (error) throw error;
      return data as {
        series: RecurringSeries[];
        total: number;
        hasMore: boolean;
        nextUpcoming: {
          seriesId: string;
          nextRunAt: string;
          amount: number | null;
          chain: string | null;
          recipients: string[];
          direction: string;
        } | null;
      };
    },
    [profileId, payTag, walletAddress]
  );

  // Initial / tab-change load
  useEffect(() => {
    if (!profileId && !payTag) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchPage(tab, 0)
      .then((res) => {
        if (cancelled) return;
        setSeries(res.series || []);
        setTotal(res.total || 0);
        setHasMore(!!res.hasMore);

        // Toast for next upcoming run (once per session per seriesId).
        const up = res.nextUpcoming;
        if (up?.nextRunAt) {
          const eta = new Date(up.nextRunAt).getTime() - Date.now();
          if (
            eta > 0 &&
            eta <= UPCOMING_TOAST_WINDOW_MS &&
            !toastedRef.current.has(up.seriesId)
          ) {
            toastedRef.current.add(up.seriesId);
            persistToasted(toastedRef.current);
            const mins = Math.max(1, Math.round(eta / 60_000));
            const isOutgoing = up.direction === "sent" || up.direction === "both";
            const who = up.recipients?.[0] ? `@${up.recipients[0]}` : "recipient";
            toast(
              isOutgoing
                ? `Next recurring payment to ${who} in ~${mins}m`
                : `Next incoming recurring payment in ~${mins}m`,
              {
                id: `recurring-upcoming-${up.seriesId}`,
                description: up.amount != null
                  ? `$${Number(up.amount).toFixed(2)} on ${(up.chain || "").toUpperCase()}`
                  : undefined,
                icon: <Clock className="w-4 h-4" />,
              }
            );
          }
        }
      })
      .catch((err) => {
        console.warn("[RecurringPayments] load failed", err);
        if (!cancelled) { setSeries([]); setTotal(0); setHasMore(false); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profileId, payTag, walletAddress, tab, fetchPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(tab, series.length);
      setSeries((prev) => [...prev, ...(res.series || [])]);
      setHasMore(!!res.hasMore);
    } catch (err) {
      console.warn("[RecurringPayments] loadMore failed", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const openDetails = async (s: RecurringSeries) => {
    setOpenSeries(s);
    setRuns(null);
    setRunsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "list-recurring-payments",
        { body: { action: "details", profileId, payTag, seriesId: s.seriesId } }
      );
      if (error) throw error;
      setRuns(((data as any)?.runs || []) as RunDetail[]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load run history");
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const handleCancel = async (s: RecurringSeries) => {
    if (!profileId) return;
    if (!confirm(`Cancel this recurring payment? ${s.pendingCount} remaining run${s.pendingCount === 1 ? "" : "s"} will be stopped.`)) {
      return;
    }
    setCancellingId(s.seriesId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "list-recurring-payments",
        { body: { action: "cancel", profileId, seriesId: s.seriesId } }
      );
      if (error) throw error;
      toast.success(`Cancelled ${(data as any)?.cancelled ?? s.pendingCount} pending run${((data as any)?.cancelled ?? s.pendingCount) === 1 ? "" : "s"}`);
      // Dismiss any stale "next run" toast for this series and prevent it
      // from re-firing this session.
      try { toast.dismiss(`recurring-upcoming-${s.seriesId}`); } catch { /* */ }
      toastedRef.current.add(s.seriesId);
      persistToasted(toastedRef.current);
      setSeries((prev) => prev.filter((x) => x.seriesId !== s.seriesId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  };

  // Don't render the empty shell while we don't know if there's anything —
  // this avoids a pop-in/layout shift inside the history sheet.
  if (loading) return null;
  if (series.length === 0 && tab === "active") {
    // Still allow switching to "past" via a tiny entry-point.
    return (
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setTab("past")}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Clock className="w-3 h-3" /> View past recurring
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 border border-border rounded-2xl overflow-hidden bg-card/80 backdrop-blur-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <RefreshCw className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            Recurring payments
            <span className="text-[10px] font-normal text-muted-foreground">
              ({total})
            </span>
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {tab === "active"
              ? `${series.reduce((n, s) => n + s.pendingCount, 0)} upcoming run${series.reduce((n, s) => n + s.pendingCount, 0) === 1 ? "" : "s"} scheduled`
              : "Cancelled & completed series"}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div>
          {/* Tabs */}
          <div className="px-3 pt-1 pb-2 flex items-center gap-1 border-b border-border/50">
            {(["active", "past"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
                  tab === t
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "active" ? "Active" : "Past"}
              </button>
            ))}
          </div>

          <div className="px-2 pb-3 pt-1 space-y-1.5">
              {series.map((s) => {
                const isSent = s.direction === "sent" || s.direction === "both";
                const Icon = isSent ? ArrowUpRight : ArrowDownLeft;
                const colour = isSent ? "text-destructive" : "text-success";
                const bg = isSent ? "bg-destructive/10" : "bg-success/10";
                const symbol = currencyForChain(s.chain);
                const recipientLabel = s.recipients.length
                  ? s.recipients.map((r) => `@${r}`).join(", ")
                  : "—";
                const counterparty = isSent
                  ? recipientLabel
                  : s.senderPayTag ? `@${s.senderPayTag}` : "external sender";
                const completed = s.completedCount;
                const total = Math.max(s.totalCount, completed + s.pendingCount);

                return (
                  <div
                    key={s.seriesId}
                    className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${colour}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {isSent ? "To " : "From "}
                          <span className="font-semibold">{counterparty}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5 uppercase tracking-wide">
                            {platformLabel(s.platform)} · {String(s.chain || "").toUpperCase()}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Every {s.intervalLabel || "—"} · {completed} of {total} done
                          {s.nextRunAt && (
                            <>
                              {" · Next "}
                              {relTime(s.nextRunAt)}
                            </>
                          )}
                          {s.status && s.status !== "active" && (
                            <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">
                              · {s.status}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${colour}`}>
                          {isSent ? "-" : "+"}${(s.amountPerRun ?? 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{symbol}</p>
                      </div>
                    </div>

                    <div className="mt-2 pl-11 flex items-center gap-3">
                      <button
                        onClick={() => openDetails(s)}
                        className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Info className="w-3 h-3" />
                        Details
                      </button>
                      {s.canCancel && s.pendingCount > 0 && (
                        <button
                          onClick={() => handleCancel(s)}
                          disabled={cancellingId === s.seriesId}
                          className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          {cancellingId === s.seriesId ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Cancelling…
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3" />
                              Cancel remaining {s.pendingCount}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {hasMore && (
              <div className="pt-2 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  Load more
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details drawer */}
      <Sheet open={!!openSeries} onOpenChange={(o) => !o && setOpenSeries(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-[24px] px-5 pt-5 pb-8"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-base font-semibold tracking-tight">
              Recurring payment details
            </SheetTitle>
          </SheetHeader>
          {openSeries && (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-border/60 p-3.5 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {openSeries.direction === "sent" ? "Sending to" : openSeries.direction === "received" ? "Receiving from" : "With"}
                    </p>
                    <p className="text-sm font-semibold truncate">
                      {openSeries.direction === "received"
                        ? openSeries.senderPayTag ? `@${openSeries.senderPayTag}` : "external sender"
                        : openSeries.recipients.map((r) => `@${r}`).join(", ") || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold">
                      ${(openSeries.amountPerRun ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {currencyForChain(openSeries.chain)} · every {openSeries.intervalLabel || "—"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Done</p>
                    <p className="font-semibold">{openSeries.completedCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pending</p>
                    <p className="font-semibold">{openSeries.pendingCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cancelled/Failed</p>
                    <p className="font-semibold">{openSeries.failedCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next run</p>
                    <p className="font-semibold">{openSeries.nextRunAt ? relTime(openSeries.nextRunAt) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last run</p>
                    <p className="font-semibold">{openSeries.lastRunAt ? relTime(openSeries.lastRunAt) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="font-semibold">{openSeries.createdAt ? relTime(openSeries.createdAt) : "—"}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  All runs
                </p>
                {runsLoading ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : runs && runs.length > 0 ? (
                  <ul className="space-y-1.5">
                    {runs.map((r, i) => {
                      const ts = r.completedAt || r.scheduledAt;
                      const icon =
                        r.status === "completed" ? <Check className="w-3.5 h-3.5 text-success" /> :
                        r.status === "pending"   ? <Clock className="w-3.5 h-3.5 text-primary" /> :
                                                   <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
                      return (
                        <li
                          key={r.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-card/50"
                        >
                          <div className="flex-shrink-0">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">
                              Run {r.runIndex ?? i + 1}
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {r.status}
                              </span>
                            </p>
                            <p className="text-[10.5px] text-muted-foreground truncate">
                              {ts ? new Date(ts).toLocaleString() : "—"}
                              {r.error ? ` · ${r.error}` : ""}
                            </p>
                          </div>
                          <p className="text-[12px] font-semibold flex-shrink-0">
                            ${(r.amount ?? 0).toFixed(2)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] text-muted-foreground py-4 text-center">
                    No runs yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
