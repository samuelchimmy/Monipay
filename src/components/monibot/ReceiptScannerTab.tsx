import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Receipt, Loader2, CheckCircle2, XCircle, Clock,
  ExternalLink, Copy, AlertTriangle, Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { WalletOptions } from "./types";

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

type SearchMode = "hash" | "tag" | "id";
type StatusFilter = "all" | "completed" | "failed" | "pending";

interface TxResult {
  id: string;
  tx_hash: string;
  amount: number;
  fee: number;
  type: string;
  chain: string;
  status: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  payer_pay_tag: string | null;
  recipient_pay_tag: string | null;
  campaign_id: string | null;
  tweet_id: string | null;
  replied: boolean | null;
  error_reason: string | null;
  retry_count: number | null;
}

const EXPLORER_URLS: Record<string, string> = {
  base: "https://basescan.org/tx/",
  bsc: "https://bscscan.com/tx/",
  tempo: "https://explore.tempo.xyz/tx/",
};

export function MoniBotReceiptScannerTab({ walletOptions, isUnlocked }: Props) {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("hash");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [results, setResults] = useState<TxResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      toast.error("Enter a search query");
      return;
    }

    setIsSearching(true);
    setSearched(true);
    try {
      let dbQuery = supabase
        .from("monibot_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (searchMode === "hash") {
        dbQuery = dbQuery.ilike("tx_hash", `%${q}%`);
      } else if (searchMode === "tag") {
        const tagClean = q.replace(/^@/, "").toLowerCase();
        dbQuery = dbQuery.or(
          `payer_pay_tag.ilike.%${tagClean}%,recipient_pay_tag.ilike.%${tagClean}%`
        );
      } else {
        dbQuery = dbQuery.eq("id", q);
      }

      const { data, error } = await dbQuery;
      if (error) throw error;
      setResults((data as TxResult[]) || []);
      if (!data?.length) toast("No transactions found");
    } catch (err: any) {
      console.error("Receipt search failed:", err);
      toast.error("Search failed: " + (err.message || "Unknown error"));
    } finally {
      setIsSearching(false);
    }
  }, [query, searchMode]);

  const filtered = statusFilter === "all"
    ? results
    : results.filter((tx) => {
        if (statusFilter === "completed") return tx.status === "completed";
        if (statusFilter === "failed") return tx.status === "failed" || tx.error_reason;
        if (statusFilter === "pending") return tx.status === "pending";
        return true;
      });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const getStatusBadge = (tx: TxResult) => {
    if (tx.error_reason || tx.status === "failed") {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
          <XCircle className="w-2.5 h-2.5" />Failed
        </Badge>
      );
    }
    if (tx.status === "completed") {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px] px-1.5 py-0 h-4 gap-0.5">
          <CheckCircle2 className="w-2.5 h-2.5" />Done
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] px-1.5 py-0 h-4 gap-0.5">
        <Clock className="w-2.5 h-2.5" />Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />Receipt Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Mode Selector */}
          <div className="flex gap-1.5">
            {([
              { mode: "hash" as SearchMode, label: "TX Hash" },
              { mode: "tag" as SearchMode, label: "PayTag" },
              { mode: "id" as SearchMode, label: "Receipt ID" },
            ]).map(({ mode, label }) => (
              <Button
                key={mode}
                variant={searchMode === mode ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-3 font-semibold"
                onClick={() => setSearchMode(mode)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder={
                searchMode === "hash"
                  ? "0x... transaction hash"
                  : searchMode === "tag"
                  ? "@paytag"
                  : "Receipt UUID"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-10 text-sm font-mono"
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="h-10 px-5 font-bold"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Status Filter */}
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              {(["all", "completed", "failed", "pending"] as StatusFilter[]).map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "secondary" : "ghost"}
                  size="sm"
                  className="text-[11px] h-6 px-2 capitalize font-medium"
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                  {s !== "all" && (
                    <span className="ml-1 text-muted-foreground">
                      ({results.filter((tx) => {
                        if (s === "completed") return tx.status === "completed";
                        if (s === "failed") return tx.status === "failed" || tx.error_reason;
                        if (s === "pending") return tx.status === "pending";
                        return false;
                      }).length})
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {filtered.length} Result{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px]">
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No matching transactions
                  </p>
                ) : (
                  filtered.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 bg-muted/50 rounded-lg border border-border/50 space-y-2"
                    >
                      {/* Row 1: Status + Amount + Chain */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(tx)}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 uppercase">
                            {tx.chain}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                            {tx.type === "p2p_command" ? "P2P" : tx.type}
                          </Badge>
                        </div>
                        <span className="text-sm font-bold font-mono">
                          ${tx.amount?.toFixed(2)}
                        </span>
                      </div>

                      {/* Row 2: Tags */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">From:</span>
                        <span className="font-medium">
                          {tx.payer_pay_tag ? `@${tx.payer_pay_tag}` : tx.sender_id.substring(0, 12) + "…"}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">
                          {tx.recipient_pay_tag ? `@${tx.recipient_pay_tag}` : tx.receiver_id.substring(0, 12) + "…"}
                        </span>
                      </div>

                      {/* Row 3: Details */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{format(new Date(tx.created_at), "MMM d, yyyy · HH:mm:ss")}</span>
                        <span>Fee: ${tx.fee?.toFixed(2)}</span>
                      </div>

                      {/* Row 4: TX Hash + Actions */}
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
                          {tx.tx_hash}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(tx.tx_hash)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        {tx.tx_hash?.startsWith("0x") && EXPLORER_URLS[tx.chain] && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              window.open(EXPLORER_URLS[tx.chain] + tx.tx_hash, "_blank")
                            }
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      {/* Error reason */}
                      {tx.error_reason && (
                        <div className="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/5 p-2 rounded">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{tx.error_reason}</span>
                        </div>
                      )}

                      {/* Reply + Retry info */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>
                          Reply: {tx.replied ? "✅" : "❌"}
                        </span>
                        {(tx.retry_count ?? 0) > 0 && (
                          <span>Retries: {tx.retry_count}</span>
                        )}
                        {tx.campaign_id && (
                          <span>Campaign: {tx.campaign_id.substring(0, 8)}…</span>
                        )}
                        {tx.tweet_id && (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-[10px]"
                            onClick={() =>
                              window.open(
                                `https://x.com/i/web/status/${tx.tweet_id}`,
                                "_blank"
                              )
                            }
                          >
                            View Tweet ↗
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
      )}
    </div>
  );
}
