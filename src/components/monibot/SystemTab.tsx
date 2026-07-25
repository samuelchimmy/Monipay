import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database, RefreshCw, Loader2, Shield, Users, Receipt,
  Wallet, Store, Globe, Server, HardDrive, Zap, Wifi, WifiOff, CheckCircle2, Clock,
  Share2, DollarSign, TrendingUp, Activity,
} from "lucide-react";
import { CHAIN_CONFIGS, type SupportedNetwork, type EvmNetwork } from "@/config/chains";
import { createPublicClient, http } from "viem";
import { wagmiChainFromNetwork } from "@/lib/wagmiConfig";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import type { WalletOptions } from "./types";

interface SystemStats {
  total_profiles: number;
  total_wallet_profiles: number;
  total_transactions: number;
  total_monibot_transactions: number;
  total_orders: number;
  total_products: number;
  total_invoices: number;
  total_feedback: number;
  total_support_tickets: number;
  total_api_keys: number;
  total_campaigns: number;
  total_bot_logs: number;
  total_payment_links: number;
  total_ious: number;
  total_merchant_subscriptions: number;
  total_store_settings: number;
  total_activation_fundings: number;
  total_customers: number;
  total_infra_subscriptions: number;
  total_arc_waitlist: number;
}

interface RpcStatus {
  url: string;
  latency: number | null;
  blockNumber: bigint | null;
  status: 'ok' | 'error' | 'testing';
}

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

// Active RPC storage key
const ACTIVE_RPC_KEY = 'monipay_active_rpc';

export function getActiveRpc(network: SupportedNetwork): string {
  try {
    const stored = localStorage.getItem(ACTIVE_RPC_KEY);
    if (stored) {
      const map = JSON.parse(stored);
      if (map[network]) return map[network];
    }
  } catch {}
  return CHAIN_CONFIGS[network as EvmNetwork]?.rpcUrls[0] ?? '';
}

function setActiveRpc(network: SupportedNetwork, url: string) {
  try {
    const stored = localStorage.getItem(ACTIVE_RPC_KEY);
    const map = stored ? JSON.parse(stored) : {};
    map[network] = url;
    localStorage.setItem(ACTIVE_RPC_KEY, JSON.stringify(map));
  } catch {}
}

