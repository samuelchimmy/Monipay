import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Lock, Delete, Fingerprint, X, AlertCircle, Loader2, Timer } from 'lucide-react';
import { usePayTag } from '@/contexts/PayTagContext';
import { isBiometricsAvailable, isBiometricsEnabled, authenticateBiometric, getStoredPin } from '@/lib/biometrics';
import { feedback } from '@/lib/feedback';
import { 
  isLockedOut, 
  recordFailedAttempt, 
  resetLockout, 
  getFailedAttempts,
  MAX_ATTEMPTS 
} from '@/lib/pinLockout';
import { verifyPinHash, isPinHashed } from '@/lib/pinHash';

interface SecurityGateProps {
  title: string;
  description?: string;
  onAuthenticated: (pin?: string) => void;
  onCancel: () => void;
}

export function SecurityGate({ title, description, onAuthenticated, onCancel }: SecurityGateProps) {
  const { profile, verifyPin } = usePayTag();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Incorrect PIN');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  
  const biometricsAvailable = isBiometricsAvailable() && isBiometricsEnabled();

  // Check lockout status on mount and update countdown
  useEffect(() => {
    const checkLockout = () => {
      const { locked, remainingSeconds } = isLockedOut();
      setLockoutRemaining(locked ? remainingSeconds : 0);
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBiometricAuth = async () => {
    if (!biometricsAvailable || lockoutRemaining > 0) return;
    
    setIsAuthenticating(true);
    try {
      const success = await authenticateBiometric();
      if (success) {
        resetLockout();
        const storedRawPin = getStoredPin();
        if (storedRawPin) {
          await verifyPin(storedRawPin);
        }
        onAuthenticated(storedRawPin ?? undefined);
      } else {
        feedback('error');
      }
    } catch (error) {
      console.error('Biometric auth failed:', error);
      feedback('error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const verifyAndAuthenticate = async (enteredPin: string) => {
    if (!profile) return;
    
    // Verify PIN (supports both hashed and legacy)
    let isValid = false;
    if (isPinHashed(profile.pin)) {
      isValid = await verifyPinHash(enteredPin, profile.pin);
    } else {
      isValid = profile.pin === enteredPin;
    }
    
    if (isValid) {
      feedback('success');
      resetLockout();
      await verifyPin(enteredPin);
      onAuthenticated(enteredPin);
    } else {
      const result = recordFailedAttempt();
      setError(true);
      setPin('');
      feedback('error');
      
      if (result.isNowLocked) {
        setErrorMessage(`Too many attempts. Try again in ${result.lockoutSeconds}s`);
        setLockoutRemaining(result.lockoutSeconds);
      } else {
        setErrorMessage(`Incorrect PIN. ${result.attemptsRemaining} attempts left`);
      }
    }
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && lockoutRemaining === 0) {
      feedback('tap');
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 4) {
        setTimeout(() => {
          verifyAndAuthenticate(newPin);
        }, 150);
      }
    }
  };

  const handleDelete = () => {
    feedback('tap');
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const isLocked = lockoutRemaining > 0;
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', biometricsAvailable ? 'bio' : '', '0', 'del'];

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
        className="bg-card rounded-3xl p-6 w-full max-w-sm relative"
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isLocked ? 'bg-destructive/10' : 'bg-primary/10'
          }`}>
            {isLocked ? (
              <Timer className="w-8 h-8 text-destructive" />
            ) : (
              <Lock className="w-8 h-8 text-primary" />
            )}
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {isLocked ? 'Temporarily Locked' : title}
          </h3>
          {isLocked ? (
            <p className="text-destructive text-sm mt-1">
              Try again in {lockoutRemaining} seconds
            </p>
          ) : description && (
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          )}
        </div>

        {/* Lockout Timer */}
        {isLocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-destructive/10 rounded-2xl p-4 mb-6 text-center"
          >
            <div className="text-4xl font-bold text-destructive mb-1">
              {lockoutRemaining}
            </div>
            <p className="text-sm text-muted-foreground">seconds remaining</p>
          </motion.div>
        )}

        {!isLocked && (
          <>
            {/* PIN Dots */}
            <motion.div
              animate={error 
                ? { x: [-12, 12, -12, 12, -6, 6, 0] } 
                : { x: 0 }
              }
              transition={error 
                ? { x: { duration: 0.4, ease: 'easeInOut' } } 
                : {}
              }
              className="flex gap-4 justify-center mb-6"
            >
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: pin.length > i ? 1.1 : 1,
                    backgroundColor: error 
                      ? 'hsl(var(--destructive))' 
                      : pin.length > i 
                        ? 'hsl(var(--primary))' 
                        : 'hsl(var(--muted))',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="w-3.5 h-3.5 rounded-full"
                />
              ))}
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 text-destructive mb-4"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
              {numbers.map((num, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (num === 'del') handleDelete();
                    else if (num === 'bio') handleBiometricAuth();
                    else if (num) handleNumberClick(num);
                  }}
                  disabled={num === '' || isAuthenticating}
                  className={`
                    h-12 rounded-xl text-xl font-semibold transition-colors
                    ${num === '' ? 'invisible' : ''}
                    ${num === 'del' 
                      ? 'bg-transparent text-muted-foreground hover:bg-muted' 
                      : num === 'bio'
                        ? 'bg-base-blue/10 text-base-blue hover:bg-base-blue/20'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }
                  `}
                >
                  {num === 'del' ? (
                    <Delete className="w-5 h-5 mx-auto" />
                  ) : num === 'bio' ? (
                    isAuthenticating ? (
                      <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                    ) : (
                      <Fingerprint className="w-5 h-5 mx-auto" />
                    )
                  ) : (
                    num
                  )}
                </motion.button>
              ))}
            </div>
          </>
        )}

        {/* Cancel Button */}
        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full h-12 rounded-xl mt-6"
        >
          Cancel
        </Button>
      </motion.div>
    </motion.div>
  );
}

// Hook to manage security gate state
export function useSecurityGate() {
  const [showGate, setShowGate] = useState(false);
  const [gateConfig, setGateConfig] = useState<{
    title: string;
    description?: string;
    onSuccess: (pin?: string) => void;
  } | null>(null);

  const requestAccess = useCallback((config: {
    title: string;
    description?: string;
    onSuccess: (pin?: string) => void;
  }) => {
    setGateConfig(config);
    setShowGate(true);
  }, []);

  const handleAuthenticated = useCallback((pin?: string) => {
    setShowGate(false);
    gateConfig?.onSuccess(pin);
    setGateConfig(null);
  }, [gateConfig]);

  const handleCancel = useCallback(() => {
    setShowGate(false);
    setGateConfig(null);
  }, []);

  const SecurityGateModal = showGate && gateConfig ? (
    <SecurityGate
      title={gateConfig.title}
      description={gateConfig.description}
      onAuthenticated={handleAuthenticated}
      onCancel={handleCancel}
    />
  ) : null;

  return {
    requestAccess,
    SecurityGateModal,
  };
}
