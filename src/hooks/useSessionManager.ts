import { useEffect, useCallback, useRef } from 'react';

// Storage keys
const SESSION_SETTINGS_KEY = 'monipay_session_settings';
const LAST_ACTIVITY_KEY = 'monipay_last_activity';

export interface SessionSettings {
  autoLockEnabled: boolean;
  autoLockTimeout: number; // in minutes
  highValueThreshold: number; // in USDC
  requireBiometricForHighValue: boolean;
}

const DEFAULT_SETTINGS: SessionSettings = {
  autoLockEnabled: true,
  autoLockTimeout: 5, // 5 minutes
  highValueThreshold: 100, // $100 USDC
  requireBiometricForHighValue: true,
};

// Get session settings from storage
export function getSessionSettings(): SessionSettings {
  try {
    const stored = localStorage.getItem(SESSION_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load session settings:', error);
  }
  return DEFAULT_SETTINGS;
}

// Save session settings to storage
export function saveSessionSettings(settings: Partial<SessionSettings>): SessionSettings {
  const current = getSessionSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// Update last activity timestamp
export function updateLastActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

// Get last activity timestamp
export function getLastActivity(): number {
  const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
  return stored ? parseInt(stored, 10) : Date.now();
}

// Check if session has expired
export function isSessionExpired(): boolean {
  const settings = getSessionSettings();
  if (!settings.autoLockEnabled) return false;
  
  const lastActivity = getLastActivity();
  const timeoutMs = settings.autoLockTimeout * 60 * 1000;
  return Date.now() - lastActivity > timeoutMs;
}

// Check if transaction requires biometric auth
export function requiresBiometricAuth(amount: number): boolean {
  const settings = getSessionSettings();
  return settings.requireBiometricForHighValue && amount >= settings.highValueThreshold;
}

// Hook for auto-lock functionality
export function useSessionManager(
  isUnlocked: boolean,
  onLock: () => void
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const settings = getSessionSettings();

  const resetTimer = useCallback(() => {
    updateLastActivity();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (isUnlocked && settings.autoLockEnabled) {
      const timeoutMs = settings.autoLockTimeout * 60 * 1000;
      timeoutRef.current = setTimeout(() => {
        console.log('Session timeout - locking app');
        onLock();
      }, timeoutMs);
    }
  }, [isUnlocked, settings.autoLockEnabled, settings.autoLockTimeout, onLock]);

  // Set up activity listeners
  useEffect(() => {
    if (!isUnlocked) return;

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Add listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer
    resetTimer();

    // Check on visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background
        updateLastActivity();
      } else {
        // App came to foreground - check if expired
        if (isSessionExpired()) {
          onLock();
        } else {
          resetTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isUnlocked, resetTimer, onLock]);

  // Check session expiry on mount
  useEffect(() => {
    if (isUnlocked && isSessionExpired()) {
      onLock();
    }
  }, [isUnlocked, onLock]);

  return { resetTimer };
}
