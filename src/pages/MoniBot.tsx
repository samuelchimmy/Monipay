import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { PageMeta } from "@/components/PageMeta";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Loader2,
  Shield,
  ArrowLeft,
  CheckCircle2,
  BarChart3,
  Users,
  MessageSquare,
  Terminal,
  Megaphone,
  Cpu,
  Sun,
  Moon,
  Send,
  FileCode,
  Receipt,
  Server,
  Mail,
} from "lucide-react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { decryptPrivateKey } from "@/lib/wallet";
import { privateKeyToAccount } from "viem/accounts";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { MoniBotOverviewTab } from "@/components/monibot/OverviewTab";
import { MoniBotCampaignsTab } from "@/components/monibot/CampaignsTab";
import { MoniBotChatTab } from "@/components/monibot/ChatTab";
import { MoniBotLogsTab } from "@/components/monibot/LogsTab";
import { MoniBotUsersTab } from "@/components/monibot/UsersTab";
import { MoniBotFeedbackTab } from "@/components/monibot/FeedbackTab";
import { MoniBotSystemTab } from "@/components/monibot/SystemTab";
import { MoniBotContractsTab } from "@/components/monibot/ContractsTab";
import { MoniBotReceiptScannerTab } from "@/components/monibot/ReceiptScannerTab";
import { MoniBotInfraTab } from "@/components/monibot/InfraTab";
import { ArcWaitlistTab } from "@/components/monibot/ArcWaitlistTab";
import { MagicPayTab } from "@/components/monibot/MagicPayTab";
import { useSecurityGate } from "@/components/SecurityGate";
import { WagmiWrapper } from "@/components/WagmiWrapper";
import { PayTagProvider } from "@/contexts/PayTagContext";

const STORAGE_KEY = "paytag_profile";
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export default function MoniBotPage() {
  return (
    <WagmiWrapper>
      <PayTagProvider>
        <MoniBotContent />
      </PayTagProvider>
    </WagmiWrapper>
  );
}

function MoniBotContent() {
  const navigate = useNavigate();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [account, setAccount] = useState<ReturnType<typeof privateKeyToAccount> | null>(null);
  const [encryptedKey, setEncryptedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [gateRequested, setGateRequested] = useState(false);
  const { requestAccess, SecurityGateModal } = useSecurityGate();

  // Load profile and encrypted key (AdminRoute already checks payTag)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const profile = JSON.parse(saved);
      setEncryptedKey(profile?.wallet?.encryptedPrivateKey || null);
    } catch (err) {
      console.error("[MoniBot] Failed to parse profile:", err);
    }
  }, []);

  const promptUnlock = useCallback(() => {
    setGateRequested(true);
    requestAccess({
      title: "Admin Auth",
      description: "Verify identity to unlock MoniBot",
      onSuccess: (pin?: string) => {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) return;
          const profile = JSON.parse(saved);
          const rawPin = pin?.trim();
          if (!rawPin) throw new Error("Missing PIN for admin unlock");
          const encryptedPrivateKey = profile?.wallet?.encryptedPrivateKey;
          if (!encryptedPrivateKey) throw new Error("Missing encrypted wallet");
          const pk = decryptPrivateKey(encryptedPrivateKey, rawPin);
          const acc = privateKeyToAccount(pk as `0x${string}`);
          setAccount(acc);
          setIsUnlocked(true);
          toast.success("Dashboard unlocked!");
          feedback("success");
        } catch (err) {
          console.error("[MoniBot] Decrypt failed:", err);
          toast.error("Failed to decrypt wallet");
          feedback("error");
        } finally {
          setGateRequested(false);
        }
      },
    });
  }, [requestAccess]);

  // Auto-trigger SecurityGate ONCE when key loads
  useEffect(() => {
    if (!isUnlocked && encryptedKey && !gateRequested) {
      promptUnlock();
    }
  }, [encryptedKey, isUnlocked, gateRequested, promptUnlock]);

  // Inactivity auto-lock
  useEffect(() => {
    if (!isUnlocked) return;

    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setAccount(null);
        setIsUnlocked(false);
        toast("Session expired. Re-authenticate to continue.");
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [isUnlocked]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!account) throw new Error("Not unlocked");
      return account.signMessage({ message });
    },
    [account],
  );

  const walletOptions = useMemo(() => {
    if (!isUnlocked || !account) return undefined;
    return { walletAddress: account.address, signMessage };
  }, [isUnlocked, account, signMessage]);

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "campaigns", label: "Campaigns", icon: Megaphone },
    { id: "users", label: "Users", icon: Users },
    { id: "magicpay", label: "MagicPay", icon: Sparkles },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
    { id: "chat", label: "AI", icon: Send },
    { id: "logs", label: "Logs", icon: Terminal },
    { id: "system", label: "System", icon: Cpu },
    { id: "contracts", label: "Contracts", icon: FileCode },
    { id: "receipts", label: "Receipts", icon: Receipt },
    { id: "infra", label: "Infra", icon: Server },
    { id: "arc-waitlist", label: "Arc", icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="MoniBot Admin"
        description="MoniBot command center — manage campaigns, transactions, and bot operations."
        path="/m0n1b0t-cmd"
        noIndex
      />
      {SecurityGateModal}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-foreground flex items-center gap-1.5 tracking-tight">
                MoniBot <VerifiedBadge size={18} />
              </h1>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Admin Command Center
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="h-9 w-9">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            {isUnlocked ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30 font-bold text-[11px] px-3">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 font-bold text-[11px] px-3">
                <Shield className="w-3 h-3 mr-1" />
                Locked
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* Locked state: show CTA so dismissing the gate doesn't strand the page */}
        {!isUnlocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 gap-4"
          >
            {gateRequested ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Shield className="w-10 h-10 text-amber-500" />
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  This dashboard is locked. Verify your identity to continue.
                </p>
                <Button onClick={promptUnlock} className="font-bold">
                  <Shield className="w-4 h-4 mr-2" />
                  Unlock Dashboard
                </Button>
              </>
            )}
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-12 h-11 bg-muted/50 p-1 rounded-xl">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="text-[11px] font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="overview" className="mt-5">
              <MoniBotOverviewTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="campaigns" className="mt-5">
              <MoniBotCampaignsTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="users" className="mt-5">
              <MoniBotUsersTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="magicpay" className="mt-5">
              <MagicPayTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="feedback" className="mt-5">
              <MoniBotFeedbackTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="chat" className="mt-5">
              <MoniBotChatTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="logs" className="mt-5">
              <MoniBotLogsTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="system" className="mt-5">
              <MoniBotSystemTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="contracts" className="mt-5">
              <MoniBotContractsTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="receipts" className="mt-5">
              <MoniBotReceiptScannerTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="infra" className="mt-5">
              <MoniBotInfraTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
            <TabsContent value="arc-waitlist" className="mt-5">
              <ArcWaitlistTab walletOptions={walletOptions} isUnlocked={isUnlocked} />
            </TabsContent>
          </motion.div>
        </Tabs>
      </main>
    </div>
  );
}
