import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';

import { checkUsdcApproval, getEthBalance, MONIPAY_ROUTER_ADDRESS, USDC_ADDRESS } from '@/lib/wallet';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { feedback } from '@/lib/feedback';

interface AccountActivationButtonProps {
  walletAddress: string;
  decryptedPrivateKey: `0x${string}` | null;
  onActivationComplete?: () => void;
  /** If true, show a compact version for the Fund modal */
  compact?: boolean;
  /** If true, auto-trigger activation when ready */
  autoActivate?: boolean;
}

const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

// Progress messages shown while waiting for funding
const PROGRESS_MESSAGES = [
  { message: "Setting up account...", percent: 20 },
  { message: "Synchronizing PayTag...", percent: 40 },
  { message: "Configuring wallet...", percent: 55 },
  { message: "Account setup 70% done", percent: 70 },
  { message: "Almost there...", percent: 85 },
];

const FUNDED_MESSAGES = [
  { message: "99%", percent: 99 },
  { message: "Please click activate again", percent: 99 },
];

export function AccountActivationButton({ 
  walletAddress, 
  decryptedPrivateKey,
  onActivationComplete,
  compact = false,
  autoActivate = false,
}: AccountActivationButtonProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [activationStatus, setActivationStatus] = useState<{
    hasActivation: boolean;
    allowance: bigint;
    balance: bigint;
  } | null>(null);
  const [activationTxHash, setActivationTxHash] = useState<string | null>(null);
  const [hasFunding, setHasFunding] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const lastEthBalance = useRef<number | null>(null);

  // Check activation status on mount
  useEffect(() => {
    checkActivation();
  }, [walletAddress]);

  // Progress message cycler when waiting for funding
  useEffect(() => {
    if (!showProgress || hasFunding) return;

    const interval = setInterval(() => {
      setProgressIndex(prev => {
        if (prev < PROGRESS_MESSAGES.length - 1) {
          return prev + 1;
        }
        return prev; // Stay on last message
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [showProgress, hasFunding]);

  // Show "funded" messages when ETH arrives
  useEffect(() => {
    if (hasFunding && showProgress) {
      setProgressIndex(0); // Reset to show funded messages
    }
  }, [hasFunding, showProgress]);

  // Poll for activation funding (ETH deposit from funder)
  useEffect(() => {
    if (!walletAddress || activationStatus?.hasActivation || hasFunding) return;

    const checkForFunding = async () => {
      try {
        const ethBalance = await getEthBalance(walletAddress as `0x${string}`);
        
        // Detect when ETH arrives (activation funding)
        if (lastEthBalance.current !== null && ethBalance > lastEthBalance.current && ethBalance > 0) {
          setHasFunding(true);
          feedback('deposit');
        } else if (ethBalance > 0) {
          setHasFunding(true);
        }
        
        lastEthBalance.current = ethBalance;
      } catch (e) {
        console.error('Funding check failed:', e);
      }
    };

    checkForFunding();
    const interval = setInterval(checkForFunding, 3000);
    return () => clearInterval(interval);
  }, [walletAddress, activationStatus?.hasActivation, hasFunding]);

  // Auto-activate when ready, has funding, and autoActivate is true
  useEffect(() => {
    if (autoActivate && !activationStatus?.hasActivation && decryptedPrivateKey && !isActivating && !isChecking && hasFunding) {
      handleActivate();
    }
  }, [autoActivate, activationStatus, decryptedPrivateKey, isActivating, isChecking, hasFunding]);

  const checkActivation = async () => {
    setIsChecking(true);
    try {
      const status = await checkUsdcApproval(walletAddress);
      setActivationStatus({
        hasActivation: status.hasUnlimitedApproval || status.allowance > BigInt(0),
        allowance: status.allowance,
        balance: status.balance,
      });
    } catch (error) {
      console.error('Failed to check activation:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleActivate = async () => {
    // If no funding yet, start progress counter and wait
    if (!hasFunding && !decryptedPrivateKey) {
      setShowProgress(true);
      setProgressIndex(0);
      return;
    }

    if (!decryptedPrivateKey) {
      setShowProgress(true);
      setProgressIndex(0);
      return;
    }

    // If we have funding but progress was showing, now do actual activation
    if (!hasFunding) {
      setShowProgress(true);
      setProgressIndex(0);
      return;
    }

    setIsActivating(true);
    setShowProgress(false);

    try {
      const account = privateKeyToAccount(decryptedPrivateKey);
      
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http('https://mainnet.base.org'),
      });

      const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [MONIPAY_ROUTER_ADDRESS as `0x${string}`, maxApproval],
        chain: base,
        account,
      });

      setActivationTxHash(hash);

      // Wait for confirmation
      setTimeout(async () => {
        await checkActivation();
        setIsActivating(false);
        setActivationTxHash(null);
        onActivationComplete?.();
      }, 10000);

    } catch (error) {
      console.error('Activation failed:', error);
      setIsActivating(false);
    }
  };

  if (isChecking) {
    return (
      <div className={`bg-muted/50 rounded-xl ${compact ? 'p-3' : 'p-4'} flex items-center gap-3`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking account status...</span>
      </div>
    );
  }

  if (activationStatus?.hasActivation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-success/10 border border-success/20 rounded-xl ${compact ? 'p-3' : 'p-4'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-success/20 flex items-center justify-center`}>
            <Check className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-success`} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-success ${compact ? 'text-xs' : 'text-sm'}`}>Account Activated</p>
            <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
              Your wallet is ready
            </p>
          </div>
          <Check className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-success`} />
        </div>
      </motion.div>
    );
  }

  // Get current progress info
  const currentMessages = hasFunding ? FUNDED_MESSAGES : PROGRESS_MESSAGES;
  const currentProgress = currentMessages[Math.min(progressIndex, currentMessages.length - 1)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-base-blue/10 border border-base-blue/20 rounded-xl ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className={`${compact ? 'mb-3' : 'mb-4'}`}>
        <p className={`font-semibold text-base-blue ${compact ? 'text-xs' : 'text-sm'}`}>Activate Your Account</p>
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground mt-1`}>
          One-time setup to unlock instant payments.
        </p>
      </div>

      {activationTxHash ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-base-blue" />
          <span className="text-sm font-medium text-foreground">Activating your account...</span>
        </div>
      ) : showProgress && !hasFunding ? (
        // Progress counter while waiting for funding
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">{currentProgress.message}</span>
            <span className="text-base-blue font-semibold">{currentProgress.percent}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-base-blue rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${currentProgress.percent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Preparing your account...</span>
          </div>
        </div>
      ) : showProgress && hasFunding ? (
        // Funding received, prompt to activate again
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">{currentProgress.message}</span>
            <span className="text-base-blue font-semibold">{currentProgress.percent}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-base-blue rounded-full"
              initial={{ width: "85%" }}
              animate={{ width: `${currentProgress.percent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <Button
            onClick={handleActivate}
            disabled={isActivating || !decryptedPrivateKey}
            className={`w-full bg-base-blue hover:bg-base-blue/90 text-white font-semibold ${compact ? 'h-9 text-xs' : ''}`}
          >
            Activate
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleActivate}
          disabled={isActivating}
          className={`w-full bg-base-blue hover:bg-base-blue/90 text-white font-semibold ${compact ? 'h-9 text-xs' : ''}`}
        >
          {isActivating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Activating...
            </>
          ) : (
            'Activate'
          )}
        </Button>
      )}

      <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-muted-foreground mt-3 text-center`}>
        We've covered the activation fee for you.
      </p>
    </motion.div>
  );
}
