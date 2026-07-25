import type { Transaction } from '@/contexts/PayTagContext';

export function exportTransactionsToCSV(transactions: Transaction[], filename = 'monipay-transactions.csv') {
  const headers = ['Date', 'Type', 'Amount (USDC)', 'Fee', 'Net', 'Counterparty', 'Source', 'TX Hash'];
  
  const rows = transactions.map(tx => [
    new Date(tx.timestamp).toISOString(),
    tx.type,
    tx.amount.toFixed(2),
    tx.fee.toFixed(2),
    (tx.amount - tx.fee).toFixed(2),
    tx.counterparty,
    tx.source || 'p2p',
    tx.txHash || '',
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
