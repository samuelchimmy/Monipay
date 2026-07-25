import { motion } from 'framer-motion';
import { ArrowLeft, Key, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoniPayLogo } from './MoniPayLogo';
import { Footer } from './Footer';
import { feedback } from '@/lib/feedback';

interface SignInChoiceProps {
  onImportWallet: () => void;
  onGoogleSignIn: () => void;
  onCreateAccount: () => void;
  onBack: () => void;
}

/* Official Google "G" mark (brand-compliant, inline SVG). */
function GoogleG({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

export function SignInChoice({
  onImportWallet,
  onGoogleSignIn,
  onCreateAccount,
  onBack,
}: SignInChoiceProps) {
  const handle = (fn: () => void) => () => {
    feedback('tap');
    fn();
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col safe-top">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-none">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <MoniPayLogo size={32} color="#0052FF" animationMode="idle" showText textSize={16} />
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="max-w-md mx-auto w-full flex flex-col h-full">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center pt-6 pb-8"
          >
            <h1 className="text-[28px] sm:text-[32px] font-black text-foreground tracking-tight leading-[1.1]">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-[280px] mx-auto">
              Sign in to your MoniPay wallet, or create a new account in 30 seconds.
            </p>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {/* Import MoniPay Wallet — primary */}
            <button
              onClick={handle(onImportWallet)}
              className="w-full p-4 border-2 border-base-blue bg-base-blue text-white hover:bg-base-blue/90 transition-all flex items-center gap-3 text-left rounded-none"
            >
              <div className="w-11 h-11 rounded-none bg-white/15 flex items-center justify-center flex-shrink-0">
                <Key className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight">Import MoniPay Wallet</p>
                <p className="text-[12px] text-white/75 mt-0.5">Use your private key</p>
              </div>
            </button>

            {/* Sign in with Google */}
            <button
              onClick={handle(onGoogleSignIn)}
              className="w-full p-4 border-2 border-foreground/15 bg-card hover:border-foreground/30 hover:bg-muted/40 transition-all flex items-center gap-3 text-left rounded-none"
            >
              <div className="w-11 h-11 rounded-none bg-white border border-foreground/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                <GoogleG size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-foreground leading-tight">Sign in with Google</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Restore from your encrypted Drive backup</p>
              </div>
            </button>

            {/* Create new account */}
            <button
              onClick={handle(onCreateAccount)}
              className="w-full p-4 border-2 border-foreground/15 bg-card hover:border-foreground/30 hover:bg-muted/40 transition-all flex items-center gap-3 text-left rounded-none"
            >
              <div className="w-11 h-11 rounded-none bg-foreground text-background flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-foreground leading-tight">Create a new account</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Generate a fresh wallet on MoniPay</p>
              </div>
            </button>
          </motion.div>

          {/* Reassurance */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="text-[11px] text-muted-foreground text-center mt-8 mb-6 max-w-[300px] mx-auto leading-relaxed"
          >
            Your keys never leave your device. MoniPay is a self-custodial wallet — you own your funds, always.
          </motion.p>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  );
}
