import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Terminal, RefreshCw, Loader2, AlertCircle, Info, AlertTriangle, Bug, Trash2, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { WalletOptions } from "./types";

interface LogEntry {
  id: string;
  service: string;
  level: string;
  message: string;
  metadata: any;
  created_at: string;
}

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

const SERVICES = ['all', 'worker-bot', 'worker-bot-bsc', 'vp-social', 'reply-bot-bsc'];
const LEVELS = ['all', 'error', 'warn', 'info', 'debug'];

const SERVICE_THEMES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'worker-bot': { bg: 'bg-blue-500/8', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  'worker-bot-bsc': { bg: 'bg-amber-500/8', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  'vp-social': { bg: 'bg-violet-500/8', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-500' },
  'reply-bot-bsc': { bg: 'bg-emerald-500/8', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

const SERVICE_LABEL_COLORS: Record<string, string> = {
  'worker-bot': 'text-blue-400',
  'worker-bot-bsc': 'text-amber-400',
  'vp-social': 'text-violet-400',
  'reply-bot-bsc': 'text-emerald-400',
};

const SERVICE_DISPLAY: Record<string, string> = {
  'worker-bot': 'monibot',
  'worker-bot-bsc': 'monibot-BSC',
  'vp-social': 'vp-social',
  'reply-bot-bsc': 'reply-BSC',
};

const LEVEL_CONFIG: Record<string, { icon: typeof AlertCircle; color: string; stripe: string }> = {
  'error': { icon: AlertCircle, color: 'text-red-400', stripe: 'border-l-red-500' },
  'warn': { icon: AlertTriangle, color: 'text-amber-400', stripe: 'border-l-amber-500' },
  'debug': { icon: Bug, color: 'text-purple-400', stripe: 'border-l-purple-500' },
  'info': { icon: Info, color: 'text-sky-400', stripe: 'border-l-sky-500' },
};

export function MoniBotLogsTab({ walletOptions, isUnlocked }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const callApi = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    if (!walletOptions) throw new Error("Not unlocked");
    const timestamp = Date.now().toString();
    const signature = await walletOptions.signMessage(`monibot-campaign:${action}:${timestamp}`);
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({ action, timestamp, ...extra }),
      }
    );
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }, [walletOptions]);

  const fetchLogs = useCallback(async () => {
    if (!walletOptions) return;
    setLoading(true);
    try {
      const body: any = { limit: 300 };
      if (serviceFilter !== "all") body.service = serviceFilter;
      if (levelFilter !== "all") body.level = levelFilter;
      const data = await callApi("get-logs", body);
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Logs fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [walletOptions, serviceFilter, levelFilter, callApi]);

  const handleDeleteOld = async () => {
    if (!walletOptions) return;
    setDeleting(true);
    try {
      const data = await callApi("delete-old-logs", { hours: 24 });
      toast.success(`Deleted ${data.deleted || 0} logs older than 24h`);
      fetchLogs();
    } catch (err) {
      toast.error("Failed to delete old logs");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!walletOptions || !confirm("Delete ALL logs? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const data = await callApi("delete-all-logs");
      toast.success(`Deleted ${data.deleted || 0} logs`);
      setLogs([]);
    } catch (err) {
      toast.error("Failed to delete logs");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (walletOptions) fetchLogs();
  }, [walletOptions, fetchLogs]);

  useEffect(() => {
    if (autoRefresh && walletOptions) {
      intervalRef.current = setInterval(fetchLogs, 10000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, walletOptions, fetchLogs]);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  const serviceCounts = SERVICES.filter(s => s !== 'all').reduce((acc, s) => {
    acc[s] = logs.filter(l => l.service === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{logs.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Total Logs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-400 leading-none">{errorCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Errors</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-amber-400 leading-none">{warnCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Warnings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">24h</p>
              <p className="text-[10px] text-muted-foreground font-medium">Auto-Purge</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Legend + Filters */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-3 space-y-3">
          {/* Service Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Service</span>
            {SERVICES.map(s => {
              const theme = SERVICE_THEMES[s];
              const isActive = serviceFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setServiceFilter(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? s === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : `${theme?.bg} ${theme?.text} ring-1 ${theme?.border} shadow-sm`
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {s !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${theme?.dot}`} />}
                  {s === 'all' ? 'All' : s}
                  {s !== 'all' && serviceCounts[s] > 0 && (
                    <span className="text-[8px] opacity-70">({serviceCounts[s]})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Level + Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Level</span>
              {LEVELS.map(l => {
                const cfg = LEVEL_CONFIG[l];
                return (
                  <button
                    key={l}
                    onClick={() => setLevelFilter(l)}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                      levelFilter === l
                        ? l === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : `bg-muted ${cfg?.color} ring-1 ring-current/20 shadow-sm`
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-[10px] px-3 py-1 rounded-full font-bold transition-all ${
                  autoRefresh
                    ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                    : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                {autoRefresh ? '● Live' : '○ Paused'}
              </button>
              <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={loading} className="h-7 w-7">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Stream - Terminal Style */}
      <div className="rounded-xl border border-border/50 overflow-hidden bg-[#0d1117]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#161b22]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs font-mono text-white/40 ml-2">monibot — logs</span>
            <Badge variant="secondary" className="text-[10px] h-5 font-bold bg-white/5 text-white/40 border-0">{logs.length}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteOld}
              disabled={deleting || !isUnlocked}
              className="h-7 text-[10px] font-bold text-white/30 hover:text-amber-400 hover:bg-white/5 gap-1"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
              Purge 24h+
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteAll}
              disabled={deleting || !isUnlocked}
              className="h-7 text-[10px] font-bold text-white/30 hover:text-red-400 hover:bg-white/5 gap-1"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Clear All
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[700px]">
          <div className="font-mono text-[10px] leading-snug">
            {!isUnlocked ? (
              <p className="text-white/30 text-center py-12">Unlock dashboard to view logs</p>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Terminal className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-white/30 text-sm">
                  {loading ? "Loading logs..." : "No logs found"}
                </p>
                <p className="text-white/15 text-[11px]">Logs auto-purge after 24 hours</p>
              </div>
            ) : (
              logs.map((log) => {
                const serviceColor = SERVICE_LABEL_COLORS[log.service] || 'text-white/50';
                const d = new Date(log.created_at);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const timestamp = `${dateStr} ${timeStr}`;

                // Map service names to shorter display labels
                const serviceLabel = SERVICE_DISPLAY[log.service] || log.service;

                return (
                  <div
                    key={log.id}
                    className={`flex items-start px-4 py-[3px] border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${
                      log.level === 'error' ? 'bg-red-500/[0.04]' : ''
                    }`}
                  >
                    {/* Separator line */}
                    <span className="text-white/10 mr-3 select-none">│</span>

                    {/* Timestamp */}
                    <span className="text-green-500/60 flex-shrink-0 w-[140px] tabular-nums">
                      {timestamp}
                    </span>

                    {/* Service */}
                    <span className={`flex-shrink-0 w-[100px] font-medium ${serviceColor}`}>
                      {serviceLabel}
                    </span>

                    {/* Message */}
                    <span className={`break-all whitespace-pre-wrap ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-yellow-400/90' :
                      log.level === 'debug' ? 'text-purple-400/80' :
                      'text-green-300/70'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
