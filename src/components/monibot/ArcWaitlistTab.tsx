import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Loader2, Mail, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { WalletOptions } from "./types";

interface WaitlistRow {
  id: string;
  email: string;
  monitag: string | null;
  source: string;
  user_agent: string | null;
  created_at: string;
}

interface Payload {
  total: number;
  rows: WaitlistRow[];
  fetchedAt: number;
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: WaitlistRow[]): string {
  const headers = ["created_at", "email", "monitag", "source", "user_agent", "id"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.created_at, r.email, r.monitag ?? "", r.source, r.user_agent ?? "", r.id].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function ArcWaitlistTab({ walletOptions, isUnlocked }: { walletOptions?: WalletOptions; isUnlocked: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const fetchRows = useCallback(async () => {
    if (!walletOptions) return;
    setLoading(true);
    try {
      const timestamp = Date.now();
      const signature = await walletOptions.signMessage(`monibot-campaign:arc-waitlist:${timestamp}`);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arc-waitlist-admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletOptions.walletAddress,
            "x-wallet-signature": signature,
          },
          body: JSON.stringify({ timestamp, limit: 2000 }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err: any) {
      console.error("[ArcWaitlistTab]", err);
      toast.error(err?.message || "Failed to fetch waitlist");
    } finally {
      setLoading(false);
    }
  }, [walletOptions]);

  useEffect(() => { if (isUnlocked) fetchRows(); }, [fetchRows, isUnlocked]);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.email.toLowerCase().includes(q) ||
      (r.monitag ?? "").toLowerCase().includes(q) ||
      r.source.toLowerCase().includes(q),
    );
  }, [data, query]);

  const downloadCsv = useCallback(() => {
    const rows = filtered;
    if (!rows.length) { toast.error("Nothing to export"); return; }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ymd = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `arc-waitlist-${ymd}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }, [filtered]);

  if (!isUnlocked) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Arc Waitlist
              {data && (
                <Badge variant="outline" className="ml-1 font-bold text-[10px]">
                  {data.total} total
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={fetchRows} disabled={loading} className="h-8">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="ml-1.5 text-[11px] font-bold">Refresh</span>
              </Button>
              <Button size="sm" onClick={downloadCsv} disabled={!filtered.length} className="h-8">
                <Download className="w-3.5 h-3.5" />
                <span className="ml-1.5 text-[11px] font-bold">Export CSV</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search email, monitag, source…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {data ? "No signups match your filter." : "No data."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Date</th>
                    <th className="px-3 py-2 font-bold">Email</th>
                    <th className="px-3 py-2 font-bold">MoniTag</th>
                    <th className="px-3 py-2 font-bold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">{r.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.monitag || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && (
            <p className="text-[10px] text-muted-foreground">
              Showing {filtered.length} of {data.rows.length} loaded · {data.total} total ·
              fetched {new Date(data.fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}