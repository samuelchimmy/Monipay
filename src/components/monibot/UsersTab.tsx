import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Loader2, User, Wallet, Copy, CheckCircle2, XCircle,
  ExternalLink, Shield, Globe, ArrowDownLeft, ArrowUpRight, Send,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { CHAIN_CONFIGS } from "@/config/chains";
import type { WalletOptions } from "./types";

interface ProfileResult {
  id: string;
  pay_tag: string;
  wallet_address: string;
  preferred_mode: string;
  preferred_network: string;
  created_at?: string;
  x_username?: string;
  x_verified?: boolean;
  bot_allowance_amount?: number;
  discord_id?: string;
  discord_username?: string;
  telegram_id?: string;
  telegram_username?: string;
  bluesky_id?: string;
  bluesky_username?: string;
  farcaster_fid?: number;
  farcaster_username?: string;
  google_email?: string;
  tempo_address?: string;
  solana_address?: string;
  status?: string;
}

type BalanceInfo = Record<string, string>;

type ActivationInfo = Record<string, { funded: boolean; tx_hash?: string }>;

const ACTIVATION_CHAINS: Array<{ key: string; label: string }> = [
  { key: 'celo',   label: 'Celo' },
];

const BALANCE_CHAINS: Array<{ key: string; label: string; currency: string; accent: string }> = [
  { key: 'celo',   label: 'Celo',   currency: 'USDT',  accent: 'text-amber-400 bg-amber-500/5 border-amber-500/10' },
];

interface SocialTx {
  id: string;
  chain: string;
  type: string;
  amount: number;
  fee?: number;
  tx_hash: string;
  status: string;
  platform?: string;
  payer_pay_tag?: string;
  recipient_pay_tag?: string;
  recipient_username?: string;
  created_at: string;
  sender_id?: string;
  receiver_id?: string;
}

interface OnchainTx {
  id: string;
  type: string;
  amount: number;
  fee?: number;
  tx_hash?: string;
  status: string;
  source?: string;
  counterparty?: string;
  payer_pay_tag?: string;
  metadata?: any;
  created_at: string;
}

type UnifiedTx = {
  id: string;
  kind: 'social' | 'onchain';
  chain: string;
  type: string;
  amount: number;
  status: string;
  tx_hash?: string;
  counterparty: string;
  direction: 'sent' | 'received';
  created_at: string;
  extra?: string;
};

interface PendingMP {
  id: string;
  iou_id?: string;
  amount: number;
  token_symbol?: string;
  chain: string;
  platform?: string;
  platform_user_id?: string;
  sender_handle?: string;
  sender_pay_tag?: string;
  created_at: string;
  expiry?: string;
  status: string;
}

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

