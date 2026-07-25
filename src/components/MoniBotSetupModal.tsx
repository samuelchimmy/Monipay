import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Users, Clock, RefreshCw, Zap, Sparkles, ChevronRight, Bot, Link, Wallet, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "./BottomSheet";

interface MoniBotSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

// ==========================================
// 1. BRAND LOGOS
// ==========================================
const XLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);

const DiscordLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

const TelegramLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="m21.416 2.043-18.92 7.3c-1.764.68-1.756 1.692-.323 2.13l4.864 1.517 11.264-7.106c.531-.32.144-.067-.225.26l-9.103 8.216-.367 5.253c.536 0 .77-.245 1.069-.536l2.564-2.49 5.333 3.939c.983.542 1.69.263 1.933-.888l3.496-16.456c.355-1.425-.536-2.071-1.585-1.139z" />
  </svg>
);

// ==========================================
// 2. DATA
// ==========================================
const platformData = [
  {
    platform: "Twitter / X",
    icon: XLogo,
    prefix: "@monibot",
    accent: "from-neutral-800 to-neutral-600",
    commands: [
      { icon: Send, label: "Send Payment", cmd: "@monibot send $5 to @alice" },
      { icon: Users, label: "Multi-Send", cmd: "@monibot send $2 each to @bob, @charlie" },
      { icon: Sparkles, label: "Giveaway", cmd: "@monibot send $1 to first 50 replies" },
      { icon: Clock, label: "Scheduled", cmd: "@monibot send $5 to @alice in 5mins" },
      { icon: RefreshCw, label: "Balance", cmd: "@monibot balance" },
      { icon: Zap, label: "Allowance", cmd: "@monibot allowance" },
    ],
  },
  {
    platform: "Discord",
    icon: DiscordLogo,
    prefix: "!monibot",
    accent: "from-[hsl(235,86%,65%)] to-[hsl(235,86%,55%)]",
    commands: [
      { icon: Send, label: "Send Payment", cmd: "!monibot send $5 to @alice" },
      { icon: Users, label: "Multi-Send", cmd: "!monibot send $2 each to @bob, @charlie" },
      { icon: Sparkles, label: "Giveaway", cmd: "!monibot send $1 to first 50 replies" },
      { icon: Clock, label: "Scheduled", cmd: "!monibot send $5 to @alice in 5mins" },
      { icon: RefreshCw, label: "Balance", cmd: "!monibot balance" },
      { icon: Zap, label: "Allowance", cmd: "!monibot allowance" },
    ],
  },
  {
    platform: "Telegram",
    icon: TelegramLogo,
    prefix: "/monibot",
    accent: "from-[hsl(200,80%,55%)] to-[hsl(200,80%,45%)]",
    commands: [
      { icon: Send, label: "Send Payment", cmd: "/monibot send $5 to @alice" },
      { icon: Users, label: "Multi-Send", cmd: "/monibot send $2 each to @bob, @charlie" },
      { icon: Sparkles, label: "Giveaway", cmd: "/monibot send $1 to first 50 replies" },
      { icon: Clock, label: "Scheduled", cmd: "/monibot send $5 to @alice in 5mins" },
      { icon: RefreshCw, label: "Balance", cmd: "/monibot balance" },
      { icon: Zap, label: "Allowance", cmd: "/monibot allowance" },
    ],
  },
];

export function MoniBotSetupModal({ isOpen, onClose, onOpenSettings }: MoniBotSetupModalProps) {
  const [activePlatform, setActivePlatform] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isOpen || !isAutoPlaying) return;
    const timer = setInterval(() => {
      setActivePlatform((p) => (p + 1) % platformData.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isOpen, isAutoPlaying]);

  useEffect(() => {
    if (isOpen) {
      setActivePlatform(0);
      setIsAutoPlaying(true);
    }
  }, [isOpen]);

  const goTo = useCallback((idx: number) => {
    setActivePlatform(idx);
    setIsAutoPlaying(false);
  }, []);

  const current = platformData[activePlatform];
  const CurrentIcon = current.icon;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <Bot className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-bold text-foreground tracking-tight" style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}>MoniBot AI</h2>
          <p className="text-muted-foreground font-bold uppercase tracking-wider" style={{ fontSize: 'clamp(8px, 2.5vw, 10px)' }}>
            Autonomous Agent
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-5">
        {/* Compact Setup Steps */}
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-3 p-2.5 rounded-xl border ${onOpenSettings ? "border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" : "border-border bg-muted/20"}`}
            onClick={() => {
              if (onOpenSettings) {
                onClose();
                onOpenSettings();
              }
            }}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${onOpenSettings ? "bg-primary text-primary-foreground" : "bg-muted-foreground/10 text-muted-foreground"}`}>
              <Link className="w-3.5 h-3.5" />
            </div>
            <p className="font-bold text-foreground flex-1" style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}>1. Link accounts</p>
            {onOpenSettings && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/20">
            <div className="w-7 h-7 rounded-lg bg-muted-foreground/10 text-muted-foreground flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <p className="font-bold text-foreground" style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}>2. Set allowance</p>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/20">
            <div className="w-7 h-7 rounded-lg bg-muted-foreground/10 text-muted-foreground flex items-center justify-center shrink-0">
              <AtSign className="w-3.5 h-3.5" />
            </div>
            <p className="font-bold text-foreground" style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}>3. Mention monibot in commands</p>
          </div>
        </div>

        {/* Command Carousel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-muted-foreground uppercase tracking-[0.15em]" style={{ fontSize: 'clamp(8px, 2.5vw, 10px)' }}>
              Available Commands
            </h3>
            <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
              {platformData.map((p, idx) => {
                const TabIcon = p.icon;
                return (
                  <button
                    key={p.platform}
                    onClick={() => goTo(idx)}
                    className={`px-3 py-1.5 flex items-center justify-center rounded-lg transition-all ${
                      idx === activePlatform
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activePlatform}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-border bg-muted/10 overflow-hidden shadow-sm"
            >
              <div className={`px-5 py-3 bg-gradient-to-r ${current.accent} flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <CurrentIcon className="w-4 h-4 text-white" />
                  <span className="font-black text-white" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>{current.platform}</span>
                </div>
                <span className="font-mono font-bold text-white/90 bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm" style={{ fontSize: 'clamp(8px, 2.5vw, 10px)' }}>
                  {current.prefix}
                </span>
              </div>

              <div className="p-2 space-y-0.5">
                {current.commands.map((cmd) => {
                  const CmdIcon = cmd.icon;
                  return (
                    <div
                      key={cmd.label}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <CmdIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>{cmd.label}</p>
                        <p className="font-mono text-muted-foreground truncate" style={{ fontSize: 'clamp(9px, 2.5vw, 10px)' }}>{cmd.cmd}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progress Indicators */}
          <div className="flex justify-center gap-1.5 mt-4">
            {platformData.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className="relative h-1 rounded-full overflow-hidden transition-all bg-muted"
                style={{ width: idx === activePlatform ? 24 : 8 }}
              >
                {idx === activePlatform && (
                  <motion.div
                    className="absolute inset-0 bg-primary rounded-full origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 4.5, ease: "linear" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Button */}
        <Button
          onClick={onClose}
          variant="primary"
          size="default"
          className="w-full h-[52px] rounded-full"
          style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
        >
          Got It
        </Button>
      </div>
    </BottomSheet>
  );
}
