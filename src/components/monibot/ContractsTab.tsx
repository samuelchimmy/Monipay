import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { parseUnits, formatUnits, erc20Abi } from "viem";
import { wagmiChainFromNetwork } from "@/lib/wagmiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, Unplug, ExternalLink, Loader2, CheckCircle2, XCircle,
  ArrowUpDown, Shield, Coins, Users, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { CHAIN_CONFIGS, type SupportedNetwork, type EvmNetwork } from "@/config/chains";
import { MoniPayRouterABI } from "@/lib/abis/MoniPayRouterABI";
import { MoniBotRouterABI } from "@/lib/abis/MoniBotRouterABI";
import { WagmiWrapper } from "@/components/WagmiWrapper";
import type { WalletOptions } from "./types";

interface ContractsTabProps {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

type TxStatus = { hash?: string; status: "idle" | "pending" | "success" | "error"; error?: string };

function ContractsContent({ isUnlocked }: ContractsTabProps) {
  const [network, setNetwork] = useState<SupportedNetwork>("celo");
  const chain = CHAIN_CONFIGS[network as EvmNetwork];
  const wagmiChain = wagmiChainFromNetwork(network);

  // Active EVM chains that have at least one router deployed (Base, BSC, Tempo, Celo, Ink)
  const ACTIVE_NETWORKS = (Object.keys(CHAIN_CONFIGS) as EvmNetwork[]).filter(
    n => CHAIN_CONFIGS[n].status === "active" &&
         (CHAIN_CONFIGS[n].monipayRouter || CHAIN_CONFIGS[n].monibotRouter)
  );

  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [txStatus, setTxStatus] = useState<Record<string, TxStatus>>({});

  const wrongChain = isConnected && chainId !== chain.id;

  // ── Read: MoniPayRouter ──
  const { data: mpTreasury } = useReadContract({
    address: chain.monipayRouter as `0x${string}`,
    abi: MoniPayRouterABI,
    functionName: "platformTreasury",
    chainId: chain.id,
    query: { enabled: !!chain.monipayRouter, refetchInterval: 15000 },
  });
  const { data: mpVolume } = useReadContract({
    address: chain.monipayRouter as `0x${string}`,
    abi: MoniPayRouterABI,
    functionName: "totalVolume",
    chainId: chain.id,
    query: { enabled: !!chain.monipayRouter, refetchInterval: 15000 },
  });
  const { data: mpFees } = useReadContract({
    address: chain.monipayRouter as `0x${string}`,
    abi: MoniPayRouterABI,
    functionName: "totalFeesCollected",
    chainId: chain.id,
    query: { enabled: !!chain.monipayRouter, refetchInterval: 15000 },
  });

  // ── Read: MoniPayRouter Owner ──
  const { data: mpOwner } = useReadContract({
    address: chain.monipayRouter as `0x${string}`,
    abi: MoniPayRouterABI,
    functionName: "owner",
    chainId: chain.id,
    query: { enabled: !!chain.monipayRouter },
  });

  // ── Read: MoniBotRouter ──
  const { data: mbTreasury } = useReadContract({
    address: chain.monibotRouter as `0x${string}`,
    abi: MoniBotRouterABI,
    functionName: "platformTreasury",
    chainId: chain.id,
    query: { refetchInterval: 15000 },
  });
  const { data: mbFeeBps } = useReadContract({
    address: chain.monibotRouter as `0x${string}`,
    abi: MoniBotRouterABI,
    functionName: "platformFeeBps",
    chainId: chain.id,
    query: { refetchInterval: 15000 },
  });
  const { data: mbGrantBalance, refetch: refetchGrantBalance } = useReadContract({
    address: chain.monibotRouter as `0x${string}`,
    abi: MoniBotRouterABI,
    functionName: "getGrantBalance",
    chainId: chain.id,
    query: { refetchInterval: 15000 },
  });

  // ── Read: MoniBotRouter Owner ──
  const { data: mbOwner } = useReadContract({
    address: chain.monibotRouter as `0x${string}`,
    abi: MoniBotRouterABI,
    functionName: "owner",
    chainId: chain.id,
  });

  const ismpOwner = isConnected && address && mpOwner && address.toLowerCase() === (mpOwner as string).toLowerCase();
  const ismbOwner = isConnected && address && mbOwner && address.toLowerCase() === (mbOwner as string).toLowerCase();

  const fmt = (val: bigint | undefined) => val !== undefined ? formatUnits(val, chain.decimals) : "—";
  const explorerLink = (addr: string) => `${chain.explorerUrl}/address/${addr}`;
  const txLink = (hash: string) => `${chain.explorerUrl}/tx/${hash}`;

  const setStatus = (key: string, s: TxStatus) => setTxStatus(prev => ({ ...prev, [key]: s }));

  const execTx = async (key: string, fn: () => Promise<`0x${string}`>) => {
    if (wrongChain) {
      switchChain({ chainId: chain.id });
      return;
    }
    setStatus(key, { status: "pending" });
    try {
      const hash = await fn();
      setStatus(key, { hash, status: "success" });
      toast.success(`Tx submitted: ${hash.slice(0, 10)}…`);
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || "Transaction failed";
      setStatus(key, { status: "error", error: msg });
      toast.error(msg);
    }
  };

  const TxBadge = ({ id }: { id: string }) => {
    const s = txStatus[id];
    if (!s || s.status === "idle") return null;
    if (s.status === "pending") return <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1"><Loader2 className="w-3 h-3 animate-spin" />Pending</Badge>;
    if (s.status === "success") return (
      <a href={txLink(s.hash!)} target="_blank" rel="noopener noreferrer">
        <Badge className="bg-green-500/10 text-green-500 border-green-500/30 gap-1 cursor-pointer"><CheckCircle2 className="w-3 h-3" />Success <ExternalLink className="w-3 h-3" /></Badge>
      </a>
    );
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{s.error?.slice(0, 40)}</Badge>;
  };

  // ── Form states ──
  const [mpNewTreasury, setMpNewTreasury] = useState("");
  const [mbNewTreasury, setMbNewTreasury] = useState("");
  const [mbNewFee, setMbNewFee] = useState([130]);
  const [executorAddr, setExecutorAddr] = useState("");
  const [executorCheck, setExecutorCheck] = useState("");
  const [executorCheckResult, setExecutorCheckResult] = useState<boolean | null>(null);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [depositAmt, setDepositAmt] = useState("");

  const { data: adminTokenBalance } = useReadContract({
    address: chain.token as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    chainId: chain.id,
    query: { enabled: !!address, refetchInterval: 15000 },
  });

  const [emergencyToken, setEmergencyToken] = useState("");
  const [emergencyAmt, setEmergencyAmt] = useState("");

  const { data: isExec, refetch: refetchExec } = useReadContract({
    address: chain.monibotRouter as `0x${string}`,
    abi: MoniBotRouterABI,
    functionName: "isExecutor",
    args: [executorCheck as `0x${string}`],
    chainId: chain.id,
    query: { enabled: executorCheck.length === 42 },
  });

  return (
    <div className="space-y-5">
      {/* Wallet + Network bar */}
      <Card className="border-border bg-card">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {isConnected ? (
              <>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/30 font-mono text-xs px-3 py-1.5">
                  <Wallet className="w-3 h-3 mr-1.5" />
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => disconnect()} className="text-xs gap-1.5">
                  <Unplug className="w-3.5 h-3.5" />Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={() => connect({ connector: injected() })}
                disabled={isConnecting}
                className="gap-2 font-bold"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Connect Admin Wallet
              </Button>
            )}

            <div className="ml-auto flex gap-2">
              {ACTIVE_NETWORKS.map(n => (
                <Button
                  key={n}
                  variant={network === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNetwork(n)}
                  className="font-bold text-xs uppercase"
                >
                  {CHAIN_CONFIGS[n].name ?? n}
                </Button>
              ))}
            </div>

            {wrongChain && (
              <Button size="sm" variant="destructive" onClick={() => switchChain({ chainId: chain.id })} className="gap-1.5 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5" />Switch to {chain.name}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MoniPayRouter Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />MoniPayRouter
              <Badge variant="outline" className="text-[10px] font-mono">{chain.name}</Badge>
              {isConnected && (
                ismpOwner
                  ? <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" />Owner</Badge>
                  : <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] gap-1"><XCircle className="w-3 h-3" />Not Owner</Badge>
              )}
            </CardTitle>
            {chain.monipayRouter && (
              <a href={explorerLink(chain.monipayRouter)} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono">
                {chain.monipayRouter.slice(0, 6)}…{chain.monipayRouter.slice(-4)} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Read values */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Treasury</p>
              <p className="text-xs font-mono mt-1 truncate">{mpTreasury as string || "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Volume</p>
              <p className="text-sm font-bold mt-1">{fmt(mpVolume as bigint)} {chain.currency}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fees Collected</p>
              <p className="text-sm font-bold mt-1">{fmt(mpFees as bigint)} {chain.currency}</p>
            </div>
          </div>

          {/* Set Treasury */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs font-bold">Set Treasury</Label>
              <Input
                placeholder="0x…"
                value={mpNewTreasury}
                onChange={e => setMpNewTreasury(e.target.value)}
                className="h-9 text-xs font-mono mt-1"
              />
            </div>
            <Button
              size="sm"
              disabled={!isConnected || !mpNewTreasury}
              onClick={() => execTx("mp-treasury", () =>
                writeContractAsync({
                  account: address!,
                  chain: wagmiChain,
                  address: chain.monipayRouter as `0x${string}`,
                  abi: MoniPayRouterABI,
                  functionName: "setTreasury",
                  args: [mpNewTreasury as `0x${string}`],
                })
              )}
              className="h-9 font-bold text-xs"
            >
              {wrongChain ? `Switch to ${chain.name}` : "Submit"}
            </Button>
            <TxBadge id="mp-treasury" />
          </div>
        </CardContent>
      </Card>

      {/* MoniBotRouter Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />MoniBotRouter
              <Badge variant="outline" className="text-[10px] font-mono">{chain.name}</Badge>
              {isConnected && (
                ismbOwner
                  ? <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" />Owner</Badge>
                  : <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] gap-1"><XCircle className="w-3 h-3" />Not Owner</Badge>
              )}
            </CardTitle>
            <a href={explorerLink(chain.monibotRouter)} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono">
              {chain.monibotRouter.slice(0, 6)}…{chain.monibotRouter.slice(-4)} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Read values */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Treasury</p>
              <p className="text-xs font-mono mt-1 truncate">{mbTreasury as string || "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fee (BPS)</p>
              <p className="text-sm font-bold mt-1">{mbFeeBps !== undefined ? Number(mbFeeBps).toString() : "—"} bps</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 relative group">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Grant Balance</p>
              <p className="text-sm font-bold mt-1">{fmt(mbGrantBalance as bigint)} {chain.currency}</p>
              <button
                onClick={() => refetchGrantBalance()}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                title="Refresh balance"
              >
                <ArrowUpDown className="w-3 h-3" />
              </button>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fee %</p>
              <p className="text-sm font-bold mt-1">{mbFeeBps !== undefined ? (Number(mbFeeBps) / 100).toFixed(2) : "—"}%</p>
            </div>
          </div>

          {/* Set Treasury */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Set Treasury</Label>
            <div className="flex gap-2">
              <Input placeholder="0x…" value={mbNewTreasury} onChange={e => setMbNewTreasury(e.target.value)} className="h-9 text-xs font-mono" />
              <Button size="sm" disabled={!isConnected || !mbNewTreasury} className="h-9 font-bold text-xs"
                onClick={() => execTx("mb-treasury", () =>
                  writeContractAsync({
                    account: address!,
                    chain: wagmiChain,
                    address: chain.monibotRouter as `0x${string}`,
                    abi: MoniBotRouterABI,
                    functionName: "setPlatformTreasury",
                    args: [mbNewTreasury as `0x${string}`],
                  })
                )}
              >Submit</Button>
              <TxBadge id="mb-treasury" />
            </div>
          </div>

          {/* Set Platform Fee */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">Set Platform Fee — {mbNewFee[0]} bps ({(mbNewFee[0] / 100).toFixed(2)}%)</Label>
            <Slider value={mbNewFee} onValueChange={setMbNewFee} min={0} max={500} step={1} className="my-2" />
            <div className="flex gap-2">
              <Button size="sm" disabled={!isConnected} className="h-9 font-bold text-xs"
                onClick={() => execTx("mb-fee", () =>
                  writeContractAsync({
                    account: address!,
                    chain: wagmiChain,
                    address: chain.monibotRouter as `0x${string}`,
                    abi: MoniBotRouterABI,
                    functionName: "setPlatformFee",
                    args: [BigInt(mbNewFee[0])],
                  })
                )}
              >Update Fee</Button>
              <TxBadge id="mb-fee" />
            </div>
          </div>

          {/* Executor Management */}
          <div className="space-y-2">
            <Label className="text-xs font-bold flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Executor Management</Label>
            <div className="flex gap-2">
              <Input placeholder="0x… executor address" value={executorAddr} onChange={e => setExecutorAddr(e.target.value)} className="h-9 text-xs font-mono" />
              <Button size="sm" variant="default" disabled={!isConnected || !executorAddr} className="h-9 font-bold text-xs"
                onClick={() => execTx("mb-add-exec", () =>
                  writeContractAsync({
                    account: address!,
                    chain: wagmiChain,
                    address: chain.monibotRouter as `0x${string}`,
                    abi: MoniBotRouterABI,
                    functionName: "addExecutor",
                    args: [executorAddr as `0x${string}`],
                  })
                )}
              >Add</Button>
              <Button size="sm" variant="destructive" disabled={!isConnected || !executorAddr} className="h-9 font-bold text-xs"
                onClick={() => execTx("mb-rm-exec", () =>
                  writeContractAsync({
                    account: address!,
                    chain: wagmiChain,
                    address: chain.monibotRouter as `0x${string}`,
                    abi: MoniBotRouterABI,
                    functionName: "removeExecutor",
                    args: [executorAddr as `0x${string}`],
                  })
                )}
              >Remove</Button>
              <TxBadge id="mb-add-exec" />
              <TxBadge id="mb-rm-exec" />
            </div>
            {/* Check Executor */}
            <div className="flex gap-2 items-center">
              <Input placeholder="Check executor…" value={executorCheck} onChange={e => { setExecutorCheck(e.target.value); setExecutorCheckResult(null); }} className="h-9 text-xs font-mono" />
              <Button size="sm" variant="outline" className="h-9 text-xs font-bold"
                onClick={async () => {
                  await refetchExec();
                  setExecutorCheckResult(isExec as boolean);
                }}
                disabled={executorCheck.length !== 42}
              >Check</Button>
              {executorCheckResult !== null && (
                <Badge className={executorCheckResult ? "bg-green-500/10 text-green-500 border-green-500/30" : "bg-red-500/10 text-red-500 border-red-500/30"}>
                  {executorCheckResult ? "✓ Executor" : "✗ Not Executor"}
                </Badge>
              )}
            </div>
          </div>

          {/* Deposit Grant Funds */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5 text-green-500"><Coins className="w-3.5 h-3.5" />Deposit Grant Funds</Label>
            <p className="text-[10px] text-muted-foreground">
              Transfer {chain.currency} from your wallet into the MoniBotRouter contract to fund campaign grants.
              {adminTokenBalance !== undefined && (
                <span className="ml-1 font-mono">Your balance: {formatUnits(adminTokenBalance, chain.decimals)} {chain.currency}</span>
              )}
            </p>
            <div className="flex gap-2">
              <Input placeholder={`Amount (${chain.currency})`} value={depositAmt} onChange={e => setDepositAmt(e.target.value)} className="h-9 text-xs font-mono" type="number" />
              <Button size="sm" variant="outline" className="h-9 text-xs font-bold"
                onClick={() => {
                  if (adminTokenBalance !== undefined) setDepositAmt(formatUnits(adminTokenBalance, chain.decimals));
                }}
                disabled={!adminTokenBalance}
              >Max</Button>
              <Button size="sm" disabled={!isConnected || !depositAmt} className="h-9 font-bold text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => execTx("mb-deposit", () =>
                  writeContractAsync({
                    account: address!,
                    chain: wagmiChain,
                    address: chain.token as `0x${string}`,
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [chain.monibotRouter as `0x${string}`, parseUnits(depositAmt, chain.decimals)],
                  })
                )}
              >Deposit</Button>
              <TxBadge id="mb-deposit" />
            </div>
          </div>

          {/* Withdraw Campaign Funds */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" />Withdraw Campaign Funds</Label>
            <div className="flex gap-2">
              <Input placeholder={`Amount (${chain.currency})`} value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} className="h-9 text-xs font-mono" type="number" />
              <Button size="sm" variant="outline" className="h-9 text-xs font-bold"
                onClick={() => setWithdrawAmt(fmt(mbGrantBalance as bigint))}
                disabled={!mbGrantBalance}
              >Max</Button>
              <Button size="sm" disabled={!isConnected || !withdrawAmt} className="h-9 font-bold text-xs"
                onClick={() => execTx("mb-withdraw", () =>
                  writeContractAsync({
                    account: address!,
                    chain: wagmiChain,
                    address: chain.monibotRouter as `0x${string}`,
                    abi: MoniBotRouterABI,
                    functionName: "withdrawCampaignFunds",
                    args: [parseUnits(withdrawAmt, chain.decimals)],
                  })
                )}
              >Withdraw</Button>
              <TxBadge id="mb-withdraw" />
            </div>
          </div>

          {/* Emergency Withdraw */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5 text-destructive"><AlertTriangle className="w-3.5 h-3.5" />Emergency Withdraw (any ERC20)</Label>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Token address (0x…)" value={emergencyToken} onChange={e => setEmergencyToken(e.target.value)} className="h-9 text-xs font-mono flex-1 min-w-[180px]" />
              <Input placeholder="Amount (raw units)" value={emergencyAmt} onChange={e => setEmergencyAmt(e.target.value)} className="h-9 text-xs font-mono w-32" type="number" />
              <Button size="sm" variant="destructive" disabled={!isConnected || !emergencyToken || !emergencyAmt} className="h-9 font-bold text-xs"
                onClick={() => execTx("mb-emergency", () =>
                  writeContractAsync({
                    account: address!,
                    chain: wagmiChain,
                    address: chain.monibotRouter as `0x${string}`,
                    abi: MoniBotRouterABI,
                    functionName: "emergencyWithdraw",
                    args: [emergencyToken as `0x${string}`, parseUnits(emergencyAmt, chain.decimals)],
                  })
                )}
              >Emergency Withdraw</Button>
              <TxBadge id="mb-emergency" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MoniBotContractsTab(props: ContractsTabProps) {
  return (
    <WagmiWrapper>
      <ContractsContent {...props} />
    </WagmiWrapper>
  );
}
