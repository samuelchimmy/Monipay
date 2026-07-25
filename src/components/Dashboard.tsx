import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayTag } from "@/contexts/PayTagContext";
import { ModeToggle } from "./ModeToggle";
import { MerchantDashboard } from "./MerchantDashboard";
import { UserDashboard } from "./UserDashboard";
import { NetworkActivationStatus } from "./NetworkActivationStatus";
import { TransactionHistory } from "./TransactionHistory";
import { Settings } from "./Settings";
import { DepositSuccessOverlay } from "./DepositSuccessOverlay";
import { WithdrawModal } from "./WithdrawModal";
import { FundWalletModal } from "./FundWalletModal";
import { CeloHoldingsCollapse } from "./CeloHoldingsCollapse";
import { BottomNav } from "./BottomNav";
import type { BottomNavTab } from "./BottomNav";
import { useDepositDetection } from "@/hooks/useDepositDetection";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useSecurityGate } from "./SecurityGate";
import { useStatusBar } from "@/hooks/useStatusBar";
import { useBackButton } from "@/hooks/useBackButton";
import { MoniPayLogo } from "./MoniPayLogo";
import { Clock, Eye, EyeOff, Send, ExternalLink, Bot, Sun, Moon, WalletMinimal } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { MoniBotSetupModal } from "./MoniBotSetupModal";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/wallet";
import { PayTagDisplay } from "./VerifiedBadge";
import { NetworkToggle } from "./NetworkToggle";
import { DentedCard } from "./DentedCard";
import { getChainConfig, CHAIN_CONFIGS } from "@/config/chains";
import type { SupportedNetwork } from "@/config/chains";
import { TEMPO_ENABLED } from "@/lib/featureFlags";
import { useRealtimePayments } from "@/hooks/useRealtimePayments";
import { useTheme } from "next-themes";
import { IOUClaimBanner } from "./claim/IOUClaimBanner";

const HIDE_BALANCE_KEY = "monipay_hide_balance";

