import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenIcon } from '@/components/TokenIcon';
import { BrandedQR } from './BrandedQR';
import { usePayTag } from '@/contexts/PayTagContext';
import { Button } from '@/components/ui/button';
import { 
  Delete, X, Coffee, ShoppingBag, Utensils, Sparkles, Check, 
  Package, ArrowDownLeft, Clock, Grid3X3, BarChart3, Smartphone, Globe, ChevronRight, FileText, Send, RefreshCw
} from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { ProductCatalog, Product } from './ProductCatalog';
import { SortableQuickAdd } from './SortableQuickAdd';
import { MerchantAnalytics } from './MerchantAnalytics';
import { TransactionReceiptModal, TransactionReceipt } from './TransactionReceiptModal';
import { TransactionHistory } from './TransactionHistory';
import { SendInvoiceModal } from './SendInvoiceModal';
import { InvoicesSection } from './InvoicesSection';
import { isMoniBotTag, VerifiedBadge } from './VerifiedBadge';
import { TransactionBadge, getTransactionBadges } from './TransactionBadge';

import { useInvoices } from '@/hooks/useInvoices';
import { PullToRefresh } from './PullToRefresh';
import { feedback } from '@/lib/feedback';
import { shortenAddress, getUsdcBalance, getTokenBalance } from '@/lib/wallet';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { toast } from '@/components/ui/use-toast';


const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Coffee', price: 5.00, icon: 'coffee', category: 'Drinks', pinned: false },
  { id: '2', name: 'Snack', price: 3.50, icon: 'shopping', category: 'Food', pinned: false },
  { id: '3', name: 'Meal', price: 12.00, icon: 'utensils', category: 'Food', pinned: false },
];

const PLATFORM_FEE_PERCENT = 0.01;
const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

