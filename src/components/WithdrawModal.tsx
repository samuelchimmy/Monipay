import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, Wallet, ArrowRight, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomSheet } from './BottomSheet';
import { usePayTag } from '@/contexts/PayTagContext';
import { feedback } from '@/lib/feedback';
import { SecurityGate } from './SecurityGate';
import { signPaymentAuthorization, signPaymentAuthorizationWithSigner, getPaymentNonce } from '@/lib/wallet';
import { useUnifiedSigner } from '@/hooks/useUnifiedSigner';
import { getChainConfig, isSolanaNetwork, type SupportedNetwork } from '@/config/chains';

// MoniPay is Celo-only. Solana withdrawal was removed; isSolanaNetwork() is
// always false so these paths are dead — local no-op stubs keep them typed.
function getSolanaKeypairFromSecret(_hexSecret: string): never {
  throw new Error('Solana is not supported');
}
async function sendSolanaPayment(_opts: unknown): Promise<{ success: boolean; txHash?: string; error?: string }> {
  return { success: false, error: 'Solana is not supported' };
}
import { TEMPO_ENABLED } from '@/lib/featureFlags';
import { ModalNetworkToggle } from '@/components/ModalNetworkToggle';
import { approveCeloTokenWithKey } from '@/lib/celoWallet';
import { approveEvmTokenWithKey } from '@/lib/evmApproval';
import { ensureGasForApproval } from '@/lib/gasGuard';

