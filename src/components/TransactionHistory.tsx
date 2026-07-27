import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoniPayLogo } from './MoniPayLogo';
import { usePayTag, Transaction } from '@/contexts/PayTagContext';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpRight, ArrowDownLeft, X, ArrowLeft, Search,
  ExternalLink, Copy, Check, Calendar, Printer, Twitter, Filter, Share2
} from 'lucide-react';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { Input } from '@/components/ui/input';
import { shortenAddress } from '@/lib/wallet';

// Helper: get currency label for a network (network-level default)
function getNetworkCurrency(network?: SupportedNetwork | string): string {
  return 'USDT';
}

// Helper: get currency label for a single transaction.
// Reads the token symbol stored in metadata (set by relay-payment-celo for
// multi-token sends) and falls back to the network default.
function getTxCurrency(tx: { metadata?: { network?: SupportedNetwork | string; token_symbol?: string } }): string {
  if (tx.metadata?.token_symbol) return tx.metadata.token_symbol;
  return getNetworkCurrency(tx.metadata?.network);
}

// Helper: get explorer URL and label for a network
function getExplorerInfo(network?: SupportedNetwork | string, txHash?: string): { explorerUrl: string; label: string } {
  const hash = txHash || '';
  return { explorerUrl: `https://celoscan.io/tx/${hash}`, label: 'CeloScan' };
}
import { PrintableReceipt } from './PrintableReceipt';
import { isMoniBotTag, VerifiedBadge } from './VerifiedBadge';
import { TransactionBadge, getTransactionBadges, type TransactionBadgeType } from './TransactionBadge';
import { usePayTagLookup } from '@/hooks/usePayTagLookup';
import { MagicPayReceiptsSection } from './MagicPayReceiptsSection';
import { RecurringPaymentsSection } from './RecurringPaymentsSection';

interface TransactionHistoryProps {
  onClose: () => void;
  initialFilter?: FilterType;
  title?: string;
}

type FilterType = 'all' | 'sent' | 'received';

