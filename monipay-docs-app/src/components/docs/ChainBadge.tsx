import { cn } from '@/lib/utils';

interface ChainBadgeProps {
  chain: 'base' | 'bsc' | 'tempo' | 'solana' | 'celo' | 'ink';
  status?: 'live' | 'testnet' | 'soon';
}

const chainConfig = {
  base: {
    name: 'Base',
    token: 'USDC',
    color: 'bg-blue-500',
    text: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/10',
  },
  bsc: {
    name: 'BNB Chain',
    token: 'USDT',
    color: 'bg-yellow-500',
    text: 'text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-900/10',
  },
  tempo: {
    name: 'Tempo',
    token: 'aUSD',
    color: 'bg-purple-500',
    text: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/10',
  },
  solana: {
    name: 'Solana',
    token: 'USDC',
    color: 'bg-emerald-500',
    text: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
  },
  celo: {
    name: 'Celo',
    token: 'cUSD',
    color: 'bg-green-500',
    text: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-900/10',
  },
  ink: {
    name: 'Ink',
    token: 'USDC',
    color: 'bg-indigo-500',
    text: 'text-indigo-500',
    bg: 'bg-indigo-50 dark:bg-indigo-900/10',
  },
};

export function ChainBadge({ chain, status = 'live' }: ChainBadgeProps) {
  const config = chainConfig[chain];

  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border', config.bg)}>
      <div className={cn('w-2 h-2 rounded-full animate-pulse', config.color)} />
      <span className="text-xs font-bold text-text-primary">{config.name}</span>
      <span className="text-[10px] font-mono text-text-muted uppercase">{config.token}</span>
      {status !== 'live' && (
        <span className="text-[10px] font-bold uppercase tracking-tighter text-brand">
          {status}
        </span>
      )}
    </div>
  );
}
