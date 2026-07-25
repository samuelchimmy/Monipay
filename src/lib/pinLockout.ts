// PIN lockout utility with exponential backoff for security

const LOCKOUT_KEY = 'monipay_pin_lockout';
const MAX_ATTEMPTS = 5;

// Exponential backoff durations: 1 min → 5 min → 15 min → 1 hour
const LOCKOUT_DURATIONS_MS = [
  60 * 1000,      // 1 minute
  5 * 60 * 1000,  // 5 minutes
  15 * 60 * 1000, // 15 minutes
  60 * 60 * 1000, // 1 hour
];

// Reset consecutive lockout count after 24 hours of inactivity
const LOCKOUT_RESET_AFTER_MS = 24 * 60 * 60 * 1000;

interface LockoutState {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptTime: number;
  consecutiveLockouts: number;
}

function getLockoutState(): LockoutState {
  try {
    const stored = localStorage.getItem(LOCKOUT_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      
      // Check if we should reset consecutive lockouts after 24 hours of inactivity
      if (state.lastAttemptTime && Date.now() - state.lastAttemptTime > LOCKOUT_RESET_AFTER_MS) {
        return { failedAttempts: 0, lockedUntil: null, lastAttemptTime: 0, consecutiveLockouts: 0 };
      }
      
      return {
        failedAttempts: state.failedAttempts || 0,
        lockedUntil: state.lockedUntil || null,
        lastAttemptTime: state.lastAttemptTime || 0,
        consecutiveLockouts: state.consecutiveLockouts || 0,
      };
    }
  } catch (e) {
    console.error('Error reading lockout state:', e);
  }
  return { failedAttempts: 0, lockedUntil: null, lastAttemptTime: 0, consecutiveLockouts: 0 };
}

function saveLockoutState(state: LockoutState): void {
  try {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving lockout state:', e);
  }
}

function getLockoutDuration(consecutiveLockouts: number): number {
  const index = Math.min(consecutiveLockouts, LOCKOUT_DURATIONS_MS.length - 1);
  return LOCKOUT_DURATIONS_MS[index];
}

export function isLockedOut(): { locked: boolean; remainingSeconds: number } {
  const state = getLockoutState();
  
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    const remainingMs = state.lockedUntil - Date.now();
    return { locked: true, remainingSeconds: Math.ceil(remainingMs / 1000) };
  }
  
  // If lockout has expired, reset the state
  if (state.lockedUntil && Date.now() >= state.lockedUntil) {
    saveLockoutState({
      failedAttempts: 0,
      lockedUntil: null,
      lastAttemptTime: state.lastAttemptTime,
      consecutiveLockouts: state.consecutiveLockouts,
    });
  }
  
  return { locked: false, remainingSeconds: 0 };
}

export function recordFailedAttempt(): { 
  attemptsRemaining: number; 
  isNowLocked: boolean;
  lockoutSeconds: number;
} {
  const state = getLockoutState();
  const newAttempts = state.failedAttempts + 1;
  
  if (newAttempts >= MAX_ATTEMPTS) {
    // Increment consecutive lockout count and calculate duration
    const newConsecutiveLockouts = state.consecutiveLockouts + 1;
    const lockoutDuration = getLockoutDuration(newConsecutiveLockouts - 1);
    const lockedUntil = Date.now() + lockoutDuration;
    
    saveLockoutState({
      failedAttempts: newAttempts,
      lockedUntil,
      lastAttemptTime: Date.now(),
      consecutiveLockouts: newConsecutiveLockouts,
    });
    
    return { 
      attemptsRemaining: 0, 
      isNowLocked: true,
      lockoutSeconds: Math.ceil(lockoutDuration / 1000),
    };
  }
  
  saveLockoutState({
    ...state,
    failedAttempts: newAttempts,
    lockedUntil: null,
    lastAttemptTime: Date.now(),
  });
  
  return { 
    attemptsRemaining: MAX_ATTEMPTS - newAttempts, 
    isNowLocked: false,
    lockoutSeconds: 0,
  };
}

export function resetLockout(): void {
  // Full reset on successful authentication
  saveLockoutState({ 
    failedAttempts: 0, 
    lockedUntil: null, 
    lastAttemptTime: 0,
    consecutiveLockouts: 0,
  });
}

export function getFailedAttempts(): number {
  return getLockoutState().failedAttempts;
}

export function getConsecutiveLockouts(): number {
  return getLockoutState().consecutiveLockouts;
}

export { MAX_ATTEMPTS, LOCKOUT_DURATIONS_MS };
