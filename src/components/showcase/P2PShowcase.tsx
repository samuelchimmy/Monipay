import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ArrowRight, Zap, Globe, MessageSquare, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NetworkBase, NetworkBinanceSmartChain } from '@web3icons/react';

type Phase = 'tweet' | 'processing' | 'confirm' | 'receipt';

const PHASE_DURATION = { tweet: 2000, processing: 1200, confirm: 2000, receipt: 2800 };
const SEQUENCE: Phase[] = ['tweet', 'processing', 'confirm', 'receipt'];

const FEATURES = [
  { icon: Zap, title: 'Instant Settlement', desc: 'Transactions confirm on Base & BSC in seconds' },
  { icon: CreditCard, title: 'Zero Gas Fees', desc: 'MoniPay covers all network costs for users' },
  { icon: MessageSquare, title: 'Natural Language', desc: 'Just tweet @monibot send $5 to @alice' },
  { icon: Globe, title: 'Multi-Chain', desc: 'USDC on Base and USDT on BNB Smart Chain' },
];

export function P2PShowcase() {
  const [phase, setPhase] = useState<Phase>('tweet');
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!inView) return;
    let timeout: ReturnType<typeof setTimeout>;
    const advance = (current: Phase) => {
      if (current === 'receipt') return; // Stop at final state
      const idx = SEQUENCE.indexOf(current);
      const next = SEQUENCE[idx + 1];
      timeout = setTimeout(() => { setPhase(next); advance(next); }, PHASE_DURATION[current]);
    };
    advance('tweet');
    return () => clearTimeout(timeout);
  }, [inView]);

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 px-4 relative">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-success/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
          {/* Left: P2P demo card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5"
          >
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/8 rounded-full blur-3xl group-hover:bg-primary/15 transition-all duration-700" />
            <div className="absolute top-0 right-0 w-full h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent" />

            <div className="relative z-10">
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-3xl lg:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-1"
              >
                P2P
              </motion.h2>
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-lg lg:text-xl font-bold font-['Montserrat'] uppercase tracking-tight mb-4 text-muted-foreground"
              >
                Payments
              </motion.h3>
              <p className="text-sm font-medium text-muted-foreground mb-6">
                Send money via tweet. No app downloads. No wallet addresses. Just mention @monibot.
              </p>

              {/* Animated chat sequence */}
              <div className="flex flex-col gap-3 min-h-[220px] justify-center">
                <AnimatePresence>
                  {(phase === 'tweet' || phase === 'processing' || phase === 'confirm' || phase === 'receipt') && (
                    <motion.div key="tweet-bubble"
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="w-full"
                    >
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-bl-md px-4 py-3 shadow-lg max-w-[85%]">
                        <p className="text-sm font-bold">@monibot send $5 to @alice</p>
                        <p className="text-[10px] mt-1 opacity-70">via @sender</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {phase === 'processing' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1.5 py-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.5, delay: i * 0.15, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-muted-foreground/40"
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {(phase === 'confirm' || phase === 'receipt') && (
                    <motion.div key="confirm-bubble"
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="w-full flex justify-end"
                    >
                      <div className="bg-success/10 border border-success/30 text-foreground rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]">
                        <p className="text-sm font-bold">Sent! 🔵 $4.75 landed in alice's wallet</p>
                        <p className="text-[10px] mt-1 text-muted-foreground">via @monibot</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Button variant="ghost"
                className="group/btn mt-2 text-sm font-bold px-0 hover:bg-transparent"
                onClick={() => window.open('https://x.com/intent/tweet?text=%40monibot%20send%20%241%20to%20%40', '_blank', 'noopener,noreferrer')}
              >
                Try it now
                <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          {/* Right: Features list card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5"
          >
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-success/5 rounded-full blur-3xl group-hover:bg-success/10 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-success/20 to-transparent" />

            <div className="relative z-10 h-full flex flex-col">
              <motion.h2
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-3xl lg:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-1"
              >
                Multi-Chain
              </motion.h2>
              <motion.h3
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="text-lg lg:text-xl font-bold font-['Montserrat'] uppercase tracking-tight mb-6 text-muted-foreground"
              >
                & Multi-Asset
              </motion.h3>

              {/* Chain badges */}
              <div className="flex gap-3 mb-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1.5"
                >
                  <NetworkBase size={18} variant="branded" />
                  <span className="text-xs font-bold text-primary">Base · USDC</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.35, duration: 0.4 }}
                  className="flex items-center gap-2 bg-[hsl(45,100%,50%)]/10 rounded-full px-3 py-1.5"
                >
                  <NetworkBinanceSmartChain size={18} variant="branded" />
                  <span className="text-xs font-bold text-foreground">BSC · USDT</span>
                </motion.div>
              </div>

              <div className="space-y-3 flex-1">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, x: 20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border/30 hover:border-primary/20 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <f.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-foreground block">{f.title}</span>
                      <span className="text-xs text-muted-foreground">{f.desc}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
