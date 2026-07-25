import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Fingerprint, Shield, X, Loader2 } from 'lucide-react';
import { authenticateBiometric, isBiometricsEnabled } from '@/lib/biometrics';
import { requiresBiometricAuth, getSessionSettings } from '@/hooks/useSessionManager';

interface BiometricAuthModalProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BiometricAuthModal({ amount, onSuccess, onCancel }: BiometricAuthModalProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = getSessionSettings();

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const success = await authenticateBiometric();
      if (success) {
        onSuccess();
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      console.error('Biometric auth error:', err);
      setError('Biometric authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-3xl p-6 w-full max-w-sm text-center"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-amber-500" />
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">
          High-Value Transaction
        </h3>
        
        <p className="text-muted-foreground text-sm mb-4">
          This transaction of <span className="font-bold text-foreground">${amount.toFixed(2)}</span> exceeds 
          your threshold of ${settings.highValueThreshold.toFixed(2)}. 
          Please verify with biometrics to continue.
        </p>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleAuthenticate}
          disabled={isAuthenticating}
          className="w-full h-14 rounded-2xl bg-base-blue text-white font-semibold flex items-center justify-center gap-3 mb-3 disabled:opacity-50"
        >
          {isAuthenticating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Fingerprint className="w-5 h-5" />
              Verify with Biometrics
            </>
          )}
        </motion.button>

        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full h-12 rounded-xl"
        >
          Cancel Transaction
        </Button>
      </motion.div>
    </motion.div>
  );
}

// Hook to check if biometric auth is needed for a transaction
export function useBiometricAuth() {
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [onAuthSuccess, setOnAuthSuccess] = useState<(() => void) | null>(null);

  const checkBiometricRequired = (
    amount: number,
    onSuccess: () => void
  ): boolean => {
    // Only require biometric if enabled and amount exceeds threshold
    if (isBiometricsEnabled() && requiresBiometricAuth(amount)) {
      setPendingAmount(amount);
      setOnAuthSuccess(() => onSuccess);
      setShowBiometricModal(true);
      return true; // Auth required
    }
    return false; // No auth needed, proceed directly
  };

  const handleAuthSuccess = () => {
    setShowBiometricModal(false);
    if (onAuthSuccess) {
      onAuthSuccess();
    }
  };

  const handleAuthCancel = () => {
    setShowBiometricModal(false);
    setOnAuthSuccess(null);
  };

  return {
    showBiometricModal,
    pendingAmount,
    checkBiometricRequired,
    handleAuthSuccess,
    handleAuthCancel,
  };
}

export { requiresBiometricAuth, getSessionSettings };
