import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useInView } from 'framer-motion';
import {
  TokenUSDC,
  TokenUSDT,
  NetworkBase,
  NetworkBinanceSmartChain,
  NetworkEthereum,
  NetworkArbitrumOne,
  NetworkOptimism,
  ExchangeCoinbase,
  ExchangeBinance,
  WalletMetamask,
} from '@web3icons/react';

/* ─── Across Protocol icon ─── */
function AcrossIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#6CF9D8" />
      <path d="M8 22L16 8L24 22H20L16 14L12 22H8Z" fill="#2D2D2D" />
    </svg>
  );
}

const LOGOS = [
  { name: 'Base', Icon: NetworkBase },
  { name: 'BNB Chain', Icon: NetworkBinanceSmartChain },
  { name: 'Ethereum', Icon: NetworkEthereum },
  { name: 'Arbitrum', Icon: NetworkArbitrumOne },
  { name: 'Optimism', Icon: NetworkOptimism },
  { name: 'USDC', Icon: TokenUSDC },
  { name: 'USDT', Icon: TokenUSDT },
  { name: 'Coinbase', Icon: ExchangeCoinbase },
  { name: 'Binance', Icon: ExchangeBinance },
  { name: 'MetaMask', Icon: WalletMetamask },
  { name: 'Across', Icon: AcrossIcon },
];

// Duplicate for seamless loop
const DOUBLE_LOGOS = [...LOGOS, ...LOGOS];

export function LogoCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <section ref={ref} className="py-16 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto px-4"
      >
        <div className="py-10 px-6 lg:px-12">
          <p className="text-center text-sm lg:text-base font-semibold text-muted-foreground mb-8 max-w-xl mx-auto">
            Built on industry-leading infrastructure. Bridge from 15+ chains with Across Protocol.
          </p>

          {/* Scrolling logos */}
          <div className="relative overflow-hidden">
          {/* Fade edges - seamless transparent */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background via-background/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background via-background/60 to-transparent z-10 pointer-events-none" />

            <motion.div
              animate={{ x: ['0%', '-50%'] }}
              transition={{
                x: { duration: 30, repeat: Infinity, ease: 'linear' },
              }}
              className="flex items-center gap-10 lg:gap-14 w-max"
            >
              {DOUBLE_LOGOS.map((logo, i) => (
                <div
                  key={`${logo.name}-${i}`}
                  className="flex items-center gap-2.5 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <logo.Icon size={28} variant="branded" />
                  <span className="text-sm lg:text-base font-bold text-foreground tracking-wide whitespace-nowrap">
                    {logo.name}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
