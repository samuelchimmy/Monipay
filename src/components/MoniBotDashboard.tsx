import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { usePayTag } from "@/contexts/PayTagContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Loader2,
  Megaphone,
  Calendar,
  Activity,
  RefreshCw,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  Zap,
  Wallet,
  ArrowUpRight,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { useMoniBotDashboard, ScheduledCampaign, MoniBotTransaction, Campaign } from "@/hooks/useMoniBotDashboard";
import { VerifiedBadge } from "./VerifiedBadge";
import { formatDistanceToNow, format } from "date-fns";
import { getGrantBalance, MONIBOT_ROUTER_ADDRESS, MONIBOT_ROUTER_ADDRESS_BSC, USDC_ADDRESS, USDT_ADDRESS_BSC, getMoniBotConfig } from "@/lib/monibotContract";
import { decryptPrivateKey } from "@/lib/wallet";
import { createWalletClient, http, parseUnits, erc20Abi } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { SupportedNetwork } from "@/config/chains";
import { NetworkToggle } from "./NetworkToggle";

export function MoniBotDashboard() {
  const { profile } = usePayTag();
  
  // PIN unlock state for wallet signing
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [account, setAccount] = useState<ReturnType<typeof privateKeyToAccount> | null>(null);
  const [unlockPin, setUnlockPin] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Create signMessage function for the hook
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!account) {
      throw new Error("Dashboard not unlocked. Please enter PIN.");
    }
    return account.signMessage({ message });
  }, [account]);

  // Dashboard hook with wallet signing
  const dashboardOptions = useMemo(() => {
    if (!isUnlocked || !account) return undefined;
    return {
      walletAddress: account.address,
      signMessage,
    };
  }, [isUnlocked, account, signMessage]);

  const {
    schedule,
    transactions,
    campaigns,
    loading,
    triggerLoading,
    scheduleLoading,
    error,
    refetch,
    triggerCampaign,
    scheduleTodayCampaigns,
    cancelScheduledJob,
  } = useMoniBotDashboard(dashboardOptions);

  const [customMessage, setCustomMessage] = useState("");
  const [grantAmount, setGrantAmount] = useState("1.00");
  const [maxParticipants, setMaxParticipants] = useState("5");

  // Grant budget state - dual network
  const [grantBudgetBase, setGrantBudgetBase] = useState<string>("0");
  const [grantBudgetBsc, setGrantBudgetBsc] = useState<string>("0");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNetwork, setTopUpNetwork] = useState<SupportedNetwork>("celo");
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isBudgetLoading, setIsBudgetLoading] = useState(true);

  // Only allow access for @monibot
  const isAdmin = profile?.payTag?.toLowerCase() === "monibot";

  // Fetch grant budget on mount and after refetch
  useEffect(() => {
    if (!isAdmin) return;
    fetchGrantBudget();
  }, [isAdmin]);

  const fetchGrantBudget = async () => {
    setIsBudgetLoading(true);
    try {
      const [baseBalance, bscBalance] = await Promise.all([
        getGrantBalance('celo'),
        getGrantBalance('celo'),
      ]);
      setGrantBudgetBase(baseBalance);
      setGrantBudgetBsc(bscBalance);
    } catch (err) {
      console.error("Failed to fetch grant budget:", err);
    } finally {
      setIsBudgetLoading(false);
    }
  };

  const handleTopUpBudget = async () => {
    if (!profile?.wallet?.encryptedPrivateKey || !topUpAmount) {
      toast.error("Please enter an amount");
      return;
    }

    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsTopUpLoading(true);
    try {
      const pin = prompt("Enter your PIN to sign the transfer:");
      if (!pin) {
        setIsTopUpLoading(false);
        return;
      }

      const privateKey = decryptPrivateKey(profile.wallet.encryptedPrivateKey, pin);
      const account = privateKeyToAccount(privateKey as `0x${string}`);

      const config = getMoniBotConfig(topUpNetwork);
      const targetChain = celo;
      const rpcUrl = 'https://forno.celo.org';

      const walletClient = createWalletClient({
        account,
        chain: targetChain,
        transport: http(rpcUrl),
      });

      const amountInUnits = parseUnits(amount.toFixed(config.decimals), config.decimals);

      toast.loading(`Sending ${config.currency} to ${topUpNetwork.toUpperCase()} router...`, { id: "topup" });

      const hash = await walletClient.writeContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [config.routerAddress, amountInUnits],
        chain: targetChain,
        account,
      });

      toast.loading("Waiting for confirmation...", { id: "topup" });
      await new Promise((r) => setTimeout(r, 5000));

      toast.success(`Topped up $${amount.toFixed(2)} ${config.currency} on ${topUpNetwork.toUpperCase()}!`, { id: "topup" });
      feedback("success");
      setTopUpAmount("");
      await fetchGrantBudget();
    } catch (error: any) {
      console.error("Top-up failed:", error);
      toast.error(error.message || "Failed to top up budget", { id: "topup" });
      feedback("error");
    } finally {
      setIsTopUpLoading(false);
    }
  };

  // Handle PIN unlock
  const handleUnlock = async () => {
    if (!profile?.wallet?.encryptedPrivateKey || !unlockPin) {
      toast.error("Please enter your PIN");
      feedback("error");
      return;
    }

    setIsUnlocking(true);
    try {
      const privateKey = decryptPrivateKey(profile.wallet.encryptedPrivateKey, unlockPin);
      const acc = privateKeyToAccount(privateKey as `0x${string}`);
      setAccount(acc);
      setIsUnlocked(true);
      setUnlockPin("");
      toast.success("Dashboard unlocked!");
      feedback("success");
    } catch (err: any) {
      console.error("Failed to unlock:", err);
      toast.error("Invalid PIN");
      feedback("error");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleTriggerCampaign = async () => {
    if (!isUnlocked) {
      toast.error("Please unlock the dashboard first");
      feedback("error");
      return;
    }
    
    const result = await triggerCampaign({
      message: customMessage || undefined,
      grant_amount: parseFloat(grantAmount) || 1.00,
      max_participants: parseInt(maxParticipants) || 5,
    });

    if (result.success) {
      toast.success(result.message || "Campaign triggered!");
      feedback("success");
      setCustomMessage("");
    } else {
      toast.error(result.error || "Failed to trigger campaign");
      feedback("error");
    }
  };

  const handleScheduleTodayCampaigns = async () => {
    if (!isUnlocked) {
      toast.error("Please unlock the dashboard first");
      feedback("error");
      return;
    }
    
    const result = await scheduleTodayCampaigns(
      parseFloat(grantAmount) || 1.00,
      parseInt(maxParticipants) || 5
    );

    if (result.success) {
      toast.success(`Scheduled ${result.scheduled?.length || 0} campaigns for today!`);
      feedback("success");
    } else {
      toast.error(result.error || "Failed to schedule campaigns");
      feedback("error");
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!isUnlocked) {
      toast.error("Please unlock the dashboard first");
      feedback("error");
      return;
    }
    
    const result = await cancelScheduledJob(jobId);
    if (result.success) {
      toast.success("Campaign cancelled");
      feedback("success");
    } else {
      toast.error(result.error || "Failed to cancel");
      feedback("error");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-500 border-amber-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-500 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-red-500 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTxStatusIcon = (tx: MoniBotTransaction) => {
    if (tx.tx_hash?.startsWith('0x')) {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (tx.tx_hash?.includes('ERROR') || tx.tx_hash?.includes('REJECTED')) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  };

  // Non-admin users see nothing
  if (!isAdmin) {
    return null;
  }

  // Loading state
  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-base-blue to-purple-500 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
              Bot Dashboard
              <VerifiedBadge size={18} />
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Campaign controls</p>
              <NetworkToggle />
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Unlock Card - Required before campaign actions */}
      {!isUnlocked && (
        <Card className="border-amber-500/20 bg-card">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Key className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  type="password"
                  value={unlockPin}
                  onChange={(e) => setUnlockPin(e.target.value)}
                  placeholder="Enter PIN to unlock"
                  maxLength={6}
                  className="h-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                />
              </div>
              <Button
                onClick={handleUnlock}
                disabled={isUnlocking || !unlockPin}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 h-10 px-4"
              >
                {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isUnlocked && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-600 dark:text-green-400">Dashboard unlocked</span>
        </div>
      )}

      {/* Grant Budget Card - Dual Network */}
      <Card className="border-green-500/20 bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-green-500" />
              <CardTitle className="text-sm font-medium">Grant Budget</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchGrantBudget} disabled={isBudgetLoading} className="h-7 w-7">
              <RefreshCw className={`w-3.5 h-3.5 ${isBudgetLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Base · USDC</span>
              <span className="text-lg font-bold font-mono text-foreground">
                {isBudgetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `$${parseFloat(grantBudgetBase).toFixed(2)}`}
              </span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">BSC · USDT</span>
              <span className="text-lg font-bold font-mono text-foreground">
                {isBudgetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `$${parseFloat(grantBudgetBsc).toFixed(2)}`}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={topUpNetwork}
              onChange={(e) => setTopUpNetwork(e.target.value as SupportedNetwork)}
              className="h-9 rounded-md border border-border bg-background px-2 text-xs font-medium"
            >
              <option value="celo">Celo</option>
            </select>
            <Input
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Amount"
              min="1"
              step="1"
              className="h-9 flex-1"
            />
            <Button
              onClick={handleTopUpBudget}
              disabled={isTopUpLoading || !topUpAmount}
              size="sm"
              className="bg-green-600 hover:bg-green-700 h-9 px-3"
            >
              {isTopUpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowUpRight className="w-4 h-4 mr-1" />Top Up</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Campaign */}
      <Card className="border-base-blue/20 bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-base-blue" />
            <CardTitle className="text-sm font-medium">Campaign</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grant ($)</label>
              <Input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="1.00"
                min="0.01"
                step="0.01"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max</label>
              <Input
                type="number"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                placeholder="5"
                min="1"
                className="h-9"
              />
            </div>
          </div>
          
          <div>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Custom message (optional)..."
              className="min-h-[50px] text-sm resize-none"
              maxLength={280}
            />
            <span className="text-xs text-muted-foreground">{customMessage.length}/280</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleTriggerCampaign}
              disabled={triggerLoading}
              size="sm"
              className="bg-base-blue hover:bg-base-blue/90 h-9"
            >
              {triggerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" />Post</>}
            </Button>
            <Button
              variant="outline"
              onClick={handleScheduleTodayCampaigns}
              disabled={scheduleLoading}
              size="sm"
              className="h-9"
            >
              {scheduleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calendar className="w-4 h-4 mr-1.5" />Schedule 3</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">Schedule</CardTitle>
            {schedule.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">{schedule.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No campaigns scheduled
            </p>
          ) : (
            <div className="space-y-2">
              {schedule.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="text-center min-w-[44px]">
                      <p className="text-sm font-bold">{format(new Date(job.scheduled_at), 'h:mm')}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{format(new Date(job.scheduled_at), 'a')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        ${job.payload?.grant_amount || 1} × {job.payload?.max_participants || 5}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize truncate max-w-[100px]">
                        {job.payload?.time_slot || 'Campaign'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusBadge(job.status)}
                    {job.result?.social_tweet_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(`https://x.com/i/web/status/${job.result?.social_tweet_id}`, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {job.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        onClick={() => handleCancelJob(job.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Activity */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              <CardTitle className="text-sm font-medium">Activity</CardTitle>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[260px]">
            <div className="space-y-1.5">
              {transactions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No activity</p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-2.5 p-2.5 bg-muted/50 rounded-lg"
                  >
                    {getTxStatusIcon(tx)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">
                          @{tx.payer_pay_tag || tx.receiver_id?.substring(0, 8)}
                        </p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                          {tx.type === 'p2p_command' ? 'P2P' : tx.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${tx.amount.toFixed(2)} · {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {tx.replied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                      {tx.tweet_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => window.open(`https://x.com/i/web/status/${tx.tweet_id}`, '_blank')}
                        >
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

      {/* Campaign History */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />
            <CardTitle className="text-sm font-medium">History</CardTitle>
            {campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">{campaigns.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No campaigns yet</p>
          ) : (
            <div className="space-y-1.5">
              {campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {campaign.message?.substring(0, 40) || 'Campaign'}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${campaign.grant_amount} × {campaign.max_participants || '?'}
                      {campaign.posted_at && ` · ${formatDistanceToNow(new Date(campaign.posted_at), { addSuffix: true })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 ${
                        campaign.status === 'active' 
                          ? 'text-green-500 border-green-500/30' 
                          : 'text-muted-foreground'
                      }`}
                    >
                      {campaign.status}
                    </Badge>
                    {campaign.tweet_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(`https://x.com/i/web/status/${campaign.tweet_id}`, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
