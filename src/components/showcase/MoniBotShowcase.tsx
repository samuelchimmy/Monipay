import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Bot, Heart, MessageCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { XExhibitBadge } from '@/components/XExhibitBadge';

// --- Data ---
const TWEETS = [
  {
    id: 1, author: '@monibot', avatar: '🤖',
    text: 'Campaign alert! First 5 to drop their monitag get $1 each 🔵',
    time: '2m', replies: 12, likes: 5, link: 'https://x.com/monibot', hasReply: false,
  },
  {
    id: 2, author: '@jade_dev', avatar: '💎',
    text: '@monibot send $1 to @alice', time: '5m', replies: 1, likes: 2,
    link: 'https://x.com/monibot', hasReply: true,
    reply: { author: '@monibot', avatar: '🤖', text: "Sent! 🔵 $0.95 landed safely in alice's wallet." },
  },
  {
    id: 3, author: '@crypto_mark', avatar: '🚀',
    text: '@monibot crypto_mark', time: '8m', replies: 1, likes: 3,
    link: 'https://x.com/monibot', hasReply: true,
    reply: { author: '@monibot', avatar: '🤖', text: "Transfer confirmed ✅ You're on Base with MoniPay." },
  },
];

const STATS = [
  { label: 'Autonomous Budget', value: 50, prefix: '$', suffix: '' },
  { label: 'Grants Issued', value: 17, prefix: '', suffix: '' },
  { label: 'Bot Transactions', value: 59, prefix: '', suffix: '' },
  { label: 'Users Onboarded', value: 16, prefix: '', suffix: '' },
];

// --- Sub-components ---
function AnimatedCounter({ value, prefix, suffix }: { value: number; prefix: string; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);

  return (
    <span ref={ref} className="text-3xl font-extrabold text-foreground font-['Montserrat']">
      {prefix}{count}{suffix}
    </span>
  );
}

function TweetCard({ tweet, showReply }: { tweet: typeof TWEETS[0]; showReply: boolean }) {
  return (
    <motion.a
      href={tweet.link} target="_blank" rel="noopener noreferrer"
      className="block p-4 rounded-xl bg-background/60 border border-border/40 hover:border-primary/30 hover:bg-background/90 transition-all duration-200 cursor-pointer group"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
    >
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">{tweet.avatar}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-foreground">{tweet.author}</span>
            <span className="text-xs text-muted-foreground">· {tweet.time}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-sm text-foreground leading-relaxed">{tweet.text}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageCircle className="w-3.5 h-3.5" /> {tweet.replies}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="w-3.5 h-3.5" /> {tweet.likes}</span>
          </div>
        </div>
      </div>
      {tweet.hasReply && tweet.reply && (
        <AnimatePresence>
          {showReply && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.4, delay: 1.5 }} className="mt-3 ml-6 pl-4 border-l-2 border-primary/30">
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm flex-shrink-0">{tweet.reply.avatar}</div>
                <div>
                  <span className="text-xs font-bold text-primary">{tweet.reply.author}</span>
                  <p className="text-xs text-foreground mt-0.5">{tweet.reply.text}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.a>
  );
}

// --- Main Component ---
export function MoniBotShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= TWEETS.length) {
          clearInterval(interval);
          return prev;
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 px-4 relative">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-primary/3 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-5 gap-5 lg:gap-6">
          {/* Main MoniBot Feed Card (3 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-3 rounded-3xl border border-primary/15 bg-card/60 backdrop-blur-xl p-6 lg:p-8 relative overflow-hidden group shadow-xl shadow-primary/5 ring-1 ring-white/5"
          >
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/8 rounded-full blur-3xl group-hover:bg-primary/15 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            <div className="relative z-10">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="mb-1"
              >
                <span className="inline-flex items-center bg-primary/10 text-primary rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-3">
                  Agentic Commerce
                </span>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.12, duration: 0.5 }}
                className="text-3xl lg:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-1"
              >
                MoniBot
              </motion.h2>
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-lg lg:text-xl font-bold text-primary/70 font-['Montserrat'] tracking-tight mb-4"
              >
                Intelligent Social Financial Layer
              </motion.h3>
              <p className="text-sm font-medium text-muted-foreground mb-6 max-w-md leading-relaxed">
                The first autonomous AI agent for on-chain commerce. Run gasless campaigns, P2P payments, and multi-recipient airdrops — all through natural language on Twitter. No wallets, no signing, no friction.
              </p>

              {/* Tweet feed */}
              <div className="bg-background/60 backdrop-blur-sm border border-border/30 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center gap-2 pb-3 border-b border-border/30">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">MoniBot Feed</p>
                    <p className="text-[9px] text-muted-foreground">Live activity</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[9px] text-success font-bold">Online</span>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <TweetCard key={activeIndex} tweet={TWEETS[activeIndex]} showReply={true} />
                </AnimatePresence>

                <div className="flex justify-center gap-1.5 pt-1">
                  {TWEETS.map((_, i) => (
                    <button key={i} onClick={() => setActiveIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? 'bg-primary w-5' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}`}
                    />
                  ))}
                </div>
              </div>

              <Button variant="ghost"
                className="group/btn mt-4 text-sm font-bold px-0 hover:bg-transparent"
                onClick={() => window.open('https://x.com/monibot', '_blank', 'noopener,noreferrer')}
              >
                Try @monibot on Twitter
                <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
              <div className="mt-3">
                <XExhibitBadge variant="pill" />
              </div>
            </div>
          </motion.div>

          {/* Right column - Stats (2 cols) */}
          <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-5">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-primary/10 bg-card/60 backdrop-blur-xl p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/5 ring-1 ring-white/5"
              >
                <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] font-['Montserrat']">
                    {stat.label}
                  </p>
                  <div className="w-2 h-2 rounded-full bg-success/60 animate-pulse" />
                </div>
                <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${Math.min((stat.value / (stat.prefix === '$' ? 100 : 60)) * 100, 100)}%` } : {}}
                    transition={{ delay: 0.5 + i * 0.15, duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
