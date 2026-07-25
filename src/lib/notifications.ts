// Notification utilities for MoniPay PWA

const NOTIFICATION_PERMISSION_KEY = 'monipay_notifications_enabled';

export function isNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATION_PERMISSION_KEY) === 'true';
}

export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, String(enabled));
}

export function isNotificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  
  const permission = await Notification.requestPermission();
  const granted = permission === 'granted';
  setNotificationsEnabled(granted);
  return granted;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationsSupported()) return 'unsupported';
  return Notification.permission;
}

interface NotifyOptions {
  title: string;
  body: string;
  icon?: string;
  type?: 'payment_received' | 'deposit' | 'invoice_received' | 'invoice_paid';
  tag?: string;
}

export async function sendLocalNotification({ title, body, icon, type, tag }: NotifyOptions) {
  if (!isNotificationsEnabled()) return;
  if (!isNotificationsSupported()) return;
  if (Notification.permission !== 'granted') return;

  // Use service worker registration for persistent notifications
  const registration = await navigator.serviceWorker?.ready;
  if (registration) {
    const options: NotificationOptions & Record<string, unknown> = {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: tag || type || 'monipay',
      data: { type },
    };
    registration.showNotification(title, options);
  } else {
    // Fallback to basic notification
    new Notification(title, { body, icon: icon || '/favicon.ico', tag: tag || type });
  }
}

// Pre-built notification helpers
export function notifyPaymentReceived(amount: number, from: string) {
  sendLocalNotification({
    title: '💰 Payment Received',
    body: `$${amount.toFixed(2)} from ${from}`,
    type: 'payment_received',
    tag: `payment_${Date.now()}`,
  });
}

export function notifyDepositConfirmed(amount: number) {
  sendLocalNotification({
    title: '✅ Deposit Confirmed',
    body: `$${amount.toFixed(2)} USDC deposited to your wallet`,
    type: 'deposit',
    tag: `deposit_${Date.now()}`,
  });
}

export function notifyInvoiceReceived(amount: number, from: string) {
  sendLocalNotification({
    title: '📄 Invoice Received',
    body: `$${amount.toFixed(2)} invoice from ${from}`,
    type: 'invoice_received',
    tag: `invoice_${Date.now()}`,
  });
}

export function notifyInvoicePaid(amount: number, by: string) {
  sendLocalNotification({
    title: '🎉 Invoice Paid',
    body: `$${amount.toFixed(2)} paid by ${by}`,
    type: 'invoice_paid',
    tag: `invoice_paid_${Date.now()}`,
  });
}
