import { useState, useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Smartphone, Nfc, Check, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  { label: 'Merchant enters amount', icon: '💰', detail: '$12.50' },
  { label: 'Customer taps phone', icon: '📱', detail: 'NFC / QR' },
  { label: 'Payment confirmed', icon: '✅', detail: '< 2 seconds' },
];

export function TapToPayShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 px-4 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/3 w-80 h-80 bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
          {/* Left: Visual demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5"
          >
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/8 rounded-full blur-3xl group-hover:bg-primary/15 transition-all duration-700" />
            <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent" />

            <div className="relative z-10">
              <span className="inline-flex items-center bg-primary/10 text-primary rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-3">
                Point of Sale
              </span>
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-3xl lg:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-1"
              >
                Tap to Pay
              </motion.h2>
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-lg lg:text-xl font-bold font-['Montserrat'] uppercase tracking-tight mb-4 text-muted-foreground"
              >
                Contactless Commerce
              </motion.h3>
              <p className="text-sm font-medium text-muted-foreground mb-8 max-w-md leading-relaxed">
                Turn any phone into a payment terminal. Merchants enter amounts on a keypad, customers scan a QR — settlement in under 2 seconds with zero hardware.
              </p>

              {/* Animated POS demo */}
              <div className="bg-background/60 backdrop-blur-sm border border-border/30 rounded-2xl p-5 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs font-bold text-foreground">MoniPay POS</span>
                  </div>
                  <span className="text-[9px] font-bold text-success flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Ready
                  </span>
                </div>

                {/* Amount display */}
                <div className="text-center mb-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-4xl font-extrabold text-foreground font-['Montserrat']">
                        {activeStep >= 0 ? '$12.50' : '$0.00'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{STEPS[activeStep].label}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Step indicators */}
                <div className="flex gap-2">
                  {STEPS.map((step, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        backgroundColor: i <= activeStep ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      }}
                      className="flex-1 h-1.5 rounded-full transition-colors"
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Features */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5"
          >
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-700" />

            <div className="relative z-10 h-full flex flex-col">
              <h3 className="text-xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-6">
                How It Works
              </h3>

              <div className="space-y-4 flex-1">
                {[
                  { icon: Smartphone, title: 'Open POS Mode', desc: 'Switch to Merchant mode and enter the amount on your keypad — any phone becomes a terminal.' },
                  { icon: Nfc, title: 'Customer Scans QR', desc: 'A branded QR code is generated instantly. Customer scans with their MoniPay app or camera.' },
                  { icon: Zap, title: 'Gasless Settlement', desc: 'Transaction is relayed gaslessly via meta-transactions. Funds arrive in your wallet in under 2 seconds.' },
                  { icon: Check, title: 'Instant Receipt', desc: 'Both parties receive a printable receipt with full transaction details and on-chain verification.' },
                ].map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, x: 20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.25 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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

              <Button variant="ghost"
                className="group/btn mt-4 text-sm font-bold px-0 hover:bg-transparent self-start"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Get started
                <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
