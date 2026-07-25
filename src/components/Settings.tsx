import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePayTag } from '@/contexts/PayTagContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, Lock, Key, Shield, Eye, EyeOff, Copy, Check,
  Smartphone, Bell, Moon, Sun, Trash2, LogOut, ChevronRight, AlertTriangle, Volume2, Loader2,
  Timer, DollarSign, Fingerprint, HelpCircle, Code, Bot, Globe, Languages
} from 'lucide-react';
import { NetworkBase } from '@web3icons/react';
import { CHAIN_CONFIGS, type SupportedNetwork } from '@/config/chains';
import { DeveloperSettings } from './DeveloperSettings';
import { SupportPage } from './SupportPage';
import { GoogleDriveBackup } from './GoogleDriveBackup';
import { MoniBotSettings } from './MoniBotSettings';
import { MoniBotDashboard } from './MoniBotDashboard';
import { VerifiedBadge, PayTagDisplay, isMoniBotTag } from './VerifiedBadge';
import { shortenAddress, decryptPrivateKey, encryptPrivateKey } from '@/lib/wallet';
import { feedback, soundManager } from '@/lib/feedback';
import { 
  isBiometricsAvailable, 
  isBiometricsEnabled, 
  registerBiometric, 
  setBiometricsEnabled,
  storePin
} from '@/lib/biometrics';
import { 
  getSessionSettings, 
  saveSessionSettings, 
  type SessionSettings 
} from '@/hooks/useSessionManager';
import { unregisterPayTag } from '@/lib/payTagRegistry';
import { useTheme } from 'next-themes';
import { APP_FOOTER_TEXT } from '@/config/app';
import { LanguageSelector } from './LanguageSelector';
import { ModalNetworkToggle } from './ModalNetworkToggle';
import { hashPin, verifyPinHash, isPinHashed } from '@/lib/pinHash';
import { 
  isNotificationsEnabled, isNotificationsSupported, 
  requestNotificationPermission, setNotificationsEnabled 
} from '@/lib/notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SettingsProps {
  onClose: () => void;
  initialSection?: 'monibot' | null;
}

