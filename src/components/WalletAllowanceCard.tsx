/**
 * WalletAllowanceCard — on-chain MoniBot allowance management for wallet-only
 * sessions (Path B / Path C). No PIN, no encrypted key — signs via the
 * injected wallet (wagmi useWalletClient).
 *
 * Reads current ERC-20 allowance against the MoniBotRouter for the user's
 * preferred network and lets them approve / revoke. Tempo (TIP-20) is
 * intentionally hidden — fee sponsorship there bypasses approvals.
 */

import { useCallback, useEffect, useState } from "react";
import { useWalletClient, useSwitchChain } from "wagmi";
import {
  createPublicClient,
  http,
  erc20Abi,
  formatUnits,
  parseUnits,
} from "viem";
import { Loader2, ShieldCheck, Sparkles, Zap, Info, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getMoniBotConfig } from "@/lib/monibotContract";
import { wagmiChainFromNetwork } from "@/lib/wagmiConfig";
import { getChainConfig, type SupportedNetwork } from "@/config/chains";

interface Props {
  walletAddress: `0x${string}`;
  /** wallet_profiles row id (used only to bust local cache after writes) */
  profileId: string;
  /** persisted preferred_network on wallet_profiles ("base" | "bsc" | ...) */
  preferredNetwork: SupportedNetwork;
  /** Tokens to hide from the Celo selection grid (e.g. hide unsupported miniapp tokens) */
  hideTokens?: Array<"USDT" | "G$" | "USDC" | "USDm">;
}

const RPC: Record<string, string> = {
  base: "https://mainnet.base.org",
  bsc: "https://bsc-dataseed.binance.org",
  celo: "https://forno.celo.org",
  ink: "https://rpc-qnd.inkonchain.com",
  tempo: "https://rpc.moderato.tempo.xyz",
};

