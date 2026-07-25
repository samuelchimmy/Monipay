import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { usePayTag } from '@/contexts/PayTagContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Scan, Check, ArrowUpRight, ArrowDownLeft, Clock, Send, Wallet, X, Copy, 
  Plus, Shield, Zap, ExternalLink, FileText, Smartphone, Globe
} from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { MoniPayLogo } from './MoniPayLogo';
import { NetworkBase, TokenUSDC } from '@web3icons/react';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';

import { BrandedQR, BrandedQRSimple } from './BrandedQR';
import { signPaymentAuthorization, signPaymentAuthorizationWithSigner, shortenAddress, getPaymentNonce, checkUsdcApproval, getUsdcBalance } from '@/lib/wallet';
import { useUnifiedSigner } from '@/hooks/useUnifiedSigner';
import { QRScanner, parseQRData, parseEIP681 } from './QRScanner';
import { BiometricAuthModal, useBiometricAuth } from './BiometricAuthModal';
import { AccountActivationButton } from './AccountActivationButton';
import { useTransactionPolling } from '@/hooks/useTransactionPolling';
import { TransactionReceiptModal, TransactionReceipt } from './TransactionReceiptModal';
import { InvoicesSection } from './InvoicesSection';
import { useInvoices } from '@/hooks/useInvoices';
import { PullToRefresh } from './PullToRefresh';
import { FundWalletModal } from './FundWalletModal';
import { feedback } from '@/lib/feedback';
import { isMoniBotTag, VerifiedBadge } from './VerifiedBadge';
import { SecurityGate } from './SecurityGate';
import { useCeloApproval } from '@/hooks/useCeloApproval';
import { toast } from '@/hooks/use-toast';

const PLATFORM_FEE_PERCENT = 0.01; // 1%
const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

import type { BottomNavTab } from './BottomNav';

interface UserDashboardProps {
  activeTab?: BottomNavTab | null;
  onTabHandled?: () => void;
}

