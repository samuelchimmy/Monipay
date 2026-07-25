import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { motion } from "framer-motion";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#26A5E4">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

type Platform = "discord" | "x" | "telegram";

interface SocialCheckFormProps {
  onIOUsFound: (ious: any[], platform: Platform, username: string) => void;
  onNoIOUs: () => void;
  checking: boolean;
  setChecking: (v: boolean) => void;
}

const PLATFORMS: { id: Platform; label: string; icon: React.FC<{ className?: string }>; placeholder: string; bgColor: string; glowColor: string }[] = [
  { id: "discord", label: "Discord", icon: DiscordIcon, placeholder: "Your Discord username", bgColor: "bg-[#5865F2]/10", glowColor: "shadow-[0_0_20px_rgba(88,101,242,0.15)]" },
  { id: "x", label: "X (Twitter)", icon: XIcon, placeholder: "Your X handle (no @)", bgColor: "bg-muted/50", glowColor: "shadow-[0_0_20px_rgba(255,255,255,0.06)]" },
  { id: "telegram", label: "Telegram", icon: TelegramIcon, placeholder: "Your Telegram username", bgColor: "bg-[#26A5E4]/10", glowColor: "shadow-[0_0_20px_rgba(38,165,228,0.15)]" },
];

export function SocialCheckForm({ onIOUsFound, onNoIOUs, checking, setChecking }: SocialCheckFormProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  async function handleCheck() {
    if (!selectedPlatform || !username.trim()) return;
    setChecking(true);
    setError("");

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/claim-iou`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          action: "check",
          platform: selectedPlatform,
          platformUserId: username.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      if (data.pendingIOUs?.length > 0) {
        onIOUsFound(data.pendingIOUs, selectedPlatform, username.trim());
      } else {
        onNoIOUs();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Platform selector */}
      <div className="space-y-3">
        {PLATFORMS.map((p, i) => {
          const Icon = p.icon;
          const selected = selectedPlatform === p.id;
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setSelectedPlatform(p.id); setError(""); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                selected
                  ? `border-primary/40 bg-primary/[0.06] ${p.glowColor}`
                  : "border-border/50 bg-card/40 hover:bg-card/60 hover:border-border"
              }`}
            >
              <div className={`w-11 h-11 rounded-xl ${p.bgColor} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.id === "discord" ? "Check your Discord" : p.id === "x" ? "See what's pending on X" : "Check your Telegram"}
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                selected ? "border-primary bg-primary" : "border-muted-foreground/30"
              }`}>
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Username input */}
      {selectedPlatform && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-3 pt-1"
        >
          <div className="relative">
            <Input
              placeholder={PLATFORMS.find(p => p.id === selectedPlatform)?.placeholder}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-13 text-base rounded-xl bg-card/60 border-border/50 text-foreground placeholder:text-muted-foreground/50 pl-4 pr-12 focus:border-primary/40 focus:ring-primary/20"
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          </div>

          <Button
            onClick={handleCheck}
            disabled={!username.trim() || checking}
            className="w-full h-12 gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-semibold text-sm shadow-[0_0_30px_rgba(0,82,255,0.25)] border-0"
            size="lg"
          >
            {checking ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
            ) : (
              <>Check for the bag 💰</>
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
