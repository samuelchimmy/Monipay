// ═══════════════════════════════════════════════════════════════
// MoniPay Feedback System — Haptics + Howler.js Sound Manager
// ═══════════════════════════════════════════════════════════════

import { soundManager, type SoundName } from './soundManager';

// ── Haptic Patterns ──────────────────────────────────────────

type HapticPattern =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'payment'
  | 'deposit'
  | 'receive'
  | 'scan'
  | 'confirm';

const hapticPatterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [15, 50, 25],
  warning: [30, 30, 30],
  error: [50, 100, 50, 100, 80],
  payment: [20, 40, 20],
  deposit: [15, 30, 15, 30, 40, 60, 80],
  receive: [25, 40, 50, 60, 100],
  scan: [10, 20, 10],
  confirm: [30, 80, 50],
};

export function haptic(pattern: HapticPattern = 'light') {
  if (navigator.vibrate) {
    navigator.vibrate(hapticPatterns[pattern]);
  }
}

// ── Feedback Type → Sound + Haptic Mapping ───────────────────

export type FeedbackType =
  | 'tap'
  | 'press'
  | 'success'
  | 'error'
  | 'payment'
  | 'deposit'
  | 'receive'
  | 'scan'
  | 'copy'
  | 'toggle'
  | 'toggleOff'
  | 'modalOpen'
  | 'modalClose'
  | 'confirm'
  | 'swipe'
  | 'pullRefresh'
  | 'processing'
  | 'alert'
  | 'message'
  | 'balanceUpdate'
  | 'goalAchieved'
  | 'warning'
  | 'pageTransition'
  | 'expand'
  | 'collapse'
  | 'back';

const feedbackMap: Record<FeedbackType, { haptic: HapticPattern; sound: SoundName }> = {
  // Button interactions
  tap:            { haptic: 'light',   sound: 'tap' },
  press:          { haptic: 'medium',  sound: 'press' },
  swipe:          { haptic: 'light',   sound: 'swipe' },
  pullRefresh:    { haptic: 'medium',  sound: 'pullRefresh' },
  toggle:         { haptic: 'light',   sound: 'toggleOn' },
  toggleOff:      { haptic: 'light',   sound: 'toggleOff' },
  copy:           { haptic: 'light',   sound: 'tap' },

  // Transactions
  payment:        { haptic: 'payment', sound: 'paymentSuccess' },
  success:        { haptic: 'success', sound: 'transferComplete' },
  deposit:        { haptic: 'deposit', sound: 'depositConfirmed' },
  receive:        { haptic: 'receive', sound: 'depositConfirmed' },
  scan:           { haptic: 'scan',    sound: 'cardScan' },
  confirm:        { haptic: 'confirm', sound: 'paymentSuccess' },
  processing:     { haptic: 'light',   sound: 'processing' },
  error:          { haptic: 'error',   sound: 'transactionFailed' },

  // Notifications
  alert:          { haptic: 'medium',  sound: 'alert' },
  message:        { haptic: 'light',   sound: 'messageReceived' },
  balanceUpdate:  { haptic: 'light',   sound: 'balanceUpdate' },
  goalAchieved:   { haptic: 'success', sound: 'goalAchieved' },
  warning:        { haptic: 'warning', sound: 'warning' },

  // Navigation
  pageTransition: { haptic: 'light',   sound: 'pageTransition' },
  modalOpen:      { haptic: 'light',   sound: 'modalOpen' },
  modalClose:     { haptic: 'light',   sound: 'modalClose' },
  expand:         { haptic: 'light',   sound: 'expand' },
  collapse:       { haptic: 'light',   sound: 'collapse' },
  back:           { haptic: 'light',   sound: 'back' },
};

// ── Main Feedback Function ───────────────────────────────────

export function feedback(type: FeedbackType) {
  const mapping = feedbackMap[type];
  if (!mapping) return;
  haptic(mapping.haptic);
  soundManager.play(mapping.sound);
}

// ── Re-export soundManager for direct access ─────────────────

export { soundManager } from './soundManager';
