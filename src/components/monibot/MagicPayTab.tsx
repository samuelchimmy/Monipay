import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, Sparkles, Copy, RefreshCw, MessageSquare, Send, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { WalletOptions } from "./types";

interface MagicPayItem {
  id: string;
  iou_id?: string;
  amount: number;
  token_symbol?: string;
  chain: string;
  platform?: string;
  platform_user_id?: string;
  recipient_identifier?: string;
  sender_handle?: string;
  sender_pay_tag?: string;
  sender_profile_id?: string;
  recipient_profile_id?: string;
  created_at: string;
  expiry?: string;
  claimed_at?: string;
  status: string;
  tx_hash_create?: string;
  tx_hash_claim?: string;
}

interface RecipientGroup {
  platform: string;
  platform_user_id: string;
  recipient_identifier: string | null;
  count: number;
  total_amount: number;
  chains: string[];
  oldest: string;
  newest: string;
  already_linked: boolean;
}

interface Summary {
  pending: { count: number; volume: number };
  claimed: { count: number; volume: number };
  refunded: { count: number; volume: number };
  expired: { count: number; volume: number };
}

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

const PLATFORM_LINKS: Record<string, (handle: string, id: string) => string> = {
  twitter: (h) => `https://x.com/${h.replace(/^@/, '')}`,
  x: (h) => `https://x.com/${h.replace(/^@/, '')}`,
  telegram: (h) => `https://t.me/${h.replace(/^@/, '')}`,
  discord: (_h, id) => `https://discord.com/users/${id}`,
};

export function MagicPayTab({ walletOptions, isUnlocked }: Props) {
  const [status, setStatus] = useState<'pending' | 'claimed' | 'refunded' | 'expired'>('pending');
  const [platform, setPlatform] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MagicPayItem[]>([]);
  const [recipients, setRecipients] = useState<RecipientGroup[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byChain, setByChain] = useState<Record<string, { count: number; volume: number }>>({});
  const [search, setSearch] = useState('');

  const fetchList = useCallback(async () => {
    if (!walletOptions) return;
    setLoading(true);
    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:admin-magicpay-list:${timestamp}`);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({
          action: "admin-magicpay-list",
          timestamp,
          status,
          platform: platform === 'all' ? null : platform,
          limit: 500,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      const data = await res.json();
      setItems(data.items || []);
      setRecipients(data.recipients || []);
      setSummary(data.summary || null);
      setByChain(data.by_chain || {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to load MagicPay');
    } finally {
      setLoading(false);
    }
  }, [walletOptions, status, platform]);

  useEffect(() => { if (isUnlocked) fetchList(); }, [isUnlocked, fetchList]);

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-bold text-muted-foreground">Unlock dashboard to access MagicPay</p>
      </div>
    );
  }

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success('Copied!'); };

  const filteredRecipients = recipients.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.recipient_identifier?.toLowerCase().includes(s) ||
      r.platform_user_id?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(['pending', 'claimed', 'refunded', 'expired'] as const).map((k) => {
          const v = summary?.[k] || { count: 0, volume: 0 };
          const color =
            k === 'pending' ? 'amber' : k === 'claimed' ? 'green' : k === 'refunded' ? 'red' : 'muted';
          return (
            <Card key={k} className={`border-${color}-500/20`}>
              <CardContent className="pt-4 pb-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider text-${color}-500`}>{k}</p>
                <p className="text-2xl font-extrabold mt-1">{v.count}</p>
                <p className="text-[11px] text-muted-foreground font-mono">${v.volume.toFixed(2)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* By chain */}
      {Object.keys(byChain).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">By Chain (all statuses)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(byChain).map(([c, v]) => (
              <div key={c} className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">{c}</span>
                <span className="text-xs font-bold">{v.count}</span>
                <span className="text-[10px] font-mono text-muted-foreground ml-1.5">${v.volume.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="pending" className="text-xs font-bold gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Unclaimed
              </TabsTrigger>
              <TabsTrigger value="claimed" className="text-xs font-bold gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
              </TabsTrigger>
              <TabsTrigger value="refunded" className="text-xs font-bold">Refunded</TabsTrigger>
              <TabsTrigger value="expired" className="text-xs font-bold">Expired</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-2 items-center">
            {['all', 'twitter', 'discord', 'telegram'].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wider transition-colors ${
                  platform === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {p}
              </button>
            ))}
            <div className="flex-1 min-w-[200px]">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter recipients by handle or id..."
                className="h-8 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchList} disabled={loading} className="h-8 px-3 text-xs font-bold">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recipients (outreach view) */}
      {(status === 'pending' || status === 'expired') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              Outreach Targets — {filteredRecipients.length} {status === 'expired' ? 'expired recipients' : 'recipients waiting to claim'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredRecipients.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">
                {loading ? 'Loading…' : 'No unclaimed MagicPay matching filters.'}
              </p>
            ) : (
              filteredRecipients.map((r) => {
                const handle = r.recipient_identifier || r.platform_user_id;
                const linkBuilder = PLATFORM_LINKS[r.platform];
                const link = linkBuilder ? linkBuilder(handle, r.platform_user_id) : null;
                return (
                  <div
                    key={`${r.platform}:${r.platform_user_id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">{r.platform}</Badge>
                        <p className="text-sm font-extrabold truncate">{handle}</p>
                        {r.already_linked && (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px] font-bold">linked</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.count} pending · oldest {formatDistanceToNow(new Date(r.oldest), { addSuffix: true })}
                        {' · '}chains: {r.chains.join(', ')}
                      </p>
                      {r.platform_user_id && (
                        <p className="text-[10px] text-muted-foreground font-mono">id: {r.platform_user_id}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-base font-extrabold font-mono text-amber-500">
                        ${r.total_amount.toFixed(2)}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(handle)} title="Copy handle">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {link && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(link, '_blank')} title="Open profile">
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Raw items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-extrabold">
            {status} (showing {items.length}{summary ? ` of ${summary[status]?.count ?? 0}` : ''})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 max-h-[600px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4 text-center">No entries.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/60 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">
                    ${Number(it.amount).toFixed(2)} {it.token_symbol || ''}
                    <span className="text-muted-foreground font-medium"> · {it.chain} · {it.platform}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    to {it.recipient_identifier || it.platform_user_id} · from {it.sender_pay_tag || it.sender_handle || '—'}
                    {' · '}{formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {it.tx_hash_create && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(it.tx_hash_create!)} title="Copy create tx">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}