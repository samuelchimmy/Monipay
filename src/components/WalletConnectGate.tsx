/**
 * WalletConnectGate — entry point for Path C users (external wallets).
 *
 * Shown when:
 *   - User is on a standard browser (not MiniPay)
 *   - No legacy MoniPay profile exists locally
 *   - User has not yet connected a wagmi wallet
 *
 * Provides Injected + WalletConnect buttons, plus a link to fall back to
 * the legacy MoniPay account onboarding flow.
 */

import { useConnect } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { Wallet, Link2, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { MoniPayLogo } from "@/components/MoniPayLogo";
import { Footer } from "@/components/Footer";
import { feedback } from "@/lib/feedback";

const WC_PROJECT_ID = "fdef5f6c19413d2eb89836d77bad923c";

interface Props {
  onConnected?: () => void;
  onCreateMoniPayAccount?: () => void;
  title?: string;
  subtitle?: string;
}

export function WalletConnectGate({
  onConnected,
  onCreateMoniPayAccount,
  title = "Connect your wallet",
  subtitle = "Use MoniBot, Merchant tools and payments with any EVM wallet. No MoniPay account required.",
}: Props) {
  const { connect, isPending } = useConnect();
  const { theme, setTheme } = useTheme();
  const handle = (fn: () => void) => () => { feedback("tap"); fn(); };

  return (
    <div
      data-minipay=""
      className="fixed inset-0 flex flex-col safe-top overflow-hidden"
      style={{ background: "hsl(var(--mp-surface))", color: "hsl(var(--mp-ink))" }}
    >
      {/* MiniPay backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 480px at 20% 0%, hsl(var(--mp-primary) / 0.10), transparent 60%), radial-gradient(700px 420px at 85% 8%, hsl(var(--mp-primary) / 0.07), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--mp-ink) / 0.18) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 90%)",
            maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 90%)",
          }}
        />
      </div>

      {/* Yellow Celo pill header */}
      <div className="relative z-10 px-3 sm:px-6 pt-3">
        <div className="mx-auto max-w-5xl">
          <div
            className="flex items-center justify-between gap-2 rounded-full pl-2 pr-2 py-2 backdrop-blur-xl"
            style={{ background: "#FCFF52", border: "1px solid #000", boxShadow: "0 8px 32px -12px rgba(0,0,0,0.25)" }}
          >
            <div className="w-9 h-9" />
            <div className="flex items-center gap-2">
              <MoniPayLogo size={26} color="#000" animationMode="header" entranceOnMount />
              <span className="font-bold tracking-tight text-[15px] text-black">Monipay</span>
            </div>
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:block" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="max-w-md mx-auto w-full flex flex-col h-full justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center pb-7"
          >
            <h1 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight leading-[1.05]" style={{ color: "hsl(var(--mp-ink))" }}>
              {title.split(" ").slice(0, -1).join(" ")}{" "}
              <span style={{ color: "hsl(var(--mp-primary))" }}>{title.split(" ").slice(-1)[0]}</span>
            </h1>
            <p className="mt-3 text-[13px]" style={{ color: "hsl(var(--mp-muted))" }}>{subtitle}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            <button
              type="button"
              disabled={isPending}
              onClick={handle(() => connect({ connector: injected() }, { onSuccess: () => onConnected?.() }))}
              className="mp-cta w-full p-4 flex items-center gap-3 text-left !rounded-2xl disabled:opacity-60"
              style={{ minHeight: 72 }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[inset_0_0_0_1px_hsl(var(--primary-foreground)/0.18)]"
                style={{ background: "hsl(var(--primary-foreground) / 0.15)" }}
              >
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight">Browser wallet</p>
                <p className="text-[12px] opacity-80 mt-0.5">MetaMask, Rabby, Coinbase</p>
              </div>
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={handle(() => connect({ connector: walletConnect({ projectId: WC_PROJECT_ID }) }, { onSuccess: () => onConnected?.() }))}
              className="mp-card w-full p-4 flex items-center gap-3 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              style={{ minHeight: 72 }}
            >
              <div className="mp-icon-frame w-11 h-11 flex-shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight" style={{ color: "hsl(var(--mp-ink))" }}>WalletConnect</p>
                <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--mp-muted))" }}>Scan with any mobile wallet</p>
              </div>
            </button>
          </motion.div>

          {onCreateMoniPayAccount && (
            <div className="text-center pt-6">
              <button
                type="button"
                onClick={onCreateMoniPayAccount}
                className="text-xs underline underline-offset-4"
                style={{ color: "hsl(var(--mp-muted))" }}
              >
                Create a MoniPay account instead
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <Footer variant="minimal" />
      </div>
    </div>
  );
}