import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Megaphone, Send, Calendar, Loader2, Trash2, ExternalLink,
  CheckCircle2, XCircle, Clock, RefreshCw, Wallet, ArrowUpRight, Zap, CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { useMoniBotDashboard } from "@/hooks/useMoniBotDashboard";
import { getGrantBalance, getMoniBotConfig } from "@/lib/monibotContract";
import { formatDistanceToNow, format } from "date-fns";
import { decryptPrivateKey } from "@/lib/wallet";
import { createWalletClient, http, parseUnits, erc20Abi } from "viem";
import { celo } from "@/lib/wagmiConfig";
import { privateKeyToAccount } from "viem/accounts";
import type { SupportedNetwork } from "@/config/chains";
import { TEMPO_ENABLED } from "@/lib/featureFlags";
import type { WalletOptions } from "./types";

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

export function MoniBotCampaignsTab({ walletOptions, isUnlocked }: Props) {
  const {
    schedule, transactions, campaigns, loading, triggerLoading, scheduleLoading,
    error, refetch, triggerCampaign, scheduleTodayCampaigns, cancelScheduledJob, deleteScheduledJob,
    deleteCampaign, markCampaignDone,
  } = useMoniBotDashboard(walletOptions);

  const [customMessage, setCustomMessage] = useState("");
  const [grantAmount, setGrantAmount] = useState("1.00");
  const [maxParticipants, setMaxParticipants] = useState("5");
  const [campaignNetwork, setCampaignNetwork] = useState<SupportedNetwork>("celo");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNetwork, setTopUpNetwork] = useState<SupportedNetwork>("celo");
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [grantBudgetBase, setGrantBudgetBase] = useState("0");
  const [grantBudgetBsc, setGrantBudgetBsc] = useState("0");
  const [isBudgetLoading, setIsBudgetLoading] = useState(true);

  const [grantBudgetTempo, setGrantBudgetTempo] = useState("0");

  const fetchBudget = useCallback(async () => {
    setIsBudgetLoading(true);
    try {
      const promises: Promise<string>[] = [getGrantBalance('celo')];
      const results = await Promise.all(promises);
      setGrantBudgetBase(results[0]);
      setGrantBudgetBsc(results[1]);
    } catch { /* silent */ }
    finally { setIsBudgetLoading(false); }
  }, []);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  const handleTopUp = async () => {
    if (!topUpAmount) { toast.error("Enter amount"); return; }
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }

    setIsTopUpLoading(true);
    try {
      const pin = prompt("Enter PIN to sign:");
      if (!pin) { setIsTopUpLoading(false); return; }

      const saved = JSON.parse(localStorage.getItem('paytag_profile') || '{}');
      const pk = decryptPrivateKey(saved.wallet.encryptedPrivateKey, pin);
      const acc = privateKeyToAccount(pk as `0x${string}`);
      const config = getMoniBotConfig(topUpNetwork);
      const chain = celo;
      const rpc = 'https://forno.celo.org';

      const client = createWalletClient({ account: acc, chain, transport: http(rpc) });
      const units = parseUnits(amount.toFixed(config.decimals), config.decimals);

      toast.loading(`Sending ${config.currency}...`, { id: "topup" });
      await client.writeContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [config.routerAddress, units],
        chain, account: acc,
      });
      toast.loading("Confirming...", { id: "topup" });
      await new Promise(r => setTimeout(r, 5000));
      toast.success(`Topped up $${amount.toFixed(2)} on ${topUpNetwork.toUpperCase()}!`, { id: "topup" });
      feedback("success");
      setTopUpAmount("");
      await fetchBudget();
    } catch (err: any) {
      toast.error(err.message || "Top-up failed", { id: "topup" });
      feedback("error");
    } finally {
      setIsTopUpLoading(false);
    }
  };

  const handleTrigger = async () => {
    if (!isUnlocked) { toast.error("Unlock first"); return; }
    const result = await triggerCampaign({
      message: customMessage || undefined,
      grant_amount: parseFloat(grantAmount) || 1,
      max_participants: parseInt(maxParticipants) || 5,
      network: campaignNetwork,
    });
    if (result.success) {
      toast.success(result.message || "Campaign triggered!");
      feedback("success");
      setCustomMessage("");
    } else {
      toast.error(result.error || "Failed");
      feedback("error");
    }
  };

  const handleSchedule = async () => {
    if (!isUnlocked) { toast.error("Unlock first"); return; }
    const result = await scheduleTodayCampaigns(parseFloat(grantAmount) || 1, parseInt(maxParticipants) || 5);
    if (result.success) {
      toast.success(`Scheduled ${result.scheduled?.length || 0} campaigns!`);
      feedback("success");
    } else {
      toast.error(result.error || "Failed");
      feedback("error");
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!isUnlocked) return;
    const r = await cancelScheduledJob(jobId);
    if (r.success) { toast.success("Cancelled"); feedback("success"); }
    else { toast.error(r.error || "Failed"); }
  };

  const handleDelete = async (jobId: string) => {
    if (!isUnlocked) return;
    const r = await deleteScheduledJob(jobId);
    if (r.success) { toast.success("Deleted"); feedback("success"); }
    else { toast.error(r.error || "Failed"); }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!isUnlocked) return;
    const r = await deleteCampaign(campaignId);
    if (r.success) { toast.success("Campaign deleted"); feedback("success"); }
    else { toast.error(r.error || "Failed"); }
  };

  const handleMarkDone = async (campaignId: string) => {
    if (!isUnlocked) return;
    const r = await markCampaignDone(campaignId);
    if (r.success) { toast.success("Marked as done"); feedback("success"); }
    else { toast.error(r.error || "Failed"); }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: any }> = {
      pending: { color: 'text-amber-500 border-amber-500/30', icon: Clock },
      completed: { color: 'text-green-500 border-green-500/30', icon: CheckCircle2 },
      cancelled: { color: 'text-red-500 border-red-500/30', icon: XCircle },
    };
    const cfg = map[status] || { color: '', icon: null };
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`${cfg.color} text-[10px]`}>
        {Icon && <Icon className="w-3 h-3 mr-1" />}{status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Grant Budget */}
      <Card className="border-green-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-500" />Grant Budget
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchBudget} disabled={isBudgetLoading} className="h-7 w-7">
              <RefreshCw className={`w-3.5 h-3.5 ${isBudgetLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`grid gap-2 ${TEMPO_ENABLED ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Base · USDC</span>
              <span className="text-lg font-bold font-mono">
                {isBudgetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `$${parseFloat(grantBudgetBase).toFixed(2)}`}
              </span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">BSC · USDT</span>
              <span className="text-lg font-bold font-mono">
                {isBudgetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `$${parseFloat(grantBudgetBsc).toFixed(2)}`}
              </span>
            </div>
            {TEMPO_ENABLED && (
              <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg border border-foreground/10">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tempo · αUSD</span>
                <span className="text-lg font-bold font-mono">
                  {isBudgetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `$${parseFloat(grantBudgetTempo).toFixed(2)}`}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <select value={topUpNetwork} onChange={(e) => setTopUpNetwork(e.target.value as SupportedNetwork)} className="h-9 rounded-md border border-border bg-background px-2 text-xs font-medium">
              <option value="celo">Celo</option>
            </select>
            <Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="Amount" className="h-9 flex-1" />
            <Button onClick={handleTopUp} disabled={isTopUpLoading || !topUpAmount} size="sm" className="bg-green-600 hover:bg-green-700 h-9 px-3">
              {isTopUpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowUpRight className="w-4 h-4 mr-1" />Top Up</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Campaign with Network Toggle */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />New Campaign
            </CardTitle>
            <div className="flex items-center bg-muted rounded-full p-0.5">
              <button
                onClick={() => setCampaignNetwork('celo')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${campaignNetwork === 'celo' ? 'bg-[#FCFF52] text-gray-950' : 'text-muted-foreground'}`}
              >Celo</button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Grant (USDC)
              </label>
              <Input type="number" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} placeholder="1.00" className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Users</label>
              <Input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="5" className="h-9" />
            </div>
          </div>
          <div>
            <Textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Custom message (optional)..." className="min-h-[50px] text-sm resize-none" maxLength={280} />
            <div className="flex items-center justify-between mt-1">
              <Badge variant="outline" className="text-[10px]">{campaignNetwork.toUpperCase()}</Badge>
              <span className="text-xs text-muted-foreground">{customMessage.length}/280</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleTrigger} disabled={triggerLoading || !isUnlocked} size="sm" className="bg-primary hover:bg-primary/90 h-9">
              {triggerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" />Post</>}
            </Button>
            <Button variant="outline" onClick={handleSchedule} disabled={scheduleLoading || !isUnlocked} size="sm" className="h-9">
              {scheduleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calendar className="w-4 h-4 mr-1.5" />Schedule 3</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
            {schedule.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{schedule.length}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No campaigns scheduled</p>
          ) : (
            <div className="space-y-2">
              {schedule.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="text-center min-w-[44px]">
                      <p className="text-sm font-bold">{format(new Date(job.scheduled_at), 'h:mm')}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{format(new Date(job.scheduled_at), 'a')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">${job.payload?.grant_amount || 1} × {job.payload?.max_participants || 5}</p>
                      <p className="text-xs text-muted-foreground capitalize truncate max-w-[100px]">{job.payload?.time_slot || 'Campaign'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusBadge(job.status)}
                    {job.result?.social_tweet_id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`https://x.com/i/web/status/${job.result?.social_tweet_id}`, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {job.status === 'pending' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => handleCancel(job.id)} title="Cancel">
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(job.id)} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign History */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />
            <CardTitle className="text-sm font-medium">History</CardTitle>
            {campaigns.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{campaigns.length}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No campaigns yet</p>
          ) : (
            <div className="space-y-1.5">
              {campaigns.slice(0, 8).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.message?.substring(0, 40) || 'Campaign'}...</p>
                    <p className="text-xs text-muted-foreground">
                      ${c.grant_amount} × {c.max_participants || '?'}
                      {c.posted_at && ` · ${formatDistanceToNow(new Date(c.posted_at), { addSuffix: true })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 ${c.status === 'active' ? 'text-green-500 border-green-500/30' : ''}`}>
                      {c.status}
                    </Badge>
                    {c.tweet_id && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`https://x.com/i/web/status/${c.tweet_id}`, '_blank')}>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                    {c.status !== 'completed' && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500" onClick={() => handleMarkDone(c.id)} title="Mark as done">
                        <CheckCheck className="w-3 h-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteCampaign(c.id)} title="Delete campaign">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
