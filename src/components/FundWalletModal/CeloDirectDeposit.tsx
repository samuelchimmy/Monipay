import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Check, ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandedQRSimple } from '@/components/BrandedQR';
import { shortenAddress } from '@/lib/wallet';
import { getCeloTokenBalance } from '@/lib/celoWallet';
import { feedback } from '@/lib/feedback';
import { toast } from 'sonner';
import { NetworkCelo, TokenUSDT, TokenUSDC } from '@web3icons/react';

interface CeloDirectDepositProps {
  walletAddress: string;
  onBack: () => void;
  onSuccess: (amount: number) => void;
}

const CELO_TOKENS = [
  {
    symbol: 'USDT',
    label: 'Tether (USDT)',
    address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as `0x${string}`,
    decimals: 6,
    color: '#26A17B',
    Icon: (props: { size?: number }) => <TokenUSDT size={props.size ?? 18} variant="branded" className="rounded-full" />,
  },
  {
    symbol: 'USDC',
    label: 'USD Coin (USDC)',
    address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as `0x${string}`,
    decimals: 6,
    color: '#2775CA',
    Icon: (props: { size?: number }) => <TokenUSDC size={props.size ?? 18} variant="branded" className="rounded-full" />,
  },
  {
    symbol: 'G$',
    label: 'GoodDollar (G$)',
    address: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A' as `0x${string}`,
    decimals: 18,
    color: '#00AEFF',
    Icon: (props: { size?: number }) => (
      <div 
        className="rounded-full bg-[#00AEFF] flex items-center justify-center text-white shadow-sm font-black"
        style={{ width: props.size ?? 18, height: props.size ?? 18, fontSize: (props.size ?? 18) * 0.55 }}
      >
        G
      </div>
    ),
  },
] as const;

export function CeloDirectDeposit({ walletAddress, onBack, onSuccess }: CeloDirectDepositProps) {
  const [copied, setCopied] = useState(false);
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const lastBalances = useRef<Record<string, number | null>>({});

  const selectedToken = CELO_TOKENS[selectedTokenIdx];

  // Poll all 3 tokens simultaneously for any incoming deposit
  useEffect(() => {
    if (!walletAddress) return;

    // Reset balances on mount
    lastBalances.current = {};

    const checkForDeposit = async () => {
      try {
        await Promise.all(
          CELO_TOKENS.map(async (token) => {
            const balance = await getCeloTokenBalance(
              walletAddress as `0x${string}`,
              token.address,
              token.decimals
            );
            if (!Number.isFinite(balance)) return;

            const prev = lastBalances.current[token.symbol];
            if (prev !== null && prev !== undefined && balance > prev) {
              const depositedAmount = balance - prev;
              feedback('deposit');
              onSuccess(depositedAmount);
            }
            lastBalances.current[token.symbol] = balance;
          })
        );
      } catch (e) {
        console.error('[Celo Direct Deposit] Check failed:', e);
      }
    };

    checkForDeposit();
    const interval = setInterval(checkForDeposit, 3000);
    return () => clearInterval(interval);
  }, [walletAddress, onSuccess]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      feedback('tap');
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-9 w-9">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground">Direct Wallet Deposit</h3>
          <p className="text-xs text-muted-foreground">Celo Network</p>
        </div>
        {/* Celo brand icon */}
        <NetworkCelo size={24} variant="branded" className="rounded-full shadow-sm flex-shrink-0" />
      </div>

      <div className="p-5 flex flex-col items-center gap-4">
        {/* Token selector */}
        <div className="w-full relative">
          <button
            onClick={() => setShowTokenPicker((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-muted border border-border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <selectedToken.Icon size={20} />
              <span className="font-semibold text-sm text-foreground">{selectedToken.symbol}</span>
              <span className="text-xs text-muted-foreground">{selectedToken.label}</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${showTokenPicker ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showTokenPicker && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border border-border rounded-xl shadow-xl overflow-hidden"
              >
                {CELO_TOKENS.map((token, idx) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setSelectedTokenIdx(idx);
                      setShowTokenPicker(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors ${
                      idx === selectedTokenIdx ? 'bg-muted/70' : ''
                    }`}
                  >
                    <token.Icon size={18} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground">{token.label}</p>
                    </div>
                    {idx === selectedTokenIdx && (
                      <Check className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* QR Code */}
        <BrandedQRSimple value={walletAddress} size={180} />

        {/* Address with Copy */}
        <div className="w-full bg-muted rounded-xl p-4">
          <p className="text-xs text-muted-foreground text-center mb-2">Your Celo Wallet Address</p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-3 bg-background rounded-lg px-4 py-3 border border-border hover:border-primary/50 transition-colors"
          >
            <span className="font-mono font-medium text-foreground text-sm">
              {shortenAddress(walletAddress)}
            </span>
            <div className="flex-shrink-0">
              {copied ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <Copy className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </motion.button>
        </div>

        {/* Network warning */}
        <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold text-amber-700 text-sm">Celo Network Only</p>
              <p className="text-xs text-amber-600/80 mt-0.5">
                Send only <span className="font-bold">USDT, USDC, or G$</span> on the{' '}
                <span className="font-bold">Celo</span> network. Other tokens or networks may result
                in permanent loss.
              </p>
            </div>
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-2 h-2 rounded-full bg-[#FCFF52] border border-yellow-400"
          />
          <span>Watching for deposit on Celo…</span>
        </div>
      </div>
    </div>
  );
}
