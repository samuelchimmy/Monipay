import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RefreshCw, Target, DollarSign, Users, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getGrantBalance } from "@/lib/monibotContract";
import { supabase } from "@/integrations/supabase/client";

interface MissionStats {
  contractBalance: number;
  currentUsers: number;
  targetUsers: number;
  isOnboarded: boolean;
}

export function MoniBotMissionProgress() {
  const [stats, setStats] = useState<MissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch actual contract balance on-chain
      const contractBalance = await getGrantBalance();

      // Fetch user stats from DB
      const { data, error: dbError } = await supabase.functions.invoke("monibot-stats", {
        method: "GET",
      });

      if (dbError) throw dbError;

      setStats({
        contractBalance: parseFloat(contractBalance) || 0,
        currentUsers: data?.current_users ?? 0,
        targetUsers: data?.target_users ?? 5000,
        isOnboarded: data?.is_onboarded ?? false,
      });
    } catch (err: any) {
      console.error("Failed to fetch MoniBot stats:", err);
      setError(err.message || "Failed to fetch mission stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <Card className="border-primary/20 bg-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading stats...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-destructive">{error || "Failed to load stats"}</p>
            <Button variant="ghost" size="sm" onClick={fetchStats}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const userProgress = stats.targetUsers > 0 
    ? (stats.currentUsers / stats.targetUsers) * 100 
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Mission Stats
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={fetchStats}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contract Balance */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Contract Balance
            </span>
            <span className="text-lg font-bold font-mono text-foreground">
              ${stats.contractBalance.toFixed(2)}
            </span>
          </div>

          {/* User Goal Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                User Goal
              </span>
              <span className="font-mono font-medium">
                {stats.currentUsers.toLocaleString()} / {stats.targetUsers.toLocaleString()}
              </span>
            </div>
            <Progress value={userProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {(stats.targetUsers - stats.currentUsers).toLocaleString()} to go
            </p>
          </div>

          {/* Status */}
          <div className="flex justify-center pt-1">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              stats.isOnboarded 
                ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                stats.isOnboarded ? "bg-green-500" : "bg-amber-500"
              }`} />
              {stats.isOnboarded ? "Active" : "Setup"}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