export function MoniBotSystemTab({ walletOptions, isUnlocked }: Props) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [rpcNetwork, setRpcNetwork] = useState<SupportedNetwork>('base');
  const [rpcStatuses, setRpcStatuses] = useState<RpcStatus[]>([]);
  const [rpcTesting, setRpcTesting] = useState(false);
  const RPC_NETWORKS: SupportedNetwork[] = ['base', 'bsc', 'celo', 'ink', 'tempo'];
  const [activeRpcs, setActiveRpcs] = useState<Record<string, string>>(
    Object.fromEntries(RPC_NETWORKS.map(n => [n, getActiveRpc(n)]))
  );
  const [magicpayStats, setMagicpayStats] = useState<Record<string, { count: number; volume: number; fees: number }> | null>(null);
  const [publicStats, setPublicStats] = useState<any>(null);

  const fetchPublicStats = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-stats`);
      if (res.ok) setPublicStats(await res.json());
    } catch (e) { console.error("public stats failed", e); }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!walletOptions) return;
    setLoading(true);
    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:admin-system-stats:${timestamp}`);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({ action: "admin-system-stats", timestamp }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("System stats failed:", err);
    } finally {
      setLoading(false);
    }
  }, [walletOptions]);

  const fetchMagicPayStats = useCallback(async () => {
    if (!walletOptions) return;
    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:admin-magicpay-stats:${timestamp}`);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({ action: "admin-magicpay-stats", timestamp }),
      });
      if (res.ok) setMagicpayStats(await res.json());
    } catch (err) {
      console.error("MagicPay stats failed:", err);
    }
  }, [walletOptions]);

  useEffect(() => {
    if (walletOptions && isUnlocked) {
      fetchStats();
      fetchMagicPayStats();
      fetchPublicStats();
    }
  }, [walletOptions, isUnlocked, fetchStats, fetchMagicPayStats, fetchPublicStats]);

  const testRpcEndpoints = async () => {
    setRpcTesting(true);
    const urls = [...(CHAIN_CONFIGS[rpcNetwork as EvmNetwork]?.rpcUrls ?? [])];
    const chain = wagmiChainFromNetwork(rpcNetwork);

    // Initialize all as testing
    setRpcStatuses(urls.map(url => ({ url, latency: null, blockNumber: null, status: 'testing' as const })));

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const start = performance.now();
        try {
          const client = createPublicClient({ chain, transport: http(url, { timeout: 8000 }) });
          const blockNumber = await client.getBlockNumber();
          const latency = Math.round(performance.now() - start);
          return { url, latency, blockNumber, status: 'ok' as const };
        } catch {
          return { url, latency: null, blockNumber: null, status: 'error' as const };
        }
      })
    );

    const statuses = results.map(r => r.status === 'fulfilled' ? r.value : { url: '', latency: null, blockNumber: null, status: 'error' as const });
    // Sort: ok first (by latency), then errors
    statuses.sort((a, b) => {
      if (a.status === 'ok' && b.status !== 'ok') return -1;
      if (a.status !== 'ok' && b.status === 'ok') return 1;
      if (a.latency !== null && b.latency !== null) return a.latency - b.latency;
      return 0;
    });

    setRpcStatuses(statuses);
    setRpcTesting(false);
  };

  const handleSelectRpc = (url: string) => {
    setActiveRpc(rpcNetwork, url);
    setActiveRpcs(prev => ({ ...prev, [rpcNetwork]: url }));
  };

  const copyAddress = async (label: string, addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      toast.success(`${label} address copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-bold text-muted-foreground">Unlock dashboard to view system stats</p>
      </div>
    );
  }

  const statCards = stats ? [
    { label: "Total Users", value: (stats.total_profiles || 0) + (stats.total_wallet_profiles || 0), icon: Users, color: "text-blue-500" },
    { label: "Wallet-only", value: stats.total_wallet_profiles, icon: Wallet, color: "text-sky-500" },
    { label: "Ledger Txs", value: stats.total_transactions, icon: Receipt, color: "text-green-500" },
    { label: "MoniBot Txs", value: stats.total_monibot_transactions, icon: Receipt, color: "text-lime-500" },
    { label: "Activations", value: stats.total_activation_fundings, icon: Zap, color: "text-amber-400" },
    { label: "Customers", value: stats.total_customers, icon: Users, color: "text-fuchsia-500" },
    { label: "Merchants (Pro)", value: stats.total_merchant_subscriptions, icon: Store, color: "text-rose-500" },
    { label: "Storefronts", value: stats.total_store_settings, icon: Store, color: "text-orange-400" },
    { label: "IOUs", value: stats.total_ious, icon: Wallet, color: "text-teal-500" },
    { label: "Infra Subs", value: stats.total_infra_subscriptions, icon: Server, color: "text-slate-500" },
    { label: "Arc Waitlist", value: stats.total_arc_waitlist, icon: Globe, color: "text-neutral-500" },
    { label: "Orders", value: stats.total_orders, icon: Store, color: "text-purple-500" },
    { label: "Products", value: stats.total_products, icon: HardDrive, color: "text-amber-500" },
    { label: "Invoices", value: stats.total_invoices, icon: Wallet, color: "text-cyan-500" },
    { label: "Feedback", value: stats.total_feedback, icon: Zap, color: "text-yellow-500" },
    { label: "Support Tickets", value: stats.total_support_tickets, icon: Server, color: "text-red-500" },
    { label: "API Keys", value: stats.total_api_keys, icon: Globe, color: "text-indigo-500" },
    { label: "Campaigns", value: stats.total_campaigns, icon: Zap, color: "text-pink-500" },
    { label: "Bot Logs", value: stats.total_bot_logs, icon: Database, color: "text-emerald-500" },
    { label: "Payment Links", value: stats.total_payment_links, icon: Globe, color: "text-orange-500" },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider">Platform Overview</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px] font-bold"
            onClick={async () => {
              const url = `${window.location.origin}/stats`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Public stats link copied", { description: url });
              } catch { toast.error("Copy failed"); }
            }}
          >
            <Share2 className="w-3.5 h-3.5 mr-1" />Share Public Link
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { fetchStats(); fetchPublicStats(); fetchMagicPayStats(); }} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Headline traction signals (from public platform-stats endpoint) */}
      {publicStats?.headline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Volume", icon: DollarSign, color: "text-emerald-500", actual: publicStats.headline.total_volume_usd_actual, usd: true },
            { label: "Total Txs", icon: Receipt, color: "text-blue-500", actual: publicStats.headline.total_transactions_actual, usd: false },
            { label: "Platform Fees", icon: TrendingUp, color: "text-amber-500", actual: publicStats.headline.total_platform_fees_usd_actual, usd: true },
            { label: "Gas Paid", icon: Zap, color: "text-rose-500", actual: publicStats.headline.total_gas_paid_usd_actual, usd: true },
            { label: "DAU", icon: Activity, color: "text-cyan-500", actual: publicStats.headline.dau, usd: false },
            { label: "WAU", icon: Activity, color: "text-sky-500", actual: publicStats.headline.wau, usd: false },
            { label: "MAU", icon: Activity, color: "text-indigo-500", actual: publicStats.headline.mau, usd: false },
            { label: "MRR (Subs)", icon: DollarSign, color: "text-lime-500", actual: publicStats.headline.subs_mrr_usd, usd: true },
          ].map(({ label, icon: Icon, color, actual, usd }) => {
            const fmt = (n: number) => usd
              ? (n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(2)}K` : `$${(n||0).toFixed(2)}`)
              : (n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : `${n||0}`);
            return (
              <Card key={label} className="border-border">
                <CardContent className="pt-4 pb-4 text-center">
                  <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
                  <p className="text-xl font-extrabold font-mono text-foreground">{fmt(actual || 0)}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* By chain breakdown */}
      {publicStats?.by_chain && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />By Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left py-1.5">Chain</th>
                    <th className="text-right">Txs</th>
                    <th className="text-right">Volume</th>
                    <th className="text-right">Fees</th>
                    <th className="text-right">Gas</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {Object.entries(publicStats.by_chain as Record<string, any>).map(([chain, m]) => (
                    <tr key={chain} className="border-t border-border/60">
                      <td className="py-1.5 font-bold uppercase">{chain}</td>
                      <td className="text-right">{(m.tx_count || 0).toLocaleString()}</td>
                      <td className="text-right">${(m.volume_usd || 0).toFixed(2)}</td>
                      <td className="text-right">${(m.platform_fees_usd || 0).toFixed(2)}</td>
                      <td className="text-right">${(m.gas_paid_usd || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !stats ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
                <p className="text-2xl font-extrabold font-mono text-foreground">{value?.toLocaleString() || 0}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* RPC Health & Switch */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-500" />RPC Endpoints
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {RPC_NETWORKS.map(net => (
                  <button
                    key={net}
                    onClick={() => { setRpcNetwork(net); setRpcStatuses([]); }}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      rpcNetwork === net
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {net}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testRpcEndpoints}
                disabled={rpcTesting}
                className="h-8 text-xs font-bold"
              >
                {rpcTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                Test All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {/* Active RPC indicator */}
          <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="text-[11px] font-bold text-green-600 dark:text-green-400">Active:</span>
            <span className="text-[11px] font-mono text-foreground truncate">{activeRpcs[rpcNetwork]}</span>
          </div>

          {rpcStatuses.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-medium">
                {CHAIN_CONFIGS[rpcNetwork as EvmNetwork]?.rpcUrls.length ?? 0} {rpcNetwork.toUpperCase()} endpoints configured
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Click "Test All" to check latency & health</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rpcStatuses.map((rpc) => {
                const isActive = activeRpcs[rpcNetwork] === rpc.url;
                const shortUrl = rpc.url.replace('https://', '').replace('http://', '').split('/')[0];
                return (
                  <button
                    key={rpc.url}
                    onClick={() => rpc.status === 'ok' && handleSelectRpc(rpc.url)}
                    disabled={rpc.status !== 'ok'}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-green-500/10 border border-green-500/30'
                        : rpc.status === 'ok'
                          ? 'bg-muted/30 hover:bg-muted/60 border border-transparent'
                          : 'bg-destructive/5 border border-transparent opacity-60'
                    }`}
                  >
                    {rpc.status === 'testing' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                    ) : rpc.status === 'ok' ? (
                      <Wifi className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    )}
                    <span className="text-[11px] font-mono font-medium text-foreground truncate flex-1">
                      {shortUrl}
                    </span>
                    {rpc.status === 'ok' && rpc.blockNumber && (
                      <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                        #{rpc.blockNumber.toString().slice(-6)}
                      </span>
                    )}
                    {rpc.status === 'ok' && rpc.latency !== null && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold px-1.5 py-0 flex-shrink-0 ${
                          rpc.latency < 300 ? 'text-green-500 border-green-500/30' :
                          rpc.latency < 800 ? 'text-amber-500 border-amber-500/30' :
                          'text-red-500 border-red-500/30'
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        {(rpc.latency / 1000).toFixed(2)}s
                      </Badge>
                    )}
                    {rpc.status === 'error' && (
                      <Badge variant="outline" className="text-[10px] font-bold text-destructive border-destructive/30 px-1.5 py-0 flex-shrink-0">
                        Failed
                      </Badge>
                    )}
                    {isActive && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px] font-bold px-1.5 py-0 flex-shrink-0">
                        Active
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Addresses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-extrabold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />System Wallets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "Treasury", addr: "0xfa2B8eD012f756E22E780B772d604af4575d5fcf" },
            { label: "MoniBot", addr: "0xdFA5fe220cE7C4BCBb1180686666b803DfAE8ED3" },
            { label: "Relayer", addr: "0xF407b975dE76FF6AeAA98dbB7b0d2F2297A4360F" },
            { label: "Activator", addr: "0xe763D5eE4474e604bC537d0dE2bD277f1F29dB6a" },
          ].map(({ label, addr }) => (
            <button
              key={label}
              onClick={() => copyAddress(label, addr)}
              className="w-full flex items-center justify-between p-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
              title="Click to copy"
            >
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                {label}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-medium text-foreground">{addr.substring(0, 6)}...{addr.substring(38)}</span>
                <a
                  href={`https://basescan.org/address/${addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground"
                  title="View on BaseScan"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* MagicPay Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-extrabold flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />MagicPay Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!magicpayStats ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['base','bsc','celo','ink','tempo','solana'] as const).map(c => {
                const s = magicpayStats[c] ?? { count: 0, volume: 0, fees: 0 };
                return (
                  <div key={c} className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{c}</p>
                    <p className="text-sm font-extrabold font-mono text-foreground mt-0.5">{s.count.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">vol ${s.volume.toFixed(0)} · fees ${s.fees.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}