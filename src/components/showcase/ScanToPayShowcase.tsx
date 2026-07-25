import { useState, useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ScanLine, QrCode, ShieldCheck, Wallet, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SCAN_MODES = [
{ label: 'MoniPay QR', desc: 'Scan a branded QR to auto-fill PayTag and amount — one-tap payment.', badge: 'Fastest' },
{ label: 'External Wallet', desc: 'Scan any wallet address QR to send USDC/USDT directly on-chain.', badge: 'Universal' },
{ label: 'Payment Link', desc: 'Scan a merchant payment link QR to complete checkout instantly.', badge: 'Commerce' }];


export function ScanToPayShowcase() {
  const [activeMode, setActiveMode] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setActiveMode((prev) => (prev + 1) % SCAN_MODES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 px-4 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-success/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-5 gap-5 lg:gap-6">
          {/* Main card (3 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-3 rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5">

            <div className="absolute -top-20 -right-20 w-40 h-40 bg-success/8 rounded-full blur-3xl group-hover:bg-success/15 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-success/20 to-transparent" />

            <div className="relative z-10">
              <span className="inline-flex items-center bg-success/10 text-success rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-3">
                Universal Scanner
              </span>
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-3xl lg:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-1">

                Scan to Pay
              </motion.h2>
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-lg lg:text-xl font-bold font-['Montserrat'] uppercase tracking-tight mb-4 text-muted-foreground">

                Intelligent QR Recognition
              </motion.h3>
              <p className="text-sm font-medium text-muted-foreground mb-6 max-w-md leading-relaxed">
                One scanner, every payment. MoniPay's smart QR reader auto-detects whether you're scanning a branded PayTag QR, an external wallet address, or a payment link and routes accordingly.
              </p>

              {/* Scan mode carousel */}
              <div className="bg-background/60 backdrop-blur-sm border border-border/30 rounded-2xl p-5 shadow-inner">
                {/* Scanner visualization */}
                <div className="relative w-full aspect-[2/1] bg-muted/30 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
                  <motion.div
                    animate={{ y: [-40, 40, -40] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-[80%] h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <QrCode className="w-12 h-12 text-muted-foreground/30" />
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeMode}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="text-center">

                        <span className="inline-flex items-center bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                          {SCAN_MODES[activeMode].badge}
                        </span>
                        <p className="text-sm font-bold text-foreground mt-1.5">{SCAN_MODES[activeMode].label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[280px]">{SCAN_MODES[activeMode].desc}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Dots */}
                <div className="flex justify-center gap-1.5">
                  {SCAN_MODES.map((_, i) =>
                  <button
                    key={i}
                    onClick={() => setActiveMode(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeMode ? 'bg-primary w-5' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}`} />

                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right sidebar cards (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-5 lg:gap-6">
            {[
            { icon: ScanLine, title: 'Smart Detection', desc: 'Automatically distinguishes between MoniPay QR codes, raw wallet addresses, and payment link URLs — no manual selection needed.', color: 'primary' },
            { icon: ShieldCheck, title: 'Secure Signing', desc: 'Every payment is signed locally with your PIN-encrypted key. No private data leaves your device during scanning.', color: 'primary' },
            { icon: Wallet, title: 'Multi-Wallet Support', desc: 'Scan QR codes from Metamask, Trust Wallet, Binance, or any wallet. MoniPay sends directly to any valid address on Base or BSC.', color: 'success' }].
            map((card, i) =>
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 flex-1 shadow-lg hover:shadow-xl hover:shadow-primary/5 ring-1 ring-white/5">

                <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className={`w-10 h-10 rounded-xl bg-${card.color}/10 flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 text-${card.color}`} />
                </div>
                <h4 className="text-base font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-2">
                  {card.title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                  {card.desc}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>);

}