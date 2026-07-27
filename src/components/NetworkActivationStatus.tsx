import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Shield, ExternalLink } from 'lucide-react';
import { checkApprovalForNetwork, getTokenBalance } from '@/lib/wallet';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { feedback } from '@/lib/feedback';
import { toast } from 'sonner';

const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

const TOKEN_ABI = [
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

interface NetworkActivationStatusProps {
  walletAddress: string;
  network: SupportedNetwork;
  decryptedPrivateKey: `0x${string}` | null;
  onActivationComplete?: () => void;
  /** Compact mode for inside wallet card (white text, transparent bg) */
  compact?: boolean;
}

export function NetworkActivationStatus({
  walletAddress,
  network,
  decryptedPrivateKey,
  onActivationComplete,
  compact = false,
}: NetworkActivationStatusProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const config = getChainConfig(network);
  const isTempo = false;
  const isCelo = true;
  const isSolana = false;
  const hasRouter = Boolean(config.monipayRouter);
  const [hasBalance, setHasBalance] = useState<boolean | null>(null);

  const checkStatus = useCallback(async () => {
    if (!walletAddress) {
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    try {
      console.log(`[Activation] Checking ${network} approval for ${walletAddress.slice(0, 8)}...`);
      const result = await checkApprovalForNetwork(walletAddress, network);
      console.log(`[Activation] ${network} activated: ${result.isActivated}, allowance: ${result.allowance}`);
      setIsActivated(result.isActivated);

      // For Tempo, also check if user has aUSD balance (needed to pay approval tx fee)
      if (isTempo && !result.isActivated) {
        try {
          const balance = await getTokenBalance(walletAddress as `0x${string}`, 'celo');
          setHasBalance(Number.isFinite(balance) && balance > 0.01);
        } catch {
          setHasBalance(false);
        }
      }
    } catch (e) {
      console.error('[Activation] Check failed:', e);
    } finally {
      setIsChecking(false);
    }
  }, [walletAddress, network, isTempo]);

   useEffect(() => {
    // Solana uses SPL token transfers — no EVM approval needed
    // Celo uses fee currency for gas — activation handled via activation-funder with CELO gas grant
    if (isSolana) {
      setIsActivated(true);
      setIsChecking(false);
      return;
    }
    if (!hasRouter) {
      // No router configured — can't activate
      setIsActivated(false);
      setIsChecking(false);
      return;
    }
    checkStatus();
  }, [checkStatus, hasRouter, isSolana]);

  const handleActivate = async () => {
    if (!decryptedPrivateKey || !config.monipayRouter) return;

    setIsActivating(true);
    try {
      // Tempo: no native gas; AlphaUSD pays fees. Skip funding.
      // Base/BSC/Celo/Ink: request a tiny native-gas drip from activation-funder.
      const fundChain = 'CELO';

      if (!isTempo && fundChain) {
        try {
          const { getDeviceId } = await import('@/lib/deviceId');
          const deviceId = getDeviceId();
          console.log(`[Activation] Requesting ${fundChain} gas funding...`);
          const fundRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/activation-funder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'fund',
              walletAddress,
              deviceId,
              chain: fundChain,
            }),
          });
          const fundJson = await fundRes.json().catch(() => ({}));
          console.log(`[Activation] ${fundChain} funder response:`, fundRes.status, fundJson);
          // If already funded previously, no need to wait long
          const alreadyFunded = !!fundJson?.alreadyFunded || fundJson?.status === 'funded';
          const gotTopup = !!fundJson?.success || alreadyFunded;
          if (!gotTopup) {
            toast.message('Topping up network fee', {
              description: 'Please try again in a moment.',
            });
            setIsActivating(false);
            return;
          }
          // Wait for funding to land — Celo ~5s blocks, Base/Ink/BSC ~2-3s
          const waitMs = alreadyFunded ? 500 : (fundChain === 'CELO' ? 8000 : 6000);
          await new Promise(r => setTimeout(r, waitMs));
        } catch (e) {
          console.warn(`${fundChain} activation funder call failed, proceeding anyway:`, e);
        }
      }

      const account = privateKeyToAccount(decryptedPrivateKey);

      // MoniPay is Celo-only.
      const chain = {
            id: 42220,
            name: 'Celo Mainnet',
            nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
            rpcUrls: { default: { http: ['https://forno.celo.org'] } },
          } as any;
      const rpcUrl = config.rpcUrls[0];

      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });

      const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      await walletClient.writeContract({
        address: config.token,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [config.monipayRouter as `0x${string}`, maxApproval],
        chain,
        account,
      });

      // Wait for confirmation
      await new Promise(r => setTimeout(r, isTempo ? 5000 : 8000));
      await checkStatus();
      feedback('payment');
      onActivationComplete?.();
    } catch (error) {
      console.error('Activation failed:', error);
      feedback('error');
    } finally {
      setIsActivating(false);
    }
  };

  if (isChecking) {
    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'mb-4 px-1'}`}>
        <Loader2 className={`w-3 h-3 animate-spin ${compact ? 'text-white/50' : 'text-muted-foreground'}`} />
        <span className={`text-xs ${compact ? 'text-white/50' : 'text-muted-foreground'}`}>Checking {config.name}...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between">
        {isActivated ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-success/30 flex items-center justify-center">
              <Check className="w-3 h-3 text-success" />
            </div>
            <span className="text-[11px] font-semibold text-success">{config.name} Activated</span>
          </div>
        ) : isTempo && hasBalance === false ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
                <Shield className="w-3 h-3 text-white/70" />
              </div>
              <span className="text-[11px] text-white/70">Fund wallet first</span>
            </div>
            <a
              href={config.faucetUrl || 'https://faucet.tempo.xyz'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[10px] h-6 px-2.5 rounded-full font-medium"
            >
              Get Funds <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
                <Shield className="w-3 h-3 text-white/70" />
              </div>
              <span className="text-[11px] text-white/70">{config.name} Not Activated</span>
            </div>
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={isActivating || !decryptedPrivateKey}
              className="bg-white/20 hover:bg-white/30 text-white text-[10px] h-6 px-2.5 rounded-full"
            >
              {isActivating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Activate'}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      {isActivated ? (
        <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl px-4 py-2.5">
          <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-success" />
          </div>
          <span className="text-xs font-semibold text-success">
            {config.name} Activated
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {config.currency} payments ready
          </span>
        </div>
      ) : isTempo && hasBalance === false ? (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-foreground">
              Get {config.currency} First
            </span>
            <p className="text-[10px] text-muted-foreground">
              You need testnet funds before activating
            </p>
          </div>
          <a
            href={config.faucetUrl || 'https://faucet.tempo.xyz'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-foreground text-background text-xs h-7 px-3 rounded-lg font-medium hover:opacity-80 transition-opacity"
          >
            Faucet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-base-blue/10 border border-base-blue/20 rounded-xl px-4 py-2.5">
          <div className="w-6 h-6 rounded-full bg-base-blue/20 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-base-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-foreground">
              {config.name} Not Activated
            </span>
            <p className="text-[10px] text-muted-foreground">
              One-time approval for {config.currency} payments
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleActivate}
            disabled={isActivating || !decryptedPrivateKey}
            className="bg-base-blue hover:bg-base-blue/90 text-white text-xs h-7 px-3"
          >
            {isActivating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              'Activate'
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
}