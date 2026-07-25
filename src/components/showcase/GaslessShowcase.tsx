import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, X, Check, ShieldCheck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function GaslessShowcase() {
  const [showMoniPay, setShowMoniPay] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });
  const navigate = useNavigate();

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 px-4 relative">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-primary/4 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-5 gap-5 lg:gap-6">
          {/* Main gasless comparison card (3 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-3 rounded-2xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5"
          >
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/8 rounded-full blur-3xl group-hover:bg-primary/15 transition-all duration-700" />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            <div className="relative z-10">
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-3xl lg:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-1"
              >
                Gasless
              </motion.h2>
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-lg lg:text-xl font-bold font-['Montserrat'] uppercase tracking-tight mb-4 text-muted-foreground"
              >
                Transactions
              </motion.h3>
              <p className="text-sm font-medium text-muted-foreground mb-6 max-w-md">
                Enable seamless transactions with sponsored network fees, abstracting away the friction.
              </p>

              {/* Toggle */}
              <div className="flex mb-6">
                <div className="bg-muted/50 rounded-full p-1 flex">
                  <button
                    onClick={() => setShowMoniPay(false)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      !showMoniPay ? 'bg-destructive text-destructive-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Traditional
                  </button>
                  <button
                    onClick={() => setShowMoniPay(true)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      showMoniPay ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    MoniPay
                  </button>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Traditional */}
                <motion.div
                  animate={{ opacity: showMoniPay ? 0.4 : 1, scale: showMoniPay ? 0.97 : 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-background/60 border border-border/30 rounded-2xl p-5 relative"
                >
                  {!showMoniPay && (
                    <span className="absolute top-3 right-3 bg-destructive/10 text-destructive text-[9px] font-bold px-2 py-0.5 rounded-full">
                      Current Standard
                    </span>
                  )}
                  <h4 className="text-sm font-bold text-foreground mb-4">Traditional Crypto</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">Transaction</span>
                      <span className="text-sm font-extrabold text-foreground">$10.00</span>
                    </div>
                    <div className="flex justify-between items-center bg-destructive/5 -mx-2 px-2 py-1.5 rounded-lg">
                      <span className="text-xs text-destructive font-bold">Gas Fee</span>
                      <span className="text-sm font-extrabold text-destructive">-$2.34</span>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">You Receive</span>
                      <span className="text-lg font-extrabold text-foreground">$7.66</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-destructive font-bold">
                    <X className="w-3 h-3" />
                    <span>23% lost to gas fees</span>
                  </div>
                </motion.div>

                {/* MoniPay */}
                <motion.div
                  animate={{ opacity: showMoniPay ? 1 : 0.4, scale: showMoniPay ? 1 : 0.97 }}
                  transition={{ duration: 0.3 }}
                  className="bg-background/60 border-2 border-primary/20 rounded-2xl p-5 relative"
                >
                  {showMoniPay && (
                    <span className="absolute top-3 right-3 bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full">
                      ✨ MoniPay
                    </span>
                  )}
                  <h4 className="text-sm font-bold text-foreground mb-4">With MoniPay</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">Transaction</span>
                      <span className="text-sm font-extrabold text-foreground">$10.00</span>
                    </div>
                    <div className="flex justify-between items-center bg-success/5 -mx-2 px-2 py-1.5 rounded-lg">
                      <span className="text-xs text-success font-bold">Gas Fee</span>
                      <span className="text-sm font-extrabold text-success">$0.00</span>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">You Receive</span>
                      <span className="text-lg font-extrabold text-success">$10.00</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] text-success font-bold">
                    <Check className="w-3 h-3" />
                    <span>100% received — we pay the gas</span>
                  </div>
                  {showMoniPay && (
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                  )}
                </motion.div>
              </div>

              <Button variant="ghost"
                className="group/btn mt-4 text-sm font-bold px-0 hover:bg-transparent"
                onClick={() => navigate('/how-it-works')}
              >
                Learn how it works
                <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          {/* Right column - info cards (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-5 lg:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 flex-1 shadow-lg hover:shadow-xl hover:shadow-primary/5 ring-1 ring-white/5"
            >
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-base font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-2">
                Non-Custodial
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Your keys, your crypto. MoniPay never holds or has access to your funds. Sign transactions locally with your PIN-encrypted private key.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 flex-1 shadow-lg hover:shadow-xl hover:shadow-primary/5 ring-1 ring-white/5"
            >
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-success/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                <CreditCard className="w-5 h-5 text-success" />
              </div>
              <h4 className="text-base font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-2">
                Checkout API
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Accept stablecoin payments through branded checkout flows or API-generated links. Stripe-like experience powered by blockchain.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
