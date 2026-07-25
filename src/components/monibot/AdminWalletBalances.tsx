import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Fuel, RefreshCw, Loader2, AlertTriangle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { WalletOptions } from "./types";

interface BalanceRow {
  role: "funder" | "relayer";
  chain: string;
  label: string;
  symbol: string;
  address: string | null;
  balance: string;
  lowThreshold: number;
  error?: string;
}

interface BalancesPayload {
  funderAddress: string | null;
  relayerAddress: string | null;
  balances: BalanceRow[];
  fetchedAt: number;
}

const EXPLORERS: Record<string, string> = {
  base: "https://basescan.org/address/",
  bsc:  "https://bscscan.com/address/",
  celo: "https://celoscan.io/address/",
  ink:  "https://explorer.inkonchain.com/address/",
  tempo: "https://explore.tempo.xyz/address/",
  solana: "https://solscan.io/account/",
  arc: "https://explorer.arc.network/address/",
};

const CHAIN_ORDER = ["base", "bsc", "celo", "ink", "tempo", "solana", "arc"];

export function AdminWalletBalances({ walletOptions }: { walletOptions?: WalletOptions }) {
  const [data, setData] = useState<BalancesPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!walletOptions) return;
    setLoading(true);
    try {
      const timestamp = Date.now();
      const signature = await walletOptions.signMessage(`monibot-campaign:wallet-balances:${timestamp}`);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-wallet-balances`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletOptions.walletAddress,
            "x-wallet-signature": signature,
          },
          body: JSON.stringify({ timestamp }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err: any) {
      console.error("[AdminWalletBalances]", err);
      toast.error(err?.message || "Failed to fetch wallet balances");
    } finally {
      setLoading(false);
    }
  }, [walletOptions]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const renderRoleCard = (role: "funder" | "relayer", title: string, address: string | null) => {
    const rows = (data?.balances || [])
      .filter(b => b.role === role)
      .sort((a, b) => CHAIN_ORDER.indexOf(a.chain) - CHAIN_ORDER.indexOf(b.chain));

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <Fuel className="w-4 h-4 text-primary" />
              {title}
            </CardTitle>
            {address && (
              <button
                onClick={() => { navigator.clipboard.writeText(address); toast.success("Address copied"); }}
                className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground"
              >
                {address.slice(0, 6)}…{address.slice(-4)}
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              {loading ? "Loading…" : "No data"}
            </p>
          )}
          {rows.map(r => {
            const balNum = parseFloat(r.balance) || 0;
            const isLow = balNum < r.lowThreshold;
            return (
              <div
                key={`${r.role}-${r.chain}`}
                className={`flex items-center justify-between p-2 rounded-lg border ${
                  isLow ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/40 border-border"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0 h-5">
                    {r.label}
                  </Badge>
                  {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  {r.error && <span className="text-[10px] text-red-500 truncate">{r.error}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold ${isLow ? "text-amber-500" : "text-foreground"}`}>
                    {balNum.toFixed(6)} {r.symbol}
                  </span>
                  {r.address && EXPLORERS[r.chain] && (
                    <a
                      href={`${EXPLORERS[r.chain]}${r.address}`}
                      target="_blank" rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Operational Wallets
        </h3>
        <Button variant="ghost" size="icon" onClick={fetchBalances} disabled={loading} className="h-7 w-7">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderRoleCard("funder",  "Activation Funder", data?.funderAddress  ?? null)}
        {renderRoleCard("relayer", "Payment Relayer",   data?.relayerAddress ?? null)}
      </div>
    </div>
  );
}
