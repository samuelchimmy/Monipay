import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getCeloTokenBalance } from '@/lib/celoWallet';
import { usePayTag } from '@/contexts/PayTagContext';
import { TokenIcon } from '@/components/TokenIcon';

interface CeloHoldingsCollapseProps {
  walletAddress: string;
  /** Force a color theme regardless of PayTag mode. 'light' = black text on light bg, 'dark' = white text on dark bg. */
  forceTheme?: 'light' | 'dark';
  /** Restrict which tokens render. Defaults to all four (USDT, USDC, USDm, G$). */
  tokens?: Array<'USDT' | 'USDC' | 'USDm' | 'G$'>;
  /** Override the section title. */
  title?: string;
}

export function CeloHoldingsCollapse({ walletAddress, forceTheme, tokens, title }: CeloHoldingsCollapseProps) {
  const { mode } = usePayTag();
  const isMerchant = forceTheme ? forceTheme === 'light' : mode === 'merchant';

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [g$Price, setG$Price] = useState<number>(0.00018);
  const [balances, setBalances] = useState<{ USDT: number; USDC: number; USDm: number; G$: number }>({
    USDT: 0,
    USDC: 0,
    USDm: 0,
    G$: 0,
  });

  const fetchG$Price = async (): Promise<number> => {
    try {
      const res = await fetch("https://api.coingecko.com/v3/simple/price?ids=gooddollar&vs_currencies=usd");
      if (res.ok) {
        const json = await res.json();
        const price = json.gooddollar?.usd;
        if (typeof price === 'number' && price > 0) return price;
      }
    } catch (e) {
      console.warn("[G$ Price Fetch] Failed:", e);
    }
    return 0.00018;
  };

  useEffect(() => {
    if (!walletAddress || !expanded) return;

    let active = true;
    setLoading(true);

    const loadBalances = async () => {
      try {
        const [usdt, usdc, usdm, g$, price] = await Promise.all([
          getCeloTokenBalance(walletAddress as `0x${string}`, '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', 6),
          getCeloTokenBalance(walletAddress as `0x${string}`, '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', 6),
          getCeloTokenBalance(walletAddress as `0x${string}`, '0x765DE816845861e75A25fCA122bb6898B8B1282a', 18),
          getCeloTokenBalance(walletAddress as `0x${string}`, '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', 18),
          fetchG$Price()
        ]);

        if (active) {
          setBalances({
            USDT: Number.isFinite(usdt) ? usdt : 0,
            USDC: Number.isFinite(usdc) ? usdc : 0,
            USDm: Number.isFinite(usdm) ? usdm : 0,
            G$: Number.isFinite(g$) ? g$ : 0,
          });
          setG$Price(price);
        }
      } catch (err) {
        console.error('Failed to load Celo holdings:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBalances();

    return () => {
      active = false;
    };
  }, [walletAddress, expanded]);

  // Color theme classes dynamically mapping user/merchant card backgrounds
  const textTitle = isMerchant ? 'text-black/60 hover:text-black/80' : 'text-white/70 hover:text-white/90';
  const loaderColor = isMerchant ? 'text-black/40' : 'text-white/40';
  const borderColor = isMerchant ? 'border-black/10' : 'border-white/10';
  const itemBg = isMerchant ? 'bg-black/[0.04] hover:bg-black/[0.08] border-black/[0.03]' : 'bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.04]';
  const tokenSymbolColor = isMerchant ? 'text-black/80' : 'text-white/90';
  const tokenNameColor = isMerchant ? 'text-black/45' : 'text-white/60';
  const balanceColor = isMerchant ? 'text-black' : 'text-white';
  const valueColor = isMerchant ? 'text-black/50' : 'text-white/65';

  const ALL_TOKENS = [
    { 
      symbol: 'USDT', 
      balance: balances.USDT, 
      value: balances.USDT, 
      name: 'Tether USDT', 
      Icon: () => <TokenIcon symbol="USDT" size={16} /> 
    },
    { 
      symbol: 'USDC', 
      balance: balances.USDC, 
      value: balances.USDC, 
      name: 'USD Coin', 
      Icon: () => <TokenIcon symbol="USDC" size={16} /> 
    },
    { 
      symbol: 'USDm', 
      balance: balances.USDm, 
      value: balances.USDm, 
      name: 'Mento USDm', 
      Icon: () => <TokenIcon symbol="USDm" size={16} /> 
    },
    { 
      symbol: 'G$', 
      balance: balances.G$, 
      value: balances.G$ * g$Price, 
      name: 'GoodDollar', 
      Icon: () => <TokenIcon symbol="G$" size={16} /> 
    }
  ];
  const CELO_TOKENS_LIST = tokens
    ? ALL_TOKENS.filter((t) => tokens.includes(t.symbol as any))
    : ALL_TOKENS;

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full py-1.5 flex items-center justify-between text-[11px] font-bold transition-colors border-t ${textTitle} ${borderColor}`}
      >
        <span className="uppercase tracking-wider">{title ?? 'Celo Holdings Breakdown'}</span>
        <div className="flex items-center gap-1">
          {loading && <Loader2 className={`w-3 h-3 animate-spin ${loaderColor}`} />}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pt-2 pb-1.5">
              {CELO_TOKENS_LIST.map((token) => (
                <div 
                  key={token.symbol} 
                  className={`flex items-center justify-between py-1.5 px-2.5 rounded-xl border transition-colors ${itemBg}`}
                >
                  <div className="flex items-center gap-2">
                    <token.Icon />
                    <div className="leading-tight">
                      <div className="flex items-center gap-1">
                        <span className={`text-[11px] font-extrabold ${tokenSymbolColor}`}>{token.symbol}</span>
                      </div>
                      <p className={`text-[8px] font-semibold tracking-wide uppercase ${tokenNameColor}`}>{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right leading-tight">
                    <span className={`text-[11px] font-black ${balanceColor}`}>
                      {token.balance.toLocaleString(undefined, { 
                        minimumFractionDigits: token.symbol === 'G$' ? 0 : 2, 
                        maximumFractionDigits: token.symbol === 'G$' ? 0 : 2 
                      })}
                    </span>
                    <p className={`text-[8px] font-extrabold ${valueColor}`}>
                      ${token.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
