import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePayTag, AppMode } from '@/contexts/PayTagContext';
import { AtSign, Lock, Store, User, ChevronRight, Check, Shield, Loader2, Sun, Moon, Key, ArrowLeft, Copy, AlertTriangle, Download, Sparkles, Cloud, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoniPayLogo } from './MoniPayLogo';
import { Footer } from './Footer';
import { useTheme } from 'next-themes';
import { Checkbox } from '@/components/ui/checkbox';
import { Landing } from './Landing';
import { AccountActivationButton } from './AccountActivationButton';
import { TempoLanding } from './TempoLanding';
import { GoogleDriveRestore } from './GoogleDriveRestore';
import { SignInChoice } from './SignInChoice';
import { SignUpChoice } from './SignUpChoice';
import { MiniPaySignInChoice } from './minipay/MiniPaySignInChoice';
import { MiniPayOnboardChrome } from './minipay/MiniPayOnboardChrome';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { encryptForBackup, uploadBackup, checkBackupExists, downloadBackup, decryptFromBackup } from '@/lib/googleDriveBackup';
import { checkUsdcApproval } from '@/lib/wallet';
import { getDeviceId } from '@/lib/deviceId';
import { GOOGLE_CLIENT_ID } from '@/config/app';
// Use public folder for faster direct serving (no Vite processing)
const heroImage = '/monipay-phone.png';
const SilkBg = lazy(() => import('./Silk'));
type Step = 1 | 2 | 3 | 4 | 5;
type OnboardingFlow = 'create' | 'import';
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0
  })
};

// Synced flip animation — shared state via module-level store
const flipStore = (() => {
  let index = 0;
  const listeners = new Set<(i: number) => void>();
  setInterval(() => {
    index = (index + 1) % 2;
    listeners.forEach((fn) => fn(index));
  }, 3000);
  return { getIndex: () => index, subscribe: (fn: (i: number) => void) => {listeners.add(fn);return () => {listeners.delete(fn);};} };
})();

function FlipWord({ words }: {words: string[];}) {
  const [currentIndex, setCurrentIndex] = useState(() => flipStore.getIndex());

  useEffect(() => {
    return flipStore.subscribe(setCurrentIndex);
  }, []);

  return (
    <span className="inline-block relative align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="inline-block text-base-blue"
          style={{ transformStyle: 'preserve-3d' }}>

          {words[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </span>);

}

interface OnboardingBackupProps {
  privateKey: string;
  pin: string;
  onBackupSuccess: () => void;
  isSuccess: boolean;
}

function OnboardingGoogleDriveBackupInner({ privateKey, pin, onBackupSuccess, isSuccess }: OnboardingBackupProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'conflict' | 'backing_up' | 'success' | 'error'>('idle');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingBackupDate, setExistingBackupDate] = useState<number | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      setAccessToken(response.access_token);
      setStatus('checking');

      // Check for existing backup (conflict detection)
      try {
        const existing = await checkBackupExists(response.access_token);
        if (existing.exists && existing.timestamp) {
          setExistingBackupDate(existing.timestamp);
          setShowConflictDialog(true);
          setStatus('conflict');
        } else {
          // No existing backup - proceed with upload
          await performBackup(response.access_token);
        }
      } catch {
        await performBackup(response.access_token);
      }
    },
    onError: () => {
      setStatus('error');
      setError('Google sign-in failed');
    },
    scope: 'https://www.googleapis.com/auth/drive.appdata'
  });

  const performBackup = async (token: string) => {
    if (!privateKey || !pin) return;

    setStatus('backing_up');
    try {
      const { encryptedData, iv, salt } = await encryptForBackup(privateKey, pin);
      const result = await uploadBackup(token, encryptedData, iv, salt);

      if (result.success) {
        setStatus('success');
        onBackupSuccess();
      } else {
        setError(result.error || 'Backup failed');
        setStatus('error');
      }
    } catch (e) {
      setError('Failed to backup wallet');
      setStatus('error');
    }
  };

  const handleOverwrite = async () => {
    if (accessToken) {
      setShowConflictDialog(false);
      await performBackup(accessToken);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isSuccess || status === 'success') {
    return (
      <div className="bg-success/10 border border-success/30 rounded-none p-4 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center">
          <Check className="w-5 h-5 text-white" />
        </div>
        <div className="text-left flex-1">
          <p className="text-sm font-semibold text-success">Backed up to Google Drive</p>
          <p className="text-xs text-muted-foreground">Your wallet is secured in the cloud</p>
        </div>
      </div>);

  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => googleLogin()}
        disabled={status === 'checking' || status === 'backing_up' || !privateKey}
        className="w-full h-12 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 mb-4 gap-2">

        {status === 'checking' || status === 'backing_up' ?
        <>
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-primary font-semibold">
              {status === 'checking' ? 'Checking...' : 'Backing up...'}
            </span>
          </> :

        <>
            <Cloud className="w-5 h-5 text-primary" />
            <span className="text-primary font-semibold">Backup to Google Drive</span>
          </>
        }
      </Button>

      {error &&
      <div className="bg-destructive/10 rounded-lg p-2 mb-4 text-center">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      }

      {/* Conflict Dialog */}
      {showConflictDialog &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">

          <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-foreground/10 p-6 w-full max-w-md">

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Existing Backup Found</h3>
                <p className="text-sm text-muted-foreground">
                  From {existingBackupDate ? formatDate(existingBackupDate) : 'earlier'}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              We found an existing wallet backup in your Google Drive. What would you like to do?
            </p>

            <div className="space-y-3">
              <Button
              onClick={handleOverwrite}
              variant="destructive"
              className="w-full h-12 rounded-none">

                Overwrite with New Wallet
              </Button>
              <Button
              onClick={() => {
                setShowConflictDialog(false);
                setStatus('idle');
              }}
              variant="outline"
              className="w-full h-12 rounded-none">

                Cancel
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              ⚠️ Overwriting will replace your old backup permanently
            </p>
          </motion.div>
        </motion.div>
      }
    </>);

}

