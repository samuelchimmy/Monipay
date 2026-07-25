import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, RefreshCw, Loader2, Shield, Send,
  CheckCircle2, Clock, AlertCircle, Star, Bug, Lightbulb, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { WalletOptions } from "./types";

interface FeedbackItem {
  id: string;
  type: string;
  message: string;
  status: string;
  admin_notes: string | null;
  pay_tag: string | null;
  email: string | null;
  profile_id: string | null;
  created_at: string;
}

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

export function MoniBotFeedbackTab({ walletOptions, isUnlocked }: Props) {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchFeedbacks = useCallback(async () => {
    if (!walletOptions) return;
    setLoading(true);
    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:admin-feedbacks:${timestamp}`);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({ action: "admin-feedbacks", timestamp, status: statusFilter !== "all" ? statusFilter : undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks || []);
      }
    } catch (err) {
      console.error("Feedback fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [walletOptions, statusFilter]);

  useEffect(() => {
    if (walletOptions && isUnlocked) fetchFeedbacks();
  }, [walletOptions, isUnlocked, fetchFeedbacks]);

  const handleReply = async (feedbackId: string) => {
    if (!replyText.trim() || !walletOptions) return;
    setReplying(true);
    try {
      const timestamp = Date.now().toString();
      const signature = await walletOptions.signMessage(`monibot-campaign:admin-reply-feedback:${timestamp}`);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletOptions.walletAddress,
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({
          action: "admin-reply-feedback",
          timestamp,
          feedbackId,
          adminNotes: replyText.trim(),
          newStatus: "reviewed",
        }),
      });
      if (res.ok) {
        toast.success("Reply saved!");
        setReplyText("");
        setExpandedId(null);
        fetchFeedbacks();
      } else {
        throw new Error("Failed");
      }
    } catch {
      toast.error("Failed to save reply");
    } finally {
      setReplying(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="w-3.5 h-3.5 text-red-500" />;
      case 'feature': return <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />;
      case 'rating': return <Star className="w-3.5 h-3.5 text-amber-500" />;
      default: return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "text-amber-500 border-amber-500/30",
      reviewed: "text-green-500 border-green-500/30",
      resolved: "text-blue-500 border-blue-500/30",
    };
    return (
      <Badge variant="outline" className={`text-[10px] font-bold ${styles[status] || ''}`}>
        {status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
        {status === 'reviewed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
        {status}
      </Badge>
    );
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-bold text-muted-foreground">Unlock dashboard to manage feedback</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {['all', 'pending', 'reviewed', 'resolved'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-bold transition-colors ${
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={fetchFeedbacks} disabled={loading} className="h-8 w-8">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Feedback List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />User Feedback
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-bold">{feedbacks.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {loading && feedbacks.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : feedbacks.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground text-center py-12">No feedback found</p>
            ) : (
              <div className="divide-y divide-border">
                {feedbacks.map(fb => (
                  <div key={fb.id} className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      {getTypeIcon(fb.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-extrabold text-foreground">
                            {fb.pay_tag ? `@${fb.pay_tag}` : fb.email || 'Anonymous'}
                          </span>
                          {getStatusBadge(fb.status)}
                          <span className="text-[10px] text-muted-foreground ml-auto font-medium">
                            {formatDistanceToNow(new Date(fb.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground leading-relaxed">{fb.message}</p>

                        {fb.admin_notes && (
                          <div className="mt-2 p-2.5 bg-primary/5 border border-primary/10 rounded-lg">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Admin Reply</p>
                            <p className="text-xs font-medium text-foreground">{fb.admin_notes}</p>
                          </div>
                        )}

                        <button
                          onClick={() => setExpandedId(expandedId === fb.id ? null : fb.id)}
                          className="flex items-center gap-1 text-[11px] text-primary font-bold mt-2 hover:underline"
                        >
                          {expandedId === fb.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {expandedId === fb.id ? 'Close' : 'Reply'}
                        </button>

                        {expandedId === fb.id && (
                          <div className="mt-2 flex gap-2">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Admin reply..."
                              className="min-h-[60px] text-sm font-medium resize-none"
                            />
                            <Button
                              size="icon"
                              onClick={() => handleReply(fb.id)}
                              disabled={replying || !replyText.trim()}
                              className="h-10 w-10 flex-shrink-0"
                            >
                              {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
