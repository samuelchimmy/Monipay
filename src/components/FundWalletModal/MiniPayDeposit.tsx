/**
 * MiniPayDeposit.tsx — Deposit USDT or G$ from MiniPay's injected wallet
 * into the user's MoniPay wallet on Celo.
 *
 * Uses window.ethereum (MiniPay's provider) to send a direct
 * ERC-20 transfer of the chosen token to the MoniPay wallet address.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Check, AlertCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { feedback } from '@/lib/feedback';
import { encodeFunctionData, erc20Abi } from 'viem';
import {
  CELO_USDT_ADDRESS,
  CELO_FEE_CURRENCY,
  CELO_TOKEN_DECIMALS,
} from '@/lib/celoWallet';

interface MiniPayDepositProps {
  walletAddress: string;
  onBack: () => void;
  onSuccess: (amount: number) => void;
}

type DepositStep = 'amount' | 'processing' | 'success' | 'error';

export function MiniPayDeposit({ walletAddress, onBack, onSuccess }: MiniPayDepositProps) {
  const [selectedToken, setSelectedToken] = useState<'USDT' | 'G$'>('USDT');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<DepositStep>('amount');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount >= 0.01;

  const activeTokenAddress = selectedToken === 'G$'
    ? '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A'
    : CELO_USDT_ADDRESS;
  const activeDecimals = selectedToken === 'G$' ? 18 : CELO_TOKEN_DECIMALS;

  const handleDeposit = async () => {
    const eth = (window as any).ethereum;
    if (!eth?.isMiniPay) {
      setErrorMsg('MiniPay wallet not detected. Open this page inside MiniPay.');
      setStep('error');
      return;
    }

    setStep('processing');
    feedback('tap');

    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts?.length) throw new Error('No MiniPay accounts found');

      const from = accounts[0];
      // Convert amount to raw bigint based on token decimals
      const rawAmount = BigInt(Math.round(numericAmount * 10 ** activeDecimals));

      const calldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [walletAddress as `0x${string}`, rawAmount],
      });

      const txHash: string = await eth.request({
        method: 'eth_sendTransaction',
        params: [{
          from,
          to: activeTokenAddress,
          data: calldata,
          feeCurrency: CELO_FEE_CURRENCY,
        }],
      });

      console.log('[MiniPayDeposit] tx:', txHash);
      setStep('success');
      feedback('success');

      setTimeout(() => {
        onSuccess(numericAmount);
      }, 1500);
    } catch (err: any) {
      console.error('[MiniPayDeposit] error:', err);
      setErrorMsg(err?.message || 'Deposit failed');
      setStep('error');
      feedback('error');
    }
  };

  if (step === 'processing') {
    return (
      <div className="py-12 text-center space-y-4">
        <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Confirming in MiniPay…</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-success flex items-center justify-center">
          <Check className="w-8 h-8 text-white" strokeWidth={3} />
        </div>
        <p className="text-lg font-bold text-foreground">Deposit Sent!</p>
        <p className="text-2xl font-bold text-success">
          +{numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedToken}
        </p>
      </motion.div>
    );
  }

  if (step === 'error') {
    return (
      <div className="py-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
        <p className="text-sm text-destructive font-medium">{errorMsg}</p>
        <Button variant="outline" onClick={() => { setStep('amount'); setErrorMsg(null); }}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
        <Smartphone className="w-8 h-8 text-[#FCFF52]" />
        <div>
          <p className="text-sm font-semibold text-foreground">MiniPay Deposit</p>
          <p className="text-xs text-muted-foreground">Send USDT or G$ from your MiniPay wallet</p>
        </div>
      </div>

      <div className="flex gap-1.5 p-1 bg-muted/40 rounded-lg text-xs font-bold">
        <button
          type="button"
          onClick={() => setSelectedToken('USDT')}
          className={`flex-1 py-1.5 rounded transition-all ${
            selectedToken === 'USDT' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          USDT
        </button>
        <button
          type="button"
          onClick={() => setSelectedToken('G$')}
          className={`flex-1 py-1.5 rounded transition-all ${
            selectedToken === 'G$' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          GoodDollar (G$)
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount ({selectedToken})</label>
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0.01"
          step="0.01"
          className="text-lg font-bold h-12"
        />
      </div>

      <Button
        className="w-full h-12 text-base font-bold"
        disabled={!isValid}
        onClick={handleDeposit}
      >
        Deposit {numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedToken}
      </Button>
    </div>
  );
}