// ── Celo multi-token config ────────────────────────────────────────────────
const CELO_TOKENS = [
  { symbol: 'USDT',  address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6  },
  { symbol: 'G$',    address: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', decimals: 18 },
  { symbol: 'USDC',  address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6  },
  { symbol: 'USDm',  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
] as const;
type CeloTokenSymbol = typeof CELO_TOKENS[number]['symbol'];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  coffee: Coffee,
  shopping: ShoppingBag,
  utensils: Utensils,
  sparkles: Sparkles,
  package: Package,
};

const STORAGE_KEY = 'monipay_products';

import type { BottomNavTab } from './BottomNav';

interface MerchantDashboardProps {
  activeTab?: BottomNavTab | null;
  onTabHandled?: () => void;
}

export function MerchantDashboard({ activeTab, onTabHandled }: MerchantDashboardProps) {
  const { t } = useTranslation();
  const { profile, transactions, updateBalance, addTransaction, syncTransactions } = usePayTag();
  const [amount, setAmount] = useState('0');
  const [showQR, setShowQR] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paidByPayTag, setPaidByPayTag] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  
  // Invoice payment success state
  const [invoicePaid, setInvoicePaid] = useState(false);
  const [invoicePaidByPayTag, setInvoicePaidByPayTag] = useState<string | null>(null);
  const [invoicePaidAmount, setInvoicePaidAmount] = useState<number>(0);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [showSendInvoice, setShowSendInvoice] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  
  const [deepLinkInvoiceId, setDeepLinkInvoiceId] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [qrMode, setQrMode] = useState<'monipay' | 'external'>('monipay');
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // ── Celo token selector for the charge / QR screen ──────────────────────────
  const isCeloMerchant = (profile?.preferredNetwork || 'celo') === 'celo';
  const [celoToken, setCeloToken] = useState<CeloTokenSymbol>('USDT');
  const activeCeloToken = CELO_TOKENS.find(t => t.symbol === celoToken) ?? CELO_TOKENS[0];
  const merchantTokenLabel = isCeloMerchant ? activeCeloToken.symbol : getChainConfig((profile?.preferredNetwork || 'celo') as SupportedNetwork).currency;

  // Invoice management - get pending count for badge and track sent invoices for payment detection
  const { pendingCount: invoicePendingCount, sentInvoices, fetchInvoices } = useInvoices(profile?.id);
  
  // Track sent invoice statuses to detect when one is paid
  const previousSentInvoicesRef = useRef<Map<string, string>>(new Map());
  
  // Detect when a sent invoice is paid and clear the cart
  useEffect(() => {
    if (!sentInvoices.length) return;
    
    const prevStatuses = previousSentInvoicesRef.current;
    
    sentInvoices.forEach((invoice) => {
      const prevStatus = prevStatuses.get(invoice.id);
      
      // Check if status changed from 'pending' to 'paid'
      if (prevStatus === 'pending' && invoice.status === 'paid') {
        console.log('[Invoice] ✅ Invoice paid!', {
          invoiceId: invoice.id,
          recipient: invoice.recipient_pay_tag,
          amount: invoice.amount,
        });
        
        // Trigger success feedback
        feedback('payment');
        
        // Show invoice payment success modal
        setInvoicePaidByPayTag(invoice.recipient_pay_tag);
        setInvoicePaidAmount(invoice.amount);
        setInvoicePaid(true);
        
        // Clear cart and amount
        setAmount('0');
        setCart([]);
        
        // Refresh balance
        syncTransactions();
      }
    });
    
    // Update previous statuses
    const newMap = new Map<string, string>();
    sentInvoices.forEach((invoice) => {
      newMap.set(invoice.id, invoice.status);
    });
    previousSentInvoicesRef.current = newMap;
  }, [sentInvoices, syncTransactions]);

  // Fetch products from Supabase
  const fetchProducts = useCallback(async () => {
    if (!profile?.id) return;
    
    setIsLoadingProducts(true);
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', profileId: profile.id }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.products && data.products.length > 0) {
          setProducts(data.products);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.products));
        }
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [profile?.id]);

  // Load products from Supabase on mount
  useEffect(() => {
    if (profile?.id) {
      fetchProducts();
    }
  }, [profile?.id, fetchProducts]);

  // Persist products locally as fallback
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  // React to bottom nav tab presses
  useEffect(() => {
    if (!activeTab) return;
    switch (activeTab) {
      case 'stats':
        setShowAnalytics(true);
        break;
      case 'store':
        setShowCatalog(true);
        break;
      case 'charge':
        setShowQR(true);
        break;
      case 'history':
        setShowSalesHistory(true);
        break;
    }
    onTabHandled?.();
  }, [activeTab, onTabHandled]);

  // Computed values
  const numericAmount = parseFloat(amount) || 0;
  const fee = numericAmount * PLATFORM_FEE_PERCENT;
  const merchantReceives = numericAmount - fee;

  // Track the count of "received" transactions when QR modal opens
  // This is the same data source as Recent Sales, so it's guaranteed to be in sync
  const [qrOpenReceivedCount, setQrOpenReceivedCount] = useState<number | null>(null);

  // Poll for new transactions - faster when QR modal is open
  useEffect(() => {
    if (!profile?.id) return;
    
    // Sync immediately on mount
    syncTransactions();
    
    // Poll faster (every 3 seconds) when QR modal is open, otherwise every 30 seconds
    const interval = setInterval(() => {
      syncTransactions();
    }, showQR ? 3000 : 30000);
    
    return () => clearInterval(interval);
  }, [profile?.id, syncTransactions, showQR]);

  // When QR modal opens, capture the current count of "received" transactions
  // This mirrors exactly how Recent Sales renders: transactions.filter(tx => tx.type === 'received')
  useEffect(() => {
    if (showQR && !isPaid) {
      const currentReceivedCount = transactions.filter(tx => tx.type === 'received').length;
      setQrOpenReceivedCount(currentReceivedCount);
      console.log('[ScanToPay] Modal opened. Current received tx count:', currentReceivedCount);
    } else if (!showQR) {
      setQrOpenReceivedCount(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQR, isPaid]);

  // Track if payment was from external wallet (for tagging in Recent Sales)
  const [paidViaExternal, setPaidViaExternal] = useState(false);

  // Update transaction items for external payments (async helper)
  const updateExternalTxItems = useCallback(async (txId: string) => {
    if (!profile?.id || cart.length === 0) return;
    
    const itemsPayload = cart.map(({ product, quantity }) => ({
      name: product.name,
      quantity,
      price: product.price,
    }));
    
    try {
      await fetch(`${SUPABASE_FUNCTIONS_URL}/relay-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateItems',
          message: {
            txId,
            profileId: profile.id,
            items: itemsPayload,
          },
        }),
      });
      console.log('[External] Updated transaction with cart items');
    } catch (err) {
      console.error('[External] Failed to update items:', err);
    }
  }, [profile?.id, cart]);

  // Detect new incoming payments - same logic as Recent Sales getting a new item
  useEffect(() => {
    if (!showQR || isPaid || qrOpenReceivedCount === null) return;

    const currentReceivedTxs = transactions.filter(tx => tx.type === 'received');
    const currentCount = currentReceivedTxs.length;
    
    // If we have more received transactions now than when modal opened, payment was received
    if (currentCount > qrOpenReceivedCount) {
      // Get the newest transaction (first in array, sorted by timestamp desc)
      const newestTx = currentReceivedTxs[0];
      
      if (newestTx) {
        // Check if amount matches (with generous 10% tolerance for fees + rounding)
        const expectedAmount = numericAmount;
        const receivedAmount = newestTx.amount;
        const tolerance = Math.max(expectedAmount * 0.10, 0.01);
        const amountMatches = Math.abs(receivedAmount - expectedAmount) <= tolerance;
        
        // For External Wallet mode, accept any incoming payment with reasonable amount
        // For MoniPay mode, be more strict about amount matching
        const shouldAccept = qrMode === 'external' 
          ? (receivedAmount > 0 && (amountMatches || Math.abs(receivedAmount - expectedAmount) <= 1))
          : (amountMatches || expectedAmount === 0 || receivedAmount > 0);
        
        if (shouldAccept) {
          console.log('[ScanToPay] ✅ Payment detected! Mode:', qrMode, 'New received count:', currentCount, 'was:', qrOpenReceivedCount);
          console.log('[ScanToPay] Transaction:', {
            expectedAmount,
            receivedAmount,
            txHash: newestTx.txHash,
            txId: newestTx.id,
            payer: newestTx.payerPayTag || newestTx.counterparty,
            mode: qrMode,
          });
          feedback('payment');
          setIsPaid(true);
          setPaidViaExternal(qrMode === 'external');
          
          // For external wallet payments, update the transaction with cart items
          if (qrMode === 'external' && cart.length > 0) {
            updateExternalTxItems(newestTx.id);
          }
          
          // For external wallet, show abbreviated address as payer
          const payerDisplay = qrMode === 'external' && !newestTx.payerPayTag
            ? shortenAddress(newestTx.counterparty)
            : (newestTx.payerPayTag || newestTx.counterparty);
          
          setPaidByPayTag(payerDisplay);
          setPaidAmount(newestTx.amount - newestTx.fee);
        }
      }
    }
  }, [transactions, showQR, isPaid, qrOpenReceivedCount, numericAmount, qrMode, cart, updateExternalTxItems]);

  // Auto-close the Scan to Pay modal 2 seconds after payment is received
  useEffect(() => {
    if (isPaid && showQR) {
      const timer = setTimeout(() => {
        setShowQR(false);
        setIsPaid(false);
        setPaidByPayTag(null);
        setPaidAmount(0);
        setPaidViaExternal(false);
        setAmount('0');
        setCart([]);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isPaid, showQR]);

  // Auto-close the invoice payment success modal after 2 seconds
  useEffect(() => {
    if (invoicePaid) {
      const timer = setTimeout(() => {
        setInvoicePaid(false);
        setInvoicePaidByPayTag(null);
        setInvoicePaidAmount(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [invoicePaid]);

  // Keypad is disabled when cart has items (mutual exclusivity)
  const isKeypadDisabled = cart.length > 0;

  const handleKeypadTapWhileDisabled = () => {
    feedback('error');
    toast({
      title: "Keypad Locked",
      description: "Clear cart to use manual amount.",
      variant: "destructive",
    });
  };

  const handleNumberClick = (num: string) => {
    if (isKeypadDisabled) {
      handleKeypadTapWhileDisabled();
      return;
    }
    feedback('tap');
    setAmount(prev => {
      if (prev === '0' && num !== '.') return num;
      if (num === '.' && prev.includes('.')) return prev;
      if (prev.includes('.') && prev.split('.')[1]?.length >= 2) return prev;
      return prev + num;
    });
  };

  const handleDelete = () => {
    if (isKeypadDisabled) {
      handleKeypadTapWhileDisabled();
      return;
    }
    feedback('tap');
    setAmount(prev => {
      if (prev.length === 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    feedback('tap');
    setAmount('0');
    setCart([]);
  };

  const handleQuickProduct = (product: Product) => {
    feedback('tap');
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    
    setAmount(prev => {
      const current = parseFloat(prev) || 0;
      return (current + product.price).toFixed(2);
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    setCart(prev => {
      if (item.quantity === 1) {
        return prev.filter(i => i.product.id !== productId);
      }
      return prev.map(i => 
        i.product.id === productId 
          ? { ...i, quantity: i.quantity - 1 }
          : i
      );
    });

    setAmount(prev => {
      const current = parseFloat(prev) || 0;
      return Math.max(0, current - item.product.price).toFixed(2);
    });
  };

  const handleCharge = () => {
    if (numericAmount < 0.01) {
      feedback('error');
      return;
    }
    setShowQR(true);
  };

  // Production: Payment detection handled by blockchain events
  // TODO: Add real-time payment detection via on-chain event monitoring

  // USDC contract on Base Mainnet
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const BASE_CHAIN_ID = 8453;

  // Build MoniPay QR payload with multi-address format
  const evmAddress = profile?.wallet?.address;
  const solAddress = profile?.wallet?.solanaAddress;

  const monipayPayload = JSON.stringify({
    type: 'monipay',
    payTag: profile?.payTag,
    network: profile?.preferredNetwork || 'celo',
    // For Celo, embed the selected token so the payer's app knows which token to send
    ...(isCeloMerchant ? { tokenAddress: activeCeloToken.address, tokenSymbol: activeCeloToken.symbol, decimals: activeCeloToken.decimals } : {}),
    addresses: {
      evm: evmAddress,
      ...(solAddress ? { solana: solAddress } : {}),
    },
    // Legacy compat: keep 'address' for old scanners
    address: evmAddress,
    merchantName: profile?.payTag ? `@${profile.payTag}` : 'Merchant',
    amount: numericAmount,
    fee: fee,
    merchantReceives,
    items: cart.length > 0 ? cart.map(({ product, quantity }) => ({
      name: product.name,
      quantity,
      price: product.price,
    })) : undefined,
  });

  // External wallet QR: plain wallet address for manual transfer
  const activeReceiveAddress = profile?.wallet?.address;
  const externalWalletPayload = activeReceiveAddress || '';

  const qrPayload = qrMode === 'monipay' ? monipayPayload : externalWalletPayload;

  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
  // Filter to received transactions, excluding personal MoniBot transfers (P2P commands / grants)
  const merchantTransactions = transactions.filter(tx => 
    tx.type === 'received' && 
    tx.source !== 'monibot_p2p' && 
    tx.source !== 'monibot_grant'
  );
  const selectedTransaction = transactions.find(tx => tx.id === selectedTx);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle pull-to-refresh
  const handlePullRefresh = useCallback(async () => {
    if (!profile?.wallet?.address) return;
    try {
      const balanceAddr = profile.wallet.address as `0x${string}`;
      const balance = await getTokenBalance(balanceAddr, profile.preferredNetwork || 'celo');
      if (Number.isFinite(balance)) {
        // Update via context if available, or just sync transactions
      }
    } catch {}
    await syncTransactions();
  }, [profile?.wallet?.address, syncTransactions]);

  return (
    <>
      <PullToRefresh onRefresh={handlePullRefresh} className="h-full lg:overflow-visible">
        <div className="px-3 pb-6 overflow-x-hidden md:px-6 lg:px-8">
        {/* Desktop: 3-column layout | Mobile: Single column */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_280px] gap-4 lg:gap-6">
            {/* Left Column: Quick Add + Keypad */}
            <div className="space-y-4">
              {/* Quick Products / POS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold text-muted-foreground">{t('quick_add')}</h2>
                </div>
                <SortableQuickAdd
                  products={products}
                  onProductsChange={setProducts}
                  onProductClick={handleQuickProduct}
                />
              </div>

              {/* Cart - Mobile Only */}
              <div className="lg:hidden">
                {cart.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreg{t('cart')}d">Cart</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="text-destructive h-7 px-2 text-xs"
                      >
                        {t('clear')}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {cart.map(({ product, quantity }) => (
                        <div key={product.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {product.name} x{quantity}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              ${(product.price * quantity).toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleRemoveFromCart(product.id)}
                              className="text-destructive/60 hover:text-destructive"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Amount Display */}
              <div className="bg-card border border-border rounded-2xl p-4 lg:p-6">
                <div className="text-center">
                  <span className="text-muted-foreground text-xs lg:text-sm">{t('amount_to_charge')}</span>
                  <div className="flex items-center justify-center gap-1 my-1 lg:my-2">
                    <span className="text-4xl lg:text-5xl font-bold text-foreground">$</span>
                    <motion.span
                      key={amount}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.1 }}
                      className="text-4xl lg:text-5xl font-bold text-foreground"
                    >
                      {amount}
                    </motion.span>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs lg:text-sm">
                    <span className="text-muted-foreground">
                      {t('receive_amount')}: <span className="font-semibold text-success">${merchantReceives.toFixed(2)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {t('fee')}: <span className="font-medium">${fee.toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Keypad */}
              <div className={`grid grid-cols-3 gap-2 transition-opacity duration-200 ${isKeypadDisabled ? 'opacity-50' : ''}`}>
                {numbers.map((num) => (
                  <motion.button
                    key={num}
                    whileTap={{ scale: isKeypadDisabled ? 1 : 0.95 }}
                    onClick={() => {
                      if (num === 'del') handleDelete();
                      else handleNumberClick(num);
                    }}
                    disabled={isKeypadDisabled}
                    className={`
                      h-12 lg:h-14 rounded-xl text-xl lg:text-2xl font-semibold transition-colors
                      ${isKeypadDisabled ? 'cursor-not-allowed' : ''}
                      ${num === 'del' 
                        ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' 
                        : 'bg-card border border-border hover:bg-muted text-foreground'
                      }
                    `}
                  >
                    {num === 'del' ? <Delete className="w-5 h-5 lg:w-6 lg:h-6 mx-auto" /> : num}
                  </motion.button>
                ))}
              </div>

              {/* Action Buttons - Mobile Only */}
              <div className="flex gap-2 lg:hidden">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleClear}
                  className="h-12 rounded-2xl text-sm px-4"
                >
                   {t('clear')}
                </Button>
                <Button
                  size="lg"
                  onClick={() => setShowSendInvoice(true)}
                  disabled={numericAmount < 0.01}
                  className="flex-1 h-12 rounded-2xl text-sm font-semibold gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                   {t('invoice')}
                </Button>
                <Button
                  size="lg"
                  onClick={handleCharge}
                  disabled={numericAmount < 0.01}
                  className="flex-1 min-w-0 h-12 text-sm font-semibold rounded-2xl"
                  style={{ backgroundColor: `hsl(${getChainConfig((profile?.preferredNetwork || 'celo') as SupportedNetwork).accentColor})`, color: '#000' }}
                >
                  <span className="truncate">{t('charge_btn')} ${amount}</span>
                </Button>
              </div>
            </div>

            {/* Middle Column: Recent Sales (Desktop) */}
            <div className="hidden lg:block space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs lg:text-sm font-semibold text-muted-foreground">{t('recent_sales')}</h2>
                  {merchantTransactions.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSalesHistory(true)}
                      className="text-base-blue hover:text-base-blue/80 h-7 px-2 text-xs gap-1"
                    >
                      {t('view_all')}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {merchantTransactions.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-5 lg:p-8 text-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      className="flex justify-center mb-3"
                    >
                      <MoniPayLogo size={40} color="hsl(var(--muted-foreground))" animationMode="idle" isEmpty />
                    </motion.div>
                    <p className="text-muted-foreground text-xs lg:text-sm">{t('no_sales_yet')}</p>
                    <p className="text-muted-foreground text-[10px] lg:text-xs mt-1">{t('sales_appear_here')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                    {merchantTransactions.map((tx, index) => {
                      const itemsPreview = tx.items && tx.items.length > 0
                        ? tx.items.map(item => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`).join(', ')
                        : null;

                      const badges = getTransactionBadges({
                        source: tx.source,
                        counterparty: tx.counterparty,
                        metadata: tx.metadata,
                        invoiceId: tx.invoiceId,
                        payerPayTag: tx.payerPayTag,
                      });

                      const isExternalPayment = badges.includes('external');
                      const counterpartyDisplay = isExternalPayment ? shortenAddress(tx.counterparty) : tx.counterparty;

                      return (
                        <motion.button
                          key={tx.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.04, 0.3) }}
                          whileTap={{ scale: 0.97 }}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => setSelectedTx(tx.id)}
                          className="w-full bg-card border border-border rounded-xl p-3 flex items-center gap-3 text-left hover:border-primary/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                            <ArrowDownLeft className="w-4 h-4 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-xs text-foreground truncate flex items-center gap-0.5">
                                {counterpartyDisplay}
                                {isMoniBotTag(tx.payerPayTag || tx.counterparty) && <VerifiedBadge size={12} />}
                              </p>
                              {badges.map((badge) => (
                                <TransactionBadge key={badge} type={badge} size="sm" />
                              ))}
                            </div>
                            {itemsPreview ? (
                              <p className="text-[10px] text-muted-foreground truncate" title={itemsPreview}>
                                {itemsPreview}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(tx.timestamp).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-bold text-success text-sm">
                              +${(tx.amount - tx.fee).toFixed(2)}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Cart + Actions (Desktop) */}
            <div className="hidden lg:block">
              <div className="sticky top-4 space-y-4">
                {/* Cart Section */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-base-blue" />
                      <span className="text-sm font-semibold text-foreground">{t('cart')}</span>
                    </div>
                    {cart.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="text-destructive h-6 px-2 text-xs"
                      >
                        {t('clear_all')}
                      </Button>
                    )}
                  </div>

                    {cart.length === 0 ? (
                    <div className="py-8 text-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="flex justify-center mb-2"
                      >
                        <MoniPayLogo size={40} color="hsl(var(--muted-foreground))" animationMode="idle" isEmpty />
                      </motion.div>
                       <p className="text-xs text-muted-foreground">{t('cart_empty')}</p>
                       <p className="text-[10px] text-muted-foreground mt-1">{t('tap_products_add')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {cart.map(({ product, quantity }) => (
                        <div key={product.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">${product.price.toFixed(2)} × {quantity}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              ${(product.price * quantity).toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleRemoveFromCart(product.id)}
                              className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cart Total */}
                  {cart.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('subtotal')}</span>
                        <span className="font-bold text-lg text-foreground">${numericAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>{t('you_receive')}</span>
                        <span className="text-success font-medium">${merchantReceives.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Desktop */}
                <div className="space-y-2">
                  <Button
                    size="lg"
                    onClick={handleCharge}
                    disabled={numericAmount < 0.01}
                    className="w-full h-14 text-base font-semibold rounded-2xl"
                    style={{ backgroundColor: `hsl(${getChainConfig((profile?.preferredNetwork || 'celo') as SupportedNetwork).accentColor})`, color: '#000' }}
                  >
                    {t('charge_btn')} ${amount}
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => setShowSendInvoice(true)}
                    disabled={numericAmount < 0.01}
                    className="w-full h-12 rounded-2xl text-sm font-semibold gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    {t('send_invoice')}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleClear}
                    className="w-full h-10 rounded-xl text-sm"
                  >
                    {t('clear')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Recent Sales - Mobile Only */}
            <div className="lg:hidden space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold text-muted-foreground">{t('recent_sales')}</h2>
                  {merchantTransactions.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSalesHistory(true)}
                      className="text-base-blue hover:text-base-blue/80 h-7 px-2 text-xs gap-1"
                    >
                      {t('view_all')}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {merchantTransactions.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-5 text-center">
                    <Clock className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-xs">{t('no_sales_yet')}</p>
                    <p className="text-muted-foreground text-[10px] mt-1">{t('sales_appear_here')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
                    {merchantTransactions.map((tx) => {
                      const itemsPreview = tx.items && tx.items.length > 0
                        ? tx.items.map(item => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`).join(', ')
                        : null;
                      
                      // Determine if this is an external wallet payment (counterparty is an address, not a @paytag)
                      const isExternalPayment = !tx.payerPayTag && tx.counterparty.startsWith('0x');

                      return (
                        <motion.button
                          key={tx.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedTx(tx.id)}
                          className="w-full bg-card border border-border rounded-xl p-3 flex items-center gap-3 text-left hover:border-primary/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                            <ArrowDownLeft className="w-4 h-4 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-xs text-foreground">
                                {isExternalPayment ? shortenAddress(tx.counterparty) : tx.counterparty}
                              </p>
                              {tx.invoiceId && (
                                <span className="px-1.5 py-0.5 text-[8px] font-semibold bg-base-blue/10 text-base-blue rounded">
                                  Invoice
                                </span>
                              )}
                              {isExternalPayment && (
                                <span className="px-1.5 py-0.5 text-[8px] font-semibold bg-muted text-muted-foreground rounded">
                                  External
                                </span>
                              )}
                            </div>
                            {itemsPreview ? (
                              <p className="text-[10px] text-muted-foreground truncate" title={itemsPreview}>
                                {itemsPreview}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(tx.timestamp).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-bold text-success text-sm">
                              +${(tx.amount - tx.fee).toFixed(2)}
                            </span>
                            {itemsPreview && (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </PullToRefresh>

        {/* QR Modal */}
        <AnimatePresence>
          {showQR && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => !isPaid && setShowQR(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center relative"
              >
                {isPaid ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="py-6"
                  >
                    {/* Blue & White Rounded Square Success Card */}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="bg-base-blue/10 border-2 border-base-blue rounded-3xl p-8 mb-4"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 15 }}
                        className="w-20 h-20 mx-auto rounded-2xl bg-base-blue flex items-center justify-center mb-4 shadow-lg shadow-base-blue/30"
                      >
                        <motion.div
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ delay: 0.3, duration: 0.3 }}
                        >
                          <Check className="w-10 h-10 text-white" strokeWidth={3} />
                        </motion.div>
                      </motion.div>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl font-bold text-base-blue"
                      >
                        +${paidAmount.toFixed(2)}
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                        className="text-sm text-base-blue/80 font-medium mt-1"
                      >
                        {merchantTokenLabel} Received
                      </motion.p>
                    </motion.div>
                    
                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-xl font-bold text-foreground"
                    >
                      {t('payment_successful')}
                    </motion.h3>
                    {paidByPayTag && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="mt-2 text-center"
                      >
                        <p className="text-muted-foreground text-sm">from</p>
                        {paidViaExternal ? (
                          <>
                            <p className="text-base-blue font-mono text-sm font-medium mt-1">
                              {paidByPayTag}
                            </p>
                            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground rounded">
                              External Wallet
                            </span>
                          </>
                        ) : (
                          <p className="text-base-blue font-semibold text-lg flex items-center justify-center gap-1">
                            @{paidByPayTag}
                            {isMoniBotTag(paidByPayTag) && <VerifiedBadge size={18} />}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowQR(false)}
                      className="absolute top-4 right-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
                     {t('scan_pay_title')}
                    </h3>
                    <p className="text-muted-foreground mb-3">${numericAmount.toFixed(2)} {merchantTokenLabel}</p>

                    {/* Celo: token selector in charge modal */}
                    {isCeloMerchant && (
                      <div className="flex gap-1.5 flex-wrap justify-center mb-3">
                        {CELO_TOKENS.map((t) => (
                          <button
                            key={t.symbol}
                            type="button"
                            onClick={() => setCeloToken(t.symbol)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
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
                    )}

                    {/* QR Mode Toggle */}
                    <div className="flex items-center justify-center gap-1 mb-4 bg-muted rounded-xl p-1">
                      <button
                        onClick={() => setQrMode('monipay')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          qrMode === 'monipay' 
                            ? 'bg-card text-foreground shadow-sm' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                         MoniPay
                      </button>
                      <button
                        onClick={() => setQrMode('external')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          qrMode === 'external' 
                            ? 'bg-card text-foreground shadow-sm' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                         {t('external_wallet')}
                      </button>
                    </div>
                    
                     <BrandedQR
                       value={qrPayload}
                       size={200}
                       className="mb-4"
                     />

                    {/* Mode-specific info */}
                    {qrMode === 'monipay' ? (
                      <div className="text-xs text-muted-foreground mb-4 space-y-1">
                       <p className="text-base-blue font-medium">{t('for_monipay_app')}</p>
                        <p>{t('merchant_receives')}: ${merchantReceives.toFixed(2)}</p>
                        <p>{t('platform_fee')}: ${fee.toFixed(2)}</p>
                      </div>
                     ) : (
                       <div className="text-center mb-4 space-y-3">
                         {/* Prominent Amount Display - Blue/White Theme, same width as QR */}
                         <div className="bg-base-blue rounded-2xl px-4 py-3 mx-auto" style={{ width: 272 }}>
                           <p className="text-[10px] text-white/80 font-medium mb-0.5">{t('customer_send_exactly')}</p>
                           <div className="flex items-baseline justify-center gap-1">
                             <span className="text-3xl font-bold text-white">${numericAmount.toFixed(2)}</span>
                             <span className="text-sm text-white/80">{merchantTokenLabel}</span>
                           </div>
                           <p className="text-[10px] text-white/60 mt-1">on {getChainConfig((profile?.preferredNetwork || 'celo') as SupportedNetwork).name} Network</p>
                         </div>
                         
                         <p className="text-xs text-muted-foreground">
                           For <span className="text-base-blue font-medium">MetaMask, Coinbase Wallet, Trust Wallet</span>, etc.
                         </p>
                       </div>
                      )}

                    {/* Waiting for payment indicator */}
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4 py-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-muted-foreground/30 border-t-base-blue rounded-full"
                      />
                      <span>{t('waiting_for_payment')}</span>
                    </div>

                    {/* Manual check button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isCheckingPayment}
                      onClick={async () => {
                        feedback('tap');
                        setIsCheckingPayment(true);
                        await syncTransactions();
                        setIsCheckingPayment(false);
                      }}
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      {isCheckingPayment ? (
                        <>
                          <MoniPayLogo size={12} color="currentColor" animationMode="processing" />
                          {t('checking')}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          {t('check_for_payment')}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      {/* Product Catalog */}
      <AnimatePresence>
        {showCatalog && (
          <ProductCatalog
            products={products}
            onProductsChange={setProducts}
            onClose={() => setShowCatalog(false)}
          />
        )}
      </AnimatePresence>

      {/* Analytics */}
      <AnimatePresence>
        {showAnalytics && (
          <MerchantAnalytics onClose={() => setShowAnalytics(false)} />
        )}
      </AnimatePresence>

      {/* Sales History (filtered to received only) */}
      <AnimatePresence>
        {showSalesHistory && (
          <TransactionHistory 
            onClose={() => setShowSalesHistory(false)} 
            initialFilter="received"
            title={t('sales_history')}
          />
        )}
      </AnimatePresence>

      {/* Send Invoice Modal */}
      <SendInvoiceModal
        isOpen={showSendInvoice}
        onClose={() => setShowSendInvoice(false)}
        profileId={profile?.id || ''}
        cart={cart}
        amount={numericAmount}
        fee={fee}
        merchantReceives={merchantReceives}
        recentTags={Array.from(new Set(
          transactions
            .map(tx => tx.counterparty)
            .filter(c => c && !c.startsWith('0x') && c !== 'monibot')
            .map(c => c.replace(/^@/, ''))
            .filter(tag => tag && tag !== profile?.payTag)
        ))}
      />

      {/* Invoices Modal */}
      <InvoicesSection
        isOpen={showInvoices}
        onClose={() => {
          setShowInvoices(false);
          setDeepLinkInvoiceId(null);
        }}
        deepLinkInvoiceId={deepLinkInvoiceId}
      />

      {/* Transaction Receipt Modal */}
      {selectedTransaction && (
        <TransactionReceiptModal
          transaction={{
            id: selectedTransaction.id,
            type: selectedTransaction.type,
            amount: selectedTransaction.amount,
            fee: selectedTransaction.fee,
            counterparty: selectedTransaction.counterparty,
            timestamp: selectedTransaction.timestamp,
            txHash: selectedTransaction.txHash,
            status: 'completed',
            items: selectedTransaction.items,
            invoiceId: selectedTransaction.invoiceId,
          }}
          walletAddress={profile?.wallet?.address}
          onClose={() => setSelectedTx(null)}
          onViewInvoice={(invoiceId) => {
            setSelectedTx(null);
            setDeepLinkInvoiceId(invoiceId);
            setShowInvoices(true);
          }}
        />
      )}

      {/* Invoice Payment Success Modal */}
      <AnimatePresence>
        {invoicePaid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-border"
            >
              {/* Blue & White Rounded Square Success Card */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-base-blue/10 border-2 border-base-blue rounded-3xl p-8 mb-4"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 15 }}
                  className="w-20 h-20 mx-auto rounded-2xl bg-base-blue flex items-center justify-center mb-4 shadow-lg shadow-base-blue/30"
                >
                  <motion.div
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl font-bold text-base-blue"
                >
                  +${invoicePaidAmount.toFixed(2)}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="text-sm text-base-blue/80 font-medium mt-1"
                >
                   {t('invoice_paid')}
                </motion.p>
              </motion.div>
              
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-bold text-foreground"
              >
                {t('invoice_paid_title')}
              </motion.h3>
              {invoicePaidByPayTag && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-base-blue font-semibold mt-2 text-lg flex items-center justify-center gap-1"
                >
                  by @{invoicePaidByPayTag}
                  {isMoniBotTag(invoicePaidByPayTag) && <VerifiedBadge size={18} />}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