export function UserDashboard({ activeTab, onTabHandled }: UserDashboardProps) {
  const { t } = useTranslation();
  const { profile, transactions, updateBalance, addTransaction, decryptedPrivateKey, decryptedSolanaKey, refreshBalance, lookupPayTag, syncTransactions, unlockSolanaKey, solanaReady, activeNetworkReady, repairSolanaWallet, isWalletOnly } = usePayTag();
  const { signer: unifiedSigner } = useUnifiedSigner();
  const [showScanner, setShowScanner] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showSendSuccess, setShowSendSuccess] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveMode, setReceiveMode] = useState<'monipay' | 'external'>('monipay');
  const [receiveSuccess, setReceiveSuccess] = useState<{ payTag: string; amount: number; isExternal?: boolean } | null>(null);
  const [showFund, setShowFund] = useState(false);
  const [insufficientFundsAmount, setInsufficientFundsAmount] = useState<number | null>(null);
  const [sendPayTag, setSendPayTag] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendTagFocused, setSendTagFocused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [scannedData, setScannedData] = useState<{
    payTag: string;
    merchantAddress: string;
    merchantName?: string;
    amount: number;
    fee: number;
    merchantReceives: number;
    items?: Array<{ name: string; quantity: number; price: number }>;
  } | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionReceipt | null>(null);
  const [showSolanaUnlock, setShowSolanaUnlock] = useState(false);
  const [pendingSolanaAction, setPendingSolanaAction] = useState<(() => void) | null>(null);
  const [solanaNoticeDismissed, setSolanaNoticeDismissed] = useState(() => {
    return localStorage.getItem('monipay_solana_notice_dismissed') === 'true';
  });

  // Celo approval management — pass private key for non-MiniPay context
  const network = (profile?.preferredNetwork || 'base') as SupportedNetwork;
  const celoApproval = useCeloApproval(
    network === 'celo' ? (profile?.wallet?.address as `0x${string}` | null) : null,
    network === 'celo' ? decryptedPrivateKey : null,
  );

  // Biometric auth for high-value transactions
  const {
    showBiometricModal,
    pendingAmount,
    checkBiometricRequired,
    handleAuthSuccess,
    handleAuthCancel,
  } = useBiometricAuth();

  // Transaction polling for real-time status updates
  const { 
    pendingTransactions, 
    addPendingTransaction, 
    hasPending 
  } = useTransactionPolling();

  // Invoice management
  const { pendingCount: invoicePendingCount } = useInvoices(profile?.id);

  // Payment detection for Receive modal
  const receiveModalOpenedAt = React.useRef<number | null>(null);
  const lastKnownTransactionId = React.useRef<string | null>(null);
  // Use a separate effect that reacts to transactions changes
  useEffect(() => {
    if (!showReceive || !profile?.id || receiveSuccess) return;
    
    // Set baseline when modal opens
    if (receiveModalOpenedAt.current === null) {
      receiveModalOpenedAt.current = Date.now();
      lastKnownTransactionId.current = transactions[0]?.id || null;
      console.log('[Receive] Modal opened, baseline set:', {
        openedAt: receiveModalOpenedAt.current,
        lastTxId: lastKnownTransactionId.current,
      });
    }
    
    // Check for new received transactions
    const newReceivedTx = transactions.find(tx => {
      const isNew = tx.timestamp > (receiveModalOpenedAt.current || 0) - 5000; // 5s buffer
      const isReceived = tx.type === 'received';
      const isDifferent = tx.id !== lastKnownTransactionId.current;
      return isNew && isReceived && isDifferent;
    });
    
    if (newReceivedTx) {
      console.log('[Receive] Payment detected:', newReceivedTx);
      
      // Determine if payer is external (address) or MoniPay user (paytag)
      const isExternalPayer = newReceivedTx.counterparty.startsWith('0x');
      const payerDisplay = isExternalPayer 
        ? shortenAddress(newReceivedTx.counterparty)
        : (newReceivedTx.counterparty.startsWith('@') 
            ? newReceivedTx.counterparty.slice(1) 
            : newReceivedTx.counterparty);
      
      setReceiveSuccess({
        payTag: payerDisplay,
        amount: newReceivedTx.amount,
        isExternal: isExternalPayer,
      });
      feedback('payment');
      refreshBalance();
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        setShowReceive(false);
        setReceiveSuccess(null);
        receiveModalOpenedAt.current = null;
      }, 2000);
    }
  }, [showReceive, profile?.id, transactions, receiveSuccess, refreshBalance]);
  
  // Reset baseline when modal closes
  useEffect(() => {
    if (!showReceive) {
      receiveModalOpenedAt.current = null;
      lastKnownTransactionId.current = null;
    }
  }, [showReceive]);
  
  // Poll for transactions while Receive modal is open
  useEffect(() => {
    if (!showReceive || !profile?.id) return;
    
    console.log('[Receive] Starting transaction polling');
    
    // Poll every 3 seconds
    const interval = setInterval(() => {
      console.log('[Receive] Polling for new transactions...');
      syncTransactions();
    }, 3000);
    
    return () => {
      console.log('[Receive] Stopping transaction polling');
      clearInterval(interval);
    };
  }, [showReceive, profile?.id, syncTransactions]);

  // Refresh balance and sync transactions on mount
  useEffect(() => {
    refreshBalance();
    syncTransactions();
    
    // Poll for new transactions every 30 seconds
    const interval = setInterval(() => {
      syncTransactions();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // React to bottom nav tab presses
  useEffect(() => {
    if (!activeTab) return;
    switch (activeTab) {
      case 'pay':
        setShowScanner(true);
        break;
      case 'send':
        setShowSend(true);
        break;
      case 'invoices':
        setShowInvoices(true);
        break;
      case 'receive':
        setShowReceive(true);
        break;
    }
    onTabHandled?.();
  }, [activeTab, onTabHandled]);

  const handleQRScanned = (data: string) => {
    setShowScanner(false);
    feedback('scan');
    
    console.log('[QR Scan] Raw data received:', data);
    
    // Use the shared parser
    const parsed = parseQRData(data);
    console.log('[QR Scan] Parsed data:', parsed);
    
    // Handle paytag_receive QR (from another user's Receive modal) - opens Send USDC with payTag pre-filled
    if (parsed.type === 'paytag_receive' && parsed.payTag) {
      console.log('[QR Scan] PayTag receive detected, opening Send USDC modal with:', parsed.payTag);
      setSendPayTag(parsed.payTag);
      feedback('modalOpen');
      setShowSend(true);
      return;
    }
    
    // Handle MoniPay merchant QR (has amount - payment request)
    if (parsed.type === 'monipay' && parsed.payTag) {
      try {
        // Parse original JSON to get full data including items + multi-address
        const jsonData = JSON.parse(data);
        const amount = parseFloat(jsonData.amount) || 0;
        
        if (amount <= 0) {
          feedback('error');
          return;
        }
        
        const fee = amount * PLATFORM_FEE_PERCENT;
        const merchantReceives = amount * (1 - PLATFORM_FEE_PERCENT);

        // Resolve correct address for our active network
        const currentNetwork = (profile?.preferredNetwork || 'base') as SupportedNetwork;
        let resolvedAddress = parsed.address; // fallback from parser
        if (jsonData.addresses) {
          if (currentNetwork === 'solana' && jsonData.addresses.solana) {
            resolvedAddress = jsonData.addresses.solana;
          } else if (jsonData.addresses.evm) {
            resolvedAddress = jsonData.addresses.evm;
          }
        }

        if (!resolvedAddress) {
          toast({ title: 'Incompatible QR', description: `Merchant has no ${currentNetwork} address`, variant: 'destructive' });
          feedback('error');
          return;
        }
        
        console.log('[QR Scan] MoniPay payment details:', {
          payTag: parsed.payTag,
          address: resolvedAddress,
          network: currentNetwork,
          amount,
          fee,
          merchantReceives,
          items: jsonData.items,
        });
        
        setScannedData({
          payTag: parsed.payTag!,
          merchantAddress: resolvedAddress,
          merchantName: jsonData.merchantName,
          amount,
          fee,
          merchantReceives,
          items: jsonData.items,
        });
        feedback('modalOpen');
        setShowPayment(true);
      } catch (e) {
        console.error('[QR Scan] Error parsing MoniPay data:', e);
        feedback('error');
      }
      return;
    }
    
    // Handle EIP-681 URI from external wallets
    if (parsed.type === 'eip681' && parsed.address && parsed.amount) {
      console.log('[QR Scan] EIP-681 payment request:', {
        address: parsed.address,
        amount: parsed.amount,
      });
      
      const amount = parsed.amount;
      const fee = amount * PLATFORM_FEE_PERCENT;
      const merchantReceives = amount * (1 - PLATFORM_FEE_PERCENT);
      
      // Use shortened address as payTag display
      const shortAddress = `${parsed.address.slice(0, 6)}...${parsed.address.slice(-4)}`;
      
      setScannedData({
        payTag: shortAddress,
        merchantAddress: parsed.address,
        merchantName: 'External Wallet',
        amount,
        fee,
        merchantReceives,
      });
      feedback('modalOpen');
      setShowPayment(true);
      return;
    }
    
    // Handle plain address (no amount - could prompt for amount)
    if (parsed.type === 'address' && parsed.address) {
      console.log('[QR Scan] Plain address detected, opening send modal');
      setSendPayTag(parsed.address);
      feedback('modalOpen');
      setShowSend(true);
      return;
    }
    
    // Unknown format
    feedback('error');
    console.error('[QR Scan] Unrecognized QR format:', parsed);
  };

const PLATFORM_FEE = 0.01;

  /**
   * Ensure Solana key is decrypted before proceeding with a Solana action.
   * If key is already decrypted, runs the callback immediately.
   * Otherwise, shows a PIN prompt and runs callback after unlock.
   */
  const requireSolanaUnlock = (callback: () => void): boolean => {
    if (decryptedSolanaKey) {
      callback();
      return true;
    }
    if (!profile?.wallet?.encryptedSolanaKey) {
      toast({ title: 'No Solana wallet', description: 'Generate a Solana wallet in Settings first.', variant: 'destructive' });
      return false;
    }
    // Show PIN prompt to decrypt Solana key
    setPendingSolanaAction(() => callback);
    setShowSolanaUnlock(true);
    return false;
  };

  const handleSolanaUnlockAuthenticated = () => {
    setShowSolanaUnlock(false);
    // The SecurityGate calls verifyPin which decrypts the Solana key
    // Now run the pending action
    if (pendingSolanaAction) {
      // Small delay to let state propagate
      setTimeout(() => {
        pendingSolanaAction();
        setPendingSolanaAction(null);
      }, 100);
    }
  };

  // Actual payment execution (called after biometric auth if needed)
  const executePayment = async () => {
    if (!scannedData || !profile) return;
    const isSolanaNet = (profile.preferredNetwork || 'base') === 'solana';
    if (isSolanaNet && !activeNetworkReady) {
      toast({ title: 'Wallet not ready', description: 'Your Solana wallet needs to be set up. Go to Settings → Solana Wallet.', variant: 'destructive' });
      return;
    }
    if (!isSolanaNet && !decryptedPrivateKey && !isWalletOnly) return;
    if (!isSolanaNet && isWalletOnly && !unifiedSigner) {
      toast({ title: 'Wallet not ready', description: 'Connect your wallet to sign this payment.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    feedback('tap');

    const network = (profile.preferredNetwork || 'celo') as SupportedNetwork;
    const config = getChainConfig(network);

    try {
      let result: { success: boolean; txHash?: string; error?: string };

      {
        // EVM: EIP-712 / relay flow (Celo)
        const approvalStatus = await checkUsdcApproval(profile.wallet.address, network);
        const requiredAmount = BigInt(Math.ceil(scannedData.amount * Math.pow(10, config.decimals)));
        if (approvalStatus.allowance < requiredAmount) {
          feedback('error');
          setIsProcessing(false);
          return;
        }

        const nonce = await getPaymentNonce(profile.wallet.address, network);
        const { signature, message } = await signPaymentAuthorization(
          decryptedPrivateKey,
          scannedData.merchantAddress as `0x${string}`,
          scannedData.merchantReceives,
          scannedData.fee,
          nonce,
          network
        );

        const relayEndpoint = 'relay-payment-celo';
        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/${relayEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'relay',
            signature,
            message: {
              from: profile.wallet.address,
              to: scannedData.merchantAddress,
              amount: message.amount.toString(),
              fee: message.fee.toString(),
              nonce: message.nonce.toString(),
              deadline: message.deadline.toString(),
            },
            senderProfileId: profile.id,
            recipientPayTag: scannedData.payTag,
            recipientAddress: scannedData.merchantAddress,
            items: scannedData.items,
            network,
          }),
        });
        result = await response.json();
        if (!response.ok) result.success = false;
      }

      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      // Update local balance
      updateBalance(scannedData.amount, 'deduct');
      
      addTransaction({
        type: 'sent',
        amount: scannedData.amount,
        fee: scannedData.fee,
        counterparty: `@${scannedData.payTag}`,
        txHash: result.txHash || '',
      });

      if (result.txHash) {
        addPendingTransaction({
          txHash: result.txHash,
          amount: scannedData.amount,
          counterparty: `@${scannedData.payTag}`,
          startedAt: Date.now(),
        });
      }

      feedback('payment');
      setShowPayment(false);
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        setScannedData(null);
        setIsProcessing(false);
        syncTransactions();
      }, 2500);
    } catch (error) {
      console.error('Payment failed:', error);
      feedback('error');
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!scannedData || !profile) return;
    const isSolanaNet = (profile.preferredNetwork || 'base') === 'solana';
    if (isSolanaNet && !activeNetworkReady) {
      toast({ title: 'Wallet not ready', description: 'Your Solana wallet needs to be set up. Go to Settings → Solana Wallet.', variant: 'destructive' });
      return;
    }
    if (!isSolanaNet && !decryptedPrivateKey) return;
    
    // Check balance
    if (profile.balance < scannedData.amount) {
      feedback('error');
      setShowPayment(false);
      setInsufficientFundsAmount(scannedData.amount - profile.balance);
      setShowFund(true);
      return;
    }

    const currentNetwork = (profile.preferredNetwork || 'base') as SupportedNetwork;

    // Celo: check approval before proceeding
    if (currentNetwork === 'celo' && !celoApproval.isApproved) {
      toast({ title: 'Approval Required', description: 'Approving USDT for the MoniPay router...', });
      try {
        await celoApproval.approve();
        await celoApproval.refetch();
      } catch {
        toast({ title: 'Approval Failed', description: 'Could not approve USDT. Please try again.', variant: 'destructive' });
        return;
      }
    }

    // Solana: ensure key is unlocked
    if (currentNetwork === 'solana' && !decryptedSolanaKey) {
      requireSolanaUnlock(() => executePayment());
      return;
    }

    // Check if biometric auth is required for high-value transaction
    const authRequired = checkBiometricRequired(scannedData.amount, executePayment);
    
    // If auth is required, the modal will show and call executePayment on success
    // If not required, proceed directly
    if (!authRequired) {
      executePayment();
    }
  };

  const handleSendConfirm = async () => {
    if (!profile) return;
    const isSolanaNet = (profile.preferredNetwork || 'base') === 'solana';
    if (isSolanaNet && !activeNetworkReady) {
      toast({ title: 'Wallet not ready', description: 'Your Solana wallet needs to be set up. Go to Settings → Solana Wallet.', variant: 'destructive' });
      return;
    }
    if (!isSolanaNet && !decryptedPrivateKey) return;
    
    const amount = parseFloat(sendAmount);
    const tag = sendPayTag.replace('@', '').trim();
    
    if (!tag) {
      feedback('error');
      return;
    }
    
    if (isNaN(amount) || amount <= 0) {
      feedback('error');
      return;
    }
    
    const fee = amount / 99;
    const recipientReceives = amount;
    const totalWithFee = amount + fee;
    
    if (profile.balance < totalWithFee) {
      feedback('error');
      setShowSend(false);
      setInsufficientFundsAmount(totalWithFee - profile.balance);
      setShowFund(true);
      return;
    }

    const currentNetwork = (profile.preferredNetwork || 'base') as SupportedNetwork;

    // Celo: check approval before proceeding
    if (currentNetwork === 'celo' && !celoApproval.isApproved) {
      toast({ title: 'Approval Required', description: 'Approving USDT for the MoniPay router...', });
      try {
        await celoApproval.approve();
        await celoApproval.refetch();
      } catch {
        toast({ title: 'Approval Failed', description: 'Could not approve USDT. Please try again.', variant: 'destructive' });
        return;
      }
    }

    // Solana: ensure key is unlocked
    if (currentNetwork === 'solana' && !decryptedSolanaKey) {
      requireSolanaUnlock(() => handleSendConfirm());
      return;
    }

    setIsProcessing(true);
    feedback('tap');

    const network = (profile.preferredNetwork || 'celo') as SupportedNetwork;
    const config = getChainConfig(network);

    try {
      // Lookup recipient's wallet address
      const recipient = await lookupPayTag(tag);
      if (!recipient) {
        throw new Error('Recipient not found');
      }

      const recipientAddress = recipient.walletAddress;

      if (!recipientAddress) {
        throw new Error('Recipient wallet not found');
      }

      let result: { success: boolean; txHash?: string; error?: string; details?: string };

      {
        // EVM: EIP-712 / relay flow (Celo)
        const approvalStatus = await checkUsdcApproval(profile.wallet.address, network);
        const requiredAmount = BigInt(Math.ceil(totalWithFee * Math.pow(10, config.decimals)));
        if (approvalStatus.allowance < requiredAmount) {
          feedback('error');
          setIsProcessing(false);
          return;
        }

        const nonce = await getPaymentNonce(profile.wallet.address, network);
        const { signature, message } = isWalletOnly && unifiedSigner
          ? await signPaymentAuthorizationWithSigner(
              unifiedSigner,
              recipientAddress as `0x${string}`,
              recipientReceives,
              fee,
              nonce,
              network
            )
          : await signPaymentAuthorization(
              decryptedPrivateKey,
              recipientAddress as `0x${string}`,
              recipientReceives,
              fee,
              nonce,
              network
            );

        const relayEndpoint = 'relay-payment-celo';
        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/${relayEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'relay',
            signature,
            message: {
              from: profile.wallet.address,
              to: recipientAddress,
              amount: message.amount.toString(),
              fee: message.fee.toString(),
              nonce: message.nonce.toString(),
              deadline: message.deadline.toString(),
            },
            senderProfileId: profile.id,
            recipientPayTag: tag,
            network,
          }),
        });
        result = await response.json();
        if (!response.ok) result.success = false;
      }

      if (!result.success) {
        throw new Error(result.details || result.error || 'Transaction failed');
      }

      updateBalance(totalWithFee, 'deduct');
      addTransaction({
        type: 'sent',
        amount: recipientReceives,
        fee: fee,
        counterparty: `@${tag}`,
        txHash: result.txHash || '',
      });

      feedback('payment');
      setShowSend(false);
      setSendPayTag('');
      setSendAmount('');
      
      setScannedData({
        payTag: tag,
        merchantAddress: recipientAddress,
        amount: amount,
        fee: fee,
        merchantReceives: recipientReceives,
      });
      setShowSendSuccess(true);
      
      setTimeout(() => {
        setShowSendSuccess(false);
        setScannedData(null);
        setIsProcessing(false);
        syncTransactions();
      }, 2500);
    } catch (error: any) {
      console.error('Send failed:', error);
      const errMsg = error?.message?.replace(/^Error:\s*/, '') || 'Transaction failed';
      toast({ title: 'Send Failed', description: errMsg, variant: 'destructive' });
      feedback('error');
      setIsProcessing(false);
    }
  };

  const handleCopyAddress = () => {
    const activeAddr = (profile?.preferredNetwork === 'solana' && profile?.wallet?.solanaAddress)
      ? profile.wallet.solanaAddress
      : profile?.wallet?.address;
    if (activeAddr) {
      navigator.clipboard.writeText(activeAddr);
      feedback('copy');
    }
  };

  const handleCopyPayTag = () => {
    if (profile) {
      navigator.clipboard.writeText(`@${profile.payTag}`);
      feedback('copy');
    }
  };

  // Handle pull-to-refresh
  const handlePullRefresh = useCallback(async () => {
    await Promise.all([refreshBalance(), syncTransactions()]);
  }, [refreshBalance, syncTransactions]);

  const solanaNeedsRepair = !!(profile?.wallet?.solanaAddress && !profile?.wallet?.encryptedSolanaKey);
  const isSolanaSelected = (profile?.preferredNetwork || 'base') === 'solana';
  const showSolanaNotice = isSolanaSelected && !solanaNoticeDismissed;
  const dismissSolanaNotice = () => {
    setSolanaNoticeDismissed(true);
    localStorage.setItem('monipay_solana_notice_dismissed', 'true');
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className="h-full">
      <div className="container pb-8 px-4">
      {/* Solana wallet repair warning banner — only on Solana network */}
      {isSolanaSelected && solanaNeedsRepair && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3"
        >
          <Shield className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">Solana wallet needs repair</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your Solana wallet is missing its signing key. Go to <strong>Settings → Solana Wallet</strong> to repair it before making Solana payments.
            </p>
          </div>
        </motion.div>
      )}
      {/* Solana beta notice — friendly reminder to back up */}
      {showSolanaNotice && !solanaNeedsRepair && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-3"
        >
          <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Heads up — Solana is in beta</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Our Solana mainnet deployment is still stabilizing. Please back up your Solana wallet right after creating it via <strong>Settings → Solana Wallet</strong>.
            </p>
          </div>
          <button
            onClick={dismissSolanaNotice}
            className="p-1 rounded-full hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </motion.div>
      )}
      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-muted-foreground tracking-wide uppercase">{t('recent_activity')}</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center shadow-card">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="flex justify-center mb-3"
            >
              <MoniPayLogo size={48} color="hsl(var(--muted-foreground))" animationMode="idle" isEmpty />
            </motion.div>
            <p className="text-foreground font-semibold text-sm">{t('no_transactions')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('fund_wallet_to_start')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map((tx, index) => (
              <motion.button
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedTransaction({
                  id: tx.id,
                  type: tx.type,
                  amount: tx.amount,
                  fee: tx.fee,
                  counterparty: tx.counterparty,
                  timestamp: tx.timestamp,
                  txHash: tx.txHash,
                  status: 'completed',
                  items: tx.items,
                })}
                className="w-full bg-card rounded-2xl p-4 flex items-center gap-3.5 text-left shadow-card hover:shadow-md transition-shadow"
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                  ${tx.type === 'sent' ? 'bg-destructive/8' : 'bg-success/8'}
                `}>
                  {tx.type === 'sent' ? (
                    <ArrowUpRight className="w-4.5 h-4.5 text-destructive" />
                  ) : (
                    <ArrowDownLeft className="w-4.5 h-4.5 text-success" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-[13px] text-foreground truncate flex items-center gap-0.5">
                      {tx.counterparty.startsWith('0x') ? shortenAddress(tx.counterparty) : tx.counterparty}
                      {isMoniBotTag(tx.counterparty) && <VerifiedBadge size={14} />}
                    </p>
                    {tx.counterparty.startsWith('0x') && (
                      <span className="px-1.5 py-0.5 text-[8px] font-semibold bg-[hsl(var(--chip-peach))] text-orange-600 dark:text-orange-400 rounded-full flex-shrink-0">
                        External
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <span className={`font-bold text-[14px] ${tx.type === 'sent' ? 'text-destructive' : 'text-success'}`}>
                  {tx.type === 'sent' ? '-' : '+'}${tx.amount.toFixed(2)}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <QRScanner
            onScan={handleQRScanned}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>

      {/* Payment Sheet */}
      <BottomSheet
        isOpen={showPayment && !!scannedData}
        onClose={() => !isProcessing && setShowPayment(false)}
        title={t('confirm_payment')}
      >
        {scannedData && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>{t('paying')}</p>
              <h3 className="font-bold text-foreground flex items-center justify-center gap-1" style={{ fontSize: 'clamp(18px, 5vw, 24px)' }}>
                @{scannedData.payTag}
                {isMoniBotTag(scannedData.payTag) && <VerifiedBadge size={20} />}
              </h3>
            </div>

            {scannedData.items && scannedData.items.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="font-medium text-muted-foreground mb-2" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>{t('items')}</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {scannedData.items.map((item, index) => (
                    <div key={index} className="flex justify-between" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                      <span className="text-foreground">{item.name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                      <span className="font-medium text-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted rounded-2xl p-5 text-center">
              <span className="font-bold text-foreground" style={{ fontSize: 'clamp(28px, 8vw, 40px)' }}>
                ${scannedData.amount.toFixed(2)}
              </span>
              <p className="text-muted-foreground mt-1" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>{getChainConfig(profile?.preferredNetwork || 'base').currency} on {getChainConfig(profile?.preferredNetwork || 'base').name}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                <span className="text-muted-foreground">{t('merchant_receives')}</span>
                <span className="font-medium text-foreground">${scannedData.merchantReceives.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                <span className="text-muted-foreground">{t('platform_fee')}</span>
                <span className="font-medium text-foreground">${scannedData.fee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                <span className="text-muted-foreground">{t('network_fee')}</span>
                <span className="font-medium text-base-blue">{t('sponsored')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                size="lg"
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="w-full h-[52px] font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <MoniPayLogo size={20} color="hsl(var(--background))" animationMode="processing" />
                    <span className="truncate">{t('processing')}</span>
                  </div>
                ) : (
                  t('confirm_payment')
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowPayment(false)}
                disabled={isProcessing}
                className="w-full h-[52px] rounded-full"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                {t('cancel')}
              </Button>
            </div>
            
            {isProcessing && (
              <p className="text-center text-muted-foreground" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>
                <Shield className="w-3 h-3 inline mr-1" />
                {t('signing_paymaster')}
              </p>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Send Sheet */}
      <BottomSheet
        isOpen={showSend}
        onClose={() => !isProcessing && setShowSend(false)}
        title={t('send_currency', { currency: getChainConfig(profile?.preferredNetwork || 'base').currency })}
      >
        <div className="space-y-4">
          <div>
            <label className="font-medium text-muted-foreground mb-2 block" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              {t('recipient_paytag')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">@</span>
              <Input
                placeholder="username"
                value={sendPayTag}
                onChange={(e) => setSendPayTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                onFocus={() => setSendTagFocused(true)}
                onBlur={() => setTimeout(() => setSendTagFocused(false), 150)}
                className="pl-8"
                disabled={isProcessing}
                autoComplete="off"
              />
              {sendTagFocused && (() => {
                const recentTags = Array.from(new Set(
                  transactions
                    .map(tx => tx.counterparty)
                    .filter(c => c && !c.startsWith('0x') && c !== 'monibot')
                    .map(c => c.replace(/^@/, ''))
                    .filter(tag => tag && tag !== profile?.payTag)
                ));
                const filtered = sendPayTag
                  ? recentTags.filter(tag => tag.includes(sendPayTag))
                  : recentTags;
                const suggestions = filtered.slice(0, 5);
                if (suggestions.length === 0) return null;
                return (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                    {suggestions.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setSendPayTag(tag); setSendTagFocused(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-center gap-2"
                        style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}
                      >
                        <span className="text-muted-foreground">@</span>
                        <span className="font-medium text-foreground">{tag}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
          
          <div>
            <label className="font-medium text-muted-foreground mb-2 block" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              {t('amount_currency', { currency: getChainConfig(profile?.preferredNetwork || 'base').currency })}
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              step="0.01"
              min="0"
              disabled={isProcessing}
            />
          </div>

          <div className="bg-muted rounded-xl p-4">
            <div className="flex justify-between mb-2" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              <span className="text-muted-foreground">{t('recipient_gets')}</span>
              <span className="text-foreground">${parseFloat(sendAmount || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              <span className="text-muted-foreground">{t('fee_percent')}</span>
              <span className="text-foreground">${(parseFloat(sendAmount || '0') / 99).toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              <span className="text-muted-foreground">{t('network_fee')}</span>
              <span className="text-base-blue font-medium">{t('sponsored')}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              <span className="text-foreground">{t('total')}</span>
              <span className="text-foreground">
                ${(parseFloat(sendAmount || '0') * 100 / 99).toFixed(2)}
              </span>
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleSendConfirm}
            className="w-full h-[52px] font-semibold rounded-full"
            style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
            disabled={!sendPayTag || !sendAmount || isProcessing}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <MoniPayLogo size={20} color="hsl(var(--background))" animationMode="processing" />
                <span>{t('processing')}</span>
              </div>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {t('send_payment')}
              </>
            )}
          </Button>
        </div>
      </BottomSheet>

      {/* Receive Sheet */}
      <BottomSheet
        isOpen={showReceive && !!profile}
        onClose={() => !receiveSuccess && setShowReceive(false)}
        title={receiveSuccess ? undefined : t('receive_payment')}
      >
        {profile && (
          <>
            {receiveSuccess ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-20 h-20 rounded-2xl bg-success flex items-center justify-center mb-6"
                >
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </motion.div>
                
                <h3 className="font-bold text-foreground mb-2" style={{ fontSize: 'clamp(18px, 5vw, 24px)' }}>{t('payment_received')}</h3>
                
                <div className="text-center space-y-1 mb-4">
                  <p className="text-muted-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>{t('from')}</p>
                  {receiveSuccess.isExternal ? (
                    <>
                      <p className="font-mono font-medium text-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                        {receiveSuccess.payTag}
                      </p>
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground rounded">
                        {t('external_wallet')}
                      </span>
                    </>
                  ) : (
                    <p className="font-semibold text-foreground" style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}>@{receiveSuccess.payTag}</p>
                  )}
                </div>
                
                <div className="bg-muted rounded-xl px-6 py-3">
                  <span className="text-2xl font-bold text-success">
                    +${receiveSuccess.amount.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground ml-1">{getChainConfig(profile?.preferredNetwork || 'base').currency}</span>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Mode Toggle */}
                <div className="flex items-center justify-center gap-1 mb-4 bg-muted rounded-xl p-1">
                  <button
                    onClick={() => setReceiveMode('monipay')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      receiveMode === 'monipay' 
                        ? 'bg-card text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    MoniPay
                  </button>
                  <button
                    onClick={() => setReceiveMode('external')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      receiveMode === 'external' 
                        ? 'bg-card text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    External Wallet
                  </button>
                </div>
                
                <div className="flex flex-col items-center">
                  {receiveMode === 'monipay' ? (
                    <>
                      <BrandedQR
                        value={JSON.stringify({
                          type: 'paytag_receive',
                          payTag: profile.payTag,
                          address: profile.wallet?.address,
                        })}
                        size={160}
                        payTag={profile.payTag}
                        showActions
                        copyValue={`@${profile.payTag}`}
                        compact
                      />
                      
                      <p className="text-muted-foreground text-center mt-2" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>
                        {t('for_monipay_app')}
                      </p>
                    </>
                  ) : (
                    <>
                      <BrandedQR
                        value={(() => {
                          const n = profile?.preferredNetwork || 'base';
                          if (n === 'solana' && profile?.wallet?.solanaAddress) return profile.wallet.solanaAddress;
                          return profile?.wallet?.address || '';
                        })()}
                        size={160}
                        subtitle={(() => {
                          const n = profile?.preferredNetwork || 'base';
                          const addr = (n === 'solana' && profile?.wallet?.solanaAddress) ? profile.wallet.solanaAddress : profile?.wallet?.address;
                          return addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '';
                        })()}
                        showActions
                        copyValue={(() => {
                          const n = profile?.preferredNetwork || 'base';
                          if (n === 'solana' && profile?.wallet?.solanaAddress) return profile.wallet.solanaAddress;
                          return profile?.wallet?.address || '';
                        })()}
                        compact
                      />
                      
                      <div className="flex items-center gap-1.5 mt-2">
                        {profile?.preferredNetwork === 'solana' ? (
                          <>
                            <span className="text-muted-foreground" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>USDC on Solana</span>
                          </>
                        ) : profile?.preferredNetwork === 'bsc' ? (
                          <>
                            <span className="w-4 h-4 rounded-full bg-[hsl(45,100%,51%)] flex items-center justify-center text-[8px] font-bold text-black">B</span>
                            <span className="text-muted-foreground" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>USDT on BSC</span>
                          </>
                        ) : (
                          <>
                            <TokenUSDC size={16} variant="branded" />
                            <span className="text-muted-foreground" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>USDC on</span>
                            <NetworkBase size={16} variant="branded" />
                            <span className="text-muted-foreground" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>Base</span>
                          </>
                        )}
                      </div>
                      
                      <p className="text-muted-foreground text-center mt-1" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>
                        For <span className="text-base-blue font-medium">External Wallets</span>
                      </p>
                    </>
                  )}
                  
                  <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-2 h-2 rounded-full bg-primary"
                    />
                    <span>{t('waiting_for_payment')}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </BottomSheet>

      {/* Fund Wallet Modal - New Deposit Selector */}
      <FundWalletModal
        isOpen={showFund}
        onClose={() => {
          setShowFund(false);
          setInsufficientFundsAmount(null);
        }}
        walletAddress={profile?.wallet?.address || ''}
        defaultNetwork={profile?.preferredNetwork}
        insufficientFundsAmount={insufficientFundsAmount}
        onDepositSuccess={(amount) => {
          refreshBalance();
        }}
      />

      {/* Pending Transactions Indicator */}
      <AnimatePresence>
        {hasPending && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-40"
          >
            <div className="bg-base-blue text-white rounded-xl p-4 flex items-center gap-3 shadow-lg">
              <MoniPayLogo size={20} color="#ffffff" animationMode="processing" />
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {pendingTransactions.length} transaction{pendingTransactions.length > 1 ? 's' : ''} pending
                </p>
                <p className="text-xs opacity-80">
                  Waiting for blockchain confirmation...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Success - Logo morph overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-success rounded-3xl p-8 w-full max-w-xs text-center text-white"
            >
              <div className="flex justify-center mb-4">
                <MoniPayLogo size={80} color="#ffffff" animationMode="success" />
              </div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-xl font-bold mb-1"
              >
                {t('payment_sent')}
              </motion.h2>
              {scannedData && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-white/80"
                >
                  ${scannedData.amount.toFixed(2)} to @{scannedData.payTag}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Success - Logo morph overlay */}
      <AnimatePresence>
        {showSendSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-success rounded-3xl p-8 w-full max-w-xs text-center text-white"
            >
              <div className="flex justify-center mb-4">
                <MoniPayLogo size={80} color="#ffffff" animationMode="success" />
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-xl font-bold mb-1"
              >
                {t('sent_successfully')}
              </motion.h2>
              {scannedData && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-white/80"
                >
                  ${scannedData.amount.toFixed(2)} to @{scannedData.payTag}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Biometric Auth Modal for High-Value Transactions */}
      <AnimatePresence>
        {showBiometricModal && (
          <BiometricAuthModal
            amount={pendingAmount}
            onSuccess={handleAuthSuccess}
            onCancel={handleAuthCancel}
          />
        )}
      </AnimatePresence>

      {/* Invoices Section Modal */}
      <AnimatePresence>
        {showInvoices && (
          <InvoicesSection
            isOpen={showInvoices}
            onClose={() => setShowInvoices(false)}
          />
        )}
      </AnimatePresence>

      {/* Transaction Receipt Modal */}
      {selectedTransaction && (
        <TransactionReceiptModal
          transaction={selectedTransaction}
          walletAddress={profile?.wallet?.address}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {/* Solana Key Unlock Gate */}
      <AnimatePresence>
        {showSolanaUnlock && (
          <SecurityGate
            title="Unlock Solana Wallet"
            description="Enter your PIN to decrypt the Solana private key"
            onAuthenticated={handleSolanaUnlockAuthenticated}
            onCancel={() => { setShowSolanaUnlock(false); setPendingSolanaAction(null); }}
          />
        )}
      </AnimatePresence>
      </div>
    </PullToRefresh>
  );
}