function OnboardingGoogleDriveBackup(props: OnboardingBackupProps) {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
    return null;
  }
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <OnboardingGoogleDriveBackupInner {...props} />
    </GoogleOAuthProvider>);

}

export function Onboarding({ defaultFlow }: { defaultFlow?: OnboardingFlow } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    createProfile,
    checkPayTagAvailable,
    importWallet,
    generatedPrivateKey,
    clearGeneratedKey,
    setIsUnlocked,
    setCurrentScreen,
    profile,
    decryptedPrivateKey,
    isTempoMode,
    isCeloMode,
    isSolanaMode,
  } = usePayTag();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);
  const [payTag, setPayTag] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [selectedMode, setSelectedMode] = useState<AppMode | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingTag, setIsCheckingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const confirmPinRef = useRef<HTMLInputElement>(null);
  const [showSteps, setShowSteps] = useState(isTempoMode || isCeloMode || isSolanaMode);
  const [flow, setFlow] = useState<OnboardingFlow>(defaultFlow || 'create');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [hasBackedUp, setHasBackedUp] = useState(false);
  const [hasCopiedKey, setHasCopiedKey] = useState(false);
  const [showCloudRestore, setShowCloudRestore] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isBackingUpToCloud, setIsBackingUpToCloud] = useState(false);
  const [cloudBackupSuccess, setCloudBackupSuccess] = useState(false);
  // Sign-in chooser screen (shown before the import-key form for the import flow).
  const [showSignInChoice, setShowSignInChoice] = useState(defaultFlow === 'import');
  // Sign-up chooser (Connect Wallet vs Create MoniPay Wallet) — shown after
  // user clicks "Get started" on the public landing, before legacy onboarding.
  const [showSignUpChoice, setShowSignUpChoice] = useState(false);

  // Step 5: Account Activation state
  const [isActivated, setIsActivated] = useState(false);
  const [isRequestingFunds, setIsRequestingFunds] = useState(false);
  const [hasFunds, setHasFunds] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  useEffect(() => {
    if (pin.length === 4 && confirmPinRef.current) confirmPinRef.current.focus();
  }, [pin]);

  // Auto-trigger Google Drive restore when entering import flow from the
  // MiniPay web chooser's "Sign in with Google" button.
  useEffect(() => {
    try {
      if (
        flow === 'import' &&
        showSignInChoice &&
        sessionStorage.getItem('mp_auto_google_restore') === '1'
      ) {
        sessionStorage.removeItem('mp_auto_google_restore');
        setShowCloudRestore(true);
        setShowSignInChoice(false);
      }
    } catch {}
  }, [flow, showSignInChoice]);
  const goNext = () => {
    setDirection(1);
    setStep((prev) => prev + 1 as Step);
  };
  const goBack = () => {
    setDirection(-1);
    setStep((prev) => prev - 1 as Step);
  };
  const startOnboarding = () => {
    // Open the Connect-Wallet vs Create-Account chooser first, except for
    // contexts where it doesn't apply (Tempo/Celo/Solana custom flows).
    if (isTempoMode || isCeloMode || isSolanaMode) {
      setFlow('create');
      setShowSteps(true);
      return;
    }
    setShowSignUpChoice(true);
  };
  const startImport = () => {
    setFlow('import');
    setShowSignInChoice(true);
    setShowSteps(true);
  };
  const handleStep1Submit = async () => {
    if (payTag.length < 3) {
      setTagError('moniTag™ must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(payTag)) {
      setTagError('Only letters, numbers, and underscores allowed');
      return;
    }
    setIsCheckingTag(true);
    setTagError(null);

    // Check availability via Supabase edge function
    const result = await checkPayTagAvailable(payTag);
    if (!result.available) {
      setIsCheckingTag(false);
      if (result.reserved) {
        setTagError(`@${payTag.toLowerCase()} is a reserved moniTag™. This username is reserved by Monipay and cannot be registered. Please choose a different moniTag™.`);
      } else {
        setTagError('This moniTag™ is already taken. Please choose a different one.');
      }
      return;
    }
    setIsCheckingTag(false);
    goNext();
  };
  const handleStep2Submit = () => {
    if (pin.length !== 4) return;
    if (pin !== confirmPin) return;
    goNext();
  };

  // Trigger activation funding in background (called after profile creation)
  const triggerActivationFunding = async (walletAddress: string) => {
    try {
      const deviceId = getDeviceId();
      // Fire and forget - don't await, let it happen in background
      fetch('https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/activation-funder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'fund',
          walletAddress,
          deviceId
        })
      }).then((res) => res.json()).then((data) => {
        console.log('[Onboarding] Background funding response:', data);
      }).catch((e) => {
        console.log('[Onboarding] Background funding request failed, will retry at Step 5:', e);
      });
    } catch (e) {
      console.log('[Onboarding] Background funding trigger failed:', e);
    }
  };
  const handleStep3Submit = async () => {
    if (!selectedMode) return;
    setIsCreating(true);
    const success = await createProfile(payTag.toLowerCase(), pin, selectedMode);
    if (success) {
      setIsCreating(false);
      goNext();

      // Trigger activation funding in background immediately after profile created
      // Skip for Tempo, Celo (relay handles gas), and Solana (no ERC-20 approval needed)
      const isSolanaMode = profile?.preferredNetwork === 'solana';
      if (!isTempoMode && !isCeloMode && !isSolanaMode) {
        setTimeout(() => {
          if (profile?.wallet?.address) {
            triggerActivationFunding(profile.wallet.address);
          }
        }, 500);
      }
    } else {
      setIsCreating(false);
    }
  };
  const handleBackupComplete = () => {
    if (!hasBackedUp) {
      return;
    }
    clearGeneratedKey();
    // Skip Step 5 (activation) — go straight to dashboard so the FeatureTour
    // runs immediately. The activation grant has already been triggered
    // silently in the background (see handleStep3Submit). The on-chain
    // approval is deferred until the user's first send.
    setIsUnlocked(true);
    setCurrentScreen('dashboard');
  };

  // Step 5: Request activation funds and handle activation
  const requestActivationFunds = async () => {
    if (!profile?.wallet?.address) return;
    setIsRequestingFunds(true);
    setActivationError(null);
    try {
      const deviceId = getDeviceId();
      const response = await fetch('https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/activation-funder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'fund',
          walletAddress: profile.wallet.address,
          deviceId
        })
      });
      const data = await response.json();
      if (data.success || data.alreadyFunded) {
        // Wallet funded or already funded - wait a bit for ETH to arrive
        setTimeout(() => {
          setHasFunds(true);
          setIsRequestingFunds(false);
        }, data.alreadyFunded ? 500 : 3000);
      } else if (data.pending) {
        // Still setting up - will retry automatically
        console.log('[Onboarding] Funding pending:', data.message);
        setIsRequestingFunds(false);
        // Retry after a delay
        setTimeout(() => {
          if (!hasFunds) {
            requestActivationFunds();
          }
        }, 3000);
      } else if (data.deviceLimited) {
        // Device already used - show neutral message
        setActivationError('This device has already been used for activation. Please use the Fund Wallet option instead.');
        setIsRequestingFunds(false);
      } else {
        // Other responses - just log and don't show error
        console.log('[Onboarding] Funding response:', data);
        setIsRequestingFunds(false);
      }
    } catch (error) {
      console.error('Error requesting funds:', error);
      setActivationError('Network error. Please try again.');
      setIsRequestingFunds(false);
    }
  };
  const handleActivationComplete = () => {
    setIsActivated(true);
    // Complete onboarding after a short delay
    setTimeout(() => {
      setIsUnlocked(true);
      setCurrentScreen('dashboard');
    }, 1500);
  };

  // Step 5 is deferred to the first send (lazy activation) — if the user ever
  // lands here directly, just send them to the dashboard.
  useEffect(() => {
    if (step === 5) {
      setIsUnlocked(true);
      setCurrentScreen('dashboard');
    }
  }, [step]);
  const copyPrivateKey = async () => {
    if (generatedPrivateKey) {
      await navigator.clipboard.writeText(generatedPrivateKey);
      setHasCopiedKey(true);
    }
  };

  // Import flow handlers
  const handleImportStep1 = () => {
    if (!privateKeyInput.trim()) {
      setImportError('Please enter your private key');
      return;
    }
    // Basic validation - should be hex string
    const key = privateKeyInput.trim();
    if (!/^(0x)?[a-fA-F0-9]{64}$/.test(key)) {
      setImportError('Invalid private key format. Should be 64 hex characters.');
      return;
    }
    setImportError(null);
    goNext();
  };
  const handleImportComplete = async () => {
    if (pin.length !== 4) return;
    if (pin !== confirmPin) return;
    setIsImporting(true);
    const result = await importWallet(privateKeyInput.trim(), pin);
    if (!result.success) {
      setImportError(result.error || 'Failed to import wallet');
      setIsImporting(false);
    }
  };

  // Handle cloud restore
  const handleCloudRestore = async (privateKey: string, pin: string): Promise<{success: boolean;error?: string;}> => {
    return await importWallet(privateKey, pin);
  };

  const resetToHero = () => {
    setShowSteps(false);
    setStep(1);
    setFlow('create');
    setPrivateKeyInput('');
    setPin('');
    setConfirmPin('');
    setPayTag('');
    setImportError(null);
    setHasBackedUp(false);
    setHasCopiedKey(false);
    setShowCloudRestore(false);
    setShowSignInChoice(false);
    clearGeneratedKey();
    // In /minipay (Celo) context, Onboarding renders null when showSteps is
    // false, which would leave a blank screen. Signal the MiniPay page so it
    // can restore its landing view and keep the user locked to /minipay.
    if (isCeloMode) {
      window.dispatchEvent(new CustomEvent('monipay:back-to-landing'));
    }
  };
  const {
    theme,
    setTheme
  } = useTheme();

  // Hero Landing Screen
  if (!showSteps) {
    // Sign-up chooser (Connect Wallet vs Create MoniPay Wallet)
    if (showSignUpChoice) {
      return (
        <SignUpChoice
          onConnectWallet={() => {
            // Tell Index to enable Path C (wallet-only mode).
            window.dispatchEvent(new CustomEvent('monipay:enable-wallet-mode'));
            setShowSignUpChoice(false);
          }}
          onCreateAccount={() => {
            setShowSignUpChoice(false);
            setFlow('create');
            setShowSteps(true);
          }}
          onBack={() => setShowSignUpChoice(false)}
        />
      );
    }
    // Tempo/Solana mode: landing is handled by parent page, skip to steps
    if (isTempoMode || isSolanaMode) {
      return null;
    }
    return <Landing onGetStarted={startOnboarding} onSignIn={startImport} />;
  }

  // Sign-in choice screen — shown before the import-key form
  if (flow === 'import' && showSignInChoice) {
    if (isCeloMode) {
      return (
        <MiniPaySignInChoice
          onImportWallet={() => {
            setShowCloudRestore(false);
            setShowSignInChoice(false);
          }}
          onGoogleSignIn={() => {
            setShowCloudRestore(true);
            setShowSignInChoice(false);
          }}
          onCreateAccount={() => {
            setFlow('create');
            setStep(1);
            setShowSignInChoice(false);
          }}
          onBack={resetToHero}
        />
      );
    }
    return (
      <SignInChoice
        onImportWallet={() => {
          setShowCloudRestore(false);
          setShowSignInChoice(false);
        }}
        onGoogleSignIn={() => {
          setShowCloudRestore(true);
          setShowSignInChoice(false);
        }}
        onCreateAccount={() => {
          setFlow('create');
          setStep(1);
          setShowSignInChoice(false);
        }}
        onBack={resetToHero}
      />
    );
  }

  // Import wallet flow
  if (flow === 'import') {
    if (isCeloMode) {
      return (
        <MiniPayOnboardChrome step={step} totalSteps={2} onBack={resetToHero}>
          <div className="relative h-full">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && <motion.div key="import-step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="absolute inset-0 px-4 sm:px-6 flex flex-col justify-center py-6">
                <div className="flex flex-col max-w-md mx-auto w-full text-center">
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mp-icon-frame w-16 h-16 mb-5 mx-auto">
                    <Key className="w-8 h-8" />
                  </motion.div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: 'hsl(var(--mp-ink))' }}>{t('import_wallet')}</h1>
                  <p className="text-sm mb-6" style={{ color: 'hsl(var(--mp-muted))' }}>{t('import_wallet_desc')}</p>
                  {showCloudRestore ? <>
                    <GoogleDriveRestore onRestore={handleCloudRestore} />
                    <button onClick={() => setShowCloudRestore(false)} className="text-sm mt-4 underline" style={{ color: 'hsl(var(--mp-muted))' }}>{t('use_private_key')}</button>
                  </> : <>
                    <div className="text-left">
                      <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--mp-muted))' }}>{t('private_key')}</label>
                       <Input type="password" value={privateKeyInput} onChange={(e) => { setPrivateKeyInput(e.target.value); setImportError(null); }} placeholder="0x..." className={`h-14 text-base font-mono rounded-2xl border-2 bg-card shadow-[var(--mp-shadow-card)] focus-visible:ring-2 focus-visible:ring-ring ${importError ? 'border-destructive' : ''}`} style={{ borderColor: importError ? undefined : 'hsl(var(--mp-border))' }} autoFocus />
                      {importError && <p className="text-xs text-destructive mt-2">{importError}</p>}
                    </div>
                    <p className="text-xs mt-4 flex items-center justify-center gap-1.5" style={{ color: 'hsl(var(--mp-muted))' }}><Shield className="w-3.5 h-3.5" />{t('key_stored_locally')}</p>
                    {GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID') && <button onClick={() => setShowCloudRestore(true)} className="flex items-center justify-center gap-2 mt-4 text-sm font-semibold" style={{ color: 'hsl(var(--mp-primary))' }}>
                      <Cloud className="w-4 h-4" />{t('restore_google_drive')}
                    </button>}
                  </>}
                </div>
                <div className="mt-6 max-w-md mx-auto w-full space-y-3">
                  {!showCloudRestore && <button onClick={handleImportStep1} disabled={!privateKeyInput.trim()} className="mp-cta w-full h-14 text-base inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {t('continue')}<ChevronRight className="w-5 h-5" />
                  </button>}
                  <div className="text-center py-1"><span className="text-xs" style={{ color: 'hsl(var(--mp-muted))' }}>— or —</span></div>
                  <button onClick={() => { setFlow('create'); setStep(1); setPrivateKeyInput(''); setImportError(null); setShowCloudRestore(false); }} className="mp-cta-outline w-full h-14 text-base inline-flex items-center justify-center gap-2 transition-colors">
                    <User className="w-5 h-5" />Create Account
                  </button>
                </div>
              </motion.div>}

              {step === 2 && <motion.div key="import-step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="absolute inset-0 px-4 sm:px-6 flex flex-col justify-center py-6">
                <div className="flex flex-col max-w-md mx-auto w-full text-center">
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mp-icon-frame w-16 h-16 mb-5 mx-auto">
                    <Lock className="w-8 h-8" />
                  </motion.div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: 'hsl(var(--mp-ink))' }}>{t('set_new_pin')}</h1>
                  <p className="text-sm mb-6" style={{ color: 'hsl(var(--mp-muted))' }}>{t('set_new_pin_desc')}</p>
                  <div className="space-y-4 text-left">
                    <div>
                      <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--mp-muted))' }}>{t('enter_pin')}</label>
                       <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-2xl border-2 bg-card shadow-[var(--mp-shadow-card)] focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: 'hsl(var(--mp-border))' }} maxLength={4} autoFocus />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--mp-muted))' }}>{t('confirm_pin')}</label>
                       <Input ref={confirmPinRef} type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-2xl border-2 bg-card shadow-[var(--mp-shadow-card)] focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: 'hsl(var(--mp-border))' }} maxLength={4} />
                    </div>
                  </div>
                  <p className="text-xs mt-4 flex items-center justify-center gap-1.5" style={{ color: 'hsl(var(--mp-muted))' }}><Shield className="w-3.5 h-3.5" />{t('pin_encrypts_locally')}</p>
                </div>
                <div className="mt-6 max-w-md mx-auto w-full">
                  <button onClick={handleImportComplete} disabled={pin.length !== 4 || confirmPin.length !== 4 || isImporting} className="mp-cta w-full h-14 text-base inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isImporting ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <>{t('import_wallet_btn')}<ChevronRight className="w-5 h-5" /></>}
                  </button>
                </div>
              </motion.div>}
            </AnimatePresence>
          </div>
        </MiniPayOnboardChrome>
      );
    }
    return <div className="fixed inset-0 bg-background flex flex-col safe-top">
        {/* Header */}
        <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={resetToHero} className="rounded-none">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <MoniPayLogo size={32} color="#0052FF" animationMode="idle" showText textSize={16} />
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
          <div className="max-w-md mx-auto">
            <div className="flex gap-2">
              {[1, 2].map((s) => <motion.div key={s} className="h-1.5 flex-1 overflow-hidden bg-muted">
                  <motion.div initial={{
                width: '0%'
              }} animate={{
                width: step >= s ? '100%' : '0%'
              }} transition={{
                duration: 0.3
              }} className="h-full bg-base-blue" />
                </motion.div>)}
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">{t('step_of', { step, total: 2 })}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && <motion.div key="import-step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30
          }} className="absolute inset-0 px-4 sm:px-6 flex flex-col">
                <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full text-center">
                  <motion.div initial={{
                scale: 0.8,
                opacity: 0
              }} animate={{
                scale: 1,
                opacity: 1
               }} className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-base-blue/10 mb-5 mx-auto">
                    <Key className="w-8 h-8 text-base-blue" />
                  </motion.div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{t('import_wallet')}</h1>
                  <p className="text-sm text-muted-foreground mb-6">{t('import_wallet_desc')}</p>
                  
                  {showCloudRestore ?
              <>
                      <GoogleDriveRestore onRestore={handleCloudRestore} />
                      <button
                  onClick={() => setShowCloudRestore(false)}
                  className="text-sm text-muted-foreground hover:text-foreground mt-4 underline">

                        {t('use_private_key')}
                      </button>
                    </> :

              <>
                      <div className="text-left">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('private_key')}</label>
                        <Input type="password" value={privateKeyInput} onChange={(e) => {
                    setPrivateKeyInput(e.target.value);
                    setImportError(null);
                  }} placeholder="0x..." className={`h-14 text-base font-mono rounded-none border-2 focus:border-base-blue ${importError ? 'border-destructive' : ''}`} autoFocus />
                        {importError && <p className="text-xs text-destructive mt-2">{importError}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />{t('key_stored_locally')}
                      </p>
                      
                      {/* Cloud Restore Link */}
                      {GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID') &&
                <button
                  onClick={() => setShowCloudRestore(true)}
                  className="flex items-center justify-center gap-2 mt-4 text-sm text-base-blue hover:text-base-blue/80">

                          <Cloud className="w-4 h-4" />
                          {t('restore_google_drive')}
                        </button>
                }
                    </>
              }
                </div>
                <div className="pb-6 max-w-md mx-auto w-full space-y-3">
                  {!showCloudRestore &&
                    <Button size="lg" onClick={handleImportStep1} disabled={!privateKeyInput.trim()} className="w-full h-14 text-base font-semibold rounded-none bg-base-blue hover:bg-base-blue/90">
                      {t('continue')}<ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  }
                  
                  <div className="text-center py-1">
                    <span className="text-xs text-muted-foreground">— or —</span>
                  </div>
                  
                  {/* Create Account - Prominent secondary action */}
                  <button
                    onClick={() => {
                      setFlow('create');
                      setStep(1);
                      setPrivateKeyInput('');
                      setImportError(null);
                      setShowCloudRestore(false);
                    }}
                    className="w-full h-14 text-base font-semibold rounded-none border-2 border-base-blue text-base-blue hover:bg-base-blue hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <User className="w-5 h-5" />
                    Create Account
                  </button>
                </div>
              </motion.div>}



            {step === 2 && <motion.div key="import-step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30
          }} className="absolute inset-0 px-4 sm:px-6 flex flex-col">
                <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full text-center">
                  <motion.div initial={{
                scale: 0.8,
                opacity: 0
              }} animate={{
                scale: 1,
                opacity: 1
               }} className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-base-blue/10 mb-5 mx-auto">
                    <Lock className="w-8 h-8 text-base-blue" />
                  </motion.div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{t('set_new_pin')}</h1>
                  <p className="text-sm text-muted-foreground mb-6">{t('set_new_pin_desc')}</p>
                  <div className="space-y-4 text-left">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('enter_pin')}</label>
                       <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-none border-2 focus:border-base-blue" maxLength={4} autoFocus />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('confirm_pin')}</label>
                       <Input ref={confirmPinRef} type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-none border-2 focus:border-base-blue" maxLength={4} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5"><Shield className="w-3.5 h-3.5" />{t('pin_encrypts_locally')}</p>
                </div>
                <div className="pb-6 max-w-md mx-auto w-full">
                  <Button size="lg" onClick={handleImportComplete} disabled={pin.length !== 4 || confirmPin.length !== 4 || isImporting} className="w-full h-14 text-base font-semibold rounded-none bg-base-blue hover:bg-base-blue/90">
                    {isImporting ? <motion.div animate={{
                  rotate: 360
                }} transition={{
                  repeat: Infinity,
                  duration: 1,
                  ease: 'linear'
                }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <>{t('import_wallet_btn')}<ChevronRight className="w-5 h-5 ml-2" /></>}
                  </Button>
                </div>
              </motion.div>}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <Footer variant="minimal" />
      </div>;
  }

  // Create new wallet flow
  const totalCreateSteps = isTempoMode ? 4 : 5;
  // Render shell wrapper conditional on /minipay (Celo) context.
  // Step content (below) is identical for both — only chrome changes.
  return <div data-minipay={isCeloMode ? '' : undefined} className={isCeloMode ? "fixed inset-0 flex flex-col safe-top overflow-hidden" : "fixed inset-0 bg-background flex flex-col safe-top"} style={isCeloMode ? { background: 'hsl(var(--mp-surface))', color: 'hsl(var(--mp-ink))' } : undefined}>
      {isCeloMode && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(900px 480px at 20% 0%, hsl(var(--mp-primary) / 0.10), transparent 60%), radial-gradient(700px 420px at 85% 8%, hsl(var(--mp-primary) / 0.07), transparent 60%)' }} />
          <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25]" style={{ backgroundImage: 'radial-gradient(hsl(var(--mp-ink) / 0.18) 1px, transparent 1px)', backgroundSize: '22px 22px', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 90%)', maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 90%)' }} />
        </div>
      )}
      {/* Header */}
      <div className={isCeloMode ? "relative z-10 px-3 sm:px-6 pt-3 pb-2" : "px-4 sm:px-6 pt-6 sm:pt-8 pb-4"}>
        {isCeloMode ? (
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between gap-2 rounded-full pl-2 pr-2 py-2 backdrop-blur-xl" style={{ background: '#FCFF52', border: '1px solid #000', boxShadow: '0 8px 32px -12px rgba(0,0,0,0.25)' }}>
              <button type="button" aria-label="Back" onClick={step === 4 || step === 5 ? undefined : resetToHero} disabled={step === 4 || step === 5} className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <MoniPayLogo size={26} color="#000" animationMode="header" entranceOnMount />
                <span className="font-bold tracking-tight text-[15px] text-black">Monipay</span>
              </div>
              <button type="button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-black/10 transition-colors">
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="h-4 w-4 hidden dark:block" />
              </button>
            </div>
            <div className="max-w-md mx-auto mt-4 px-1">
              <div className="flex gap-2">
                {Array.from({ length: totalCreateSteps }).map((_, i) => {
                  const s = i + 1;
                  return (
                    <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'hsl(var(--mp-faint))' }}>
                      <motion.div initial={{ width: '0%' }} animate={{ width: step >= s ? '100%' : '0%' }} transition={{ duration: 0.3 }} className="h-full rounded-full" style={{ background: 'hsl(var(--mp-primary))' }} />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs mt-2 text-center" style={{ color: 'hsl(var(--mp-muted))' }}>{t('step_of', { step, total: totalCreateSteps })}</p>
            </div>
          </div>
        ) : (<>
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={step === 4 || step === 5 ? undefined : resetToHero} disabled={step === 4 || step === 5} className="rounded-none">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <MoniPayLogo size={32} color="#0052FF" animationMode="idle" showText textSize={16} />
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
        <div className="max-w-md mx-auto">
          <div className="flex gap-2">
            {(isTempoMode ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]).map((s) => <motion.div key={s} className="h-1.5 flex-1 overflow-hidden bg-muted">
                <motion.div initial={{
              width: '0%'
            }} animate={{
              width: step >= s ? '100%' : '0%'
            }} transition={{
              duration: 0.3
            }} className="h-full bg-base-blue" />
              </motion.div>)}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">{t('step_of', { step, total: isTempoMode ? 4 : 5 })}</p>
        </div>
        </>)}
      </div>

      {/* Content */}
      <div className={isCeloMode ? "flex-1 overflow-y-auto relative z-10" : "flex-1 overflow-y-auto relative"}>
        <AnimatePresence mode="wait" custom={direction}>
           {step === 1 && <motion.div key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }} className="absolute inset-0 px-4 sm:px-6 flex flex-col justify-center py-6">
              <div className="flex flex-col max-w-md mx-auto w-full text-center">
                <motion.div initial={{
              scale: 0.8,
              opacity: 0
            }} animate={{
              scale: 1,
              opacity: 1
              }} className={isCeloMode ? "mp-icon-frame w-16 h-16 mb-5 mx-auto" : "inline-flex items-center justify-center w-16 h-16 rounded-none bg-base-blue/10 mb-5 mx-auto"}>
                  <AtSign className={isCeloMode ? "w-8 h-8" : "w-8 h-8 text-base-blue"} />
                </motion.div>
                <h1 className={isCeloMode ? "text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" : "text-2xl sm:text-3xl font-bold text-foreground mb-2"} style={isCeloMode ? { color: 'hsl(var(--mp-ink))' } : undefined}>{t('create_paytag')}</h1>
                <p className="text-sm mb-6" style={isCeloMode ? { color: 'hsl(var(--mp-muted))' } : undefined}>{isTempoMode ? t('paytag_description_tempo') : t('paytag_description')}</p>
                <div className="relative">
                  <span className={isCeloMode ? "absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg" : "absolute left-4 top-1/2 -translate-y-1/2 text-base-blue font-bold text-lg"} style={isCeloMode ? { color: 'hsl(var(--mp-primary))' } : undefined}>@</span>
                  <Input value={payTag} onChange={(e) => {
                setPayTag(e.target.value.replace(/\s/g, ''));
                setTagError(null);
              }} placeholder="yourname" className={`pl-10 h-14 text-lg font-medium border-2 ${isCeloMode ? 'rounded-2xl bg-card shadow-[var(--mp-shadow-card)] focus-visible:ring-2 focus-visible:ring-ring' : 'rounded-none focus:border-base-blue'} ${tagError ? 'border-destructive' : ''}`} maxLength={20} autoFocus />
                </div>
                {tagError && <p className="text-xs text-destructive mt-2">{tagError}</p>}
                <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5"><Shield className="w-3.5 h-3.5" />{t('generates_secure_wallet')}</p>
              </div>
              <div className="mt-6 max-w-md mx-auto w-full">
                <Button size="lg" onClick={handleStep1Submit} disabled={payTag.length < 3 || isCheckingTag} className={isCeloMode ? "mp-cta w-full h-14 text-base" : "w-full h-14 text-base font-semibold rounded-none bg-base-blue hover:bg-base-blue/90"}>
                  {isCheckingTag ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t('checking')}</> : <>{t('continue')}<ChevronRight className="w-5 h-5 ml-2" /></>}
                </Button>
              </div>
            </motion.div>}

          {step === 2 && <motion.div key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }} className="absolute inset-0 px-4 sm:px-6 flex flex-col justify-center py-6">
              <div className="flex flex-col max-w-md mx-auto w-full text-center">
                <motion.div initial={{
              scale: 0.8,
              opacity: 0
            }} animate={{
              scale: 1,
              opacity: 1
            }} className={isCeloMode ? "mp-icon-frame w-16 h-16 mb-5 mx-auto" : "inline-flex items-center justify-center w-16 h-16 rounded-none bg-base-blue/10 mb-5 mx-auto"}>
                  <Lock className={isCeloMode ? "w-8 h-8" : "w-8 h-8 text-base-blue"} />
                </motion.div>
                <h1 className={isCeloMode ? "text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" : "text-2xl sm:text-3xl font-bold text-foreground mb-2"} style={isCeloMode ? { color: 'hsl(var(--mp-ink))' } : undefined}>{t('secure_wallet')}</h1>
                <p className="text-sm mb-6" style={isCeloMode ? { color: 'hsl(var(--mp-muted))' } : undefined}>{t('create_pin_description')}</p>
                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('enter_pin')}</label>
                    <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className={isCeloMode ? "h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-2xl border-2 bg-card shadow-[var(--mp-shadow-card)] focus-visible:ring-2 focus-visible:ring-ring" : "h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-none border-2 focus:border-base-blue"} maxLength={4} autoFocus />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">{t('confirm_pin')}</label>
                    <Input ref={confirmPinRef} type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className={isCeloMode ? "h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-2xl border-2 bg-card shadow-[var(--mp-shadow-card)] focus-visible:ring-2 focus-visible:ring-ring" : "h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-none border-2 focus:border-base-blue"} maxLength={4} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5"><Shield className="w-3.5 h-3.5" />{t('pin_encrypts_locally')}</p>
              </div>
              <div className="mt-6 max-w-md mx-auto w-full">
                <Button size="lg" onClick={handleStep2Submit} disabled={pin.length !== 4 || confirmPin.length !== 4} className={isCeloMode ? "mp-cta w-full h-14 text-base" : "w-full h-14 text-base font-semibold rounded-none bg-base-blue hover:bg-base-blue/90"}>{t('continue')}<ChevronRight className="w-5 h-5 ml-2" /></Button>
              </div>
            </motion.div>}

          {step === 3 && <motion.div key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }} className="absolute inset-0 px-4 sm:px-6 flex flex-col justify-center py-6">
              <div className="flex flex-col max-w-md mx-auto w-full text-center">
                <h1 className={isCeloMode ? "text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" : "text-2xl sm:text-3xl font-bold text-foreground mb-2"} style={isCeloMode ? { color: 'hsl(var(--mp-ink))' } : undefined}>{t('choose_focus')}</h1>
                <p className="text-sm mb-6" style={isCeloMode ? { color: 'hsl(var(--mp-muted))' } : undefined}>{t('switch_anytime')}</p>
                <div className="space-y-3">
                  <motion.button whileTap={{
                scale: 0.98
              }} onClick={() => setSelectedMode('merchant')} className={`w-full p-5 border-2 text-left transition-all ${isCeloMode ? 'mp-card' : ''} ${selectedMode === 'merchant' ? (isCeloMode ? 'border-primary bg-primary/10 shadow-[var(--mp-shadow-card)]' : 'border-base-blue bg-base-blue/5 shadow-lg') : 'border-border bg-card hover:border-muted-foreground/30'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 flex items-center justify-center flex-shrink-0 ${isCeloMode ? 'rounded-2xl' : ''} ${selectedMode === 'merchant' ? (isCeloMode ? 'bg-primary text-primary-foreground' : 'bg-base-blue text-white') : isCeloMode ? 'mp-icon-frame' : 'bg-muted text-muted-foreground'}`}><Store className="w-5 h-5" /></div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-foreground">{t('merchant_mode_label')}</h3>
                        <p className="text-muted-foreground text-xs mt-1">{t('merchant_mode_desc')}</p>
                      </div>
                      {selectedMode === 'merchant' && <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${isCeloMode ? 'rounded-full bg-primary' : 'bg-base-blue'}`}><Check className="w-4 h-4 text-primary-foreground" /></div>}
                    </div>
                  </motion.button>
                  <motion.button whileTap={{
                scale: 0.98
              }} onClick={() => setSelectedMode('user')} className={`w-full p-5 border-2 text-left transition-all ${isCeloMode ? 'mp-card' : ''} ${selectedMode === 'user' ? (isCeloMode ? 'border-primary bg-primary/10 shadow-[var(--mp-shadow-card)]' : 'border-base-black bg-base-black/5 shadow-lg') : 'border-border bg-card hover:border-muted-foreground/30'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 flex items-center justify-center flex-shrink-0 ${isCeloMode ? 'rounded-2xl' : ''} ${selectedMode === 'user' ? (isCeloMode ? 'bg-primary text-primary-foreground' : 'bg-base-black text-white') : isCeloMode ? 'mp-icon-frame' : 'bg-muted text-muted-foreground'}`}><User className="w-5 h-5" /></div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-foreground">{t('personal_mode_label')}</h3>
                        <p className="text-muted-foreground text-xs mt-1">{t('personal_mode_desc')}</p>
                      </div>
                      {selectedMode === 'user' && <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${isCeloMode ? 'rounded-full bg-primary' : 'bg-base-black'}`}><Check className="w-4 h-4 text-primary-foreground" /></div>}
                    </div>
                  </motion.button>
                </div>
              </div>
              <div className="mt-6 max-w-md mx-auto w-full">
                <Button size="lg" onClick={handleStep3Submit} disabled={!selectedMode || isCreating} className={isCeloMode ? "mp-cta w-full h-14 text-base" : "w-full h-14 text-base font-semibold rounded-none bg-base-blue hover:bg-base-blue/90"}>
                  {isCreating ? <motion.div animate={{
                rotate: 360
              }} transition={{
                repeat: Infinity,
                duration: 1,
                ease: 'linear'
              }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <>{t('continue')}<ChevronRight className="w-5 h-5 ml-2" /></>}
                </Button>
              </div>
            </motion.div>}

          {step === 4 && <motion.div key="step4" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }} className="absolute inset-0 px-4 sm:px-6 flex flex-col justify-center py-5 overflow-y-auto">
              <div className="flex flex-col max-w-md mx-auto w-full text-center space-y-3">
                <motion.div initial={{
              scale: 0.8,
              opacity: 0
            }} animate={{
              scale: 1,
              opacity: 1
            }} className={isCeloMode ? "mp-icon-frame w-12 h-12 mx-auto" : "inline-flex items-center justify-center w-12 h-12 bg-amber-500/10 mx-auto"}>
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </motion.div>
                <h1 className={isCeloMode ? "text-xl sm:text-2xl font-extrabold tracking-tight" : "text-xl sm:text-2xl font-bold text-foreground"} style={isCeloMode ? { color: 'hsl(var(--mp-ink))' } : undefined}>{t('backup_your_wallet')}</h1>
                
                {/* Warning Banner */}
                <div className={isCeloMode ? "bg-destructive/10 border border-destructive/30 p-3 text-left rounded-2xl" : "bg-destructive/10 border border-destructive/30 p-3 text-left"}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive/90">
                      {t('backup_warning')}
                    </p>
                  </div>
                </div>

                {/* Private Key Display - Secure Card */}
                <div className={isCeloMode ? "mp-panel p-3" : "bg-card border border-amber-500/30 p-3"}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                    <label className="text-xs font-semibold text-amber-600">{t('your_private_key')}</label>
                  </div>
                  <div className={isCeloMode ? "relative bg-muted p-2.5 font-mono text-[10px] break-all text-left text-foreground border border-border rounded-xl" : "relative bg-muted p-2.5 font-mono text-[10px] break-all text-left text-foreground border border-border"}>
                    {showPrivateKey ?
                generatedPrivateKey || '0x••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••' :
                '•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••'
                }
                    <button
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="absolute top-1.5 right-1.5 p-1 rounded bg-background/80 hover:bg-background transition-colors">

                      {showPrivateKey ?
                  <EyeOff className="w-3 h-3 text-muted-foreground" /> :

                  <Eye className="w-3 h-3 text-muted-foreground" />
                  }
                    </button>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyPrivateKey} className={isCeloMode ? "mt-2 w-full h-9 text-xs rounded-full" : "mt-2 w-full h-9 text-xs"} disabled={!generatedPrivateKey}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    {hasCopiedKey ? t('copied') : t('copy_private_key')}
                  </Button>
                </div>

                {/* Google Drive Backup - Prominent CTA */}
                {GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID') &&
            <OnboardingGoogleDriveBackup
              privateKey={generatedPrivateKey || ''}
              pin={pin}
              onBackupSuccess={() => {
                setCloudBackupSuccess(true);
                setHasBackedUp(true);
              }}
              isSuccess={cloudBackupSuccess} />

            }

                {/* Confirmation Checkbox */}
                <div className={isCeloMode ? "flex items-start gap-2.5 text-left bg-card border border-border p-3 rounded-2xl" : "flex items-start gap-2.5 text-left bg-card border border-border p-3"}>
                  <Checkbox id="backup-confirm" checked={hasBackedUp} onCheckedChange={(checked) => setHasBackedUp(checked === true)} className="mt-0.5 h-4 w-4" />
                  <label htmlFor="backup-confirm" className="text-xs text-foreground cursor-pointer leading-relaxed">
                    {t('backup_confirm_label')}
                  </label>
                </div>
              </div>
              <div className="mt-5 max-w-md mx-auto w-full">
                <Button size="lg" onClick={handleBackupComplete} disabled={!hasBackedUp} className={isCeloMode ? "mp-cta w-full h-12 text-base" : "w-full h-12 text-base font-semibold rounded-none bg-base-blue hover:bg-base-blue/90"}>
                  {t('continue')}<ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </motion.div>}

          {step === 5 && <motion.div key="step5" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }} className="absolute inset-0 px-4 sm:px-6 flex flex-col overflow-y-auto">
              <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full text-center">
                <h1 className={isCeloMode ? "text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" : "text-2xl sm:text-3xl font-bold text-foreground mb-2"} style={isCeloMode ? { color: 'hsl(var(--mp-ink))' } : undefined}>
                  {isActivated ? t('account_activated') : t('activate_account')}
                </h1>
                <p className="text-sm mb-6" style={isCeloMode ? { color: 'hsl(var(--mp-muted))' } : undefined}>
                  {isActivated ? t('wallet_ready') : t('final_step_gasless')}
                </p>

                {isActivated ? <motion.div initial={{
              scale: 0
            }} animate={{
              scale: 1
            }} transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20
            }} className={isCeloMode ? "p-6 mb-4 rounded-[var(--mp-radius)] bg-primary shadow-[0_24px_60px_-18px_hsl(var(--mp-primary)/0.55)]" : "bg-base-blue p-6 mb-4"}>
                    <div className="w-16 h-16 rounded-full bg-primary-foreground flex items-center justify-center mx-auto mb-4">
                      <Check className={isCeloMode ? "w-8 h-8" : "w-8 h-8 text-base-blue"} style={isCeloMode ? { color: 'hsl(var(--mp-primary))' } : undefined} strokeWidth={3} />
                    </div>
                    <p className="text-lg font-semibold text-white">{t('all_set')}</p>
                    <p className="text-sm text-white/70 mt-1">{t('redirecting')}</p>
                  </motion.div> : <>
                    {/* Funding Status */}
                    <div className={isCeloMode ? "mp-panel p-4 mb-4" : "bg-muted/50 p-4 mb-4"}>
                      <div className="flex items-center gap-3">
                        {isRequestingFunds ? <>
                            <Loader2 className={isCeloMode ? "w-5 h-5 animate-spin" : "w-5 h-5 animate-spin text-base-blue"} style={isCeloMode ? { color: 'hsl(var(--mp-primary))' } : undefined} />
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-foreground">{t('preparing_account')}</p>
                              <p className="text-xs text-muted-foreground">{t('covering_activation')}</p>
                            </div>
                          </> : hasFunds ? <>
                            <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-foreground">{t('ready_for_activation')}</p>
                              <p className="text-xs text-muted-foreground">{t('tap_to_activate')}</p>
                            </div>
                          </> : activationError ? <>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-foreground">{t('try_again')}</p>
                              <Button variant="link" size="sm" onClick={requestActivationFunds} className={isCeloMode ? "text-xs p-0 h-auto" : "text-xs p-0 h-auto text-base-blue"} style={isCeloMode ? { color: 'hsl(var(--mp-primary))' } : undefined}>
                                {t('retry_activation')}
                              </Button>
                            </div>
                          </> : <>
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-foreground">{t('initializing')}</p>
                            </div>
                          </>}
                      </div>
                    </div>

                    {/* Activation Button */}
                    {hasFunds && profile?.wallet?.address && <AccountActivationButton walletAddress={profile.wallet.address} decryptedPrivateKey={decryptedPrivateKey} onActivationComplete={handleActivationComplete} autoActivate={true} />}

                    <p className="text-xs text-muted-foreground mt-4">
                      This is a one-time setup that takes ~10 seconds
                    </p>
                  </>}
              </div>
              <div className="pb-6 max-w-md mx-auto w-full">
              </div>
            </motion.div>}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <Footer variant="minimal" />
    </div>;
}