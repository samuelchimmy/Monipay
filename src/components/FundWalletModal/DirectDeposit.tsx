import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { NetworkBase, NetworkBinanceSmartChain, TokenUSDC } from '@web3icons/react';
import { SolanaLogo } from '@/components/SolanaLogo';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { BrandedQRSimple } from '@/components/BrandedQR';
import { shortenAddress } from '@/lib/wallet';
import { getCeloUsdtBalance } from '@/lib/celoWallet';
import { feedback } from '@/lib/feedback';
import { toast } from 'sonner';
import { AccountActivationButton } from '@/components/AccountActivationButton';
import { usePayTag } from '@/contexts/PayTagContext';
import { getChainConfig, isSolanaNetwork, type SupportedNetwork } from '@/config/chains';

interface DirectDepositProps {
  walletAddress: string;
  network: SupportedNetwork;
  onBack: () => void;
  onSuccess: (amount: number) => void;
}

export function DirectDeposit({
  walletAddress,
  network,
  onBack,
  onSuccess,
}: DirectDepositProps) {
  const [copied, setCopied] = React.useState(false);
  const lastBalance = useRef<number | null>(null);
  const { decryptedPrivateKey, profile } = usePayTag();
  const chain = getChainConfig(network);
  const isBase = false;
  const isCelo = network === 'celo';
  const isSolana = isSolanaNetwork(network);

  // For Solana, use the solanaAddress from profile
  const displayAddress = isSolana
    ? (profile?.wallet?.solanaAddress || walletAddress)
    : walletAddress;

  // Poll for deposits
  useEffect(() => {
    if (!displayAddress) return;
    lastBalance.current = null;

    const checkForDeposit = async () => {
      try {
        const balance = await getCeloUsdtBalance(displayAddress as `0x${string}`);
        if (!Number.isFinite(balance)) return;

        if (lastBalance.current !== null && balance > lastBalance.current) {
          const depositedAmount = balance - lastBalance.current;
          feedback('deposit');
          onSuccess(depositedAmount);
        }

        lastBalance.current = balance;
      } catch (e) {
        console.error('[Direct Deposit] Check failed:', e);
      }
    };

    checkForDeposit();
    const interval = setInterval(checkForDeposit, 3000);
    return () => clearInterval(interval);
  }, [displayAddress, onSuccess, network, isBase, isCelo, isSolana, walletAddress]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      feedback('tap');
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const truncatedAddress = isSolana
    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
    : shortenAddress(displayAddress);
  const accentColor = isSolana ? 'purple-500' : isBase ? 'base-blue' : 'yellow-500';
  const networkLabel = isSolana ? 'Solana' : chain.name;
  const currencyLabel = isSolana ? 'USDC' : chain.currency;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-9 w-9">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground truncate">Direct Deposit</h3>
        </div>
        {isSolana ? (
          <SolanaLogo size={20} />
        ) : isBase ? (
          <NetworkBase size={20} variant="branded" className="flex-shrink-0" />
        ) : (
          <NetworkBinanceSmartChain size={20} variant="branded" className="flex-shrink-0" />
        )}
      </div>

      <div className="p-5 flex flex-col items-center">
        <BrandedQRSimple value={displayAddress} size={180} className="mb-5" />

        {/* Address with Copy */}
        <div className="w-full bg-muted rounded-xl p-4 mb-4">
          <p className="text-xs text-muted-foreground text-center mb-2">Your {networkLabel} Wallet Address</p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-3 bg-background rounded-lg px-4 py-3 border border-border hover:border-primary/50 transition-colors"
          >
            <span className="font-mono font-medium text-foreground text-sm">{truncatedAddress}</span>
            <div className="flex-shrink-0">
              {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
            </div>
          </motion.button>
        </div>

        {/* Network Warning */}
        <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              {isSolana ? (
                <span className="text-lg">◎</span>
              ) : isBase ? (
                <>
                  <TokenUSDC size={20} variant="branded" />
                  <NetworkBase size={20} variant="branded" />
                </>
              ) : (
                <NetworkBinanceSmartChain size={20} variant="branded" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-amber-700 text-sm">
                {currencyLabel} on {networkLabel} Only
              </p>
              <p className="text-xs text-amber-600/80 mt-0.5">
                Send only <span className="font-bold">{currencyLabel}</span> on the{' '}
                <span className="font-bold">{networkLabel}</span> network. Other tokens or networks may result in permanent loss.
              </p>
            </div>
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className={`w-2 h-2 rounded-full ${isSolana ? 'bg-purple-500' : isBase ? 'bg-base-blue' : 'bg-yellow-500'}`}
          />
          <span>Waiting for deposit...</span>
        </div>

        {/* Account Activation (Base only — Solana SPL tokens don't need approval) */}
        {isBase && (
          <div className="w-full">
            <AccountActivationButton
              walletAddress={walletAddress}
              decryptedPrivateKey={decryptedPrivateKey}
              onActivationComplete={() => {}}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