export function MoniBotUsersTab({ walletOptions, isUnlocked }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [balances, setBalances] = useState<BalanceInfo | null>(null);
  const [activation, setActivation] = useState<ActivationInfo | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [socialTxs, setSocialTxs] = useState<SocialTx[]>([]);
  const [onchainTxs, setOnchainTxs] = useState<OnchainTx[]>([]);
  const [pendingMP, setPendingMP] = useState<PendingMP[]>([]);

  const searchUser = useCallback(async () => {
    if (!searchQuery.trim() || !walletOptions) return;
    setIsSearching(true);
    setProfile(null);
    setBalances(null);
    setActivation(null);

    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:admin-lookup:${timestamp}`);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({
          action: "admin-lookup",
          timestamp,
          query: searchQuery.trim().toLowerCase().replace('@', ''),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Lookup failed");
      }

      const data = await res.json();
      if (!data.profile) {
        toast.error("No account found");
        return;
      }

      setProfile(data.profile);
      setActivation(data.activation || null);
      setSocialTxs(data.social_txs || []);
      setOnchainTxs(data.onchain_txs || []);
      setPendingMP(data.pending_magicpay || []);

      // Add to recent searches
      setRecentSearches(prev => {
        const updated = [searchQuery.trim(), ...prev.filter(s => s !== searchQuery.trim())].slice(0, 5);
        return updated;
      });

      // Fetch balances
      if (data.profile.wallet_address) {
        fetchBalances(data.profile.wallet_address, data.profile.solana_address);
      }
    } catch (err: any) {
      toast.error(err.message || "Lookup failed");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, walletOptions]);

  const fetchEvmBalance = async (rpc: string, token: string, address: string, decimals: number) => {
    const padded = address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const data = `0x70a08231${padded}`;
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: token, data }, 'latest'] }),
    });
    const j = await res.json();
    if (!j.result || j.result === '0x') return 0;
    const raw = BigInt(j.result);
    return Number(raw) / 10 ** decimals;
  };

  const fetchBalances = async (address: string, _solanaAddress?: string) => {
    setBalanceLoading(true);
    try {
      const evmChains = ['celo'] as const;
      const results = await Promise.all(
        evmChains.map(async (k) => {
          const cfg = CHAIN_CONFIGS[k];
          try {
            const bal = await fetchEvmBalance(cfg.rpcUrls[0], cfg.token, address, cfg.decimals);
            return [k, bal.toFixed(2)] as const;
          } catch {
            return [k, '0.00'] as const;
          }
        }),
      );
      const next: BalanceInfo = Object.fromEntries(results);
      setBalances(next);
    } catch {
      console.error("Balance fetch failed");
    } finally {
      setBalanceLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const SOCIAL_FIELDS: Array<{ key: keyof ProfileResult; idKey?: keyof ProfileResult; label: string; color: string; prefix?: string }> = [
    { key: 'x_username', label: 'X / Twitter', color: 'text-foreground', prefix: '@' },
    { key: 'discord_username', idKey: 'discord_id', label: 'Discord', color: 'text-indigo-500', prefix: '@' },
    { key: 'telegram_username', idKey: 'telegram_id', label: 'Telegram', color: 'text-sky-500', prefix: '@' },
    { key: 'bluesky_username', label: 'Bluesky', color: 'text-blue-500', prefix: '@' },
    { key: 'farcaster_username', idKey: 'farcaster_fid', label: 'Farcaster', color: 'text-purple-500', prefix: '@' },
    { key: 'google_email', label: 'Google', color: 'text-rose-500' },
  ];

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-bold text-muted-foreground">Unlock dashboard to access user lookup</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card className="border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by @paytag or 0x wallet address..."
                className="pl-9 h-11 text-sm font-medium"
                onKeyDown={(e) => e.key === "Enter" && searchUser()}
              />
            </div>
            <Button onClick={searchUser} disabled={isSearching || !searchQuery.trim()} className="h-11 px-5 font-bold">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>
          {recentSearches.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Recent:</span>
              {recentSearches.map(s => (
                <button key={s} onClick={() => { setSearchQuery(s); }} className="text-[11px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Result */}
      {profile && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                @{profile.pay_tag}
              </CardTitle>
              <Badge variant="outline" className="text-xs font-bold capitalize">
                {profile.preferred_mode}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wallet Address */}
            <div className="p-3 bg-muted/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Wallet Address</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyText(profile.wallet_address)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`https://basescan.org/address/${profile.wallet_address}`, '_blank')}>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs font-mono font-medium break-all text-foreground">{profile.wallet_address}</p>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {BALANCE_CHAINS.map(({ key, label, currency, accent }) => (
                <div key={key} className={`p-2.5 rounded-xl border text-center ${accent}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{label} · {currency}</span>
                  <p className="text-lg font-extrabold font-mono mt-1 text-foreground">
                    {balanceLoading
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : (balances?.[key] === '—' ? '—' : `$${balances?.[key] || '0.00'}`)}
                  </p>
                </div>
              ))}
            </div>

            {/* Account Details */}
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-bold text-muted-foreground">Profile ID</span>
                <span className="text-xs font-mono font-medium text-foreground">{profile.id.substring(0, 12)}...</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-bold text-muted-foreground">Network</span>
                <Badge variant="secondary" className="text-xs font-bold">{profile.preferred_network?.toUpperCase()}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-bold text-muted-foreground">Mode</span>
                <Badge variant="outline" className="text-xs font-bold capitalize">{profile.preferred_mode}</Badge>
              </div>
              {profile.x_username && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs font-bold text-muted-foreground">X Account</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium">@{profile.x_username}</span>
                    {profile.x_verified && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                  </div>
                </div>
              )}
              {profile.bot_allowance_amount !== undefined && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs font-bold text-muted-foreground">Bot Allowance</span>
                  <span className="text-xs font-mono font-bold">${profile.bot_allowance_amount?.toFixed(2) || '0.00'}</span>
                </div>
              )}
              {profile.created_at && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-bold text-muted-foreground">Joined</span>
                  <span className="text-xs font-medium">{formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}</span>
                </div>
              )}
            </div>

            {/* Linked Social Accounts */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Linked Socials</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SOCIAL_FIELDS.map(({ key, idKey, label, color, prefix }) => {
                  const handle = profile[key] as string | undefined;
                  const id = idKey ? (profile[idKey] as string | number | undefined) : undefined;
                  if (!handle && !id) {
                    return (
                      <div key={label} className="p-2.5 rounded-lg border border-dashed border-border/60 bg-muted/20">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
                        <p className="text-xs text-muted-foreground/60">Not linked</p>
                      </div>
                    );
                  }
                  return (
                    <div key={label} className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-[10px] font-bold uppercase ${color}`}>{label}</p>
                        <p className="text-xs font-medium truncate">{handle ? `${prefix || ''}${handle}` : '—'}</p>
                        {id && <p className="text-[10px] text-muted-foreground font-mono truncate">id: {String(id)}</p>}
                      </div>
                      {handle && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyText(String(handle))}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activation Status */}
            {activation && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Activation Status</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ACTIVATION_CHAINS.map(({ key, label }) => {
                    const a = activation[key] || { funded: false };
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 p-3 rounded-xl border ${a.funded ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}
                      >
                        {a.funded ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        <div>
                          <p className="text-xs font-bold">{label}</p>
                          <p className="text-[10px] text-muted-foreground">{a.funded ? 'Activated' : 'Not Activated'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending MagicPay for this user */}
            {pendingMP.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Unclaimed MagicPay</span>
                <div className="space-y-1.5">
                  {pendingMP.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="min-w-0">
                        <p className="text-xs font-bold">${Number(p.amount).toFixed(2)} {p.token_symbol || ''} <span className="text-muted-foreground font-medium">on {p.chain}</span></p>
                        <p className="text-[10px] text-muted-foreground">from {p.sender_pay_tag || p.sender_handle || '—'} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-amber-500/40 text-amber-500">pending</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unified Transaction History (social + on-chain) */}
            {(() => {
              const unified: UnifiedTx[] = [
                ...socialTxs.map((tx): UnifiedTx => {
                  const isSender = tx.sender_id === profile.id;
                  return {
                    id: `s:${tx.id}`,
                    kind: 'social',
                    chain: (tx.chain || '').toLowerCase(),
                    type: tx.type,
                    amount: Number(tx.amount) || 0,
                    status: tx.status,
                    tx_hash: tx.tx_hash,
                    counterparty: isSender
                      ? (tx.recipient_pay_tag || tx.recipient_username || '—')
                      : (tx.payer_pay_tag || '—'),
                    direction: isSender ? 'sent' : 'received',
                    created_at: tx.created_at,
                    extra: tx.platform,
                  };
                }),
                ...onchainTxs.map((tx): UnifiedTx => {
                  const isSender = tx.type === 'sent' || tx.type === 'withdraw' || tx.type === 'send';
                  const chain = (tx.metadata?.chain || tx.metadata?.network || '').toString().toLowerCase();
                  return {
                    id: `o:${tx.id}`,
                    kind: 'onchain',
                    chain,
                    type: tx.type,
                    amount: Number(tx.amount) || 0,
                    status: tx.status,
                    tx_hash: tx.tx_hash,
                    counterparty: tx.payer_pay_tag || tx.counterparty || '—',
                    direction: isSender ? 'sent' : 'received',
                    created_at: tx.created_at,
                    extra: tx.source,
                  };
                }),
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              return (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Transaction History ({unified.length}) · {socialTxs.length} social · {onchainTxs.length} on-chain
                  </span>
                  {unified.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No transactions yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {unified.map((tx) => {
                        const Icon = tx.direction === 'sent' ? ArrowUpRight : ArrowDownLeft;
                        const dirColor = tx.direction === 'sent' ? 'text-red-500' : 'text-green-500';
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 border border-border/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${dirColor}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">
                                  {tx.direction === 'sent' ? 'Sent to' : 'From'} {tx.counterparty}
                                  <span className="text-muted-foreground font-medium">
                                    {tx.chain ? ` · ${tx.chain}` : ''} · {tx.type}
                                  </span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })} · {tx.status}
                                  {tx.extra ? ` · ${tx.extra}` : ''} · {tx.kind}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-xs font-mono font-bold ${dirColor}`}>
                                {tx.direction === 'sent' ? '-' : '+'}${tx.amount.toFixed(2)}
                              </span>
                              {tx.tx_hash && (
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyText(tx.tx_hash!)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
