import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Users, Receipt, DollarSign, Activity, Zap, Share2, RefreshCw, Globe } from "lucide-react";
import { toast } from "sonner";

const STATS_URL = "https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/platform-stats";

type Stats = {
  generated_at: string;
  methodology: { chains_tracked: string[]; estimate_uplift: number; notes: string[] };
  headline: any;
  growth: any;
  users: any;
  by_chain: Record<string, { tx_count: number; volume_usd: number; platform_fees_usd: number; gas_paid_usd: number }>;
  magicpay: any;
  commerce: any;
  operations: any;
  subscriptions: any;
};

const fmtUsd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000 ? `$${(n / 1_000).toFixed(2)}K` :
  `$${(n || 0).toFixed(2)}`;
const fmtNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` :
  `${n || 0}`;

export default function Stats() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(STATS_URL, { method: "GET" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const share = async () => {
    const url = `${window.location.origin}/stats`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "MoniPay — Live Traction", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Public link copied");
      }
    } catch {}
  };

  const h = data?.headline;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <Helmet>
        <title>MoniPay — Live Platform Traction</title>
        <meta name="description" content="Real-time MoniPay protocol metrics: transactions, volume, DAU, gas, platform fees across Base, Celo, BSC, Ink, Tempo, Solana, Arc." />
        <meta property="og:title" content="MoniPay — Live Platform Traction" />
        <meta property="og:description" content="Live, public dashboard of MoniPay's on-chain activity across 7 chains." />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2">MoniPay · Live Traction</p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Public Platform Stats</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Auto-refreshing aggregate metrics compiled across all supported chains directly from ledger records and verified smart contract events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button size="sm" onClick={share}><Share2 className="w-4 h-4 mr-1.5" />Share</Button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : err ? (
          <Card><CardContent className="py-10 text-center text-sm text-destructive font-medium">Failed to load: {err}</CardContent></Card>
        ) : data && h ? (
          <>
            {/* Headline cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <HeadlineCard icon={<DollarSign className="w-5 h-5" />} label="Total Volume" actual={fmtUsd(h.total_volume_usd_actual)} accent="from-emerald-500/15 to-emerald-500/5" />
              <HeadlineCard icon={<Receipt className="w-5 h-5" />} label="Total Transactions" actual={fmtNum(h.total_transactions_actual)} accent="from-blue-500/15 to-blue-500/5" />
              <HeadlineCard icon={<Users className="w-5 h-5" />} label="Total Users" actual={fmtNum(h.total_users)} sub={`DAU ${fmtNum(h.dau)} · MAU ${fmtNum(h.mau)}`} accent="from-violet-500/15 to-violet-500/5" />
              <HeadlineCard icon={<TrendingUp className="w-5 h-5" />} label="Platform Fees" actual={fmtUsd(h.total_platform_fees_usd_actual)} accent="from-amber-500/15 to-amber-500/5" />
              <HeadlineCard icon={<Zap className="w-5 h-5" />} label="Gas Paid (USD)" actual={fmtUsd(h.total_gas_paid_usd_actual)} accent="from-rose-500/15 to-rose-500/5" />
              <HeadlineCard icon={<Activity className="w-5 h-5" />} label="Daily Active" actual={fmtNum(h.dau)} sub={`WAU ${fmtNum(h.wau)}`} accent="from-cyan-500/15 to-cyan-500/5" />
              <HeadlineCard icon={<DollarSign className="w-5 h-5" />} label="MRR (subs)" actual={fmtUsd(h.subs_mrr_usd)} sub={`ARR ${fmtUsd((data.subscriptions?.arr_usd) || 0)}`} accent="from-lime-500/15 to-lime-500/5" />
              <HeadlineCard icon={<Globe className="w-5 h-5" />} label="Chains Live" actual={`${data.methodology.chains_tracked.length}`} sub={data.methodology.chains_tracked.join(" · ")} accent="from-slate-500/15 to-slate-500/5" />
            </div>

            {/* By chain */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">By Chain</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left py-2">Chain</th>
                        <th className="text-right">Txs</th>
                        <th className="text-right">Volume (USD)</th>
                        <th className="text-right">Platform Fees</th>
                        <th className="text-right">Gas Paid</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {Object.entries(data.by_chain).map(([chain, m]) => (
                        <tr key={chain} className="border-t border-border/60">
                          <td className="py-2 font-bold uppercase text-foreground">{chain}</td>
                          <td className="text-right">{fmtNum(m.tx_count)}</td>
                          <td className="text-right">{fmtUsd(m.volume_usd)}</td>
                          <td className="text-right">{fmtUsd(m.platform_fees_usd)}</td>
                          <td className="text-right">{fmtUsd(m.gas_paid_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Growth & MagicPay */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Growth</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Txs (24h)" value={fmtNum(data.growth.txs_24h)} />
                  <Stat label="Txs (7d)" value={fmtNum(data.growth.txs_7d)} />
                  <Stat label="Txs (30d)" value={fmtNum(data.growth.txs_30d)} />
                  <Stat label="New users (7d)" value={fmtNum(data.growth.new_users_7d)} />
                  <Stat label="New users (30d)" value={fmtNum(data.growth.new_users_30d)} />
                  <Stat label="Users w/ PayTag" value={fmtNum(data.users.with_paytag)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">MagicPay (IOUs)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Total" value={fmtNum(data.magicpay.total)} />
                  <Stat label="Claimed" value={fmtNum(data.magicpay.claimed)} />
                  <Stat label="Pending" value={fmtNum(data.magicpay.pending)} />
                  <Stat label="Expired" value={fmtNum(data.magicpay.expired)} />
                  <Stat label="Volume (Claimed)" value={fmtUsd(data.magicpay.volume_claimed_usd)} />
                  <Stat label="Volume (Pending)" value={fmtUsd(data.magicpay.volume_pending_usd)} />
                </CardContent>
              </Card>
            </div>

            {/* Ops & subs */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Commerce & Identity</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Storefronts" value={fmtNum(data.commerce.storefronts)} />
                  <Stat label="Products" value={fmtNum(data.commerce.products)} />
                  <Stat label="Orders (paid)" value={fmtNum(data.commerce.orders_paid)} />
                  <Stat label="Orders (pending)" value={fmtNum(data.commerce.orders_pending)} />
                  <Stat label="Order Volume" value={fmtUsd(data.commerce.orders_volume_usd)} />
                  <Stat label="Invoices" value={fmtNum(data.commerce.invoices)} />
                  <Stat label="Payment Links" value={fmtNum(data.commerce.payment_links)} />
                  <Stat label="Customers" value={fmtNum(data.commerce.customers)} />
                  <Stat label="API Keys" value={fmtNum(data.operations.api_keys)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Operations & Subs</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Activations Funded" value={fmtNum(data.operations.activations_funded)} />
                  <Stat label="Activation Gas" value={fmtUsd(data.operations.activation_gas_usd)} />
                  <Stat label="Campaigns" value={fmtNum(data.operations.campaigns)} />
                  <Stat label="Bot Logs" value={fmtNum(data.operations.bot_logs)} />
                  <Stat label="Support Tickets" value={fmtNum(data.operations.support_tickets)} />
                  <Stat label="Feedback" value={fmtNum(data.operations.feedback)} />
                  <Stat label="Merchant Subs" value={fmtNum(data.subscriptions.merchant_subs_active)} />
                  <Stat label="Infra Subs" value={fmtNum(data.subscriptions.infra_subs_active)} />
                  <Stat label="MRR" value={fmtUsd(data.subscriptions.mrr_usd)} />
                  <Stat label="ARR" value={fmtUsd(data.subscriptions.arr_usd)} />
                  <Stat label="Arc Waitlist" value={fmtNum(data.operations.arc_waitlist)} />
                </CardContent>
              </Card>
            </div>

            {/* Methodology */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Methodology</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-1">
                  {data.methodology.chains_tracked.map(c => (
                    <Badge key={c} variant="outline" className="uppercase font-mono text-[10px]">{c}</Badge>
                  ))}
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {data.methodology.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
                <p className="pt-2 text-[10px] font-mono opacity-70">Generated {new Date(data.generated_at).toLocaleString()} · cached 60s</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

function HeadlineCard({ icon, label, actual, sub, accent }: { icon: React.ReactNode; label: string; actual: string; sub?: string; accent: string }) {
  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${accent}`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between mb-2 text-muted-foreground">
          {icon}
          <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
        </div>
        <p className="text-2xl sm:text-3xl font-extrabold font-mono leading-tight">{actual}</p>
        {sub && <p className="text-[11px] text-muted-foreground font-mono mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold text-foreground">{value}</span>
    </div>
  );
}