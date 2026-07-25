import { Link, useLocation } from 'react-router-dom';

const CHAINS = [
  { path: '/', label: 'Home' },
  { path: '/base', label: 'Base' },
  { path: '/bsc', label: 'BSC' },
  { path: '/solana', label: 'Solana' },
  { path: '/ink', label: 'Ink' },
  { path: '/tempo', label: 'Tempo' },
  { path: '/minipay', label: 'Celo' },
  { path: '/arc', label: 'Arc' },
  { path: '/monibot', label: 'MoniBot' },
];

export function ChainCrossLinks() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col items-center gap-2 py-6 px-4">
      <span className="text-[10px] uppercase tracking-widest text-foreground/20">Also on</span>
      <div className="flex items-center justify-center gap-2 flex-wrap">
      {CHAINS.filter((c) => c.path !== pathname).map((chain) => (
        <Link
          key={chain.path}
          to={chain.path}
          className="text-[11px] px-3 py-1 rounded-full border border-foreground/10 text-foreground/40 hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          {chain.label}
        </Link>
      ))}
      </div>
    </div>
  );
}