export function WalletAllowanceCard({
  walletAddress,
  profileId,
  preferredNetwork,
  hideTokens,
}: Props) {
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [amount, setAmount] = useState("");
  const [current, setCurrent] = useState<string>("0");
  const [currentIou, setCurrentIou] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"casual" | "magic" | "revoke" | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [casualSuccess, setCasualSuccess] = useState(false);
  const [magicSuccess, setMagicSuccess] = useState(false);

  // Dynamic token selection for Celo V1 / V2 migration
  const [selectedToken, setSelectedToken] = useState<"USDT" | "G$" | "USDC" | "USDm">("USDT");

  const config = getMoniBotConfig(preferredNetwork);
  const symbol = config.currency ?? "USDC";
  const chainCfg = getChainConfig(preferredNetwork);
  const iouRegistry = (chainCfg.iouRegistry || "") as `0x${string}` | "";

  // Dynamic contract and token parameters
  const isCelo = preferredNetwork === "celo";

  const celoTokenObj = isCelo
    ? chainCfg.supportedTokens?.find((t) => t.symbol === selectedToken)
    : null;

  const activeTokenAddress = isCelo && celoTokenObj
    ? celoTokenObj.address
    : config.tokenAddress;
  const activeSymbol = isCelo ? selectedToken : symbol;
  const activeDecimals = isCelo && celoTokenObj ? celoTokenObj.decimals : config.decimals;

  // USDT maps to V1 Router, others to V2 Router on Celo
  const activeRouter = isCelo
    ? (selectedToken === "USDT"
        ? (chainCfg.monibotRouterV1 as `0x${string}`)
        : (chainCfg.monibotRouter as `0x${string}`))
    : config.routerAddress;

  // USDT maps to V1 IOURegistry, others to V2 IOURegistry on Celo
  const activeIouRegistry = isCelo
    ? (selectedToken === "USDT"
        ? (chainCfg.iouRegistryV1 as `0x${string}`)
        : (chainCfg.iouRegistry as `0x${string}`))
    : iouRegistry;

  // Auto-detect G$ balance on Celo on load (skip if hidden in UI)
  useEffect(() => {
    if (isCelo && !hideTokens?.includes("G$")) {
      import("@/lib/celoWallet").then(({ getCeloTokenBalance }) => {
        getCeloTokenBalance(walletAddress, "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", 18)
          .then((bal) => {
            if (bal > 0) {
              setSelectedToken("G$");
            }
          })
          .catch(() => {});
      });
    }
  }, [walletAddress, isCelo, hideTokens]);

  // Tempo uses native fee sponsorship — no approval needed. (Celo-only: always false.)
  const isTempo = false;

  const fetchAllowance = useCallback(async () => {
    if (isTempo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const client = createPublicClient({
        chain: wagmiChainFromNetwork(preferredNetwork),
        transport: http(RPC[preferredNetwork] ?? RPC.base),
      });
      const value = await (client as any).readContract({
        address: activeTokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [walletAddress, activeRouter],
      });
      setCurrent(formatUnits(value as bigint, activeDecimals));
      if (activeIouRegistry) {
        try {
          const iouVal = await (client as any).readContract({
            address: activeTokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletAddress, activeIouRegistry],
          });
          setCurrentIou(formatUnits(iouVal as bigint, activeDecimals));
        } catch { /* ignore */ }
      } else {
        setCurrentIou("0");
      }
    } catch (err) {
      console.error("WalletAllowanceCard: fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, preferredNetwork, activeTokenAddress, activeRouter, activeDecimals, isTempo, activeIouRegistry]);

  useEffect(() => { fetchAllowance(); }, [fetchAllowance]);

  const writeApproval = async (rawAmount: string, spender: `0x${string}`) => {
    if (!walletClient) {
      toast.error("Connect your wallet first");
      return;
    }
    try {
      if (walletClient.chain?.id !== config.chainId) {
        await switchChainAsync({ chainId: config.chainId });
      }
      const amountWei = parseUnits(rawAmount, activeDecimals);
      const hash = await (walletClient as any).writeContract({
        address: activeTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amountWei],
        chain: wagmiChainFromNetwork(preferredNetwork),
      });
      toast.loading("Confirming approval…", { id: "approve" });
      const client = createPublicClient({
        chain: wagmiChainFromNetwork(preferredNetwork),
        transport: http(RPC[preferredNetwork] ?? RPC.base),
      });
      await client.waitForTransactionReceipt({ hash });
      await supabase.functions.invoke("wallet-session", {
        body: {
          action: "updateSettings",
          walletAddress,
          bot_allowance_amount: Number(rawAmount),
        },
      }).catch(() => { /* non-fatal */ });
      toast.success("Allowance updated", { id: "approve" });
      fetchAllowance();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage ?? err?.message ?? "Approval failed", { id: "approve" });
      throw err;
    }
  };

  const handleCasual = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setSubmitting("casual");
    try {
      await writeApproval(amount, activeRouter);
      setCasualSuccess(true);
      setTimeout(() => setCasualSuccess(false), 2000);
    } catch { /* toast handled */ }
    finally { setSubmitting(null); }
  };

  const handleMagic = async () => {
    if (!activeIouRegistry) {
      toast.error(`MagicPay is not deployed on ${preferredNetwork.toUpperCase()} yet`);
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setSubmitting("magic");
    try {
      await writeApproval(amount, activeIouRegistry);
      setMagicSuccess(true);
      setTimeout(() => setMagicSuccess(false), 2000);
    } catch { /* toast handled */ }
    finally { setSubmitting(null); }
  };

  const handleRevoke = async () => {
    setSubmitting("revoke");
    try { await writeApproval("0", activeRouter); } catch { /* */ }
    finally { setSubmitting(null); }
  };

  if (isTempo) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4 text-xs text-muted-foreground flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 mt-0.5 text-foreground" />
        <div>
          <p className="text-foreground font-medium text-[13px]">
            Tempo uses native fee sponsorship
          </p>
          <p className="mt-0.5">
            No allowance needed — MoniBot pays fees for you. Just link your socials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
          Approve AI Spending Allowance
        </h4>
        <button
          type="button"
          onClick={() => setTooltipOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors -mr-1 p-1"
          aria-label="About spending allowances"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {isCelo && (
        <div className="grid gap-1 p-1 bg-muted/40 rounded-lg text-[10px] font-bold"
          style={{ gridTemplateColumns: `repeat(${4 - (hideTokens?.length ?? 0)}, minmax(0, 1fr))` }}
        >
          {(["USDT", "G$", "USDC", "USDm"] as const)
            .filter((tok) => !hideTokens?.includes(tok))
            .map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => setSelectedToken(tok)}
                className={`py-1 rounded transition-all text-center ${
                  selectedToken === tok
                    ? "bg-background text-foreground shadow-sm animate-in fade-in zoom-in-95 duration-200"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tok}
              </button>
            ))}
        </div>
      )}

      {tooltipOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => setTooltipOpen(false)}
        >
          <div
            className="w-[300px] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3.5 text-[11px] leading-relaxed text-popover-foreground shadow-md animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">About</p>
              <button
                type="button"
                onClick={() => setTooltipOpen(false)}
                className="-mr-1 -mt-1 p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="font-bold mb-1">CasualPay</p>
            <p className="mb-3 text-muted-foreground">
              Send quick tips and everyday payments to moniTag™ users across social platforms, up to your set limit.
            </p>
            <p className="font-bold mb-1">MagicPay</p>
            <p className="mb-1.5 text-muted-foreground">
              If the recipient isn't on MoniPay yet, your payment is securely held on chain. MoniBot shares a claim link in the success message wherever the payment was made.
            </p>
            <p className="mb-3 text-muted-foreground">
              The recipient can access their funds by visiting the link and linking their social account. Unclaimed payments are refundable after 180 days.
            </p>
            <p className="text-muted-foreground">
              Each network requires its own approval. A 1% protocol fee applies to executed transactions.
            </p>
          </div>
        </div>
      )}

      {/* CasualPay + MagicPay tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl p-3 border border-border/60 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">CasualPay</span>
            <Sparkles className="w-3 h-3 text-foreground opacity-50" />
          </div>
          <p className="text-base font-extrabold tabular-nums tracking-tight text-foreground">
            ${loading ? "—" : parseFloat(current).toFixed(2)}
          </p>
          <p className="text-[10px] mt-0.5 text-muted-foreground">{activeSymbol} approved</p>
        </div>
        <div className={`rounded-xl p-3 border bg-muted/30 ${activeIouRegistry ? "border-border/60" : "border-dashed border-border/60 opacity-60"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">MagicPay</span>
            <Zap className="w-3 h-3 text-foreground opacity-50" />
          </div>
          <p className="text-base font-extrabold tabular-nums tracking-tight text-foreground">
            {activeIouRegistry ? `$${parseFloat(currentIou).toFixed(2)}` : "—"}
          </p>
          <p className="text-[10px] mt-0.5 text-muted-foreground">
            {activeIouRegistry ? `${activeSymbol} approved` : "Not on this chain"}
          </p>
        </div>
      </div>

      {/* Amount input + dual approve buttons */}
      <div className="rounded-xl p-3 border border-border/60 bg-muted/30 space-y-2.5">
        <label className="text-[10px] font-bold tracking-[0.18em] uppercase block text-muted-foreground">
          Approval amount ({activeSymbol})
        </label>
        <Input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100.00"
          className="h-10 text-sm font-semibold tabular-nums"
          min="0"
          step="0.01"
          disabled={submitting !== null}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleCasual}
            disabled={submitting !== null || !amount}
            className={`h-10 text-[11px] font-bold ${casualSuccess ? "bg-emerald-500 hover:bg-emerald-500 text-white" : ""}`}
          >
            {submitting === "casual" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : casualSuccess ? (
              <><Check className="w-3.5 h-3.5" strokeWidth={3} /> Success</>
            ) : (
              "Approve CasualPay"
            )}
          </Button>
          <Button
            onClick={handleMagic}
            disabled={submitting !== null || !amount || !activeIouRegistry}
            className={`h-10 text-[11px] font-bold ${magicSuccess ? "bg-emerald-500 hover:bg-emerald-500 text-white" : ""}`}
          >
            {submitting === "magic" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : magicSuccess ? (
              <><Check className="w-3.5 h-3.5" strokeWidth={3} /> Success</>
            ) : (
              "Approve MagicPay"
            )}
          </Button>
        </div>
        {Number(current) > 0 && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={submitting !== null}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {submitting === "revoke" ? "Revoking…" : "Revoke CasualPay allowance"}
          </button>
        )}
      </div>
    </div>
  );
}
