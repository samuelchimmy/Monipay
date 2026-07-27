import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, ExternalLink, Copy, Check, ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react';
import { MoniPayLogo } from './MoniPayLogo';
import { Button } from '@/components/ui/button';
import { shortenAddress } from '@/lib/wallet';
import { usePayTagLookup } from '@/hooks/usePayTagLookup';
import { isMoniBotTag, VerifiedBadge } from './VerifiedBadge';
import { TransactionBadge, getTransactionBadges } from './TransactionBadge';
import { usePayTag } from '@/contexts/PayTagContext';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface TransactionReceipt {
  id: string;
  type: 'sent' | 'received';
  amount: number;
  fee: number;
  counterparty: string;
  timestamp: number;
  txHash?: string;
  status?: string;
  items?: ReceiptItem[];
  merchantName?: string;
  merchantAddress?: string;
  invoiceId?: string;
  // Optional enrichment (present on PayTagContext Transaction)
  payerPayTag?: string;
  source?: string;
  metadata?: Record<string, any>;
}

interface TransactionReceiptModalProps {
  transaction: TransactionReceipt | null;
  walletAddress?: string;
  onClose: () => void;
  onViewInvoice?: (invoiceId: string) => void;
}
// Helper: Tx hash with explorer link
function TransactionHashWithExplorer({ txHash, metadata, handleCopy, copied }: { txHash: string; metadata?: Record<string, any>; handleCopy: (text: string) => void; copied: boolean }) {
  const network = (metadata?.network || 'celo') as SupportedNetwork;
  const config = getChainConfig(network);
  const explorerUrl = config ? `${config.explorerUrl}/tx/${txHash}` : `https://celoscan.io/tx/${txHash}`;

  return (
    <div className="px-6 py-4 border-b border-dashed border-gray-300">
      <p className="text-xs text-gray-400 mb-1">Transaction Hash</p>
      <div className="flex items-center gap-2">
        <code className="text-[10px] font-mono text-gray-600 break-all flex-1">
          {txHash}
        </code>
        <button
          onClick={() => handleCopy(txHash)}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline"
      >
        View on Explorer <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

export function TransactionReceiptModal({ 
  transaction, 
  walletAddress, 
  onClose,
  onViewInvoice,
}: TransactionReceiptModalProps) {
  const [copied, setCopied] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printerWidth, setPrinterWidth] = useState<'58mm' | '80mm'>('80mm');
  const receiptRef = useRef<HTMLDivElement>(null);
  const { profile } = usePayTag();

  // Derive network from transaction metadata, fallback to user's preferred network, then 'celo'
  const txNetwork = (transaction?.metadata?.network || profile?.preferredNetwork || 'celo') as SupportedNetwork;
  const chainConfig = getChainConfig(txNetwork);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { lookupPayTag } = usePayTagLookup();
  const [resolvedPayTag, setResolvedPayTag] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolvedPayTag(null);

    if (!transaction) return;

    if (transaction.counterparty?.startsWith('0x')) {
      lookupPayTag(transaction.counterparty).then((tag) => {
        if (!cancelled) setResolvedPayTag(tag);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [transaction?.counterparty, lookupPayTag, transaction]);

  const payerPayTagCandidate = (transaction as any)?.payerPayTag || (transaction as any)?.payer_pay_tag || null;

  const counterpartyDisplay = useMemo(() => {
    if (!transaction) return '';

    if (transaction.merchantName) return transaction.merchantName;

    const raw = transaction.counterparty || '';
    const ensureAt = (s: string) => (s.startsWith('@') ? s : `@${s}`);

    if (raw.startsWith('0x')) {
      const candidate = payerPayTagCandidate || resolvedPayTag;
      if (candidate) return ensureAt(candidate);
      return shortenAddress(raw);
    }

    // Non-address: treat as a monitag and ensure @ prefix
    return ensureAt(raw);
  }, [transaction, payerPayTagCandidate, resolvedPayTag]);

  const isUnresolvedExternalCounterparty = useMemo(() => {
    if (!transaction) return false;
    if (transaction.merchantName) return false;
    if (!transaction.counterparty?.startsWith('0x')) return false;
    return !(payerPayTagCandidate || resolvedPayTag);
  }, [transaction, payerPayTagCandidate, resolvedPayTag]);

  if (!transaction) return null;

  const netAmount = transaction.type === 'received' 
    ? transaction.amount - transaction.fee 
    : transaction.amount;
  const subtotal = transaction.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || transaction.amount;
  const executePrint = (width: '58mm' | '80mm') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const is58mm = width === '58mm';
    const receiptWidth = width;
    const fontSize = is58mm ? '10px' : '12px';
    const smallFont = is58mm ? '8px' : '10px';
    const itemFont = is58mm ? '9px' : '11px';
    const amountFont = is58mm ? '18px' : '22px';
    const logoSize = is58mm ? '20px' : '24px';
    const logoFont = is58mm ? '10px' : '12px';
    const titleFont = is58mm ? '14px' : '16px';
    const padding = is58mm ? '6px' : '8px';
    const barcodeCount = is58mm ? 30 : 40;

    const itemsHtml = transaction.items && transaction.items.length > 0
      ? transaction.items.map(item => `
          <tr>
            <td style="text-align: left; padding: 2px 0; font-size: ${itemFont};">${item.name}</td>
            <td style="text-align: center; padding: 2px 2px; font-size: ${itemFont};">${item.quantity}</td>
            <td style="text-align: right; padding: 2px 0; font-size: ${itemFont};">$${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')
      : `
           <tr>
             <td style="text-align: left; padding: 2px 0; font-size: ${itemFont};">${chainConfig.currency} Transfer</td>
             <td style="text-align: center; padding: 2px 2px; font-size: ${itemFont};">1</td>
             <td style="text-align: right; padding: 2px 0; font-size: ${itemFont};">$${transaction.amount.toFixed(2)}</td>
           </tr>
         `;

    // Generate barcode-like pattern (deterministic based on transaction ID)
    const barcodeHtml = Array.from({ length: barcodeCount }).map((_, i) => {
      const charCode = transaction.id.charCodeAt(i % transaction.id.length) || 0;
      const barWidth = charCode % 2 === 0 ? '2px' : '1px';
      const height = `${16 + (charCode % 16)}px`;
      return `<div style="background: #1f2937; width: ${barWidth}; height: ${height};"></div>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MoniPay Receipt</title>
          <style>
            @page {
              size: ${receiptWidth} auto;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: 100%;
              background: white;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: ${fontSize};
              line-height: 1.3;
              color: black;
              width: ${receiptWidth};
              max-width: ${receiptWidth};
              padding: ${padding};
              margin: 0 auto;
            }
            .receipt-container {
              width: 100%;
              text-align: center;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .dashed {
              border-top: 1px dashed #9ca3af;
              margin: 6px 0;
            }
            .logo-container {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
              margin-bottom: 4px;
            }
            .logo-box {
              width: ${logoSize};
              height: ${logoSize};
              background: #0052FF;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: ${logoFont};
              font-family: Arial, sans-serif;
            }
            .logo-text {
              font-family: Arial, sans-serif;
              font-weight: bold;
              font-size: ${titleFont};
            }
            .logo-text-blue { color: #0052FF; }
            .merchant-name {
              font-size: ${is58mm ? '12px' : '14px'};
              font-weight: bold;
              margin-bottom: 2px;
            }
            .amount {
              font-size: ${amountFont};
              font-weight: bold;
              margin: 6px 0;
            }
            .amount-received { color: #16a34a; }
            .amount-sent { color: #1f2937; }
            table { 
              width: 100%; 
              border-collapse: collapse;
              margin: 0 auto;
            }
            .items-header {
              font-size: ${smallFont};
              color: #6b7280;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 2px;
              margin-bottom: 4px;
            }
            .total-row td {
              padding-top: 4px;
              border-top: 1px solid #e5e7eb;
            }
            .hash {
              font-size: ${is58mm ? '7px' : '8px'};
              word-break: break-all;
              color: #6b7280;
              margin-top: 4px;
              text-align: center;
            }
            .barcode {
              display: flex;
              justify-content: center;
              align-items: flex-end;
              gap: 1px;
              height: ${is58mm ? '24px' : '32px'};
              margin: 6px auto;
            }
            .footer-text {
              font-size: ${smallFont};
              color: #6b7280;
            }
            .blue { color: #0052FF; }
            .green { color: #16a34a; }
            .small { font-size: ${smallFont}; }
            @media print {
              html, body { 
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                width: ${receiptWidth} !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Header -->
            <div class="center">
              <div class="logo-container">
                <div class="logo-box">M</div>
                <span class="logo-text">Moni<span class="logo-text-blue">PAY</span></span>
              </div>
            </div>
            
            <div class="dashed"></div>
            
             <!-- Merchant/Counterparty -->
             <div class="center">
               <div class="merchant-name">
                 ${counterpartyDisplay}
               </div>
               <div class="small" style="color: #6b7280;">
                ${formatDate(transaction.timestamp)} • ${formatTime(transaction.timestamp)}
              </div>
            </div>
            
            <div class="dashed"></div>
            
            <!-- Receipt Info -->
            <table>
              <tr>
                <td class="small" style="color: #6b7280; text-align: left;">Receipt #:</td>
                <td class="small" style="font-family: monospace; text-align: right;">${transaction.id.slice(0, 12).toUpperCase()}</td>
              </tr>
              <tr>
                <td class="small" style="color: #6b7280; text-align: left;">Type:</td>
                <td class="small bold ${transaction.type === 'received' ? 'green' : ''}" style="text-align: right;">${transaction.type === 'received' ? 'Payment Received' : 'Payment Sent'}</td>
              </tr>
            </table>
            
            <div class="dashed"></div>
            
            <!-- Items -->
            <table class="items-header">
              <tr>
                <td style="text-align: left;">Item</td>
                <td style="text-align: center;">Qty</td>
                <td style="text-align: right;">Price</td>
              </tr>
            </table>
            <table>
              ${itemsHtml}
            </table>
            
            <div class="dashed"></div>
            
            <!-- Totals -->
            <table>
              <tr>
                <td class="small" style="text-align: left;">Subtotal</td>
                <td class="small" style="text-align: right;">$${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td class="small" style="color: #6b7280; text-align: left;">Platform Fee (1%)</td>
                <td class="small" style="color: #6b7280; text-align: right;">-$${transaction.fee.toFixed(2)}</td>
              </tr>
              <tr>
                <td class="small" style="color: #6b7280; text-align: left;">Network Fee</td>
                <td class="small blue bold" style="text-align: right;">Sponsored</td>
              </tr>
              <tr class="total-row">
                <td class="bold" style="text-align: left;">TOTAL</td>
                <td class="amount ${transaction.type === 'received' ? 'amount-received' : 'amount-sent'}" style="text-align: right;">$${netAmount.toFixed(2)}</td>
              </tr>
            </table>
            
            ${transaction.txHash ? `
              <div class="dashed"></div>
              <div class="small center" style="color: #6b7280;">Tx Hash:</div>
              <div class="hash">${transaction.txHash}</div>
            ` : ''}
            
            <div class="dashed"></div>
            
            <!-- Barcode -->
            <div class="barcode">
              ${barcodeHtml}
            </div>
            
            <!-- Footer -->
            <div class="center">
              <div class="bold" style="font-size: ${is58mm ? '11px' : '13px'}; margin-bottom: 4px;">THANK YOU!</div>
              <div class="footer-text">Powered by MoniPay</div>
              <div class="footer-text blue" style="margin-top: 4px;">www.monipay.xyz</div>
              <div class="footer-text" style="margin-top: 2px;">Gasless ${chainConfig.currency} on ${chainConfig.name} Chain</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 300);

    setShowPrintDialog(false);
  };

  const handlePrintClick = () => {
    setShowPrintDialog(true);
  };


  return (
    <>
      {/* Print Size Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-base-blue" />
              Select Printer Size
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup 
              value={printerWidth} 
              onValueChange={(val) => setPrinterWidth(val as '58mm' | '80mm')}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 rounded-xl border border-border hover:border-base-blue/50 transition-colors cursor-pointer" onClick={() => setPrinterWidth('58mm')}>
                <RadioGroupItem value="58mm" id="58mm" />
                <Label htmlFor="58mm" className="flex-1 cursor-pointer">
                  <div className="font-medium">58mm (Small)</div>
                  <div className="text-xs text-muted-foreground">Compact thermal printers</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-xl border border-border hover:border-base-blue/50 transition-colors cursor-pointer" onClick={() => setPrinterWidth('80mm')}>
                <RadioGroupItem value="80mm" id="80mm" />
                <Label htmlFor="80mm" className="flex-1 cursor-pointer">
                  <div className="font-medium">80mm (Standard)</div>
                  <div className="text-xs text-muted-foreground">Standard POS printers</div>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <Button 
            className="w-full bg-base-blue hover:bg-base-blue/90"
            onClick={() => executePrint(printerWidth)}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
        </DialogContent>
      </Dialog>

      {/* Main Receipt Modal */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-3xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-foreground">Transaction Receipt</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrintClick}
                  className="rounded-full h-9 w-9"
                >
                  <Printer className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full h-9 w-9"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable Receipt Content */}
            <div className="overflow-y-auto flex-1 p-4">
              <div 
                ref={receiptRef}
                className="bg-white text-black rounded-xl shadow-sm"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {/* Receipt Header - Dashed border style */}
                <div className="text-center px-6 pt-6 pb-4 border-b-2 border-dashed border-gray-300">
                  {/* MoniPay Logo */}
                    <div className="flex items-center justify-center gap-2 mb-2 [&_.receipt-moni-text]:!text-black">
                      <MoniPayLogo size={32} color="#0052FF" animationMode="idle" showText textSize={20} />
                    </div>
                  
                  {/* Merchant/Counterparty Info */}
                  <p className="text-gray-800 font-semibold text-lg mt-3 flex items-center justify-center gap-1">
                    {counterpartyDisplay}
                    {isMoniBotTag(counterpartyDisplay) && !counterpartyDisplay.startsWith('0x') && (
                      <span className="inline-flex items-center">
                        <VerifiedBadge size={16} className="text-[#0052FF] fill-[#0052FF]/20" />
                      </span>
                    )}
                  </p>

                  {/* Source badges (MoniBot / External / Invoice / Online Sale) */}
                  {(() => {
                    const badges = getTransactionBadges({
                      source: transaction.source,
                      counterparty: transaction.counterparty,
                      metadata: transaction.metadata as any,
                      invoiceId: transaction.invoiceId,
                      payerPayTag: payerPayTagCandidate || undefined,
                    });

                    return badges.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                        {badges.map((b) => (
                          <TransactionBadge key={b} type={b} size="sm" />
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {isUnresolvedExternalCounterparty && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-600 rounded">
                      External Wallet
                    </span>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    {formatDate(transaction.timestamp)} • {formatTime(transaction.timestamp)}
                  </p>
                </div>

                {/* Transaction Details Section */}
                <div className="px-6 py-4 border-b border-dashed border-gray-300">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Receipt #:</span>
                    <span className="font-mono">{transaction.id.slice(0, 12).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Type:</span>
                    <span className={`font-semibold ${transaction.type === 'received' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'received' ? 'Payment Received' : 'Payment Sent'}
                    </span>
                  </div>
                </div>

                {/* Items Section */}
                <div className="px-6 py-4 border-b border-dashed border-gray-300">
                  {/* Column Headers */}
                  <div className="flex justify-between text-xs text-gray-400 mb-2 pb-1 border-b border-gray-200">
                    <span className="flex-1">Item</span>
                    <span className="w-12 text-center">Qty</span>
                    <span className="w-16 text-right">Price</span>
                  </div>

                  {/* Items List */}
                  {transaction.items && transaction.items.length > 0 ? (
                    <div className="space-y-2">
                      {transaction.items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="flex-1 text-gray-800 truncate pr-2">{item.name}</span>
                          <span className="w-12 text-center text-gray-600">{item.quantity}</span>
                          <span className="w-16 text-right text-gray-800">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="flex-1 text-gray-800">{chainConfig.currency} Transfer</span>
                      <span className="w-12 text-center text-gray-600">1</span>
                      <span className="w-16 text-right text-gray-800">${transaction.amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Totals Section */}
                <div className="px-6 py-4 border-b border-dashed border-gray-300 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-800">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Platform Fee (1%)</span>
                    <span className="text-gray-600">-${transaction.fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Network Fee</span>
                    <span className="text-[#0052FF] font-medium">Sponsored ✨</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className={`font-bold text-xl ${transaction.type === 'received' ? 'text-green-600' : 'text-gray-900'}`}>
                      ${netAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Transaction Hash Section */}
                {transaction.txHash && (
                  <TransactionHashWithExplorer txHash={transaction.txHash} metadata={transaction.metadata} handleCopy={handleCopy} copied={copied} />
                )}

                {/* Footer */}
                <div className="px-6 py-5 text-center">
                  {/* Barcode-style decoration */}
                  <div className="flex justify-center items-end gap-0.5 h-10 mb-4">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-gray-800"
                        style={{
                          width: Math.random() > 0.5 ? '2px' : '1px',
                          height: `${20 + Math.random() * 20}px`,
                        }}
                      />
                    ))}
                  </div>
                  
                  <p className="text-gray-900 font-bold text-sm mb-1">THANK YOU!</p>
                  <p className="text-gray-500 text-xs mb-3">Powered by MoniPay</p>
                  
                  <div className="flex items-center justify-center gap-1 mb-2 [&_.receipt-moni-text]:!text-black">
                    <MoniPayLogo size={16} color="#0052FF" animationMode="idle" showText textSize={10} />
                  </div>
                  
                  <p className="text-gray-400 text-[10px]">
                    Gasless {chainConfig.currency} Payments on {chainConfig.name} Chain
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-border flex gap-3">
              {transaction.invoiceId && onViewInvoice && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onViewInvoice(transaction.invoiceId!)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Invoice
                </Button>
              )}
              <Button
                className="flex-1 bg-base-blue hover:bg-base-blue/90"
                onClick={handlePrintClick}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
