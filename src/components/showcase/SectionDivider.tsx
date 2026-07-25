import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

type Variant = 'gradient' | 'glow' | 'wave' | 'geometric';

export function SectionDivider({ variant = 'gradient' }: { variant?: Variant }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  if (variant === 'glow') {
    return (
      <div ref={ref} className="py-16 flex items-center justify-center">
        <motion.div
          initial={{ width: '0%', opacity: 0 }}
          animate={inView ? { width: '60%', opacity: 1 } : {}}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-px relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <motion.div
            animate={inView ? { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary/40 blur-sm"
          />
        </motion.div>
      </div>
    );
  }

  if (variant === 'wave') {
    return (
      <div ref={ref} className="py-12 overflow-hidden">
        <motion.svg
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          viewBox="0 0 1440 60"
          className="w-full h-12"
          preserveAspectRatio="none"
        >
          <motion.path
            d="M0,30 Q360,0 720,30 T1440,30"
            fill="none"
            stroke="hsl(var(--primary) / 0.2)"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : {}}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
        </motion.svg>
      </div>
    );
  }

  if (variant === 'geometric') {
    return (
      <div ref={ref} className="py-16 flex items-center justify-center gap-4">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -45, opacity: 0 }}
            animate={inView ? { scale: 1, rotate: 0, opacity: 0.3 } : {}}
            transition={{ duration: 0.5, delay: i * 0.15, ease: 'backOut' }}
            className={`${i === 1 ? 'w-3 h-3 rounded-full' : 'w-2 h-2 rounded-sm rotate-45'} bg-primary/40`}
          />
        ))}
      </div>
    );
  }

  // Default: gradient shimmer
  return (
    <div ref={ref} className="py-16 flex items-center justify-center">
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={inView ? { scaleX: 1, opacity: 1 } : {}}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-4/5 max-w-2xl h-px relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />
      </motion.div>
    </div>
  );
}
