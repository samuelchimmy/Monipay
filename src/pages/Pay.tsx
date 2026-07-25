import { useState, useEffect } from 'react';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { PageMeta } from '@/components/PageMeta';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenIcon } from '@/components/TokenIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Smartphone, AtSign, Wallet, Loader2, Check, X, 
  AlertTriangle, ArrowLeft, Shield, ChevronDown, ChevronUp,
  ExternalLink, RefreshCw
} from 'lucide-react';
import { useOrders, Order } from '@/hooks/useOrders';
import { usePaymentLinks } from '@/hooks/usePaymentLinks';
import { supabase } from '@/integrations/supabase/client';
import { feedback } from '@/lib/feedback';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { 
  decryptPrivateKeyAsync, 
  decryptPrivateKey,
  signPaymentAuthorization, 
  signPaymentAuthorizationWithSigner,
  getPaymentNonce 
} from '@/lib/wallet';
import { signedFetch } from '@/lib/signedFetch';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { PayTagProvider, usePayTag } from '@/contexts/PayTagContext';
import { useUnifiedSigner } from '@/hooks/useUnifiedSigner';
import { WagmiWrapper } from '@/components/WagmiWrapper';

type PaymentMethod = 'scan' | 'paytag' | 'wallet' | null;
type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

export default function Pay() {
  return (
    <WagmiWrapper>
      <PayTagProvider>
        <PayContent />
      </PayTagProvider>
    </WagmiWrapper>
  );
}

