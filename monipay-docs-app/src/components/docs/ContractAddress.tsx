'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContractAddressProps {
  chain: 'base' | 'bsc' | 'tempo' | 'solana';
  address: string;
  label?: string;
}

const explorers = {
  base: 'https://basescan.org/address/',
  bsc: 'https://bscscan.com/address/',
  tempo: 'https://tempo-explorer.xyz/address/',
  solana: 'https://solscan.io/account/',
};

export function ContractAddress({ chain, address, label }: ContractAddressProps) {
  const [copied, setCopied] = useState(false);
  const url = `${explorers[chain]}${address}`;

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-surface border border-border rounded-lg my-4">
      <div className="flex-1 min-w-0">
        {label && <div className="text-[10px] font-bold text-text-subtle uppercase mb-1">{label}</div>}
        <div className="font-mono text-sm text-text-primary truncate">
          {address}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={copy}
          className="p-2 text-text-muted hover:text-brand transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-text-muted hover:text-brand transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
