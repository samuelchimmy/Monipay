import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MoniPayLogo } from './MoniPayLogo';
import { haptic } from '@/lib/feedback';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  // Fire haptic when the Dot springs into place (2.4s after draw starts)
  useEffect(() => {
    const t = setTimeout(() => haptic('confirm'), 3200);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 0.4, ease: 'easeIn' }}
      className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center"
    >
      <MoniPayLogo
        size={120}
        color="hsl(var(--foreground))"
        animationMode="splash"
        onSplashComplete={onComplete}
      />

      {/* Wordmark fades in after M draw + dot settle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.6, duration: 0.4 }}
        className="mt-5 flex items-baseline gap-0.5"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <span className="text-2xl font-bold text-foreground">Moni</span>
        <span className="text-2xl font-bold text-primary">PAY</span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.8, duration: 0.3 }}
        className="text-xs text-muted-foreground mt-2 tracking-widest uppercase text-center"
      >
        A Hammer. Not a Dishwasher.
      </motion.p>
    </motion.div>
  );
}