export function TransactionHistory({ onClose, initialFilter = 'all', title = 'Transaction History' }: TransactionHistoryProps) {
  const { transactions, profile, loadMoreTransactions, hasMoreTransactions, isLoadingMore } = usePayTag();
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<TransactionBadgeType | 'all'>('all');
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // PayTag lookup for wallet addresses
  const { batchLookupPayTags } = usePayTagLookup();
  const [payTagMap, setPayTagMap] = useState<Map<string, string>>(new Map());

  // Look up pay_tags for any wallet addresses in transactions
  useEffect(() => {
    const walletAddresses = transactions
      .map(tx => tx.counterparty)
      .filter(addr => addr.startsWith('0x'));
    
    if (walletAddresses.length > 0) {
      batchLookupPayTags(walletAddresses).then(setPayTagMap);
    }
  }, [transactions, batchLookupPayTags]);

  // Infinite scroll: observe sentinel element
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreTransactions && !isLoadingMore) {
          loadMoreTransactions();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreTransactions, isLoadingMore, loadMoreTransactions]);

  const filteredTransactions = transactions.filter(tx => {
    const matchesFilter = filter === 'all' || tx.type === filter;
    const counterpartyDisplay = formatCounterparty(tx);
    const matchesSearch = searchQuery === '' || 
      counterpartyDisplay.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Tag filter
    if (tagFilter !== 'all') {
      const badges = getTransactionBadges({
        source: tx.source,
        counterparty: tx.counterparty,
        metadata: tx.metadata,
        invoiceId: tx.invoiceId,
        payerPayTag: tx.payerPayTag,
      });
      if (!badges.includes(tagFilter)) return false;
    }
    
    return matchesFilter && matchesSearch;
  });

  const selectedTransaction = transactions.find(tx => tx.id === selectedTx);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareReceipt = async (tx: Transaction) => {
    const amount = `${tx.type === 'sent' ? '-' : '+'}$${tx.amount.toFixed(2)}`;
    const counterparty = formatCounterparty(tx);
    const direction = tx.type === 'sent' ? 'Sent to' : 'Received from';
    const currency = getTxCurrency(tx);
    const text = `${direction} ${counterparty}: ${amount} ${currency} on MoniPay`;
    const url = tx.txHash ? getExplorerInfo(tx.metadata?.network, tx.txHash).explorerUrl : 'https://monipay.lovable.app';

    if (navigator.share) {
      try {
        await navigator.share({ title: 'MoniPay Receipt', text, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MoniPay Receipt</title>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; background: white; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Format counterparty - prefer explicit paytag fields, otherwise resolve wallet address to pay_tag if available
  function formatCounterparty(tx: Transaction): string {
    const raw = tx.counterparty;

    const ensureAt = (s: string) => (s.startsWith('@') ? s : `@${s}`);

    // If we already have a payerPayTag (common in receipts + MoniBot mirroring), prefer it.
    if (tx.payerPayTag) {
      return ensureAt(tx.payerPayTag);
    }

    if (raw.startsWith('0x')) {
      // Check if we have a pay_tag for this address
      const payTag = payTagMap.get(raw.toLowerCase());
      if (payTag) return `@${payTag}`;
      return shortenAddress(raw);
    }

    // Already a pay_tag - ensure @ prefix
    return ensureAt(raw);
  }

  // Check if counterparty is still an unresolved wallet address
  function isExternalWallet(tx: Transaction): boolean {
    if (tx.payerPayTag) return false;
    const raw = tx.counterparty;
    if (!raw.startsWith('0x')) return false;
    const payTag = payTagMap.get(raw.toLowerCase());
    return !payTag;
  }

  // Get MoniBot context message
  function getMoniBotContext(tx: Transaction): string | null {
    if (tx.source === 'monibot_p2p' || tx.metadata?.monibot_type === 'p2p') {
      return 'Sent via @monibot command';
    }
    if (tx.source === 'monibot_grant' || tx.metadata?.monibot_type === 'grant') {
      const campaignName = tx.metadata?.campaign_name;
      return campaignName 
        ? `Campaign: "${campaignName}"`
        : 'Campaign grant from @monibot';
    }
    return null;
  }

  // Get tweet link if available
  function getTweetLink(tx: Transaction): string | null {
    const tweetId = tx.metadata?.tweet_id;
    if (tweetId) {
      return `https://twitter.com/monibotsol/status/${tweetId}`;
    }
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-xl sm:rounded-3xl rounded-t-[28px] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden h-[90vh] sm:h-auto sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container px-4 py-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-foreground flex-1">{title}</h1>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

      {/* Search & Filter */}
      <div className="container px-4 py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by PayTag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
        
        <div className="flex gap-2">
          {(['all', 'sent', 'received'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={`rounded-full capitalize ${
                filter === f ? 'bg-base-blue hover:bg-base-blue/90' : ''
              }`}
            >
              {f === 'all' ? 'All' : f === 'sent' ? 'Sent' : 'Received'}
            </Button>
          ))}
        </div>

        {/* Tag Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={tagFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTagFilter('all')}
            className={`rounded-full text-xs flex-shrink-0 ${tagFilter === 'all' ? 'bg-base-blue hover:bg-base-blue/90' : ''}`}
          >
            <Filter className="w-3 h-3 mr-1" />
            All Tags
          </Button>
          {([
            { value: 'monibot_p2p' as TransactionBadgeType, label: 'MoniBot P2P' },
            { value: 'monibot_grant' as TransactionBadgeType, label: 'MoniBot Grant' },
            { value: 'invoice' as TransactionBadgeType, label: 'Invoice' },
            { value: 'payment_link' as TransactionBadgeType, label: 'Store' },
            { value: 'online_order' as TransactionBadgeType, label: 'Online Sale' },
            { value: 'external' as TransactionBadgeType, label: 'External' },
          ]).map((tag) => (
            <Button
              key={tag.value}
              variant={tagFilter === tag.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTagFilter(tagFilter === tag.value ? 'all' : tag.value)}
              className={`rounded-full text-xs flex-shrink-0 ${tagFilter === tag.value ? 'bg-base-blue hover:bg-base-blue/90' : ''}`}
            >
              {tag.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="container px-4 pb-8">
        <MagicPayReceiptsSection />
        <RecurringPaymentsSection />
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="flex justify-center mb-3"
            >
              <MoniPayLogo size={48} color="hsl(var(--muted-foreground))" animationMode="idle" isEmpty />
            </motion.div>
            <p className="text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((tx, index) => {
              const badges = getTransactionBadges({
                source: tx.source,
                counterparty: tx.counterparty,
                metadata: tx.metadata,
                invoiceId: tx.invoiceId,
                payerPayTag: tx.payerPayTag,
              });
              const moniBotContext = getMoniBotContext(tx);
              
              return (
                <motion.button
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedTx(tx.id)}
                  className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 text-left hover:border-primary/30 transition-colors"
                >
                  <div className={`
                    w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0
                    ${tx.type === 'sent' ? 'bg-destructive/10' : 'bg-success/10'}
                  `}>
                    {tx.type === 'sent' ? (
                      <ArrowUpRight className="w-5 h-5 text-destructive" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5 text-success" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-foreground truncate flex items-center gap-0.5">
                        {formatCounterparty(tx)}
                        {isMoniBotTag(tx.payerPayTag || tx.counterparty) && <VerifiedBadge size={14} />}
                      </p>
                      {/* Transaction badges */}
                      {badges.map((badge) => (
                        <TransactionBadge key={badge} type={badge} size="sm" />
                      ))}
                    </div>
                    {/* MoniBot context line */}
                    {moniBotContext && (
                      <p className="text-xs text-green-500 mt-0.5">{moniBotContext}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.timestamp).toLocaleDateString()} · {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                    <div className="text-right flex-shrink-0">
                    <span className={`font-bold ${tx.type === 'sent' ? 'text-destructive' : 'text-success'}`}>
                      {tx.type === 'sent' ? '-' : '+'}${tx.amount.toFixed(2)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {getTxCurrency(tx)}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isLoadingMore && (
            <MoniPayLogo size={24} color="hsl(var(--muted-foreground))" animationMode="processing" />
          )}
          {!hasMoreTransactions && filteredTransactions.length > 0 && (
            <p className="text-xs text-muted-foreground">All transactions loaded</p>
          )}
        </div>
      </div>
        </div>

      {/* Transaction Receipt Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setSelectedTx(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">Transaction Receipt</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTx(null)}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Transaction badges in receipt */}
              {(() => {
                const badges = getTransactionBadges({
                  source: selectedTransaction.source,
                  counterparty: selectedTransaction.counterparty,
                  metadata: selectedTransaction.metadata,
                  invoiceId: selectedTransaction.invoiceId,
                  payerPayTag: selectedTransaction.payerPayTag,
                });
                return badges.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4 justify-center">
                    {badges.map((badge) => (
                      <TransactionBadge key={badge} type={badge} size="md" />
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Amount */}
              <div className="text-center mb-6">
                <div className={`
                  w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center
                  ${selectedTransaction.type === 'sent' ? 'bg-destructive/10' : 'bg-success/10'}
                `}>
                  {selectedTransaction.type === 'sent' ? (
                    <ArrowUpRight className="w-8 h-8 text-destructive" />
                  ) : (
                    <ArrowDownLeft className="w-8 h-8 text-success" />
                  )}
                </div>
                <span className={`text-4xl font-bold ${
                  selectedTransaction.type === 'sent' ? 'text-destructive' : 'text-success'
                }`}>
                  {selectedTransaction.type === 'sent' ? '-' : '+'}${selectedTransaction.amount.toFixed(2)}
                </span>
                <p className="text-muted-foreground mt-1">
                  {getTxCurrency(selectedTransaction)}
                </p>
               </div>

              {/* Itemized products */}
              {selectedTransaction.items && selectedTransaction.items.length > 0 && (
                <div className="bg-muted rounded-xl p-4 mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Items</p>
                  <div className="space-y-2">
                    {selectedTransaction.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          {item.name} {item.quantity > 1 && <span className="text-muted-foreground">×{item.quantity}</span>}
                        </span>
                        <span className="font-semibold text-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border mt-3 pt-3 flex justify-between text-sm">
                    <span className="font-semibold text-foreground">Subtotal</span>
                    <span className="font-bold text-foreground">
                      ${selectedTransaction.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Status</span>
                  <span className="text-success font-medium text-sm flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    Completed
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">
                    {selectedTransaction.type === 'sent' ? 'To' : 'From'}
                  </span>
                  <span className="font-medium text-sm text-foreground flex items-center gap-0.5">
                    {formatCounterparty(selectedTransaction)}
                    {isMoniBotTag(selectedTransaction.payerPayTag || selectedTransaction.counterparty) && <VerifiedBadge size={14} />}
                  </span>
                </div>

                {/* MoniBot context */}
                {(() => {
                  const context = getMoniBotContext(selectedTransaction);
                  return context ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-sm">Source</span>
                      <span className="font-medium text-sm text-green-500">{context}</span>
                    </div>
                  ) : null;
                })()}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Date</span>
                  <span className="font-medium text-sm text-foreground">
                    {formatDate(selectedTransaction.timestamp)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Platform Fee</span>
                  <span className="font-medium text-sm text-foreground">${selectedTransaction.fee.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Network Fee</span>
                  <span className="font-medium text-sm text-base-blue">Sponsored</span>
                </div>
                
                {profile?.wallet?.address && (
                  <div className="pt-3 border-t border-border">
                    <span className="text-muted-foreground text-xs block mb-1">Your Wallet</span>
                    <button
                      onClick={() => {
                        const addr = profile.wallet.address;
                        handleCopy(addr);
                      }}
                      className="flex items-center gap-2 text-xs font-mono text-foreground hover:text-base-blue transition-colors"
                    >
                      {shortenAddress(
                        profile.wallet.address
                      )}
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
                
                {selectedTransaction.txHash && (
                  <div className="pt-3 border-t border-border">
                    <span className="text-muted-foreground text-xs block mb-1">Transaction Hash</span>
                    <button
                      onClick={() => handleCopy(selectedTransaction.txHash || '')}
                      className="flex items-center gap-2 text-xs font-mono text-foreground hover:text-base-blue transition-colors"
                    >
                      {shortenAddress(selectedTransaction.txHash)}
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={handlePrint}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                {selectedTransaction.txHash && (() => {
                  const { explorerUrl, label } = getExplorerInfo(selectedTransaction.metadata?.network, selectedTransaction.txHash);
                  return (
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => window.open(explorerUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {label}
                    </Button>
                  );
                })()}
                {/* Share Receipt */}
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => handleShareReceipt(selectedTransaction)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

              {/* Tweet link for MoniBot transactions */}
              {(() => {
                const tweetLink = getTweetLink(selectedTransaction);
                return tweetLink ? (
                  <Button
                    variant="ghost"
                    className="w-full mt-3 text-muted-foreground hover:text-foreground"
                    onClick={() => window.open(tweetLink, '_blank')}
                  >
                    <Twitter className="w-4 h-4 mr-2" />
                    View Original Tweet
                  </Button>
                ) : null;
              })()}

              {/* Hidden Printable Receipt */}
              <div className="hidden">
                <PrintableReceipt
                  ref={printRef}
                  transaction={{
                    ...selectedTransaction,
                    counterparty: formatCounterparty(selectedTransaction),
                  }}
                  walletAddress={profile?.wallet?.address}
                  moniBotContext={getMoniBotContext(selectedTransaction)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}