export function Dashboard() {
  const {
    mode,
    profile,
    refreshBalance,
    updateBalance,
    setIsUnlocked,
    setCurrentScreen,
    isUnlocked,
    syncTransactions,
    decryptedPrivateKey,
    getActiveAddress,
  } = usePayTag();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const { pendingCount: invoiceBadgeCount } = useInvoices(profile?.id);
  useRealtimePayments();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<"monibot" | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showMoniBot, setShowMoniBot] = useState(false);
  const [hideBalance, setHideBalance] = useState(() => {
    return localStorage.getItem(HIDE_BALANCE_KEY) === "true";
  });

  // Bottom nav active tab
  const [activeTab, setActiveTab] = useState<BottomNavTab | null>(null);

  // Security gate for settings
  const { requestAccess, SecurityGateModal } = useSecurityGate();

  // Status bar styling based on mode
  useStatusBar({ mode });

  // Session auto-lock
  const handleLock = useCallback(() => {
    setIsUnlocked(false);
    setCurrentScreen("lock");
  }, [setIsUnlocked, setCurrentScreen]);

  useSessionManager(isUnlocked, handleLock);

  // Check if any modal/tab is open
  const isModalOpen = showHistory || showSettings || showWithdraw || showFund || showMoniBot || activeTab !== null;

  // Close one modal/tab handler for back button
  const closeModal = useCallback(() => {
    if (showSettings) setShowSettings(false);
    else if (showHistory) setShowHistory(false);
    else if (showWithdraw) setShowWithdraw(false);
    else if (showFund) setShowFund(false);
    else if (showMoniBot) setShowMoniBot(false);
    else if (activeTab !== null) setActiveTab(null);
  }, [showSettings, showHistory, showWithdraw, showFund, showMoniBot, activeTab]);

  // Back button handler (Android hardware button)
  useBackButton({
    isModalOpen,
    closeModal,
    isOnDashboard: true,
    navigateBack: () => {},
  });

  // Close all modals helper
  const closeAllModals = useCallback(() => {
    setShowHistory(false);
    setShowSettings(false);
    setShowWithdraw(false);
    setShowFund(false);
    setShowMoniBot(false);
    setActiveTab(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    requestAccess({
      title: "Access Settings",
      description: "Enter PIN or use biometrics to access settings",
      onSuccess: () => {
        closeAllModals();
        setShowSettings(true);
      },
    });
  }, [requestAccess, closeAllModals]);

  // Handle bottom nav tab press
  const handleTabPress = useCallback(
    (tab: BottomNavTab) => {
      // Always close everything first
      closeAllModals();

      // Use a microtask so state is cleared before opening the new modal
      setTimeout(() => {
        switch (tab) {
          case "account":
            handleOpenSettings();
            break;
          case "history":
            setShowHistory(true);
            break;
          default:
            setActiveTab(tab);
            break;
        }
      }, 0);
    },
    [closeAllModals, handleOpenSettings],
  );

  // Reset active tab when child modal closes
  const clearActiveTab = useCallback(() => {
    setActiveTab(null);
  }, []);

  const [networkToggleOpen, setNetworkToggleOpen] = useState(false);

  const toggleHideBalance = () => {
    const newValue = !hideBalance;
    setHideBalance(newValue);
    localStorage.setItem(HIDE_BALANCE_KEY, String(newValue));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshBalance(), syncTransactions()]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const displayBalance = profile?.balance || 0;
  const currentNetwork = (profile?.preferredNetwork || "base") as SupportedNetwork;
  const isTempoNetwork = currentNetwork === "tempo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="min-h-screen bg-background flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl safe-top">
        <div className="px-4 py-3 relative">
          <div className="flex items-center justify-between">
            {/* Logo — chain-colored */}
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
              <MoniPayLogo
                size={26}
                color={mode === "merchant" ? `hsl(${getChainConfig(currentNetwork).accentColor})` : `hsl(${getChainConfig(currentNetwork).accentColor})`}
                animationMode="header"
                isEmpty={displayBalance === 0}
              />
            </div>

            {/* Mode Toggle - centered */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <ModeToggle />
            </div>

            {/* Language Selector (compact) */}
            <LanguageSelector variant="compact" />

            {/* Theme Toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/10 transition-colors flex-shrink-0"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-foreground" />
              ) : (
                <Moon className="w-4 h-4 text-foreground" />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Balance Card with Dented Notch */}
      <div className="px-4 pt-2 pb-3 relative">
        {/* Floating Network Toggle — sits in the dent */}
        {profile?.wallet?.address && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
            <div className={`px-1 py-1 pb-1.5 bg-card/80 dark:bg-card/90 backdrop-blur-xl shadow-lg border border-border/30 transition-all duration-300 ${networkToggleOpen ? "rounded-3xl" : "rounded-3xl"}`}>
              <NetworkToggle onOpenChange={setNetworkToggleOpen} />
            </div>
          </div>
        )}

        <DentedCard
          className={`
            p-5 pt-10 relative overflow-hidden shadow-lg
            ${mode === "merchant" ? ((currentNetwork === 'bsc' || currentNetwork === 'celo' || currentNetwork === 'solana') ? "text-black" : "text-white") : "text-white bg-balance-card"}
          `}
          style={mode === "merchant" ? { backgroundColor: `hsl(${getChainConfig(currentNetwork).accentColor})` } : undefined}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.07] to-transparent pointer-events-none" />

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-[11px] font-medium tracking-wide uppercase">{t('balance')}</span>
                {profile?.payTag && <span className="opacity-35 text-[10px] font-medium">@{profile.payTag}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleHideBalance}
                  className="w-7 h-7 rounded-full bg-current/10 flex items-center justify-center hover:bg-current/15 transition-colors opacity-80"
                >
                  {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    closeAllModals();
                    setShowHistory(true);
                  }}
                  className="w-7 h-7 rounded-full bg-current/10 flex items-center justify-center hover:bg-current/15 transition-colors opacity-80"
                >
                  <Clock className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-[36px] font-bold tracking-tight leading-none">
                {hideBalance
                  ? "••••••"
                  : `$${displayBalance > 0 && displayBalance < 0.01 ? displayBalance.toFixed(6) : displayBalance?.toFixed(2) || "0.00"}`}
              </span>
              {!hideBalance && (
                <span className="opacity-50 text-sm font-medium">
                  USD
                </span>
              )}
            </div>

            {profile?.wallet?.address && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 opacity-45 text-[11px]">
                  <span className="font-mono tracking-wider">
                    {shortenAddress(getActiveAddress())}
                  </span>
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[9px] font-semibold"
                  >
                    Live
                  </motion.span>
                </div>
                {mode === "merchant" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      closeAllModals();
                      setShowWithdraw(true);
                    }}
                    className="h-7 px-3 text-[11px] bg-current/10 hover:bg-current/15 gap-1.5 rounded-full font-semibold"
                  >
                    <Send className="w-3 h-3" />
                    Withdraw
                  </Button>
                )}
              </div>
            )}

            {/* Activation Status inside wallet card */}
            {profile?.wallet?.address && (
              <div className="mb-4">
                <NetworkActivationStatus
                  walletAddress={getActiveAddress()}
                  network={currentNetwork}
                  decryptedPrivateKey={decryptedPrivateKey}
                  onActivationComplete={refreshBalance}
                  compact
                />
              </div>
            )}

            {currentNetwork === "celo" && profile?.wallet?.address && (
              <div className="mb-4">
                <CeloHoldingsCollapse walletAddress={profile.wallet.address} />
              </div>
            )}

            {/* Action Buttons INSIDE Balance Card — personal mode only */}
            {mode !== "merchant" && (
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    closeAllModals();
                    setShowFund(true);
                  }}
                  className="flex-1 h-[52px] rounded-full text-[13px] font-bold border border-white/20 text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <WalletMinimal className="w-4 h-4" />
                   {t('fund')}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    closeAllModals();
                    setShowMoniBot(true);
                  }}
                  className="flex-1 h-[52px] rounded-full text-[13px] font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  style={{ backgroundColor: `hsl(${getChainConfig(currentNetwork).accentColor})`, color: currentNetwork === 'bsc' || currentNetwork === 'celo' ? '#000' : '#fff' }}
                >
                  <Bot className="w-4 h-4" />
                  {t('monibot_ai')}
                </motion.button>
              </div>
            )}
          </div>
        </DentedCard>
      </div>

      {TEMPO_ENABLED && isTempoNetwork && (
        <div className="mx-4 mb-2 p-3 rounded-2xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">⚠️ Tempo Testnet Active</p>
            <p className="text-[10px] text-amber-500/80">These funds have no real value</p>
          </div>
          <a
            href="https://faucet.tempo.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-foreground text-background text-[10px] font-bold hover:opacity-80 transition-opacity"
          >
            Get Testnet Funds <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* IOU Claim Banner */}
      {profile?.id && (
        <IOUClaimBanner
          profileId={profile.id}
          onClaimed={refreshBalance}
        />
      )}

      {/* Dashboard Content */}
      <div className="flex-1 pb-24">
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === "merchant" ? (
            <motion.div
              key="merchant"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <MerchantDashboard activeTab={activeTab} onTabHandled={clearActiveTab} />
            </motion.div>
          ) : (
            <motion.div
              key="user"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <UserDashboard activeTab={activeTab} onTabHandled={clearActiveTab} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <BottomNav mode={mode} activeTab={activeTab} onTabPress={handleTabPress} badge={{ invoices: invoiceBadgeCount }} accentColor={`hsl(${getChainConfig(currentNetwork).accentColor})`} />

      {/* Transaction History */}
      <AnimatePresence>{showHistory && <TransactionHistory onClose={() => setShowHistory(false)} />}</AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <Settings
            onClose={() => {
              setShowSettings(false);
              setSettingsInitialSection(null);
            }}
            initialSection={settingsInitialSection}
          />
        )}
      </AnimatePresence>

      {/* Withdraw Modal (Merchant only) */}
      <WithdrawModal isOpen={showWithdraw} onClose={() => setShowWithdraw(false)} balance={displayBalance} />

      {/* Fund Wallet Modal */}
      <FundWalletModal
        isOpen={showFund}
        onClose={() => setShowFund(false)}
        walletAddress={getActiveAddress()}
        defaultNetwork={currentNetwork}
        onDepositSuccess={() => refreshBalance()}
      />

      {/* MoniBot Setup Modal */}
      <MoniBotSetupModal
        isOpen={showMoniBot}
        onClose={() => setShowMoniBot(false)}
        onOpenSettings={() => {
          closeAllModals();
          setSettingsInitialSection("monibot");
          setShowSettings(true);
        }}
      />

      {/* Security Gate Modal */}
      <AnimatePresence>{SecurityGateModal}</AnimatePresence>
    </motion.div>
  );
}