// ── Celo multi-token config ────────────────────────────────────────────────
const CELO_TOKENS = [
  { symbol: 'USDT',  address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as `0x${string}`, decimals: 6,  router: '0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0' as `0x${string}` },
  { symbol: 'G$',    address: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A' as `0x${string}`, decimals: 18, router: '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' as `0x${string}` },
  { symbol: 'USDC',  address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as `0x${string}`, decimals: 6,  router: '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' as `0x${string}` },
  { symbol: 'USDm',  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`, decimals: 18, router: '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' as `0x${string}` },
] as const;
type CeloTokenSymbol = typeof CELO_TOKENS[number]['symbol'];

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  /**
   * MiniPay / wallet-only contexts that don't propagate through wagmi can
   * force the modal into wallet-only mode so the PIN/auth gate is skipped
   * and signing routes through the injected wallet via `useUnifiedSigner`.
   */
  forceWalletOnly?: boolean;
  /**
   * 'withdraw' (default) — full chain/MiniPay menu.
   * 'send'     — strictly P2P: only "Via moniTag" + "External wallet".
   *              Used by the MiniPay Send tile.
   */
  mode?: 'send' | 'withdraw';
}

type WithdrawMethod = 'paytag' | 'address' | 'minipay';
type WithdrawStep = 'auth' | 'method' | 'details' | 'confirm' | 'processing' | 'success' | 'error';

const PLATFORM_FEE_PERCENT = 0.01;
const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

export function WithdrawModal({ isOpen, onClose, balance, forceWalletOnly = false, mode = 'withdraw' }: WithdrawModalProps) {
  const { profile, decryptedPrivateKey, decryptedSolanaKey, lookupPayTag, refreshBalance, isCeloMode, activeNetworkReady, isWalletOnly: ctxWalletOnly } = usePayTag();
  const isWalletOnly = ctxWalletOnly || forceWalletOnly;
  const isSendMode = mode === 'send';
  const { signer: unifiedSigner } = useUnifiedSigner();
  const [method, setMethod] = useState<WithdrawMethod>(
    isSendMode ? 'paytag' : (isCeloMode ? 'minipay' : 'paytag'),
  );
  const [step, setStep] = useState<WithdrawStep>('method');
  const [network, setNetwork] = useState<SupportedNetwork>(isCeloMode ? 'celo' : (profile?.preferredNetwork || 'celo'));

  // Keep network in sync with the user's currently-active preferred network
  // (fixes merchant withdraw defaulting to base after switching chains).
  useEffect(() => {
    if (!isOpen) return;
    const current = isCeloMode ? 'celo' : (profile?.preferredNetwork || 'celo');
    setNetwork(current as SupportedNetwork);
  }, [isOpen, isCeloMode, profile?.preferredNetwork]);
  const [payTag, setPayTag] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<{ address: string; payTag?: string } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Celo multi-token selection ────────────────────────────────────────────
  const [celoToken, setCeloToken] = useState<CeloTokenSymbol>('USDT');
  const activeCeloToken = CELO_TOKENS.find(t => t.symbol === celoToken) ?? CELO_TOKENS[0];
  // Reset token selection when modal opens or network changes
  useEffect(() => { if (!isOpen) return; if (network !== 'celo') setCeloToken('USDT'); }, [isOpen, network]);

  const isMiniPay = !!(window as any).ethereum?.isMiniPay;

  const chainConfig = getChainConfig(network);
  // For Celo, show the selected token symbol; for other chains, use chain default
  const tokenLabel = network === 'celo' ? activeCeloToken.symbol : chainConfig.currency;

  const numericAmount = parseFloat(amount) || 0;
  const fee = numericAmount * PLATFORM_FEE_PERCENT;
  const recipientReceives = numericAmount - fee;
  const isValidAmount = numericAmount >= 0.01 && numericAmount <= balance;

  const resetModal = () => {
    setStep('auth');
    setMethod('paytag');
    setNetwork(profile?.preferredNetwork || 'celo');
    setPayTag('');
    setAddress('');
    setAmount('');
    setRecipientInfo(null);
    setTxHash(null);
    setErrorMessage(null);
    setIsValidating(false);
  };

  // Show auth gate when modal opens
  useEffect(() => {
    if (isOpen) {
      // Wallet-only sessions (MiniPay native / external wallet) sign via
      // the injected wallet — no PIN/encrypted-key, so skip the auth gate.
      setStep(isWalletOnly ? 'method' : 'auth');
    }
  }, [isOpen, isWalletOnly]);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleMethodSelect = (selectedMethod: WithdrawMethod) => {
    feedback('tap');
    setMethod(selectedMethod);

    if (selectedMethod === 'minipay') {
      // For MiniPay, robustly request the injected wallet address via
      // eth_requestAccounts (selectedAddress is unreliable in some MiniPay
      // builds). We pre-fill recipientInfo so the confirm step has it.
      const eth = (window as any).ethereum;
      if (eth?.request) {
        eth.request({ method: 'eth_requestAccounts' })
          .then((accounts: string[]) => {
            if (accounts?.[0]) {
              setRecipientInfo({ address: accounts[0] });
            }
          })
          .catch(() => { /* user can still continue — we'll re-request on Next */ });
      }
      setStep('details');
    } else {
      setStep('details');
    }
  };

  const validatePayTag = async () => {
    if (!payTag.trim()) return;

    if (payTag.toLowerCase() === profile?.payTag?.toLowerCase()) return;

    setIsValidating(true);
    try {
      const result = await lookupPayTag(payTag);
      if (result) {
        const resolvedAddress = result.walletAddress;
        setRecipientInfo({ address: resolvedAddress, payTag: result.payTag });
        setStep('confirm');
      }
    } catch (error) {
      console.error('Lookup failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const validateAddress = () => {
    if (!address.trim()) return;

    const isSolana = isSolanaNetwork(network);

    if (isSolana) {
      // Solana Base58 address validation (32-44 chars, no 0/O/I/l)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return;
      if (address === profile?.wallet?.solanaAddress) return;
    } else {
      if (address.toLowerCase() === profile?.wallet?.address?.toLowerCase()) return;
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
    }

    setRecipientInfo({ address });
    setStep('confirm');
  };

  const handleNext = () => {
    if (!isValidAmount) return;

    if (method === 'minipay') {
      // Always use eth_requestAccounts — selectedAddress is undefined in
      // some MiniPay builds, which silently breaks the flow.
      const eth = (window as any).ethereum;
      if (recipientInfo?.address) {
        setStep('confirm');
        return;
      }
      eth?.request({ method: 'eth_requestAccounts' })
        .then((accounts: string[]) => {
          if (accounts?.[0]) {
            setRecipientInfo({ address: accounts[0] });
            setStep('confirm');
          } else {
            setErrorMessage('Could not read MiniPay wallet address');
            setStep('error');
          }
        })
        .catch(() => {
          setErrorMessage('Could not connect to MiniPay wallet');
          setStep('error');
        });
      return;
    }

    if (method === 'paytag') {
      validatePayTag();
    } else {
      validateAddress();
    }
  };

  const handleWithdraw = async () => {
    if (!recipientInfo || !profile?.id || !profile?.wallet?.address) return;

    const isSolana = isSolanaNetwork(network);
    if (isSolana && !activeNetworkReady) {
      setErrorMessage('Solana wallet not ready. Go to Settings → Solana Wallet to set up.');
      setStep('error');
      return;
    }
    if (!isSolana && !decryptedPrivateKey && !(isWalletOnly && unifiedSigner)) return;

    setStep('processing');
    feedback('tap');

    try {
      const isSolana = isSolanaNetwork(network);

      if (isSolana) {
        // Solana: build SPL transfer via relay
        if (!decryptedSolanaKey) throw new Error('Solana wallet not unlocked');
        const keypair = getSolanaKeypairFromSecret(decryptedSolanaKey);

        const result = await sendSolanaPayment({
          senderKeypair: keypair,
          recipientAddress: recipientInfo.address,
          amount: numericAmount,
          senderProfileId: profile.id,
          recipientPayTag: recipientInfo.payTag || undefined,
        });

        if (!result.success) throw new Error(result.error || 'Transfer failed');
        setTxHash(result.txHash || null);
      } else {
        // EVM: existing relay flow
        const toAddress = recipientInfo.address as `0x${string}`;
        const fromAddress = profile.wallet.address as `0x${string}`;
        const nonce = await getPaymentNonce(fromAddress, network);

        const { signature, message } = isWalletOnly && unifiedSigner
          ? await signPaymentAuthorizationWithSigner(
              unifiedSigner,
              toAddress,
              recipientReceives,
              fee,
              nonce,
              network
            )
          : await signPaymentAuthorization(
              decryptedPrivateKey as `0x${string}`,
              toAddress,
              recipientReceives,
              fee,
              nonce,
              network
            );

        const relayEndpoint =
          network === 'celo' ? 'relay-payment-celo'
          : 'relay-payment';
        const buildBody = () => ({
          action: 'relay',
          senderProfileId: profile.id,
          recipientPayTag: recipientInfo.payTag || null,
          recipientAddress: toAddress,
          network,
          signature,
          // ── Celo multi-token: pass the selected token to relay-payment-celo
          ...(network === 'celo' ? {
            tokenAddress:  activeCeloToken.address,
            routerAddress: activeCeloToken.router,
            decimals:      activeCeloToken.decimals,
            tokenSymbol:   activeCeloToken.symbol,
          } : {}),
          message: {
            from: message.from,
            to: message.to,
            amount: message.amount.toString(),
            fee: message.fee.toString(),
            nonce: message.nonce.toString(),
            deadline: message.deadline.toString(),
          },
        });

        const callRelay = async () => {
          const r = await fetch(`${SUPABASE_FUNCTIONS_URL}/${relayEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBody()),
          });
          return { ok: r.ok, json: await r.json() };
        };

        let { ok, json } = await callRelay();

        // Celo/Ink: relay may return 400 + needsApproval=true on first send.
        // Trigger a one-time token→Router approval using the user's local
        // private key, then auto-retry the relay once.
        if (!ok && network === 'celo' && json?.needsApproval) {
          if (!decryptedPrivateKey) throw new Error('Wallet locked — cannot approve');
          // Proactively top up native gas so the approve tx doesn't silently fail.
          const fromAddr = profile.wallet.address || '';
          if (fromAddr) {
            const guard = await ensureGasForApproval(network, fromAddr);
            if (!guard.funded) {
              throw new Error('Network fee top-up pending — please retry in a moment');
            }
          }
          if (network === 'celo') {
            // Approve the CORRECT token+router pair (not just USDT)
            await approveCeloTokenWithKey(
              decryptedPrivateKey as `0x${string}`,
              activeCeloToken.address,
              activeCeloToken.router,
            );
          } else {
            await approveEvmTokenWithKey(decryptedPrivateKey as `0x${string}`, network);
          }
          // Wait briefly for the approval to land, then retry the relay
          await new Promise((resolve) => setTimeout(resolve, 4000));
          ({ ok, json } = await callRelay());
        }

        if (!ok) {
          const detail = json?.details ? ` — ${json.details}` : '';
          throw new Error((json?.error || 'Transfer failed') + detail);
        }
        setTxHash(json.txHash);
      }

      setStep('success');
      feedback('success');
      setTimeout(() => refreshBalance(), 2000);
    } catch (error) {
      console.error('Withdrawal error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Transfer failed');
      setStep('error');
      feedback('error');
    }
  };

  const handleSetMax = () => {
    setAmount(balance.toFixed(2));
  };

  if (!isOpen) return null;

  // Show security gate as full-screen overlay before showing the modal
  if (step === 'auth' && !isWalletOnly) {
    return (
      <AnimatePresence>
        <SecurityGate
          title="Withdraw Funds"
          description="Enter PIN or use biometrics to access withdrawals"
          onAuthenticated={() => setStep('method')}
          onCancel={handleClose}
        />
      </AnimatePresence>
    );
  }

  const modalTitle = step === 'method' ? (isSendMode ? 'Send' : 'Withdraw Funds')
    : step === 'details' ? (method === 'minipay' ? 'Withdraw to MiniPay' : method === 'paytag' ? (isSendMode ? 'Send via moniTag' : 'Send to PayTag') : (isSendMode ? 'Send to External Wallet' : 'Send to Address'))
    : step === 'confirm' ? (isSendMode ? 'Confirm Send' : 'Confirm Withdrawal')
    : step === 'processing' ? 'Processing...'
    : step === 'success' ? 'Success!'
    : step === 'error' ? 'Error'
    : 'Withdraw';

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title={modalTitle}>
      <AnimatePresence mode="wait">
        {/* Step 1: Select Method */}
        {step === 'method' && (
          <motion.div
            key="method"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-muted-foreground mb-2" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              Choose how you want to withdraw your funds
            </p>

            {/* Network Selector */}
            <div className="mb-2">
              <ModalNetworkToggle
                value={network}
                onChange={setNetwork}
                locked={isCeloMode}
              />
            </div>

            {(!isCeloMode || isSendMode) && (
            <button
              onClick={() => handleMethodSelect('paytag')}
              className="w-full p-4 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground" style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}>Via moniTag</p>
                <p className="text-muted-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>Send to a Minipay user by @moniTag</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </button>
            )}

            {/* External Wallet — available everywhere (including the /minipay context) */}
            <button
              onClick={() => handleMethodSelect('address')}
              className="w-full p-4 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <Wallet className="w-6 h-6 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground" style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}>External Wallet</p>
                <p className="text-muted-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>Send to any wallet address</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* MiniPay option — visible inside MiniPay webview, OR forced when in /minipay context.
                Hidden in dedicated Send mode (P2P only). */}
            {!isSendMode && (isMiniPay || isCeloMode) && network === 'celo' && (
              <button
                onClick={() => handleMethodSelect('minipay')}
                className="w-full p-4 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-success" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground" style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}>MiniPay Wallet</p>
                  <p className="text-muted-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>Withdraw to your MiniPay wallet</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-muted-foreground text-center" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>
                Available balance: <span className="font-semibold text-foreground">${balance.toFixed(2)} {tokenLabel}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Step 2: Enter Details */}
        {step === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* ── Celo token selector ── */}
            {network === 'celo' && (
              <div>
                <label className="font-medium text-foreground mb-2 block" style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}>Token</label>
                <div className="flex gap-2 flex-wrap">
                  {CELO_TOKENS.map((t) => (
                    <button
                      key={t.symbol}
                      type="button"
                      onClick={() => setCeloToken(t.symbol)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        celoToken === t.symbol
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-muted text-muted-foreground border-border hover:border-foreground/40'
                      }`}
                    >
                      {t.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === 'minipay' ? (
              <div className="bg-success/10 border border-success/20 rounded-2xl p-4 text-center">
                <Wallet className="w-8 h-8 mx-auto text-success mb-2" />
                <p className="font-semibold text-foreground" style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}>Withdraw to MiniPay</p>
                <p className="text-muted-foreground mt-1" style={{ fontSize: 'clamp(11px, 3vw, 13px)' }}>
                  {tokenLabel} will be sent to your connected MiniPay wallet
                </p>
              </div>
            ) : method === 'paytag' ? (
              <div>
                <label className="font-medium text-foreground mb-2 block" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                  Recipient PayTag
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input
                    value={payTag}
                    onChange={(e) => setPayTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="pl-8"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="font-medium text-foreground mb-2 block" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                  Wallet Address
                </label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={isSolanaNetwork(network) ? 'Solana address...' : '0x...'}
                  className="font-mono"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="font-medium text-foreground mb-2 block" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                Amount ({tokenLabel})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 pr-16"
                  step="0.01"
                  min="0.01"
                  max={balance}
                />
                <button
                  onClick={handleSetMax}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-primary hover:text-primary/80"
                  style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}
                >
                  MAX
                </button>
              </div>
              <p className="text-muted-foreground mt-1" style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>
                Available: ${balance.toFixed(2)} {tokenLabel}
              </p>
            </div>

            {numericAmount > 0 && (
              <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-foreground">${numericAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                  <span className="text-muted-foreground">Fee (1%)</span>
                  <span className="text-foreground">-${fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 mt-1" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                  <span className="font-medium text-foreground">Recipient gets</span>
                  <span className="font-bold text-success">${recipientReceives.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleNext}
                disabled={!isValidAmount || isValidating}
                className="w-full h-[52px] rounded-full"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                {isValidating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('method')}
                className="w-full h-[52px] rounded-full"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                Back
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && recipientInfo && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
              <div className="text-center mb-4">
                <Send className="w-12 h-12 mx-auto text-primary mb-2" />
                <p className="font-bold text-foreground" style={{ fontSize: 'clamp(20px, 6vw, 28px)' }}>${numericAmount.toFixed(2)}</p>
                <p className="text-muted-foreground" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>{tokenLabel}</p>
              </div>

              <div className="space-y-2" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-medium text-foreground">
                    {recipientInfo.payTag ? `@${recipientInfo.payTag}` : `${recipientInfo.address.slice(0, 10)}...${recipientInfo.address.slice(-8)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span className="text-foreground">{chainConfig.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-foreground">${fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-medium text-foreground">Recipient gets</span>
                  <span className="font-bold text-success">${recipientReceives.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleWithdraw}
                className="w-full h-[52px] rounded-full"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                <Send className="w-4 h-4 mr-2" />
                Confirm & Send
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('details')}
                className="w-full h-[52px] rounded-full"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                Back
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Processing */}
        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="py-12 text-center"
          >
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
            <p className="font-medium text-foreground" style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}>Processing withdrawal...</p>
            <p className="text-muted-foreground mt-2" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>Please wait while we process your transaction</p>
          </motion.div>
        )}

        {/* Step 5: Success */}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="py-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 mx-auto rounded-full bg-success flex items-center justify-center mb-4"
            >
              <Check className="w-10 h-10 text-white" />
            </motion.div>
            <h3 className="font-bold text-foreground mb-2" style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}>Withdrawal Sent!</h3>
            <p className="text-muted-foreground mb-4" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              ${recipientReceives.toFixed(2)} {tokenLabel} sent to {recipientInfo?.payTag ? `@${recipientInfo.payTag}` : 'recipient'}
            </p>
            
            {txHash && (
              <a
                href={`${chainConfig.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}
              >
                View on {chainConfig.name === 'BSC' ? 'BscScan' : chainConfig.name === 'Tempo' ? 'Tempo Explorer' : chainConfig.name === 'Solana' ? 'Solscan' : 'BaseScan'} ↗
              </a>
            )}

            <Button
              onClick={handleClose}
              className="w-full mt-6 h-[52px] rounded-full"
              style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
            >
              Done
            </Button>
          </motion.div>
        )}

        {/* Step 6: Error */}
        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="py-8 text-center"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="font-bold text-foreground mb-2" style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}>Withdrawal Failed</h3>
            <p className="text-muted-foreground mb-6" style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              {errorMessage || 'Something went wrong. Please try again.'}
            </p>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setStep('confirm')}
                className="w-full h-[52px] rounded-full"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full h-[52px] rounded-full"
                style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BottomSheet>
  );
}