function PayContent() {
  const [searchParams] = useSearchParams();
  const { linkCode } = useParams();
  const navigate = useNavigate();

  // Wallet-only (Path B/C) payment hooks. Safe to call here because WagmiWrapper
  // and PayTagContext wrap the entire app.
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { profile: walletProfile, isWalletOnly } = usePayTag();
  const { signer: unifiedSigner } = useUnifiedSigner();
  
  const orderId = searchParams.get('orderId');
  const merchantId = searchParams.get('merchantId');
  const amount = searchParams.get('amount');
  const ref = searchParams.get('ref');
  
  const { getOrder, createOrder, completeOrder } = useOrders();
  const { getLink } = usePaymentLinks(undefined);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [merchant, setMerchant] = useState<{ payTag: string; walletAddress: string } | null>(null);
  const [productName, setProductName] = useState<string>('');
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  const [selectedCeloToken, setSelectedCeloToken] = useState<string>('USDT');
  
  // PayTag payment state
  const [payerPayTag, setPayerPayTag] = useState('');
  const [payerPin, setPayerPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [payerProfile, setPayerProfile] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Load order/payment link data
  useEffect(() => {
    loadPaymentData();
  }, [orderId, linkCode, merchantId, amount]);

  const loadPaymentData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Case 1: Order ID provided directly
      if (orderId) {
        const result = await getOrder(orderId);
        if (result) {
          setOrder(result.order);
          setMerchant(result.merchant);
          setProductName(result.order.payment_links?.name || 'Payment');
        } else {
          setError('Order not found or expired');
        }
      }
      // Case 2: Payment link code in URL path
      else if (linkCode) {
        const result = await getLink(linkCode);
        if (result) {
          const orderResult = await createOrder({
            paymentLinkCode: linkCode,
          });
          if (orderResult) {
            setOrder(orderResult.order);
            setMerchant(orderResult.merchant);
            setProductName(result.link.name);
          } else {
            setError('Failed to create order');
          }
        } else {
          setError('Payment link not found or inactive');
        }
      }
      // Case 3: Direct parameters (merchantId as payTag, amount)
      else if (merchantId && amount) {
        const { data: orderData, error: orderError } = await supabase.functions.invoke('orders', {
          body: {
            action: 'create',
            merchantId: merchantId,
            amount: parseFloat(amount),
            source: 'qr',
            metadata: ref ? { reference: ref } : {},
          },
        });
        if (!orderError && orderData?.order) {
          setOrder(orderData.order);
          setMerchant(orderData.merchant);
          setProductName(ref || 'Payment');
        } else {
          setError('Failed to create order');
        }
      }
      else {
        setError('Invalid payment link');
      }
    } catch (err) {
      console.error('Failed to load payment data:', err);
      setError('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is already logged into MoniPay (has their profile+key in localStorage)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('paytag_profile');
      if (stored && order) {
        const parsed = JSON.parse(stored);
        const hasKey = parsed.encryptedPrivateKey || parsed.encrypted_private_key || parsed.wallet?.encryptedPrivateKey;
        if (parsed.payTag && hasKey) {
          setPayerPayTag(parsed.payTag);
          setPayerProfile(parsed);
          setIsLoggedIn(true);
          setShowPinInput(true);
        }
      }
    } catch {}
  }, [order]);

  // Auto-redirect on success when callback_url exists
  useEffect(() => {
    if (paymentStatus === 'success' && order?.callback_url) {
      const timer = setTimeout(() => {
        window.location.href = order.callback_url!;
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, order?.callback_url]);


  const handlePayTagLookup = async () => {
    if (!payerPayTag.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setPaymentError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-paytag', {
        body: { 
          action: 'lookup',
          payTag: payerPayTag.toLowerCase().replace('@', ''),
        },
      });

      if (fnError || !data?.profile) {
        setPaymentError('PayTag not found. Make sure you entered it correctly.');
        feedback('error');
        return;
      }

      // Check if we have the encrypted key locally (user is logged in on this device)
      let localProfile = null;
      try {
        const stored = localStorage.getItem('paytag_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          const hasKey = parsed.encryptedPrivateKey || parsed.encrypted_private_key || parsed.wallet?.encryptedPrivateKey;
          if (parsed.payTag?.toLowerCase() === payerPayTag.toLowerCase().replace('@', '') && hasKey) {
            localProfile = parsed;
          }
        }
      } catch {}

      if (!localProfile) {
        setPaymentError('You need to be logged into MoniPay on this device to pay with your PayTag. Use the QR scan method instead.');
        feedback('error');
        return;
      }

      setPayerProfile({
        ...data.profile,
        encryptedPrivateKey: localProfile.encryptedPrivateKey || localProfile.encrypted_private_key || localProfile.wallet?.encryptedPrivateKey,
        walletAddress: data.profile.wallet_address,
        preferredNetwork: data.profile.preferred_network,
      });
      setShowPinInput(true);
    } catch (err) {
      console.error('PayTag lookup failed:', err);
      setPaymentError('Failed to find PayTag');
      feedback('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayTagPayment = async () => {
    if (!order || !payerProfile || !payerPin || !merchant) return;
    
    setPaymentStatus('processing');
    setPaymentError(null);
    
    try {
      // Get the encrypted private key from local profile
      const encryptedKey = payerProfile.encryptedPrivateKey || payerProfile.encrypted_private_key || payerProfile.wallet?.encryptedPrivateKey;
      if (!encryptedKey) {
        throw new Error('Wallet key not found. Please log in to MoniPay first.');
      }

      // Decrypt private key with PIN
      let decryptedKey: string;
      try {
        if (encryptedKey.startsWith('v2:')) {
          decryptedKey = await decryptPrivateKeyAsync(encryptedKey, payerPin);
        } else {
          decryptedKey = decryptPrivateKey(encryptedKey, payerPin);
        }
      } catch (decryptError) {
        throw new Error('Incorrect PIN. Please try again.');
      }

      // Validate the decrypted key is a valid hex private key
      if (!decryptedKey || !decryptedKey.startsWith('0x') || decryptedKey.length < 64) {
        throw new Error('Incorrect PIN. Please try again.');
      }

      const network = (payerProfile.preferredNetwork || payerProfile.preferred_network || 'base') as SupportedNetwork;
      const paymentAmount = order.amount;
      const feeAmount = paymentAmount * 0.01; // 1% fee

      // Resolve custom Celo tokens (e.g. GoodDollar V2)
      let celoDecimals = undefined;
      let celoRouter = undefined;
      let celoToken = undefined;
      let celoSymbol = undefined;

      if (network === 'celo') {
        const celoCfg = getChainConfig('celo');
        const orderCurrency = selectedCeloToken.toUpperCase();
        celoSymbol = orderCurrency;
        
        const matched = celoCfg.supportedTokens?.find(t => t.symbol.toUpperCase() === orderCurrency);
        if (matched) {
          celoToken = matched.address;
          celoDecimals = matched.decimals;
          // G$ uses V2 MoniPayRouter; USDT uses V1 Router
          celoRouter = orderCurrency === 'G$' ? (celoCfg.monipayRouter as `0x${string}`) : (celoCfg.monipayRouterV1 as `0x${string}`);
        }
      }

      // Get payment nonce
      const nonce = await getPaymentNonce(
        payerProfile.walletAddress || payerProfile.wallet_address,
        network
      );

      // Sign payment authorization (EIP-712 for Base/BSC, dummy for Tempo)
      const { signature, message } = await signPaymentAuthorization(
        decryptedKey as `0x${string}`,
        merchant.walletAddress as `0x${string}`,
        paymentAmount,
        feeAmount,
        nonce,
        network,
        celoDecimals,
        celoRouter
      );

      // Convert BigInt values to strings for JSON serialization
      const serializedMessage = {
        from: message.from,
        to: message.to,
        amount: message.amount.toString(),
        fee: message.fee.toString(),
        nonce: message.nonce.toString(),
        deadline: message.deadline.toString(),
      };

      // Extract items from order metadata for relay
      const orderItems = (order?.metadata as any)?.items || null;

      const txSource = (order?.metadata as any)?.storefront ? 'online_order' : 'payment_link';
      const relayFunctionName = network === 'celo' ? 'relay-payment-celo' : network === 'ink' ? 'relay-payment-ink' : 'relay-payment';
      const { data: relayData, error: relayError } = await supabase.functions.invoke(relayFunctionName, {
        body: {
          action: 'relay',
          signature,
          message: serializedMessage,
          senderProfileId: payerProfile.id,
          recipientPayTag: merchant.payTag,
          recipientAddress: merchant.walletAddress,
          network,
          items: orderItems,
          tokenAddress: celoToken,
          routerAddress: celoRouter,
          decimals: celoDecimals,
          tokenSymbol: celoSymbol,
        },
      });

      if (relayError) {
        const errorBody = relayError.message || 'Payment relay failed';
        throw new Error(errorBody);
      }

      if (!relayData?.txHash) {
        throw new Error(relayData?.error || 'Payment failed — no transaction hash returned');
      }

      // Complete the order
      try {
        const result = await completeOrder({
          orderId: order.id,
          txHash: relayData.txHash,
          payerProfileId: payerProfile.id,
          payerPayTag: payerPayTag,
          payerWallet: payerProfile.walletAddress || payerProfile.wallet_address || payerProfile.wallet?.address,
          fee: relayData.fee,
        });

        if (result) {
          setPaymentStatus('success');
          feedback('success');
          
          // Redirect to callback URL if provided
          if (result.callbackUrl) {
            setTimeout(() => {
              window.location.href = result.callbackUrl!;
            }, 2000);
          }
        } else {
          // Payment was sent successfully but order status update failed
          // Still show success since the blockchain payment went through
          console.warn('Order status update failed, but payment was sent. txHash:', relayData.txHash);
          setPaymentStatus('success');
          feedback('success');
        }
      } catch (orderErr) {
        // Payment was sent but order update failed - still show success
        console.warn('Order completion error, but payment was sent. txHash:', relayData.txHash, orderErr);
        setPaymentStatus('success');
        feedback('success');
      }
    } catch (err: any) {
      console.error('Payment failed:', err);
      setPaymentStatus('failed');
      setPaymentError(err.message || 'Payment failed. Please try again.');
      feedback('error');
    }
  };

  const handleRetry = () => {
    setPaymentStatus('idle');
    setPaymentError(null);
    setPayerPin('');
  };

  // Wallet-only payment: skips PIN, signs with the connected wallet via the
  // unified signer. Uses the same relay-payment edge function as the legacy
  // PIN flow, so fee math and webhooks stay identical.
  const handleWalletConnectPayment = async () => {
    if (!order || !merchant || !walletProfile || !unifiedSigner) return;
    setPaymentStatus('processing');
    setPaymentError(null);
    try {
      const network = (walletProfile.preferredNetwork || 'base') as SupportedNetwork;
      const paymentAmount = order.amount;
      const feeAmount = paymentAmount * 0.01;

      // Resolve custom Celo tokens (e.g. GoodDollar V2)
      let celoDecimals = undefined;
      let celoRouter = undefined;
      let celoToken = undefined;
      let celoSymbol = undefined;

      if (network === 'celo') {
        const celoCfg = getChainConfig('celo');
        const orderCurrency = selectedCeloToken.toUpperCase();
        celoSymbol = orderCurrency;
        
        const matched = celoCfg.supportedTokens?.find(t => t.symbol.toUpperCase() === orderCurrency);
        if (matched) {
          celoToken = matched.address;
          celoDecimals = matched.decimals;
          // G$ uses V2 MoniPayRouter; USDT uses V1 Router
          celoRouter = orderCurrency === 'G$' ? (celoCfg.monipayRouter as `0x${string}`) : (celoCfg.monipayRouterV1 as `0x${string}`);
        }
      }

      const nonce = await getPaymentNonce(walletProfile.wallet.address, network);
      const { signature, message } = await signPaymentAuthorizationWithSigner(
        unifiedSigner,
        merchant.walletAddress as `0x${string}`,
        paymentAmount,
        feeAmount,
        nonce,
        network,
        celoDecimals,
        celoRouter
      );
      const serializedMessage = {
        from: message.from,
        to: message.to,
        amount: message.amount.toString(),
        fee: message.fee.toString(),
        nonce: message.nonce.toString(),
        deadline: message.deadline.toString(),
      };
      const orderItems = (order?.metadata as any)?.items || null;
      const relayFunctionName = network === 'celo' ? 'relay-payment-celo' : network === 'ink' ? 'relay-payment-ink' : 'relay-payment';
      const { data: relayData, error: relayError } = await supabase.functions.invoke(relayFunctionName, {
        body: {
          action: 'relay',
          signature,
          message: serializedMessage,
          senderProfileId: walletProfile.id,
          recipientPayTag: merchant.payTag,
          recipientAddress: merchant.walletAddress,
          network,
          items: orderItems,
          tokenAddress: celoToken,
          routerAddress: celoRouter,
          decimals: celoDecimals,
          tokenSymbol: celoSymbol,
        },
      });
      if (relayError) throw new Error(relayError.message || 'Payment relay failed');
      if (!relayData?.txHash) throw new Error(relayData?.error || 'Payment failed');
      try {
        await completeOrder({
          orderId: order.id,
          txHash: relayData.txHash,
          payerProfileId: walletProfile.id,
          payerPayTag: walletProfile.payTag,
          payerWallet: walletProfile.wallet.address,
          fee: relayData.fee,
        });
      } catch (orderErr) {
        console.warn('Order completion error, but payment was sent:', orderErr);
      }
      setPaymentStatus('success');
      feedback('success');
    } catch (err: any) {
      console.error('Wallet-connect payment failed:', err);
      setPaymentStatus('failed');
      setPaymentError(err.message || 'Payment failed. Please try again.');
      feedback('error');
    }
  };

  // Render loading state
  if (isLoading && !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payment...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Payment Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Render success state
  if (paymentStatus === 'success') {
    const orderItems = order?.metadata?.items as Array<{ name: string; price: number; quantity: number; imageUrl?: string }> | undefined;
    const storePayTag = order?.metadata?.storePayTag as string | undefined;
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Payment Successful!</h1>
            <p className="text-muted-foreground text-sm">
              You paid <span className="font-semibold text-foreground">${order?.amount.toFixed(2)}</span> to <span className="font-semibold text-foreground">@{merchant?.payTag}</span>
            </p>
          </div>

          {/* Itemized summary */}
          {orderItems && orderItems.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Order Summary</p>
              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {item.name} {item.quantity > 1 && <span className="text-muted-foreground">×{item.quantity}</span>}
                    </span>
                    <span className="font-semibold text-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-3 pt-3 flex justify-between text-sm">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-foreground">${order?.amount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Receipt ref */}
          {order?.order_ref && (
            <p className="text-center text-xs text-muted-foreground mb-4">
              Ref: <span className="font-mono">{order.order_ref}</span>
            </p>
          )}

          {/* Navigation buttons */}
          <div className="space-y-2">
            {order?.callback_url ? (
              <p className="text-xs text-muted-foreground text-center animate-pulse mb-2">
                Redirecting...
              </p>
            ) : (
              <>
                {storePayTag && (
                  <Button
                    onClick={() => navigate(`/store/@${storePayTag}`)}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Store
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="w-full h-11 rounded-xl"
                >
                  Go to MoniPay
                </Button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              <span>Secured by MoniPay</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render failed state
  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm"
        >
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Payment Failed</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            {paymentError || 'Something went wrong. Please try again.'}
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleRetry}
              className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render checkout page
  return (
    <div className="min-h-screen bg-background">
      <PageMeta 
        title={merchant ? `Pay @${merchant.payTag}${order ? ` — $${order.amount.toFixed(2)}` : ''}` : 'Checkout'} 
        description={merchant ? `Pay @${merchant.payTag}${order ? ` $${order.amount.toFixed(2)}` : ''} securely with MoniPay — gasless crypto payments.` : 'Pay securely with MoniPay — gasless crypto payments powered by Base.'}
        path={linkCode ? `/pay/${linkCode}` : '/pay'}
        noIndex
        noIndexFollow
      />
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container px-4 py-4 flex items-center justify-center">
          <MoniPayLogo size={28} color="#0052FF" animationMode="idle" showText textSize={14} />
        </div>
      </div>

      <div className="container px-4 py-8 max-w-md mx-auto">
        {/* Merchant & Amount Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 mb-6 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary">
              {merchant?.payTag?.charAt(0).toUpperCase()}
            </span>
          </div>
          
          <p className="text-muted-foreground mb-1">Pay to</p>
          <h2 className="text-xl font-bold text-foreground mb-4">@{merchant?.payTag}</h2>
          
          <div className="text-4xl font-bold text-primary mb-2">
            ${order?.amount.toFixed(2)}
          </div>
          <p className="text-muted-foreground text-sm">{productName} • USDC</p>
          
          {order?.expires_at && (
            <p className="text-xs text-muted-foreground mt-4">
              Expires in {Math.max(0, Math.round((new Date(order.expires_at).getTime() - Date.now()) / 60000))} minutes
            </p>
          )}
        </motion.div>

        {/* Payment Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <p className="text-sm font-medium text-muted-foreground text-center mb-4">
            How would you like to pay?
          </p>

          {/* Inline error banner */}
          {paymentError && paymentStatus === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{paymentError}</p>
            </motion.div>
          )}

          {/* Scan with MoniPay App */}
          <div 
            className={`
              bg-card border rounded-2xl overflow-hidden transition-all
              ${selectedMethod === 'scan' ? 'border-primary' : 'border-border'}
            `}
          >
            <button
              onClick={() => setSelectedMethod(selectedMethod === 'scan' ? null : 'scan')}
              className="w-full px-4 py-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">Scan with MoniPay App</p>
                <p className="text-xs text-muted-foreground">Open your MoniPay app and scan</p>
              </div>
              {selectedMethod === 'scan' ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            
            <AnimatePresence>
              {selectedMethod === 'scan' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 flex flex-col items-center">
                    <div className="p-4 bg-white rounded-2xl mb-4">
                      <QRCodeSVG
                        value={`monipay://pay?orderId=${order?.id}&amount=${order?.amount}&merchant=${merchant?.payTag}`}
                        size={180}
                        level="H"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Scan this QR code with your MoniPay app
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pay with PayTag */}
          <div 
            className={`
              bg-card border rounded-2xl overflow-hidden transition-all
              ${selectedMethod === 'paytag' ? 'border-primary' : 'border-border'}
            `}
          >
            <button
              onClick={() => {
                setSelectedMethod(selectedMethod === 'paytag' ? null : 'paytag');
                setPaymentError(null);
              }}
              className="w-full px-4 py-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <AtSign className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">Pay with MoniPay Account</p>
                <p className="text-xs text-muted-foreground">
                  {isLoggedIn ? `Logged in as @${payerPayTag}` : 'Enter your PayTag to pay'}
                </p>
              </div>
              {selectedMethod === 'paytag' ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            
            <AnimatePresence>
              {selectedMethod === 'paytag' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 space-y-4">
                    {!showPinInput ? (
                      <>
                        <div className="relative">
                          <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            placeholder="yourpaytag"
                            value={payerPayTag}
                            onChange={(e) => {
                              setPayerPayTag(e.target.value.toLowerCase().replace('@', ''));
                              setPaymentError(null);
                            }}
                            className="h-12 pl-12 rounded-xl"
                          />
                        </div>
                        <Button
                          onClick={handlePayTagLookup}
                          disabled={!payerPayTag.trim() || isLoading}
                          className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            'Continue'
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          You must be logged into MoniPay on this device
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-center mb-4">
                          <p className="text-sm text-muted-foreground">Paying as</p>
                          <p className="font-semibold text-foreground">@{payerPayTag}</p>
                        </div>
                        <Input
                          type="password"
                          placeholder="Enter your PIN"
                          value={payerPin}
                          onChange={(e) => {
                            setPayerPin(e.target.value);
                            setPaymentError(null);
                          }}
                          maxLength={6}
                          className="h-12 rounded-xl text-center text-2xl tracking-widest"
                        />
                        {((payerProfile?.preferredNetwork || payerProfile?.preferred_network || 'base') === 'celo') && (
                          <div className="mb-4 text-left">
                            <label className="text-xs text-muted-foreground mb-1 block">Pay with Celo Token</label>
                            <Select value={selectedCeloToken} onValueChange={setSelectedCeloToken}>
                              <SelectTrigger className="w-full h-12 bg-background border-border rounded-xl px-4">
                                <SelectValue placeholder="Select Token" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USDT">
                                  <div className="flex items-center gap-2">
                                    <TokenIcon symbol="USDT" size={20} />
                                    <span>USDT</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="G$">
                                  <div className="flex items-center gap-2">
                                    <TokenIcon symbol="G$" size={20} />
                                    <span>GoodDollar (G$)</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="USDC">
                                  <div className="flex items-center gap-2">
                                    <TokenIcon symbol="USDC" size={20} />
                                    <span>USDC</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="USDm">
                                  <div className="flex items-center gap-2">
                                    <TokenIcon symbol="USDm" size={20} />
                                    <span>USDm</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <Button
                          onClick={handlePayTagPayment}
                          disabled={payerPin.length < 4 || paymentStatus === 'processing'}
                          className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl"
                        >
                          {paymentStatus === 'processing' ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          ) : (
                            <Check className="w-5 h-5 mr-2" />
                          )}
                          Pay ${order?.amount.toFixed(2)}
                        </Button>
                        <button
                          onClick={() => {
                            setShowPinInput(false);
                            setPayerPin('');
                            setPaymentError(null);
                          }}
                          className="w-full text-sm text-muted-foreground hover:text-foreground"
                        >
                          Use different PayTag
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Connect External Wallet */}
          <div 
            className={`
              bg-card border rounded-2xl overflow-hidden transition-all
              ${selectedMethod === 'wallet' ? 'border-primary' : 'border-border'}
            `}
          >
            <button
              onClick={() => setSelectedMethod(selectedMethod === 'wallet' ? null : 'wallet')}
              className="w-full px-4 py-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">Connect Wallet</p>
                <p className="text-xs text-muted-foreground">Pay with MetaMask, Rainbow, etc.</p>
              </div>
              {selectedMethod === 'wallet' ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            
            <AnimatePresence>
              {selectedMethod === 'wallet' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 text-center space-y-3">
                    {!wagmiConnected ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">
                          Connect your wallet to pay securely
                        </p>
                        {connectors
                          .filter((c) => c.type === 'injected' || c.id === 'walletConnect' || c.id === 'coinbaseWallet')
                          .slice(0, 3)
                          .map((connector) => (
                            <Button
                              key={connector.id}
                              variant="outline"
                              className="w-full h-12 rounded-xl"
                              onClick={() => connect({ connector })}
                              disabled={isConnecting}
                            >
                              <Wallet className="w-5 h-5 mr-2" />
                              {isConnecting ? 'Connecting…' : `Connect ${connector.name}`}
                            </Button>
                          ))}
                      </>
                    ) : !isWalletOnly || !unifiedSigner ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Preparing wallet session…
                        </p>
                        <Button
                          variant="ghost"
                          className="w-full h-10 rounded-xl text-xs"
                          onClick={() => disconnect()}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Connected as <span className="font-mono">{wagmiAddress?.slice(0, 6)}…{wagmiAddress?.slice(-4)}</span>
                        </p>
                        {((walletProfile?.preferredNetwork || 'base') === 'celo') && (
                          <div className="mb-4 text-left">
                            <label className="text-xs text-muted-foreground mb-1 block">Pay with Celo Token</label>
                            <select 
                              value={selectedCeloToken}
                              onChange={(e) => setSelectedCeloToken(e.target.value)}
                              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                            >
                              <option value="USDT">USDT</option>
                              <option value="G$">GoodDollar (G$)</option>
                              <option value="USDC">USDC</option>
                              <option value="USDm">USDm</option>
                            </select>
                          </div>
                        )}
                        <Button
                          className="w-full h-12 rounded-xl"
                          onClick={handleWalletConnectPayment}
                          disabled={paymentStatus === 'processing'}
                        >
                          {paymentStatus === 'processing' ? (
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Signing…</>
                          ) : (
                            <><Wallet className="w-5 h-5 mr-2" /> Pay ${order?.amount.toFixed(2)}</>
                          )}
                        </Button>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => disconnect()}
                        >
                          Disconnect
                        </button>
                        {paymentError && (
                          <p className="text-xs text-destructive">{paymentError}</p>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Secured by MoniPay • Base Network</span>
          </div>
        </div>
      </div>
    </div>
  );
}
