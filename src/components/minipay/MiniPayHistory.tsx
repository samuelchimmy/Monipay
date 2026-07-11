/**
 * MiniPayHistory — compact MiniPay-styled transaction list.
 *
 * Used inside MiniPayDashboard's history sheet (Path B). The legacy
 * `TransactionHistory` component is intentionally left untouched and still
 * powers every other surface.
 *
 * Display rules requested by product:
 *   - Received: "From @monitag" (or social username / shortened 0x address)
 *               "To: You"
 *   - Sent:     "From: You"
 *               "To @monitag" (or social username / shortened 0x address)
 *   - Date + time underneath, small text, concise labels.
 *   - Tapping a row opens the standard detailed receipt modal.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownLeft, ArrowUpRight, X, Check, Copy, ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePayTag, Transaction } from '@/contexts/PayTagContext';
import { usePayTagLookup } from '@/hooks/usePayTagLookup';
import { shortenAddress } from '@/lib/wallet';
import { isMoniBotTag, VerifiedBadge } from '@/components/VerifiedBadge';
import { RecurringPaymentsSection } from '@/components/RecurringPaymentsSection';
import { MagicPayReceiptsSection } from '@/components/MagicPayReceiptsSection';
import { TransactionBadge, getTransactionBadges } from '@/components/TransactionBadge';

interface Props {
  onClose: () => void;
}

function fmtAddrOrTag(raw: string, payTagMap: Map<string, string>): string {
  if (!raw) return '—';
  if (raw.startsWith('0x')) {
    const tag = payTagMap.get(raw.toLowerCase());
    return tag ? `@${tag}` : shortenAddress(raw);
  }
  return raw.startsWith('@') ? raw : `@${raw}`;
}

function fmtDateTime(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function MiniPayHistory({ onClose }: Props) {
  const {
    transactions, syncTransactions, loadMoreTransactions,
    hasMoreTransactions, isLoadingMore, profile,
  } = usePayTag();
  const { batchLookupPayTags } = usePayTagLookup();

  const [payTagMap, setPayTagMap] = useState<Map<string, string>>(new Map());
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Trigger a fresh sync on open
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRefreshing(true);
      try { await syncTransactions(); } catch {}
      if (!cancelled) setRefreshing(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable key of addresses so the lookup doesn't refire each time the
  // transactions array reference changes during background syncs. This was
  // a major flicker source in the history sheet.
  const addrKey = useMemo(() => {
    const seen = new Set<string>();
    for (const t of transactions) {
      const a = (t as any).counterparty;
      if (typeof a === 'string' && a.startsWith('0x')) seen.add(a.toLowerCase());
    }
    return Array.from(seen).sort().join(',');
  }, [transactions]);

  useEffect(() => {
    if (!addrKey) return;
    const addrs = addrKey.split(',');
    batchLookupPayTags(addrs).then(setPayTagMap).catch(() => {});
  }, [addrKey, batchLookupPayTags]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const explorerUrl = useMemo(() => {
    if (!selectedTx?.txHash) return null;
    const net = selectedTx.metadata?.network;
    if (net === 'bsc') return `https://bscscan.com/tx/${selectedTx.txHash}`;
    if (net === 'tempo') return `https://explore.tempo.xyz/tx/${selectedTx.txHash}`;
    if (net === 'solana') return `https://solscan.io/tx/${selectedTx.txHash}`;
    if (net === 'celo') return `https://celoscan.io/tx/${selectedTx.txHash}`;
    return `https://basescan.org/tx/${selectedTx.txHash}`;
  }, [selectedTx]);

  return (
    <div className="text-foreground">
      <MagicPayReceiptsSection />
      <RecurringPaymentsSection />
      {transactions.length === 0 ? (
        <div className="py-10 text-center">
          {refreshing ? (
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
          ) : (
            <p className="text-xs text-muted-foreground">No transactions yet</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {transactions.map((tx) => {
            const isSent = tx.type === 'sent';
            const other = fmtAddrOrTag(
              tx.payerPayTag ? tx.payerPayTag : tx.counterparty,
              payTagMap,
            );
            const verified = isMoniBotTag(tx.payerPayTag || tx.counterparty);
            const fromLabel = isSent ? 'Sent from' : 'Received from';
            const fromValue = isSent ? 'You' : other;
            const toValue = isSent ? other : 'You';
            const showVerifiedOnFrom = !isSent && verified;
            const showVerifiedOnTo = isSent && verified;
            const badges = getTransactionBadges({
              source: tx.source,
              counterparty: tx.counterparty,
              metadata: tx.metadata,
              invoiceId: tx.invoiceId,
              payerPayTag: tx.payerPayTag,
            });
            return (
              <li key={tx.id}>
                {/* Note: Opaque bg-card without backdrop-blur prevents mobile scrolling lag/flickering and corner clipping bugs */}
                <button
                  type="button"
                  onClick={() => setSelectedTx(tx)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-2xl border border-border/60 bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSent ? 'bg-destructive/10' : 'bg-success/10'}`}>
                    {isSent
                      ? <ArrowUpRight className="w-4 h-4 text-destructive" />
                      : <ArrowDownLeft className="w-4 h-4 text-success" />}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-muted-foreground leading-tight truncate">
                        {fromLabel}
                      </p>
                      <p className="text-[12px] font-semibold text-foreground leading-tight mt-0.5 truncate flex items-center gap-1">
                        <span className="truncate">{fromValue}</span>
                        {showVerifiedOnFrom && <VerifiedBadge size={10} />}
                      </p>
                      {!isSent && badges.map((badge) => (
                        <div key={badge} className="mt-1 scale-[0.8] origin-left">
                          <TransactionBadge type={badge} size="sm" />
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-muted-foreground leading-tight truncate">
                        To
                      </p>
                      <p className="text-[12px] font-semibold text-foreground leading-tight mt-0.5 truncate flex items-center gap-1">
                        <span className="truncate">{toValue}</span>
                        {showVerifiedOnTo && <VerifiedBadge size={10} />}
                      </p>
                      {isSent && badges.map((badge) => (
                        <div key={badge} className="mt-1 scale-[0.8] origin-left">
                          <TransactionBadge type={badge} size="sm" />
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-muted-foreground leading-tight truncate">
                        Time
                      </p>
                      <p className="text-[10.5px] font-medium text-foreground leading-tight mt-0.5 truncate" title={fmtDateTime(tx.timestamp)}>
                        {fmtDateTime(tx.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[13px] font-bold ${isSent ? 'text-destructive' : 'text-success'}`}>
                      {isSent ? '-' : '+'}${tx.amount.toFixed(2)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMoreTransactions && (
        <div className="pt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadMoreTransactions()}
            disabled={isLoadingMore}
            className="text-xs"
          >
            {isLoadingMore ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}

      {/* Detailed receipt modal */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTx(null)}
            className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Receipt</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTx(null)} className="rounded-full h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {(() => {
                const isSent = selectedTx.type === 'sent';
                const other = fmtAddrOrTag(selectedTx.payerPayTag || selectedTx.counterparty, payTagMap);
                const otherVerified = isMoniBotTag(selectedTx.payerPayTag || selectedTx.counterparty);
                const counterpartyVerified = isMoniBotTag(selectedTx.counterparty);
                const fromLabel = isSent ? 'Sent from' : 'Received from';
                const fromValue = isSent ? <span>You</span> : (
                  <span className="inline-flex items-center gap-1">
                    {other}{otherVerified && <VerifiedBadge size={12} />}
                  </span>
                );
                const toValue = isSent ? (
                  <span className="inline-flex items-center gap-1">
                    {fmtAddrOrTag(selectedTx.counterparty, payTagMap)}
                    {counterpartyVerified && <VerifiedBadge size={12} />}
                  </span>
                ) : <span>You</span>;

                const badges = getTransactionBadges({
                  source: selectedTx.source,
                  counterparty: selectedTx.counterparty,
                  metadata: selectedTx.metadata,
                  invoiceId: selectedTx.invoiceId,
                  payerPayTag: selectedTx.payerPayTag,
                });

                return (
                  <>
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4 justify-center">
                        {badges.map((badge) => (
                          <TransactionBadge key={badge} type={badge} size="sm" />
                        ))}
                      </div>
                    )}
                    {/* Hero amount */}
                    <div
                      className="rounded-3xl p-5 mb-4 text-center border border-black/10 dark:border-white/10"
                      style={{
                        background: isSent
                          ? 'linear-gradient(160deg, hsl(0 70% 95%) 0%, hsl(154 60% 88%) 100%)'
                          : 'linear-gradient(160deg, #FCFF52 0%, #F4FB8E 55%, hsl(154 65% 82%) 100%)',
                        color: '#000',
                      }}
                    >
                      <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${isSent ? 'bg-black/10' : 'bg-black'}`}>
                        {isSent
                          ? <ArrowUpRight className="w-6 h-6 text-destructive" />
                          : <ArrowDownLeft className="w-6 h-6 text-[#FCFF52]" />}
                      </div>
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-black/60">
                        {isSent ? 'Sent' : 'Received'}
                      </p>
                      <p className="text-[34px] font-black tracking-tight tabular-nums leading-tight text-black mt-0.5">
                        {isSent ? '-' : '+'}${selectedTx.amount.toFixed(2)}
                      </p>
                      <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-black/55 mt-0.5">
                        {(selectedTx.metadata?.network || 'celo').toUpperCase()}
                      </p>
                    </div>

                    {/* 2-row × 3-col grid: From / To / Time */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: fromLabel, value: fromValue },
                        { label: 'To', value: toValue },
                        { label: 'Time', value: <span className="whitespace-normal">{fmtDateTime(selectedTx.timestamp)}</span> },
                      ].map((cell, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-border/60 bg-card p-2.5 min-w-0"
                        >
                          <p className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-muted-foreground leading-tight">
                            {cell.label}
                          </p>
                          <div className="text-[12px] font-semibold text-foreground mt-1 leading-snug break-words">
                            {cell.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Status + fees */}
                    <div className="rounded-2xl bg-muted/60 p-3.5 space-y-2 text-[12.5px]">
                      <Row label="Status" value={<span className="text-success flex items-center gap-1"><Check className="w-3.5 h-3.5" />Completed</span>} />
                      <Row label="Platform fee" value={`$${(selectedTx.fee || 0).toFixed(2)}`} />
                      <Row label="Network fee" value={<span className="text-primary">Sponsored</span>} />
                    </div>
                  </>
                );
              })()}

              <div className="rounded-2xl bg-muted/40 p-3.5 mt-3 space-y-2 text-[12.5px]">

                {profile?.wallet?.address && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Your wallet</p>
                    <button
                      onClick={() => handleCopy(profile.wallet.address)}
                      className="flex items-center gap-2 text-[11px] font-mono hover:text-primary"
                    >
                      {shortenAddress(profile.wallet.address)}
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
                {selectedTx.txHash && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-[11px] text-muted-foreground mb-1">Transaction</p>
                    <button
                      onClick={() => handleCopy(selectedTx.txHash!)}
                      className="flex items-center gap-2 text-[11px] font-mono hover:text-primary"
                    >
                      {shortenAddress(selectedTx.txHash)}
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {explorerUrl && (
                <Button
                  variant="outline"
                  className="w-full mt-4 rounded-xl"
                  onClick={() => window.open(explorerUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on Explorer
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right truncate">{value}</span>
    </div>
  );
}
