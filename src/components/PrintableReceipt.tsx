import { forwardRef } from 'react';
import { Bot, Gift } from 'lucide-react';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { MoniPayLogo } from './MoniPayLogo';

interface PrintableReceiptProps {
  transaction: {
    id: string;
    type: 'sent' | 'received';
    amount: number;
    fee: number;
    counterparty: string;
    timestamp: number;
    txHash?: string;
    source?: string;
    metadata?: {
      monibot_type?: 'p2p' | 'grant';
      campaign_name?: string;
      network?: string;
    };
  };
  walletAddress?: string;
  moniBotContext?: string | null;
}

export const PrintableReceipt = forwardRef<HTMLDivElement, PrintableReceiptProps>(
  ({ transaction, walletAddress, moniBotContext }, ref) => {
    const txNetwork = (transaction.metadata?.network || 'base') as SupportedNetwork;
    const chainConfig = getChainConfig(txNetwork);
    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const netAmount = transaction.amount - transaction.fee;
    
    // Determine if this is a MoniBot transaction
    const isMoniBotP2P = transaction.source === 'monibot_p2p' || transaction.metadata?.monibot_type === 'p2p';
    const isMoniBotGrant = transaction.source === 'monibot_grant' || transaction.metadata?.monibot_type === 'grant';
    const isMoniBotTx = isMoniBotP2P || isMoniBotGrant;

    // Get transaction type label
    const getTransactionTypeLabel = () => {
      if (isMoniBotP2P) return 'MoniBot P2P';
      if (isMoniBotGrant) return 'MoniBot Grant';
      if (transaction.type === 'received') return 'Payment Received';
      return 'Payment Sent';
    };

    return (
      <div
        ref={ref}
        className="bg-white text-black p-8 max-w-md mx-auto print:p-4"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-gray-300 pb-6 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2 [&_.receipt-moni-text]:!text-black">
            <MoniPayLogo size={36} color="#0052FF" animationMode="idle" showText textSize={22} />
          </div>
          <p className="text-gray-500 text-sm">Transaction Receipt</p>
        </div>

        {/* Transaction Type Badge */}
        <div className="text-center mb-6">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
            isMoniBotTx
              ? 'bg-green-100 text-green-700'
              : transaction.type === 'received' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
          }`}>
            {isMoniBotP2P && <Bot className="w-4 h-4" />}
            {isMoniBotGrant && <Gift className="w-4 h-4" />}
            {getTransactionTypeLabel()}
          </span>
        </div>

        {/* Amount */}
        <div className="text-center mb-6">
          <span className={`text-4xl font-bold ${
            transaction.type === 'received' || isMoniBotGrant ? 'text-green-600' : 'text-red-600'
          }`}>
            {transaction.type === 'received' ? '+' : '-'}${transaction.amount.toFixed(2)}
          </span>
          <p className="text-gray-500 mt-1">{chainConfig.currency} on {chainConfig.name}</p>
        </div>

        {/* Details */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className="text-green-600 font-semibold">✓ Completed</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Receipt #</span>
            <span className="font-mono text-sm">{transaction.id.slice(0, 12).toUpperCase()}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">{transaction.type === 'received' ? 'From' : 'To'}</span>
            <span className="font-semibold">{transaction.counterparty}</span>
          </div>

          {/* MoniBot context */}
          {moniBotContext && (
            <div className="flex justify-between">
              <span className="text-gray-500">Source</span>
              <span className="font-semibold text-green-600">{moniBotContext}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-500">Date & Time</span>
            <span className="text-sm text-right">{formatDate(transaction.timestamp)}</span>
          </div>
          
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>${transaction.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Platform Fee (1%)</span>
              <span>-${transaction.fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Network Fee</span>
              <span className="text-[#0052FF]">Sponsored</span>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between">
              <span className="font-semibold">Net Amount</span>
              <span className="font-bold text-lg">${netAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Wallet & Hash */}
        {(walletAddress || transaction.txHash) && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-6 text-xs">
            {walletAddress && (
              <div>
                <span className="text-gray-500 block mb-1">Wallet Address</span>
                <span className="font-mono break-all">{walletAddress}</span>
              </div>
            )}
            {transaction.txHash && (
              <div>
                <span className="text-gray-500 block mb-1">Transaction Hash</span>
                <span className="font-mono break-all">{transaction.txHash}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center border-t-2 border-dashed border-gray-300 pt-6">
          <div className="flex items-center justify-center gap-2 mb-3 [&_.receipt-moni-text]:!text-black">
            <MoniPayLogo size={24} color="#0052FF" animationMode="idle" showText textSize={14} />
          </div>
          <p className="text-gray-500 text-xs mb-1">
            Gasless {chainConfig.currency} Payments on {chainConfig.name} Chain
          </p>
          <p className="text-[#0052FF] text-sm font-medium mb-2">
            www.monipay.xyz
          </p>
          <p className="text-gray-400 text-xs">
            Non-Custodial · No Hardware Required · Secure
          </p>
          <p className="text-gray-400 text-xs mt-3">
            Thank you for using MoniPay!
          </p>
        </div>
      </div>
    );
  }
);

PrintableReceipt.displayName = 'PrintableReceipt';
