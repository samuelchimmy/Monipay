import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity, RefreshCw, Wallet, Users, Zap, CheckCircle2,
  XCircle, Clock, ExternalLink, Loader2, Target, DollarSign, ArrowUpDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getGrantBalance } from "@/lib/monibotContract";
import type { WalletOptions } from "./types";
import { AdminWalletBalances } from "./AdminWalletBalances";

interface NetworkStats {
  total_transactions: number;
  p2p_count: number;
  p2p_volume: number;
  campaigns: number;
  grants_issued: number;
  grants_volume: number;
}

const CHAIN_META: Record<string, { label: string; token: string; tint: string; text: string }> = {
  base:   { label: "Base",   token: "USDC",     tint: "bg-blue-500/5 border-blue-500/10",     text: "text-blue-500" },
  bsc:    { label: "BSC",    token: "USDT",     tint: "bg-yellow-500/5 border-yellow-500/10", text: "text-yellow-600" },
  celo:   { label: "Celo",   token: "USDm",     tint: "bg-emerald-500/5 border-emerald-500/10", text: "text-emerald-500" },
  ink:    { label: "Ink",    token: "USDC",     tint: "bg-purple-500/5 border-purple-500/10", text: "text-purple-500" },
  tempo:  { label: "Tempo",  token: "aUSD",     tint: "bg-pink-500/5 border-pink-500/10",     text: "text-pink-500" },
  solana: { label: "Solana", token: "USDC",     tint: "bg-violet-500/5 border-violet-500/10", text: "text-violet-500" },
};

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

export function MoniBotOverviewTab({ walletOptions, isUnlocked }: Props) {
  const [grantBudgetBase, setGrantBudgetBase] = useState("0");
  const [grantBudgetBsc, setGrantBudgetBsc] = useState("0");
  const [isBudgetLoading, setIsBudgetLoading] = useState(true);
  const [stats, setStats] = useState<{ base: NetworkStats; bsc: NetworkStats; chains?: Record<string, NetworkStats> } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const fetchBudget = useCallback(async () => {
    setIsBudgetLoading(true);
    try {
      const [b, s] = await Promise.all([getGrantBalance('base'), getGrantBalance('bsc')]);
      setGrantBudgetBase(b);
      setGrantBudgetBsc(s);
    } catch (err) {
      console.error("Budget fetch failed:", err);
    } finally {
      setIsBudgetLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!walletOptions) return;
    setStatsLoading(true);
    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:get-stats:${timestamp}`);
      const res = await fetch("https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/bot-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({ action: "get-stats", timestamp }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Stats fetch failed:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [walletOptions]);

  const fetchActivity = useCallback(async () => {
    if (!walletOptions) return;
    setTxLoading(true);
    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:get-activity:${timestamp}`);
      const res = await fetch("https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/monibot-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({ action: "get-activity", timestamp, limit: 15 }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecentTxs(data.transactions || []);
      }
    } catch (err) {
      console.error("Activity fetch failed:", err);
    } finally {
      setTxLoading(false);
    }
  }, [walletOptions]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);
  useEffect(() => {
    if (walletOptions) {
      fetchStats();
      fetchActivity();
    }
  }, [walletOptions, fetchStats, fetchActivity]);

  const getTxIcon = (tx: any) => {
    if (tx.tx_hash?.startsWith('0x')) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (tx.tx_hash?.includes('ERROR') || tx.tx_hash?.includes('REJECTED')) return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Budget Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-blue-500/20">
          <CardContent className="pt-4 pb-4 text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Base · USDC</span>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {isBudgetLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `$${parseFloat(grantBudgetBase).toFixed(2)}`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="pt-4 pb-4 text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">BSC · USDT</span>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {isBudgetLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `$${parseFloat(grantBudgetBsc).toFixed(2)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operational wallet balances (funder + relayer across chains) */}
      <AdminWalletBalances walletOptions={walletOptions} />

      {/* P2P Stats */}
      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-primary" />Network Stats
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={fetchStats} disabled={statsLoading} className="h-7 w-7">
                <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(stats.chains || { base: stats.base, bsc: stats.bsc }).map(([key, s]) => {
                const meta = CHAIN_META[key] || { label: key.toUpperCase(), token: '', tint: 'bg-muted/40 border-border', text: 'text-foreground' };
                return (
                  <div key={key} className={`space-y-2 p-3 rounded-lg border ${meta.tint}`}>
                    <p className={`text-xs font-semibold ${meta.text}`}>
                      {meta.label}{meta.token ? ` · ${meta.token}` : ''}
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Transactions</span><span className="font-mono font-medium">{s.total_transactions}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">P2P Transfers</span><span className="font-mono font-medium">{s.p2p_count}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">P2P Volume</span><span className="font-mono font-medium">${s.p2p_volume.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Grants</span><span className="font-mono font-medium">{s.grants_issued}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Grant Volume</span><span className="font-mono font-medium">${s.grants_volume.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Campaigns</span><span className="font-mono font-medium">{s.campaigns}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />Live Activity
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live
              </div>
              <Button variant="ghost" size="icon" onClick={fetchActivity} disabled={txLoading} className="h-7 w-7">
                <RefreshCw className={`w-3.5 h-3.5 ${txLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px]">
            <div className="space-y-1.5">
              {recentTxs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {txLoading ? "Loading..." : "No activity yet"}
                </p>
              ) : (
                recentTxs.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-2.5 p-2.5 bg-muted/50 rounded-lg">
                    {getTxIcon(tx)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">
                          @{tx.recipient_pay_tag || tx.payer_pay_tag || tx.receiver_id?.substring(0, 8)}
                        </p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {tx.chain}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                          {tx.type === 'p2p_command' ? 'P2P' : tx.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${tx.amount?.toFixed(2)} · {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {tx.replied ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      {tx.tweet_id && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`https://x.com/i/web/status/${tx.tweet_id}`, '_blank')}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
