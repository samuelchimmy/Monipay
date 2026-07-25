import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { Cloud, Loader2, AlertTriangle, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadBackup, decryptFromBackup } from '@/lib/googleDriveBackup';
import { feedback } from '@/lib/feedback';
import { GOOGLE_CLIENT_ID } from '@/config/app';
import { supabase } from '@/integrations/supabase/client';

interface GoogleDriveRestoreProps {
  onRestore: (privateKey: string, pin: string) => Promise<{ success: boolean; error?: string; profileId?: string; walletAddress?: string }>;
}

function RestoreContent({ onRestore }: GoogleDriveRestoreProps) {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'downloading' | 'decrypting' | 'restoring' | 'success' | 'error' | 'not_found'>('idle');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [backupData, setBackupData] = useState<{ encryptedData: string; iv: string; salt: string; payTag?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      setAccessToken(response.access_token);
      setStatus('downloading');
      
      // Download backup
      const backup = await downloadBackup(response.access_token);
      
      if (!backup) {
        setStatus('not_found');
        setError('No backup found on Google Drive');
        return;
      }

      setBackupData(backup);
      setShowPinInput(true);
      setStatus('idle');
    },
    onError: () => {
      setStatus('error');
      setError('Google sign-in failed');
      feedback('error');
    },
    // Request Drive backup scope + basic identity scopes so we can link
    // the Google account (email + picture) to the restored profile.
    scope: 'openid email profile https://www.googleapis.com/auth/drive.appdata',
  });

  const handleStartRestore = () => {
    setStatus('authenticating');
    setError(null);
    googleLogin();
  };

  const handleDecryptAndRestore = async () => {
    if (pin.length !== 4 || !backupData) return;

    setStatus('decrypting');
    setError(null);

    try {
      // Decrypt the backup
      const privateKey = await decryptFromBackup(
        backupData.encryptedData,
        backupData.iv,
        backupData.salt,
        pin
      );

      setStatus('restoring');

      // Call the restore callback
      const result = await onRestore(privateKey, pin);

      if (result.success) {
        setStatus('success');
        feedback('success');

        // Fire-and-forget: link the Google identity to the restored profile.
        // We need both the access token (to fetch userinfo) and the profile
        // id + wallet address (returned by the import flow) to authorise it.
        if (accessToken && result.profileId && result.walletAddress) {
          (async () => {
            try {
              const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (!uiRes.ok) return;
              const ui = await uiRes.json() as { email?: string; picture?: string };
              if (!ui?.email && !ui?.picture) return;
              await supabase.functions.invoke('check-paytag', {
                body: {
                  action: 'linkGoogle',
                  profileId: result.profileId,
                  walletAddress: result.walletAddress,
                  googleEmail: ui.email,
                  googlePicture: ui.picture,
                },
              });
            } catch (e) {
              console.warn('[GoogleDriveRestore] linkGoogle failed:', e);
            }
          })();
        }
      } else {
        setError(result.error || 'Restore failed');
        setStatus('error');
        feedback('error');
      }
    } catch (e) {
      console.error('Decryption error:', e);
      setError('Incorrect PIN');
      setStatus('idle');
      setShake(true);
      feedback('error');
      setTimeout(() => setShake(false), 500);
    }
  };

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center py-6"
      >
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-success" />
        </div>
        <p className="text-lg font-semibold text-foreground mb-1">Wallet Restored!</p>
        <p className="text-sm text-muted-foreground">Logging you in...</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {!showPinInput ? (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-base-blue/10 flex items-center justify-center mb-3">
              <Cloud className="w-8 h-8 text-base-blue" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Restore from Google Drive</h3>
            <p className="text-sm text-muted-foreground">
              Sign in to retrieve your wallet backup
            </p>
          </div>

          <Button
            onClick={handleStartRestore}
            disabled={status === 'authenticating' || status === 'downloading'}
            className="w-full h-12 bg-base-blue hover:bg-base-blue/90 rounded-xl"
          >
            {status === 'authenticating' || status === 'downloading' ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{status === 'downloading' ? 'Searching...' : 'Connecting...'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                <span>Sign in with Google</span>
              </div>
            )}
          </Button>

          {status === 'not_found' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-600">
                No backup found. Make sure you're using the same Google account.
              </p>
            </motion.div>
          )}

          {status === 'error' && error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}
        </>
      ) : (
        <>
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-success/10 flex items-center justify-center mb-3">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Backup Found!</h3>
            {backupData?.payTag && (
              <p className="text-sm text-base-blue font-medium">@{backupData.payTag}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Enter your PIN to decrypt your wallet
            </p>
          </div>

          <motion.div
            animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError(null);
              }}
              placeholder="••••"
              className="h-14 text-2xl text-center tracking-[0.5em] font-bold rounded-xl"
              maxLength={4}
              disabled={status === 'decrypting' || status === 'restoring'}
              autoFocus
            />
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-destructive"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          <Button
            onClick={handleDecryptAndRestore}
            disabled={pin.length !== 4 || status === 'decrypting' || status === 'restoring'}
            className="w-full h-12 bg-base-blue hover:bg-base-blue/90 rounded-xl"
          >
            {status === 'decrypting' || status === 'restoring' ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{status === 'decrypting' ? 'Decrypting...' : 'Restoring...'}</span>
              </div>
            ) : (
              'Restore Wallet'
            )}
          </Button>
        </>
      )}
    </div>
  );
}

export function GoogleDriveRestore(props: GoogleDriveRestoreProps) {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">Cloud restore not configured</p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <RestoreContent {...props} />
    </GoogleOAuthProvider>
  );
}
