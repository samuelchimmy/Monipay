import { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowDown, ArrowRight, Wallet, Globe, Shield,
  Zap, CheckCircle2, ExternalLink
} from 'lucide-react';
import {
  NetworkEthereum,
  NetworkArbitrumOne,
  NetworkOptimism,
  NetworkBase,
  NetworkBinanceSmartChain,
  TokenUSDC,
  TokenUSDT,
} from '@web3icons/react';

/* ─── Across Protocol icon ─── */
function AcrossIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#6CF9D8" />
      <path d="M8 22L16 8L24 22H20L16 14L12 22H8Z" fill="#2D2D2D" />
    </svg>
  );
}

/* ─── Reveal wrapper ─── */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Animated bridge flow ─── */
const BRIDGE_ROUTES = [
  { from: 'Ethereum', fromIcon: 'eth', token: 'ETH', to: 'Base', toToken: 'USDC' },
  { from: 'Arbitrum', fromIcon: 'arb', token: 'USDC', to: 'Base', toToken: 'USDC' },
  { from: 'Optimism', fromIcon: 'op', token: 'USDT', to: 'BSC', toToken: 'USDT' },
  { from: 'Ethereum', fromIcon: 'eth', token: 'DAI', to: 'BSC', toToken: 'USDT' },
];