export function Settings({ onClose, initialSection }: SettingsProps) {
  const { profile, setProfile, setCurrentScreen, setIsUnlocked, setPreferredNetwork, isCeloMode } = usePayTag();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [backupPin, setBackupPin] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState(() => isNotificationsEnabled());
  const notifSupported = isNotificationsSupported();
  const [biometrics, setBiometrics] = useState(() => isBiometricsEnabled());
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [isEnablingBiometrics, setIsEnablingBiometrics] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled());
  const [mounted, setMounted] = useState(false);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>(() => getSessionSettings());
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [showMoniBot, setShowMoniBot] = useState(initialSection === 'monibot');
  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check biometrics support on mount
  useEffect(() => {
    setBiometricsSupported(isBiometricsAvailable());
  }, []);

  const [isChangingPin, setIsChangingPin] = useState(false);

  const handleChangePIN = async () => {
    if (!profile || isChangingPin) return;
    
    setIsChangingPin(true);
    
    try {
      // Verify current PIN (supports both hashed and legacy)
      let isCurrentPinValid = false;
      if (isPinHashed(profile.pin)) {
        isCurrentPinValid = await verifyPinHash(currentPin, profile.pin);
      } else {
        isCurrentPinValid = currentPin === profile.pin;
      }
      
      if (!isCurrentPinValid) {
        feedback('error');
        setIsChangingPin(false);
        return;
      }
      
      if (newPin.length !== 4) {
        feedback('error');
        setIsChangingPin(false);
        return;
      }
      
      if (newPin !== confirmNewPin) {
        feedback('error');
        setIsChangingPin(false);
        return;
      }
      
      // Hash the new PIN before storing
      const hashedNewPin = await hashPin(newPin);
      const reEncryptedPrivateKey = decryptPrivateKey(profile.wallet.encryptedPrivateKey, currentPin);
      const nextEncryptedPrivateKey = encryptPrivateKey(reEncryptedPrivateKey, newPin);
      const nextEncryptedSolanaKey = profile.wallet.encryptedSolanaKey
        ? encryptPrivateKey(decryptPrivateKey(profile.wallet.encryptedSolanaKey, currentPin), newPin)
        : undefined;

      // Solana key stays localStorage-only — no DB push
      
      // Update profile with new hashed PIN
      setProfile({
        ...profile,
        pin: hashedNewPin,
        wallet: {
          ...profile.wallet,
          encryptedPrivateKey: nextEncryptedPrivateKey,
          ...(nextEncryptedSolanaKey ? { encryptedSolanaKey: nextEncryptedSolanaKey } : {}),
        },
      });
      
      feedback('success');
      setShowChangePIN(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    } finally {
      setIsChangingPin(false);
    }
  };

  const [isVerifyingBackupPin, setIsVerifyingBackupPin] = useState(false);

  const handleShowBackup = async () => {
    if (!profile || isVerifyingBackupPin) return;
    
    setIsVerifyingBackupPin(true);
    
    try {
      // Verify PIN (supports both hashed and legacy)
      let isPinValid = false;
      if (isPinHashed(profile.pin)) {
        isPinValid = await verifyPinHash(backupPin, profile.pin);
      } else {
        isPinValid = backupPin === profile.pin;
      }
      
      if (!isPinValid) {
        feedback('error');
        return;
      }
      
      // Use the entered PIN (not hashed) to decrypt private key
      const decrypted = decryptPrivateKey(profile.wallet.encryptedPrivateKey, backupPin);
      setPrivateKey(decrypted);
      setShowPrivateKey(true);
    } catch (error) {
      feedback('error');
    } finally {
      setIsVerifyingBackupPin(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    feedback('copy');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    if (enabled) { soundManager.unmute(); } else { soundManager.mute(); }
    if (enabled) {
      feedback('toggle');
    }
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (!profile) return;
    
    if (enabled) {
      setIsEnablingBiometrics(true);
      try {
        await registerBiometric(profile.payTag);
        setBiometrics(true);
        feedback('success');
      } catch (error) {
        console.error('Failed to enable biometrics:', error);
        feedback('error');
      } finally {
        setIsEnablingBiometrics(false);
      }
    } else {
      setBiometricsEnabled(false);
      setBiometrics(false);
    }
  };

  const handleUpdateSessionSettings = (updates: Partial<SessionSettings>) => {
    const updated = saveSessionSettings(updates);
    setSessionSettings(updated);
    feedback('toggle');
  };

  const handleLogout = () => {
    setIsUnlocked(false);
    setCurrentScreen('lock');
    onClose();
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
    setDeleteStep(1);
    setDeleteConfirmText('');
  };

  const executeDeleteAccount = async () => {
    if (!profile) return;
    setIsDeactivating(true);
    try {
      // Deactivate in backend
      const body = JSON.stringify({
        action: 'deactivate',
        payTag: profile.payTag,
        walletAddress: profile.wallet.address,
      });
      const sigHeaders = await import('@/lib/signedFetch').then(m => m.getSignatureHeaders(body));
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-paytag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...sigHeaders },
          body,
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || 'Failed to deactivate account');
        return;
      }
      // Unregister PayTag before clearing
      if (profile.payTag) {
        unregisterPayTag(profile.payTag);
      }
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error('Delete account error:', err);
      toast.error('Failed to deactivate account');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">{t('settings')}</h1>
        </div>
      </div>

      <div className="container px-4 py-6 space-y-6">
        {/* World Cup 2026 Sports Promo Banner (Non-dismissible) */}
        <div className="bg-white/95 dark:bg-zinc-900/95 border border-slate-200/80 dark:border-zinc-800 rounded-[24px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative flex flex-col gap-4">
          {/* Banner Image Container */}
          <div className="relative overflow-hidden rounded-[16px] border border-slate-100 dark:border-zinc-800 shadow-sm aspect-[3/1] bg-slate-100 dark:bg-zinc-850">
            <img 
              src="/images/conditional-sports-p2p-banner.webp" 
              alt="World Cup 2026 Conditional Sports P2P"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Actions Footer - Custom Banner Buttons matching CSS Specs */}
          <div className="flex items-center gap-2.5 w-full mt-1.5 px-0.5">
            <a 
              href="https://blog.monipay.xyz/introducing-conditional-sports-p2p-smart-world-cup-2026-rewards" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Learn more about World Cup 2026 Rewards"
              className="flex-[0_0_auto] h-[44px] px-5 rounded-[12px] border-[1.5px] border-[#d1d6e8] bg-transparent text-[#3d4460] font-semibold text-[13.5px] flex items-center justify-center transition-all duration-150 cursor-pointer hover:border-[#0e6dec] hover:text-[#0e6dec] hover:bg-[#0e6dec]/5 active:translate-y-0 select-none whitespace-nowrap tracking-tight dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Learn More
            </a>
            <Button
              asChild
              className="flex-1 h-[44px] px-5 rounded-[12px] border-none bg-gradient-to-r from-[#0e6dec] to-[#0a4ebd] hover:from-[#0e6dec]/95 hover:to-[#0a4ebd]/95 text-white font-semibold text-[13.5px] flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(14,109,236,0.35)] hover:shadow-[0_6px_20px_rgba(14,109,236,0.45)] transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer whitespace-nowrap tracking-tight"
            >
              <a href="https://x.com/intent/tweet?text=Hey%20%40monibot%20send%20%2410%20to%20%40jade%20if%20Germany%20wins%20Curacao%20%E2%9A%BD" target="_blank" rel="noopener noreferrer">
                <span className="w-[18px] h-[18px] bg-white/20 rounded-[6px] flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 8.5l7-7M8.5 1.5H3M8.5 1.5v5.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Reward Your Followers
              </a>
            </Button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-base-blue to-base-blue/80 flex items-center justify-center text-white text-2xl font-bold shadow-md">
              {profile?.payTag?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">
                <PayTagDisplay payTag={profile?.payTag || ''} badgeSize={16} />
              </h3>
              <p className="text-sm text-muted-foreground font-mono">
                {profile?.wallet?.address ? shortenAddress(
                  (profile?.preferredNetwork === 'solana' && profile.wallet.solanaAddress) 
                    ? profile.wallet.solanaAddress 
                    : profile.wallet.address
                ) : ''}
              </p>
            </div>
          </div>
        </div>

        {/* MoniBot AI — Premium dark Master Card with animated colored borders */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">{t('ai_automation')}</h2>

          {/* Animated gradient border wrapper */}
          <div className="relative rounded-2xl p-[1.5px] overflow-hidden monibot-flow-border">
            <button
              onClick={() => setShowMoniBot(!showMoniBot)}
              className="w-full relative rounded-[14px] bg-gradient-to-br from-[#0A0B14] via-[#0E1020] to-[#0A0B14] px-4 py-4 flex items-center gap-4 transition-all hover:from-[#0E1020] hover:via-[#12152A] hover:to-[#0E1020]"
            >
              {/* Subtle glow orb behind icon */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-[#0052FF]/40 via-[#9945FF]/30 to-[#14F195]/20 blur-xl pointer-events-none" />

              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0052FF]/30 via-[#9945FF]/20 to-[#14F195]/10 ring-1 ring-white/10 flex items-center justify-center shadow-lg backdrop-blur-sm">
                <Bot className="w-[22px] h-[22px] text-white" strokeWidth={1.75} />
              </div>
              <div className="relative flex-1 text-left">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  MoniBot AI
                  <span className="monibot-pulse-badge">
                    <VerifiedBadge size={16} />
                  </span>
                </p>
                <p className="text-xs text-white/55">{t('link_social_bot')}</p>
              </div>
              <ChevronRight className={`relative w-5 h-5 text-white/50 transition-transform ${showMoniBot ? 'rotate-90' : ''}`} />
            </button>
          </div>

          <AnimatePresence>
            {showMoniBot && profile?.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3 space-y-4"
              >
                {/* Dashboard only for @monibot */}
                {profile?.payTag?.toLowerCase() === 'monibot' && (
                  <MoniBotDashboard />
                )}
                <MoniBotSettings profileId={profile.id} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Security Section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('security')}</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowChangePIN(true)}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-base-blue/20 to-base-blue/5 flex items-center justify-center shadow-sm">
                <Lock className="w-[22px] h-[22px] text-base-blue" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">{t('change_pin')}</p>
                <p className="text-xs text-muted-foreground">{t('update_security_pin')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <div className="border-t border-border" />
            
            <button
              onClick={() => setShowBackup(true)}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center shadow-sm">
                <Key className="w-[22px] h-[22px] text-amber-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">{t('backup_wallet')}</p>
                <p className="text-xs text-muted-foreground">{t('view_private_key')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Google Drive Backup */}
          {profile && (
            <GoogleDriveBackup
              encryptedPrivateKey={profile.wallet.encryptedPrivateKey}
              storedPinHash={profile.pin}
              payTag={profile.payTag}
            />
          )}

          {/* More Security Settings */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center shadow-sm">
                <Smartphone className="w-[22px] h-[22px] text-emerald-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('biometric_unlock')}</p>
                <p className="text-xs text-muted-foreground">
                  {biometricsSupported 
                    ? t('use_fingerprint_faceid') 
                    : t('not_supported_device')}
                </p>
              </div>
              {isEnablingBiometrics ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={biometrics}
                  onCheckedChange={handleToggleBiometrics}
                  disabled={!biometricsSupported}
                />
              )}
            </div>
            
            <div className="border-t border-border" />
            
            {/* Auto-Lock Settings */}
            <div className="px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center shadow-sm">
                <Timer className="w-[22px] h-[22px] text-orange-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('auto_lock')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('lock_after_inactivity', { mins: sessionSettings.autoLockTimeout })}
                </p>
              </div>
              <Switch
                checked={sessionSettings.autoLockEnabled}
                onCheckedChange={(checked) => handleUpdateSessionSettings({ autoLockEnabled: checked })}
              />
            </div>
            
            {sessionSettings.autoLockEnabled && (
              <>
                <div className="border-t border-border" />
                <div className="px-4 py-3">
                  <label className="text-xs text-muted-foreground mb-2 block">
                    {t('lock_timeout_minutes')}
                  </label>
                  <div className="flex gap-2">
                    {[1, 5, 10, 30].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleUpdateSessionSettings({ autoLockTimeout: mins })}
                        className={`
                          flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                          ${sessionSettings.autoLockTimeout === mins 
                            ? 'bg-base-blue text-white' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }
                        `}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            <div className="border-t border-border" />
            
            {/* High-Value Transaction Protection */}
            <div className="px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center shadow-sm">
                <Fingerprint className="w-[22px] h-[22px] text-amber-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('high_value_protection')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('require_biometrics_threshold', { amount: sessionSettings.highValueThreshold })}
                </p>
              </div>
              <Switch
                checked={sessionSettings.requireBiometricForHighValue}
                onCheckedChange={(checked) => handleUpdateSessionSettings({ requireBiometricForHighValue: checked })}
                disabled={!biometricsSupported || !biometrics}
              />
            </div>
            
            {sessionSettings.requireBiometricForHighValue && biometrics && (
              <>
                <div className="border-t border-border" />
                <div className="px-4 py-3">
                  <label className="text-xs text-muted-foreground mb-2 block">
                    {t('high_value_threshold')}
                  </label>
                  <div className="flex gap-2">
                    {[50, 100, 250, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleUpdateSessionSettings({ highValueThreshold: amount })}
                        className={`
                          flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                          ${sessionSettings.highValueThreshold === amount 
                            ? 'bg-base-blue text-white' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }
                        `}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Preferences Section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">{t('preferences')}</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center shadow-sm">
                <Bell className="w-[22px] h-[22px] text-purple-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('notifications')}</p>
                <p className="text-xs text-muted-foreground">
                  {notifSupported ? t('payment_alerts') : t('not_supported_browser')}
                </p>
              </div>
              <Switch
                checked={notifications}
                disabled={!notifSupported}
                onCheckedChange={async (checked) => {
                  if (checked) {
                    const granted = await requestNotificationPermission();
                    setNotifications(granted);
                  } else {
                    setNotificationsEnabled(false);
                    setNotifications(false);
                  }
                }}
              />
            </div>
            
            <div className="border-t border-border" />
            
            <div className="px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-base-blue/20 to-base-blue/5 flex items-center justify-center shadow-sm">
                <Volume2 className="w-[22px] h-[22px] text-base-blue" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('sound_effects')}</p>
                <p className="text-xs text-muted-foreground">{t('haptic_audio')}</p>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={handleToggleSound}
              />
            </div>
            
            <div className="border-t border-border" />
            
            <div className="px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center shadow-sm">
                {mounted && theme === 'dark' ? (
                  <Moon className="w-[22px] h-[22px] text-indigo-500" strokeWidth={1.75} />
                ) : (
                  <Sun className="w-[22px] h-[22px] text-indigo-500" strokeWidth={1.75} />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('dark_mode')}</p>
                <p className="text-xs text-muted-foreground">{t('switch_dark_theme')}</p>
              </div>
              <Switch
                checked={mounted && theme === 'dark'}
                onCheckedChange={(checked) => {
                  setTheme(checked ? 'dark' : 'light');
                  feedback('toggle');
                }}
              />
            </div>
            
            <div className="border-t border-border" />

            {/* Language Selector */}
            <div className="px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 flex items-center justify-center shadow-sm">
                <Languages className="w-[22px] h-[22px] text-sky-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t('language')}</p>
                <p className="text-xs text-muted-foreground">{t('select_language')}</p>
              </div>
              <div className="w-32">
                <LanguageSelector variant="compact" />
              </div>
            </div>

            <div className="border-t border-border" />
            
            {/* Network Selector */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center shadow-sm">
                  <Globe className="w-[22px] h-[22px] text-emerald-500" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{t('network')}</p>
                  <p className="text-xs text-muted-foreground">{t('choose_blockchain')}</p>
                </div>
              </div>
              <ModalNetworkToggle
                value={(profile?.preferredNetwork || 'base') as SupportedNetwork}
                onChange={async (network) => {
                  if (!profile || network === profile.preferredNetwork) return;
                  await setPreferredNetwork(network);
                  feedback('toggle');
                }}
                locked={isCeloMode}
              />
            </div>
          </div>
        </div>


        {/* Developer Section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">{t('developer')}</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowDeveloper(!showDeveloper)}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center shadow-sm">
                <Code className="w-[22px] h-[22px] text-cyan-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">{t('developer')}</p>
                <p className="text-xs text-muted-foreground">{t('api_keys_webhooks')}</p>
              </div>
              <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showDeveloper ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {/* API Docs Link */}
          <a
            href="https://docs.monipay.xyz"
            className="mt-3 block bg-card border border-border rounded-2xl overflow-hidden px-4 py-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 flex items-center justify-center shadow-sm">
                <Globe className="w-[22px] h-[22px] text-teal-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">{t('api_documentation')}</p>
                <p className="text-xs text-muted-foreground">{t('integration_guides')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </a>
          
          <AnimatePresence>
            {showDeveloper && profile?.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3"
              >
                <DeveloperSettings profileId={profile.id} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Support & Account Section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">{t('support_account')}</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowSupport(true)}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 flex items-center justify-center shadow-sm">
                <HelpCircle className="w-[22px] h-[22px] text-sky-500" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">{t('help_support')}</p>
                <p className="text-xs text-muted-foreground">{t('faq_feedback')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <div className="border-t border-border" />
            
            <button
              onClick={handleLogout}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-sm">
                <LogOut className="w-[22px] h-[22px] text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-foreground">{t('lock_wallet')}</p>
                <p className="text-xs text-muted-foreground">{t('require_pin_access')}</p>
              </div>
            </button>
            
            <div className="border-t border-border" />
            
            <button
              onClick={handleDeleteAccount}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-destructive/5 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center shadow-sm">
                <Trash2 className="w-[22px] h-[22px] text-destructive" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-destructive">{t('delete_account')}</p>
                <p className="text-xs text-muted-foreground">{t('remove_data_permanently')}</p>
              </div>
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">{APP_FOOTER_TEXT}</p>
        </div>
      </div>

      {/* Change PIN Modal */}
      <AnimatePresence>
        {showChangePIN && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowChangePIN(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-bold text-foreground mb-6">{t('change_pin')}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    {t('current_pin')}
                  </label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-xl"
                    maxLength={4}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    {t('new_pin')}
                  </label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-xl"
                    maxLength={4}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    {t('confirm_new_pin')}
                  </label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-xl"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowChangePIN(false)}
                  className="flex-1 h-12 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleChangePIN}
                  disabled={currentPin.length !== 4 || newPin.length !== 4 || confirmNewPin.length !== 4}
                  className="flex-1 h-12 rounded-xl bg-base-blue hover:bg-base-blue/90"
                >
                  Update PIN
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup Wallet Modal */}
      <AnimatePresence>
        {showBackup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              setShowBackup(false);
              setBackupPin('');
              setShowPrivateKey(false);
              setPrivateKey('');
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-bold text-foreground mb-2">Backup Wallet</h3>
              
              {!showPrivateKey ? (
                <>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-600">Security Warning</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Never share your private key. Anyone with access can control your funds.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Enter PIN to reveal
                    </label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      value={backupPin}
                      onChange={(e) => setBackupPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-xl"
                      maxLength={4}
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowBackup(false);
                        setBackupPin('');
                      }}
                      className="flex-1 h-12 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleShowBackup}
                      disabled={backupPin.length !== 4}
                      className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Reveal Key
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4">
                    <div className="flex gap-3">
                      <Shield className="w-5 h-5 text-destructive flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Store this key securely offline. Do not screenshot or share.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-card border-2 border-amber-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-amber-500" />
                      <p className="text-xs font-semibold text-amber-600">Private Key</p>
                    </div>
                    <div className="relative bg-muted rounded-lg p-3">
                      <code className="text-xs font-mono text-foreground break-all block pr-10">
                        {showPrivateKey ? privateKey : '•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••'}
                      </code>
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          className="p-1.5 rounded-lg hover:bg-background/50 transition-colors"
                        >
                          {showPrivateKey ? (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCopy(privateKey)}
                          className="p-1.5 rounded-lg hover:bg-background/50 transition-colors"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => {
                      setShowBackup(false);
                      setBackupPin('');
                      setShowPrivateKey(false);
                      setPrivateKey('');
                    }}
                    className="w-full h-12 rounded-xl"
                  >
                    Done
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Support Page */}
      <AnimatePresence>
        {showSupport && (
          <SupportPage onClose={() => setShowSupport(false)} />
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { setShowDeleteConfirm(false); setDeleteStep(1); setDeleteConfirmText(''); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 w-full max-w-sm space-y-4"
            >
              {deleteStep === 1 ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Delete Account</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deleting your account will <span className="font-semibold text-destructive">remove access</span> to your moniTag™ and all associated data. Your wallet private key will be erased from this device. This cannot be undone from the app.
                  </p>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ Any funds remaining in your wallets should be withdrawn first.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteStep(1); }}
                      className="flex-1 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => setDeleteStep(2)}
                      className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90"
                    >
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-destructive" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Final Confirmation</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Type <span className="font-mono font-bold text-destructive">DELETE</span> below to permanently delete your account.
                  </p>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="h-12 text-center font-bold tracking-wider rounded-xl"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteStep(1); setDeleteConfirmText(''); }}
                      className="flex-1 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={executeDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE' || isDeactivating}
                      className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90"
                    >
                      {isDeactivating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Delete Forever
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
