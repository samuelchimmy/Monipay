import { useState, useEffect } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Share, MoreVertical, CheckCircle2, ArrowLeft, Zap, Shield, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { requestNotificationPermission, getNotificationPermission } from '@/lib/notifications';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('default');

  useEffect(() => {
    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check notification permission
    setNotifPermission(getNotificationPermission());

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
  };

  const FEATURES = [
    { icon: <Zap className="w-5 h-5" />, title: 'Instant Payments', desc: 'Gasless stablecoin transfers in seconds' },
    { icon: <Shield className="w-5 h-5" />, title: 'Self-Custodial', desc: 'Your keys, your coins — always' },
    { icon: <WifiOff className="w-5 h-5" />, title: 'Offline Receipts', desc: 'View transaction history without internet' },
    { icon: <Wifi className="w-5 h-5" />, title: 'Push Alerts', desc: 'Get notified when payments arrive' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageMeta
        title="Install MoniPay"
        description="Install MoniPay as a PWA on your phone for instant access to gasless crypto payments. Available on iOS, Android and Web."
        path="/install"
        ogImage="https://monipay.xyz/og/install.png"
      />
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Install MoniPay</h1>
      </div>

      <div className="flex-1 px-6 py-8 max-w-lg mx-auto w-full space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-extrabold text-foreground">
            {isInstalled ? 'MoniPay Installed ✓' : 'Get the App'}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {isInstalled
              ? 'MoniPay is installed on your device. You\'re all set!'
              : 'Install MoniPay on your home screen for the best experience.'}
          </p>
        </motion.div>

        {/* Install Action */}
        {!isInstalled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {deferredPrompt ? (
              <Button onClick={handleInstall} className="w-full h-14 text-base font-bold gap-2" size="lg">
                <Download className="w-5 h-5" />
                Install MoniPay
              </Button>
            ) : isIOS ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Install on iPhone / iPad</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Share className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">1. Tap the Share button</p>
                      <p className="text-xs text-muted-foreground">In Safari's bottom toolbar</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">2. "Add to Home Screen"</p>
                      <p className="text-xs text-muted-foreground">Scroll down in the share menu</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">3. Tap "Add"</p>
                      <p className="text-xs text-muted-foreground">MoniPay will appear on your home screen</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Install on Android</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MoreVertical className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">1. Tap the menu (⋮)</p>
                      <p className="text-xs text-muted-foreground">Top-right in Chrome</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">2. "Install app" or "Add to Home screen"</p>
                      <p className="text-xs text-muted-foreground">Appears in the browser menu</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Notification Permission */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border/60 bg-muted/20 p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Push Notifications</p>
              <p className="text-xs text-muted-foreground">Get alerted for incoming payments</p>
            </div>
            {notifPermission === 'granted' ? (
              <div className="flex items-center gap-1.5 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold">Enabled</span>
              </div>
            ) : notifPermission === 'denied' ? (
              <span className="text-xs text-destructive font-medium">Blocked</span>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEnableNotifications} className="text-xs h-8">
                Enable
              </Button>
            )}
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3"
        >
          {FEATURES.map((f, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
              <div className="text-primary/60">{f.icon}</div>
              <p className="text-xs font-bold text-foreground">{f.title}</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
