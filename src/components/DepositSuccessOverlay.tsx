import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Sparkles } from 'lucide-react';
import { feedback } from '@/lib/feedback';

interface DepositSuccessOverlayProps {
  visible: boolean;
  amount: number;
  onDismiss: () => void;
}

export function DepositSuccessOverlay({ visible, amount, onDismiss }: DepositSuccessOverlayProps) {
  useEffect(() => {
    if (visible) {
      feedback('deposit');
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-success flex items-center justify-center"
          onClick={onDismiss}
        >
          {/* Confetti-like particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  opacity: 0, 
                  y: '100%',
                  x: `${Math.random() * 100}%`,
                  rotate: 0,
                }}
                animate={{ 
                  opacity: [0, 1, 0],
                  y: '-100%',
                  rotate: Math.random() * 360,
                }}
                transition={{ 
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: 'easeOut',
                }}
                className="absolute w-3 h-3"
                style={{
                  backgroundColor: ['#FFD700', '#FFF', '#00FF88', '#FF6B6B'][i % 4],
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="text-center text-white relative"
          >
            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute -top-20 right-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Success icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
              className="relative"
            >
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 0 0 rgba(255,255,255,0.4)',
                    '0 0 0 30px rgba(255,255,255,0)',
                  ]
                }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  className="w-24 h-24 rounded-full bg-white flex items-center justify-center"
                >
                  <Check className="w-12 h-12 text-success" strokeWidth={3} />
                </motion.div>
              </motion.div>
              
              {/* Sparkles */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className="w-8 h-8 text-yellow-300" />
              </motion.div>
            </motion.div>

            {/* Text */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold mb-2"
            >
              Deposit Received!
            </motion.h2>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-5xl font-bold mb-2"
            >
              +${amount.toFixed(2)}
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ delay: 0.5 }}
              className="text-lg"
            >
              USDC on Base
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.6 }}
              className="text-sm mt-4"
            >
              Tap anywhere to continue
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
