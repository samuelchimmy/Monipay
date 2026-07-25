import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ReceiptCard } from './ReceiptCard';

const heroImage = '/monipay-phone.png';

export function ParallaxCards() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollY } = useScroll();
  
  // Subtle parallax transforms - cards move at different rates
  const receiptY = useTransform(scrollY, [0, 300], [0, -20]);
  const analyticsY = useTransform(scrollY, [0, 300], [0, -35]);
  const heroY = useTransform(scrollY, [0, 300], [0, -10]);

  return (
    <div ref={containerRef} className="flex-1 flex items-end justify-center relative pt-0 overflow-visible">
      {/* Floating Receipt Card - LEFT, close to hero with parallax */}
      <motion.div 
        style={{ y: receiptY }}
        className="absolute -left-[6%] xl:-left-[4%] top-[25%] -translate-y-1/2 z-20 will-change-transform"
      >
        <ReceiptCard />
      </motion.div>

      {/* Hero Image Container */}
      <div className="relative w-full max-w-md xl:max-w-lg mx-auto -mt-40">
        {/* Background circle - centered behind the hero image */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
        >
          <div className="w-[95%] aspect-square rounded-full bg-base-blue/10 dark:bg-base-blue/30 translate-y-[20%]" />
        </motion.div>

        {/* Main Hero Image with subtle parallax */}
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ 
            duration: 0.5, 
            ease: [0.16, 1, 0.3, 1],
            opacity: { duration: 0.3 },
            scale: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
          }}
          style={{ y: heroY }}
          className="relative z-10 will-change-transform"
        >
          <img 
            src={heroImage} 
            alt="Merchant accepting payment with MoniPay" 
            className="w-full h-auto max-h-[78vh] object-contain mx-auto pointer-events-none select-none"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        </motion.div>
      </div>

      {/* Floating Analytics Card - RIGHT, close to hero with parallax */}
      <motion.div
        initial={{ x: 15, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ y: analyticsY }}
        className="absolute -right-[6%] xl:-right-[4%] top-[10%] -translate-y-1/2 z-20 bg-card rounded-xl shadow-xl p-3 border border-border will-change-transform"
      >
        <div className="flex items-center justify-between mb-2 gap-8">
          <p className="text-[10px] font-medium text-muted-foreground">Spending Trend</p>
        </div>
        <div className="flex gap-4 text-[9px] mb-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-success" />
            <span className="text-muted-foreground">Money In</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-destructive/60" />
            <span className="text-muted-foreground">Money Out</span>
          </div>
        </div>
        <div className="flex gap-4">
          <div>
            <p className="text-sm font-bold text-foreground">$550.00</p>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">$950.00</p>
          </div>
        </div>
        <div className="flex gap-0.5 mt-2">
          {[40, 60, 45, 80, 65, 90, 70].map((h, i) => (
            <div key={i} className="w-3 rounded-sm" style={{ height: `${h * 0.3}px`, backgroundColor: i === 5 ? 'hsl(var(--base-blue))' : 'hsl(var(--muted))' }} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
