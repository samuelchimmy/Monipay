import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeftRight, Wallet, QrCode, ChevronRight, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConnectedWalletDeposit } from './ConnectedWalletDeposit';
import { DirectDeposit } from './DirectDeposit';
import { CeloDirectDeposit } from './CeloDirectDeposit';
import { BottomSheet } from '@/components/BottomSheet';
import { usePlatform } from '@/hooks/usePlatform';
import type { SupportedNetwork } from '@/config/chains';
import { getChainConfig } from '@/config/chains';
import { TEMPO_ENABLED } from '@/lib/featureFlags';
import { NetworkEthereum, NetworkBase, NetworkOptimism, NetworkBinanceSmartChain } from '@web3icons/react';
import { SolanaLogo } from '@/components/SolanaLogo';
import { ModalNetworkToggle } from '@/components/ModalNetworkToggle';
import { usePayTag } from '@/contexts/PayTagContext';

type DepositView = 'menu' | 'connected-wallet' | 'direct' | 'minipay' | 'celo-direct';

interface FundWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  defaultNetwork?: SupportedNetwork;
  insufficientFundsAmount?: number | null;
  onDepositSuccess?: (amount: number) => void;
}

export function FundWalletModal({
  isOpen,
  onClose,
  walletAddress,
  defaultNetwork,
  insufficientFundsAmount,
  onDepositSuccess,
}: FundWalletModalProps) {
  const [view, setView] = useState<DepositView>('menu');
  const [depositSuccess, setDepositSuccess] = useState<{ amount: number } | null>(null);
  const { isCeloMode } = usePayTag();
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetwork>(
    defaultNetwork || 'celo'
  );

  // Sync selectedNetwork when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedNetwork(defaultNetwork || 'celo');
    }
  }, [isOpen, defaultNetwork, isCeloMode]);

  const { isNative } = usePlatform();

  const chain = getChainConfig(selectedNetwork);

  const handleDepositSuccess = (amount: number) => {
    setDepositSuccess({ amount });
    onDepositSuccess?.(amount);
    setTimeout(() => {
      setDepositSuccess(null);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    if (!depositSuccess) {
      setView('menu');
      onClose();
    }
  };

  const handleBack = () => {
    setView('menu');
  };

  const getDepositOptions = (_network: SupportedNetwork) => {
    // MoniPay is Celo-only: a single direct-deposit option.
    return [{
      id: 'celo-direct' as const,
      icon: Download,
      title: 'Direct Wallet Deposit',
      subtitle: 'Send USDT, USDC or G$ to your Celo address',
      rightContent: (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">USDT</span>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">USDC</span>
          <span className="text-[10px] font-bold text-sky-600 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5">G$</span>
        </div>
      ),
    }];
  };

  const depositOptions = useMemo(() => getDepositOptions(selectedNetwork), [selectedNetwork, isNative]);

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title={depositSuccess ? undefined : 'Deposit'}>
      {depositSuccess ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="py-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-20 h-20 mx-auto rounded-full bg-success flex items-center justify-center mb-4"
          >
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl font-bold text-foreground mb-1"
          >
            Deposit Received!
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-success mb-2"
          >
            +${depositSuccess.amount.toFixed(2)}
          </motion.p>
        </motion.div>
      ) : view === 'menu' ? (
        <div className="space-y-4">
          {/* Network Selector */}
          <ModalNetworkToggle
            value={selectedNetwork}
            onChange={setSelectedNetwork}
            locked={isCeloMode}
          />


          {/* Insufficient Funds Alert */}
          {insufficientFundsAmount !== null && insufficientFundsAmount !== undefined && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/20 rounded-[14px] p-3 text-center">
              <p className="text-sm font-medium text-destructive mb-0.5">Insufficient Funds</p>
              <p className="text-xs text-destructive/80">You need at least <span className="font-bold">${insufficientFundsAmount.toFixed(2)}</span> more {chain.currency}</p>
            </motion.div>
          )}

          {/* Deposit Options */}
          <div className="space-y-2">
            {depositOptions.map((option) => (
              <motion.button
                key={option.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView(option.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <option.icon className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{option.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{option.subtitle}</p>
                </div>
                {option.rightContent}
              </motion.button>
            ))}
          </div>
        </div>
      ) : view === 'connected-wallet' ? (
        <ConnectedWalletDeposit walletAddress={walletAddress} network={selectedNetwork} onBack={handleBack} onSuccess={handleDepositSuccess} />
      ) : view === 'celo-direct' ? (
        <CeloDirectDeposit walletAddress={walletAddress} onBack={handleBack} onSuccess={handleDepositSuccess} />
      ) : view === 'minipay' ? (
        <div className="p-6 text-center text-muted-foreground text-sm">MiniPay deposit is only available inside the MiniPay app.</div>
      ) : (
        <DirectDeposit walletAddress={walletAddress} network={selectedNetwork} onBack={handleBack} onSuccess={handleDepositSuccess} />
      )}
    </BottomSheet>
  );
}
