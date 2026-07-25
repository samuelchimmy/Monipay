import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePayTag } from '@/contexts/PayTagContext';
import { Delete, AlertCircle, Fingerprint, Timer } from 'lucide-react';
import { 
  isBiometricsAvailable, 
  isBiometricsEnabled, 
  authenticateBiometric,
  getStoredPin
} from '@/lib/biometrics';
import { feedback } from '@/lib/feedback';
import { 
  isLockedOut, 
  recordFailedAttempt, 
  resetLockout,
  MAX_ATTEMPTS 
} from '@/lib/pinLockout';
import { verifyPinHash, isPinHashed } from '@/lib/pinHash';
import { PayTagDisplay } from './VerifiedBadge';
import { MoniPayLogo } from './MoniPayLogo';

export function LockScreen() {
  const { verifyPin, profile } = usePayTag();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Incorrect PIN, try again');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [isBiometricAuth, setIsBiometricAuth] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Check biometrics availability and lockout status on mount
  useEffect(() => {
    const available = isBiometricsAvailable() && isBiometricsEnabled();
    setBiometricsAvailable(available);
    
    // Check lockout status
    const checkLockout = () => {
      const { locked, remainingSeconds } = isLockedOut();
      setLockoutRemaining(locked ? remainingSeconds : 0);
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    
    // Auto-trigger biometric auth if available and not locked
    // Use a small delay to ensure the component is fully mounted and WebAuthn is ready
    if (available && !isLockedOut().locked) {
      const biometricTimer = setTimeout(() => {
        handleBiometricAuth();
      }, 100);
      return () => {
        clearInterval(interval);
        clearTimeout(biometricTimer);
      };
    }

    return () => clearInterval(interval);
  }, []);

  const handleBiometricAuth = async () => {
    if (!isBiometricsAvailable() || !isBiometricsEnabled() || lockoutRemaining > 0 || isBiometricAuth) return;
    
    setIsBiometricAuth(true);
    try {
      // Small delay to ensure WebAuthn is ready (fixes first-try failure on some devices)
      await new Promise(resolve => setTimeout(resolve, 50));
      const success = await authenticateBiometric();
      if (success) {
        // Get the stored raw PIN for biometric unlock
        const storedRawPin = getStoredPin();
        if (storedRawPin) {
          resetLockout();
          // Use the raw PIN to unlock (will decrypt private key correctly)
          await verifyPin(storedRawPin);
        }
      }
    } catch (error) {
      console.error('Biometric auth failed:', error);
      // Silently fail and let user use PIN
    } finally {
      setIsBiometricAuth(false);
    }
  };

  const verifyAndUnlock = async (enteredPin: string) => {
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
      // Call verifyPin to complete the unlock process (decrypt key, set state)
      await verifyPin(enteredPin);
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
          verifyAndUnlock(newPin);
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
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 bg-background flex flex-col items-center justify-center px-6 safe-top safe-bottom"
    >
      {/* Logo / Icon */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 text-center"
      >
        <div className="flex justify-center mb-4">
          {isLocked ? (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
              <Timer className="w-10 h-10 text-destructive" />
            </div>
          ) : (
            <MoniPayLogo
              size={80}
              color="#0052FF"
              animationMode={error ? 'error' : 'idle'}
              isError={error}
            />
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {isLocked ? 'Temporarily Locked' : 'Welcome back'}
        </h1>
        {isLocked ? (
          <p className="text-destructive mt-1">Try again in {lockoutRemaining} seconds</p>
        ) : (
          <PayTagDisplay payTag={profile?.payTag || ''} className="text-muted-foreground mt-1" />
        )}
      </motion.div>

      {/* Lockout Timer */}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 rounded-2xl p-6 mb-8 text-center"
        >
          <div className="text-5xl font-bold text-destructive mb-2">
            {lockoutRemaining}
          </div>
          <p className="text-sm text-muted-foreground">seconds remaining</p>
        </motion.div>
      )}

      {!isLocked && (
        <>
          {/* PIN Dots */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={error 
              ? { scale: 1, opacity: 1, x: [-12, 12, -12, 12, -6, 6, 0] } 
              : { scale: 1, opacity: 1, x: 0 }
            }
            transition={error 
              ? { delay: 0, x: { duration: 0.4, ease: 'easeInOut' } } 
              : { delay: 0.2 }
            }
            className="flex gap-4 mb-6"
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
                className="w-4 h-4 rounded-full"
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
                className="flex items-center gap-2 text-destructive mb-6"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keypad */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-4 max-w-xs w-full"
          >
            {numbers.map((num, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (num === 'del') handleDelete();
                  else if (num === 'bio') handleBiometricAuth();
                  else if (num) handleNumberClick(num);
                }}
                disabled={num === '' || isBiometricAuth}
                className={`
                  h-16 rounded-2xl text-2xl font-semibold transition-colors
                  ${num === '' ? 'invisible' : ''}
                  ${num === 'del' 
                    ? 'bg-transparent text-muted-foreground hover:bg-muted' 
                    : num === 'bio'
                      ? 'bg-base-blue/10 text-base-blue hover:bg-base-blue/20'
                      : 'bg-card hover:bg-muted text-foreground shadow-sm border border-border'
                  }
                `}
              >
                {num === 'del' ? (
                  <Delete className="w-6 h-6 mx-auto" />
                ) : num === 'bio' ? (
                  <Fingerprint className={`w-6 h-6 mx-auto ${isBiometricAuth ? 'animate-pulse' : ''}`} />
                ) : (
                  num
                )}
              </motion.button>
            ))}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
