import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/components/TokenIcon';
import { MoniPayLogo } from './MoniPayLogo';
import { 
  FileText, X, Clock, Check, XCircle, AlertCircle, 
  ChevronRight, ArrowDownLeft, ArrowUpRight, Shield
} from 'lucide-react';

import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useInvoices, Invoice, InvoiceItem } from '@/hooks/useInvoices';
import { usePayTag } from '@/contexts/PayTagContext';
import { signPaymentAuthorization, signPaymentAuthorizationWithSigner, getPaymentNonce, checkUsdcApproval } from '@/lib/wallet';
import { useUnifiedSigner } from '@/hooks/useUnifiedSigner';
import { BiometricAuthModal, useBiometricAuth } from './BiometricAuthModal';
import { feedback } from '@/lib/feedback';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';

const PLATFORM_FEE_PERCENT = 0.01;

// ── Celo multi-token config ────────────────────────────────────────────────
const CELO_TOKENS = [
  { symbol: 'USDT',  address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as `0x${string}`, decimals: 6,  router: '0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0' as `0x${string}` },
  { symbol: 'G$',    address: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A' as `0x${string}`, decimals: 18, router: '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' as `0x${string}` },
  { symbol: 'USDC',  address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as `0x${string}`, decimals: 6,  router: '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' as `0x${string}` },
  { symbol: 'USDm',  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`, decimals: 18, router: '0x39E7EC08ec0c84CBF4Af9d9e4FA2259FA41D1dEE' as `0x${string}` },
] as const;
type CeloTokenSymbol = typeof CELO_TOKENS[number]['symbol'];

interface InvoicesSectionProps {
  isOpen: boolean;
  onClose: () => void;
  deepLinkInvoiceId?: string | null;
}

export function InvoicesSection({ isOpen, onClose, deepLinkInvoiceId }: InvoicesSectionProps) {
  const { profile, decryptedPrivateKey, decryptedSolanaKey, updateBalance, addTransaction, syncTransactions, solanaReady, activeNetworkReady, isWalletOnly } = usePayTag();
  const { signer: unifiedSigner } = useUnifiedSigner();
  const { 
    receivedInvoices, 
    sentInvoices, 
    pendingCount, 
    isLoading, 
    payInvoice,
    cancelInvoice,
    fetchInvoices,
  } = useInvoices(profile?.id);
  
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasDeepLinked, setHasDeepLinked] = useState(false);

  // ── Celo token selection for paying invoices ──────────────────────────────
  const invoiceNetwork = (profile?.preferredNetwork || 'base') as SupportedNetwork;
  const isCeloInvoice = invoiceNetwork === 'celo';
  const [celoToken, setCeloToken] = useState<CeloTokenSymbol>('USDT');
  const activeCeloToken = CELO_TOKENS.find(t => t.symbol === celoToken) ?? CELO_TOKENS[0];
  useEffect(() => { if (!isOpen) return; if (!isCeloInvoice) setCeloToken('USDT'); }, [isOpen, isCeloInvoice]);

  const {
    showBiometricModal,
    pendingAmount,
    checkBiometricRequired,
    handleAuthSuccess,
    handleAuthCancel,
  } = useBiometricAuth();

  // Deep-link to specific invoice when provided
  useEffect(() => {
    if (!deepLinkInvoiceId || hasDeepLinked || isLoading) return;

    // Look for the invoice in both sent and received lists
    const allInvoices = [...sentInvoices, ...receivedInvoices];
    const targetInvoice = allInvoices.find(inv => inv.id === deepLinkInvoiceId);
    
    if (targetInvoice) {
      // Switch to the correct tab
      const isReceived = receivedInvoices.some(inv => inv.id === deepLinkInvoiceId);
      setActiveTab(isReceived ? 'received' : 'sent');
      setSelectedInvoice(targetInvoice);
      setHasDeepLinked(true);
    }
  }, [deepLinkInvoiceId, sentInvoices, receivedInvoices, isLoading, hasDeepLinked]);

  // Reset deep-link state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasDeepLinked(false);
    }
  }, [isOpen]);

  const invoices = activeTab === 'received' ? receivedInvoices : sentInvoices;
  const pendingReceived = receivedInvoices.filter(i => i.status === 'pending');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'paid':
        return <Check className="w-4 h-4 text-success" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "text-xs font-medium px-2 py-0.5 rounded-full";
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-amber-500/10 text-amber-500`;
      case 'paid':
        return `${baseClasses} bg-success/10 text-success`;
      case 'expired':
        return `${baseClasses} bg-muted text-muted-foreground`;
      case 'cancelled':
        return `${baseClasses} bg-destructive/10 text-destructive`;
      default:
        return baseClasses;
    }
  };

  const executePayment = async () => {
    if (!selectedInvoice || !profile) return;

    setIsProcessing(true);
    feedback('tap');

    try {
      const network = (profile.preferredNetwork || 'celo') as SupportedNetwork;
      const config = getChainConfig(network);

      {
        // ─── EVM invoice payment path (Celo) ───
        if (!decryptedPrivateKey) return;

        // Check token approval first
        const approvalStatus = network === 'celo'
          ? await checkUsdcApproval(
              profile.wallet.address,
              network,
              activeCeloToken.address,
              activeCeloToken.router,
              activeCeloToken.decimals,
              activeCeloToken.symbol
            )
          : await checkUsdcApproval(profile.wallet.address, network);

        const currentDecimals = network === 'celo' ? activeCeloToken.decimals : config.decimals;
        const requiredAmount = BigInt(Math.ceil(selectedInvoice.amount * Math.pow(10, currentDecimals)));

        if (approvalStatus.allowance < requiredAmount) {
          feedback('error');
          setIsProcessing(false);
          return;
        }

        // Fetch the merchant's wallet address
        const invoiceResponse = await fetch('https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get',
            invoiceId: selectedInvoice.id,
            network,
          }),
        });

        const invoiceData = await invoiceResponse.json();
        if (!invoiceData.invoice?.senderWalletAddress) {
          throw new Error('Could not fetch merchant address');
        }

        const merchantAddress = invoiceData.invoice.senderWalletAddress as `0x${string}`;
        const fee = selectedInvoice.amount * PLATFORM_FEE_PERCENT;
        const merchantReceives = selectedInvoice.amount - fee;

        // Fetch nonce
        const nonce = await getPaymentNonce(profile.wallet.address, network);

        const activeRouter = network === 'celo' ? activeCeloToken.router : undefined;

        // Sign payment authorization (unified: legacy decrypted key OR wagmi walletClient)
        const { signature, message } = isWalletOnly && unifiedSigner
          ? await signPaymentAuthorizationWithSigner(
              unifiedSigner,
              merchantAddress,
              merchantReceives,
              fee,
              nonce,
              network,
              currentDecimals,
              activeRouter
            )
          : await signPaymentAuthorization(
              decryptedPrivateKey,
              merchantAddress,
              merchantReceives,
              fee,
              nonce,
              network,
              currentDecimals,
              activeRouter
            );

        // Pay the invoice (pass custom token parameters if on Celo)
        const result = await payInvoice({
          invoiceId: selectedInvoice.id,
          payerProfileId: profile.id,
          network,
          signature,
          ...(network === 'celo' ? {
            tokenAddress:  activeCeloToken.address,
            routerAddress: activeCeloToken.router,
            decimals:      activeCeloToken.decimals,
            tokenSymbol:   activeCeloToken.symbol,
          } : {}),
          message: {
            from: profile.wallet.address,
            to: merchantAddress,
            amount: message.amount.toString(),
            fee: message.fee.toString(),
            nonce: message.nonce.toString(),
            deadline: message.deadline.toString(),
          },
        });

        if (result.success) {
          updateBalance(selectedInvoice.amount, 'deduct');
          addTransaction({
            type: 'sent',
            amount: selectedInvoice.amount,
            fee,
            counterparty: `@${selectedInvoice.senderPayTag || 'merchant'}`,
            txHash: result.txHash,
          });

          feedback('payment');
          setSelectedInvoice(null);
          syncTransactions();
        } else {
          throw new Error(result.error || 'Payment failed');
        }
      }
    } catch (error) {
      console.error('Invoice payment failed:', error);
      feedback('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!selectedInvoice || !profile) return;

    // Check balance
    if (profile.balance < selectedInvoice.amount) {
      feedback('error');
      return;
    }

    // Check if biometric auth is required
    const authRequired = checkBiometricRequired(selectedInvoice.amount, executePayment);
    
    if (!authRequired) {
      executePayment();
    }
  };

  const handleCancelInvoice = async (invoice: Invoice) => {
    if (!profile) return;

    setIsProcessing(true);
    feedback('tap');

    const result = await cancelInvoice(invoice.id, profile.id);

    if (result.success) {
      feedback('tap');
      setSelectedInvoice(null);
    } else {
      feedback('error');
    }

    setIsProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => !isProcessing && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-3xl p-6 w-full max-w-md max-h-[80vh] flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-base-blue/10 flex items-center justify-center relative">
                <FileText className="w-5 h-5 text-base-blue" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-foreground">Invoices</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex bg-muted rounded-xl p-1 mb-4">
            <button
              onClick={() => setActiveTab('received')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'received'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Received
              {pendingCount > 0 && (
                <span className="ml-1.5 bg-destructive text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sent'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Sent
            </button>
          </div>

          {/* Invoice List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <MoniPayLogo size={28} color="hsl(var(--muted-foreground))" animationMode="processing" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex justify-center mb-3"
                >
                  <MoniPayLogo size={48} color="hsl(var(--muted-foreground))" animationMode="idle" isEmpty />
                </motion.div>
                <p className="text-muted-foreground">
                  {activeTab === 'received' ? 'No invoices received' : 'No invoices sent'}
                </p>
              </div>
            ) : (
              invoices.map((invoice, index) => (
                <motion.button
                  key={invoice.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.3) }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedInvoice(invoice)}
                  className="w-full bg-muted/50 rounded-xl p-4 flex items-center gap-3 text-left hover:bg-muted transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activeTab === 'received' ? 'bg-amber-500/10' : 'bg-base-blue/10'
                  }`}>
                    {activeTab === 'received' ? (
                      <ArrowDownLeft className="w-5 h-5 text-amber-500" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-base-blue" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {activeTab === 'received' ? `@${invoice.senderPayTag}` : `@${invoice.recipient_pay_tag}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(invoice.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">${invoice.amount.toFixed(2)}</p>
                    <span className={getStatusBadge(invoice.status)}>
                      {invoice.status}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isProcessing && setSelectedInvoice(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedInvoice.status)}
                  <span className={getStatusBadge(selectedInvoice.status)}>
                    {selectedInvoice.status.charAt(0).toUpperCase() + selectedInvoice.status.slice(1)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedInvoice(null)}
                  disabled={isProcessing}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Amount */}
              <div className="text-center mb-6">
                <span className="text-4xl font-bold text-foreground">
                  ${selectedInvoice.amount.toFixed(2)}
                </span>
                <p className="text-sm text-muted-foreground mt-1">
                  {invoiceNetwork === 'celo' ? activeCeloToken.symbol : getChainConfig(invoiceNetwork).currency}
                </p>
              </div>

              {/* Celo Token selector in Invoice Details */}
              {isCeloInvoice && selectedInvoice.status === 'pending' && activeTab === 'received' && (
                <div className="mb-4">
                  <label className="font-medium text-foreground mb-2 block text-xs text-center">Pay With Celo Token</label>
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    {CELO_TOKENS.map((t) => (
                      <button
                        key={t.symbol}
                        type="button"
                        onClick={() => setCeloToken(t.symbol)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                          celoToken === t.symbol
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-muted text-muted-foreground border-border hover:border-foreground/40'
                        }`}
                      >
                        <TokenIcon symbol={t.symbol} size={14} />
                        {t.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* From/To */}
              <div className="bg-muted rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {activeTab === 'received' ? 'From' : 'To'}
                  </span>
                  <span className="font-semibold text-foreground">
                    @{activeTab === 'received' ? selectedInvoice.senderPayTag : selectedInvoice.recipient_pay_tag}
                  </span>
                </div>
              </div>

              {/* Items */}
              {selectedInvoice.items && (selectedInvoice.items as InvoiceItem[]).length > 0 && (
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Items</p>
                  <div className="space-y-1.5">
                    {(selectedInvoice.items as InvoiceItem[]).map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-foreground">
                          {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                        </span>
                        <span className="font-medium text-foreground">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memo */}
              {selectedInvoice.memo && (
                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Note</p>
                  <p className="text-sm text-foreground">{selectedInvoice.memo}</p>
                </div>
              )}

              {/* Expiry */}
              {selectedInvoice.status === 'pending' && selectedInvoice.expires_at && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground">
                    {isPast(new Date(selectedInvoice.expires_at)) ? (
                      <span className="text-destructive">Expired</span>
                    ) : (
                      <>Expires {formatDistanceToNow(new Date(selectedInvoice.expires_at), { addSuffix: true })}</>
                    )}
                  </p>
                </div>
              )}

              {/* Actions */}
              {selectedInvoice.status === 'pending' && (
                <div className="space-y-2">
                  {activeTab === 'received' && !isPast(new Date(selectedInvoice.expires_at || Date.now())) ? (
                    <Button
                      size="lg"
                      onClick={handlePayInvoice}
                      disabled={isProcessing}
                      className="w-full h-14 text-lg font-semibold rounded-2xl"
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <MoniPayLogo size={20} color="#ffffff" animationMode="processing" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        'Pay Now'
                      )}
                    </Button>
                  ) : activeTab === 'sent' ? (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleCancelInvoice(selectedInvoice)}
                      disabled={isProcessing}
                      className="w-full h-12 rounded-2xl border-destructive text-destructive hover:bg-destructive/10"
                    >
                      {isProcessing ? (
                        <MoniPayLogo size={20} color="hsl(var(--foreground))" animationMode="processing" />
                      ) : (
                        'Cancel Invoice'
                      )}
                    </Button>
                  ) : null}
                </div>
              )}

              {/* Paid info */}
              {selectedInvoice.status === 'paid' && selectedInvoice.tx_hash && (() => {
                const isSolana = invoiceNetwork === 'solana';
                const explorerUrl = isSolana 
                  ? `https://solscan.io/tx/${selectedInvoice.tx_hash}`
                  : `${getChainConfig(invoiceNetwork).explorerUrl}/tx/${selectedInvoice.tx_hash}`;
                const explorerName = isSolana ? 'SolScan' : `${getChainConfig(invoiceNetwork).name}Scan`;
                return (
                  <div className="text-center">
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-base-blue hover:underline"
                    >
                      View on {explorerName} →
                    </a>
                  </div>
                );
              })()}

              {isProcessing && (
                <p className="text-center text-xs text-muted-foreground mt-4">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Signing via MoniPay Paymaster...
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Biometric Auth Modal */}
      <AnimatePresence>
        {showBiometricModal && (
          <BiometricAuthModal
            amount={pendingAmount}
            onSuccess={handleAuthSuccess}
            onCancel={handleAuthCancel}
          />
        )}
      </AnimatePresence>
    </>
  );
}
