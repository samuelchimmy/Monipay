import { useState, useRef, useCallback, ReactNode } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { MoniPayLogo } from './MoniPayLogo';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ children, onRefresh, className = '' }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);
  
  const opacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const scale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0) {
      const resistance = 0.5;
      const pull = Math.min(diff * resistance, MAX_PULL);
      pullDistance.set(pull);
    }
  }, [isRefreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing) return;
    
    const currentPull = pullDistance.get();
    
    if (currentPull >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      animate(pullDistance, PULL_THRESHOLD / 2, { duration: 0.2 });
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        animate(pullDistance, 0, { duration: 0.3 });
      }
    } else {
      animate(pullDistance, 0, { duration: 0.2 });
    }
  }, [isRefreshing, pullDistance, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto lg:overflow-visible ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator - mobile only */}
      <motion.div
        style={{ opacity, y: useTransform(pullDistance, [0, MAX_PULL], [-40, 20]) }}
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none lg:hidden"
      >
        <motion.div
          style={{ scale }}
          className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center backdrop-blur-sm"
        >
          <MoniPayLogo
            size={24}
            color="hsl(var(--primary))"
            animationMode={isRefreshing ? 'processing' : 'idle'}
          />
        </motion.div>
      </motion.div>
      
      {/* Content wrapper */}
      <motion.div style={{ y: useTransform(pullDistance, [0, MAX_PULL], [0, MAX_PULL / 2]) }}>
        {children}
      </motion.div>
    </div>
  );
}