function BridgeAnimation() {
  const [activeRoute, setActiveRoute] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'bridging' | 'done'>('idle');

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase('bridging');
      setTimeout(() => setPhase('done'), 1200);
      setTimeout(() => {
        setPhase('idle');
        setActiveRoute(i => (i + 1) % BRIDGE_ROUTES.length);
      }, 2400);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const route = BRIDGE_ROUTES[activeRoute];
  const isBase = route.to === 'Base';

  function SourceIcon({ size = 22 }: { size?: number }) {
    switch (route.fromIcon) {
      case 'eth': return <NetworkEthereum size={size} variant="branded" />;
      case 'arb': return <NetworkArbitrumOne size={size} variant="branded" />;
      case 'op': return <NetworkOptimism size={size} variant="branded" />;
      default: return <NetworkEthereum size={size} variant="branded" />;
    }
  }

  return (
    <div className="relative">
      {/* Bridge flow visualization */}
      <div className="flex items-center justify-between gap-3">
        {/* Source */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${route.from}-${route.token}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 border border-foreground/10 p-4 bg-background"
          >
            <div className="flex items-center gap-2 mb-2">
              <SourceIcon size={18} />
              <span className="text-xs font-bold text-foreground">{route.from}</span>
            </div>
            <span className="text-lg font-extrabold text-foreground">100 {route.token}</span>
          </motion.div>
        </AnimatePresence>

        {/* Arrow with animation */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <motion.div
            animate={{
              x: phase === 'bridging' ? [0, 8, 0] : 0,
              scale: phase === 'done' ? [1, 1.2, 1] : 1,
            }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {phase === 'done' ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <ArrowRight className={`w-5 h-5 ${phase === 'bridging' ? 'text-foreground' : 'text-foreground/20'}`} />
            )}
          </motion.div>
          <span className="text-[8px] font-bold text-foreground/20 uppercase tracking-wider">
            {phase === 'bridging' ? 'Bridging' : phase === 'done' ? 'Done' : 'Across'}
          </span>
        </div>

        {/* Destination */}
        <div className={`flex-1 border p-4 ${isBase ? 'border-[#0052FF]/20 bg-[#0052FF]/5' : 'border-[#F0B90B]/20 bg-[#F0B90B]/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isBase ? (
              <NetworkBase size={18} variant="branded" />
            ) : (
              <NetworkBinanceSmartChain size={18} variant="branded" />
            )}
            <span className="text-xs font-bold text-foreground">{route.to}</span>
          </div>
          <motion.span
            animate={{ opacity: phase === 'done' ? 1 : 0.4 }}
            className={`text-lg font-extrabold ${isBase ? 'text-[#0052FF]' : 'text-[#F0B90B]'}`}
          >
            ~100 {route.toToken}
          </motion.span>
        </div>
      </div>

      {/* Route indicators */}
      <div className="flex justify-center gap-1.5 mt-4">
        {BRIDGE_ROUTES.map((_, i) => (
          <div
            key={i}
            className={`h-1 transition-all duration-300 ${
              i === activeRoute ? 'w-6 bg-foreground' : 'w-1.5 bg-foreground/10'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Main Section ─── */
export function CrossChainShowcase() {
  return (
    <section className="px-6 lg:px-16 py-20 lg:py-24 border-t border-foreground/5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between mb-14">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 block mb-2">Funding</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                Fund From Anywhere
              </h2>
            </div>
            <span className="hidden md:block text-xs text-foreground/30 max-w-xs text-right">
              Bridge any token from any chain directly into your MoniPay wallet.
            </span>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10">
          {/* Left — Bridge Demo */}
          <Reveal>
            <div className="bg-background p-6 lg:p-8 min-h-[360px] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AcrossIcon size={18} />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">Cross-Chain Bridge</span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Powered by Across Protocol
                </h3>
                <p className="text-[11px] text-foreground/40 leading-relaxed mb-6 max-w-sm">
                  Bridge ETH, USDC, USDT, DAI from 15+ chains including Ethereum, Arbitrum, Optimism, 
                  zkSync, Mode, World Chain and more. Arrives in ~5 seconds.
                </p>
              </div>
              <BridgeAnimation />
            </div>
          </Reveal>

          {/* Right — Feature cards */}
          <div className="grid grid-rows-2 gap-px bg-foreground/10">
            <Reveal delay={0.06}>
              <div className="bg-background p-6 lg:p-8 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Shield className="w-4 h-4 text-foreground/20 mb-3" />
                    <h4 className="text-xs font-bold text-foreground mb-1">Locked Destination</h4>
                    <p className="text-[10px] text-foreground/40 leading-relaxed">
                      Funds always arrive at your MoniPay address. No manual address entry — no mistakes.
                    </p>
                  </div>
                  <div>
                    <Wallet className="w-4 h-4 text-foreground/20 mb-3" />
                    <h4 className="text-xs font-bold text-foreground mb-1">Any Source Wallet</h4>
                    <p className="text-[10px] text-foreground/40 leading-relaxed">
                      Use your existing tokens on any EVM chain. No need to manually swap first.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="bg-background p-6 lg:p-8 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Zap className="w-4 h-4 text-foreground/20 mb-3" />
                    <h4 className="text-xs font-bold text-foreground mb-1">Instant Settlement</h4>
                    <p className="text-[10px] text-foreground/40 leading-relaxed">
                      L2-to-L2 bridges complete in ~5 seconds. Funds appear in your wallet automatically.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-3">
                      <NetworkEthereum size={14} variant="branded" />
                      <NetworkArbitrumOne size={14} variant="branded" />
                      <NetworkOptimism size={14} variant="branded" />
                    </div>
                    <h4 className="text-xs font-bold text-foreground mb-1">15+ Chains Supported</h4>
                    <p className="text-[10px] text-foreground/40 leading-relaxed">
                      Ethereum, Arbitrum, Optimism, Polygon, zkSync, Mode, World Chain and more via Across.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Bottom strip — supported tokens */}
        <Reveal delay={0.15}>
          <div className="border border-foreground/10 border-t-0 bg-background p-4 flex flex-wrap items-center justify-center gap-6">
            {[
              { icon: <NetworkEthereum size={16} variant="branded" />, label: 'ETH' },
              { icon: <TokenUSDC size={16} variant="branded" />, label: 'USDC' },
              { icon: <TokenUSDT size={16} variant="branded" />, label: 'USDT' },
              { icon: <span className="text-xs">◆</span>, label: 'DAI' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-1.5 text-foreground/30">
                {t.icon}
                <span className="text-[10px] font-bold tracking-wide">{t.label}</span>
              </div>
            ))}
            <span className="text-[10px] text-foreground/15">+ more via Across</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
