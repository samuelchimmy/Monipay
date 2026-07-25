import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { AtSign, Globe, Search, Shield, UserCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXAMPLE_TAGS = [
{ tag: '@alice', status: 'Verified', balance: '$142.50', avatar: '👩‍💻' },
{ tag: '@merchant_xyz', status: 'Merchant', balance: '$2,340.00', avatar: '🏪' },
{ tag: '@jade_dev', status: 'Verified', balance: '$87.25', avatar: '💎' }];


const FEATURES = [
{ icon: AtSign, title: 'Human-Readable Identity', desc: 'Replace 42-character hex addresses with simple @tags. Send to @alice instead of 0x4f2e...a3b1.' },
{ icon: Globe, title: 'Cross-Platform', desc: 'Your MoniTag works across the app, Twitter via MoniBot, payment links, invoices, and the checkout API.' },
{ icon: Search, title: 'Instant Lookup', desc: 'Type any @tag to instantly resolve the wallet address, verify identity, and initiate a payment.' },
{ icon: Shield, title: 'Immutable Registry', desc: 'Tags are registered on-chain and linked to your wallet. No duplicates, no spoofing, fully verifiable.' }];


export function MoniTagShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 px-4 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 w-80 h-80 bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
          {/* Left: MoniTag identity card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5">

            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/8 rounded-full blur-3xl group-hover:bg-primary/15 transition-all duration-700" />
            <div className="absolute top-0 right-0 w-full h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent" />

            <div className="relative z-10">
              <span className="inline-flex items-center bg-primary/10 text-primary rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-3">
                Identity Layer
              </span>
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-3xl lg:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-1">

                MoniTag
              </motion.h2>
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-lg lg:text-xl font-bold font-['Montserrat'] uppercase tracking-tight mb-4 text-muted-foreground">

                Your On-Chain Username
              </motion.h3>
              <p className="text-sm font-medium text-muted-foreground mb-6 max-w-md leading-relaxed">
                A universal payment identity. Your @tag replaces complex wallet addresses everywhere in the app, on Twitter, in invoices, and across the checkout API.
              </p>

              {/* Live tag directory preview */}
              <div className="bg-background/60 backdrop-blur-sm border border-border/30 rounded-2xl p-4 shadow-inner">
                <div className="flex items-center gap-2 pb-3 border-b border-border/30 mb-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">MoniTag Directory</p>
                    <p className="text-[9px] text-muted-foreground">On-chain identity registry</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {EXAMPLE_TAGS.map((user, i) =>
                  <motion.div
                    key={user.tag}
                    initial={{ opacity: 0, x: -15 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">

                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{user.tag}</span>
                          <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{user.status}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Balance: {user.balance}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <Button variant="ghost"
              className="group/btn mt-4 text-sm font-bold px-0 hover:bg-transparent"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>

                Claim your @tag
                <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          {/* Right: Features grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5">

            <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-700" />

            <div className="relative z-10 h-full flex flex-col">
              <h3 className="text-xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-6">
                Why MoniTag?
              </h3>

              <div className="space-y-4 flex-1">
                {FEATURES.map((f, i) =>
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: 20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border/30 hover:border-primary/20 hover:shadow-sm transition-all duration-200">

                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <f.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-foreground block">{f.title}</span>
                      <span className="text-xs text-muted-foreground">{f.desc}</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>);

}