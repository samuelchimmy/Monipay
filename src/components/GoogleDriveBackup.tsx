import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { Cloud, Check, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  encryptForBackup, 
  uploadBackup, 
  checkBackupExists 
} from '@/lib/googleDriveBackup';
import { decryptPrivateKey } from '@/lib/wallet';
import { verifyPinHash, isPinHashed } from '@/lib/pinHash';
import { feedback } from '@/lib/feedback';
import { GOOGLE_CLIENT_ID } from '@/config/app';

interface GoogleDriveBackupProps {
  encryptedPrivateKey: string;
  storedPinHash: string;
  payTag: string;
}

function BackupContent({ encryptedPrivateKey, storedPinHash, payTag }: GoogleDriveBackupProps) {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'checking' | 'verifying' | 'backing_up' | 'success' | 'error' | 'conflict'>('idle');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [existingBackupDate, setExistingBackupDate] = useState<number | null>(null);
  const [existingPayTag, setExistingPayTag] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingOverwrite, setPendingOverwrite] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      setAccessToken(response.access_token);
      setStatus('checking');
      
      // Check for existing backup (conflict detection)
      try {
        const result = await checkBackupExists(response.access_token);
        if (result.exists && result.timestamp) {
          setExistingBackupDate(result.timestamp);
          // For updates (same account), show PIN input directly
          // The conflict dialog is mainly for NEW accounts trying to backup
          setLastBackup(result.timestamp);
        }
      } catch (e) {
        console.error('Failed to check backup:', e);
      }
      
      setStatus('idle');
      setShowPinInput(true);
    },
    onError: () => {
      setStatus('error');
      setError('Google sign-in failed');
      feedback('error');
    },
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  });

  const handleStartBackup = () => {
    setStatus('authenticating');
    setError(null);
    googleLogin();
  };

  const handleBackup = async (forceOverwrite = false) => {
    if (pin.length !== 4 || !accessToken) return;

    setStatus('verifying');
    setError(null);

    try {
      // Verify PIN
      let isPinValid = false;
      if (isPinHashed(storedPinHash)) {
        isPinValid = await verifyPinHash(pin, storedPinHash);
      } else {
        isPinValid = pin === storedPinHash;
      }

      if (!isPinValid) {
        setError('Incorrect PIN');
        setStatus('idle');
        feedback('error');
        return;
      }

      // Check for existing backup if this is the first backup attempt (not an update)
      if (!lastBackup && !forceOverwrite && existingBackupDate) {
        // There's an existing backup from a different wallet - show conflict
        setStatus('conflict');
        setShowConflictDialog(true);
        return;
      }

      setStatus('backing_up');

      // Decrypt private key with PIN
      const privateKey = decryptPrivateKey(encryptedPrivateKey, pin);

      // Encrypt for backup (with fresh salt/iv)
      const { encryptedData, iv, salt } = await encryptForBackup(privateKey, pin);

      // Upload to Google Drive
      const result = await uploadBackup(accessToken, encryptedData, iv, salt, payTag);

      if (result.success) {
        setStatus('success');
        setLastBackup(result.timestamp || Date.now());
        setShowConflictDialog(false);
        feedback('success');
      } else {
        setError(result.error || 'Backup failed');
        setStatus('error');
        feedback('error');
      }
    } catch (e) {
      console.error('Backup error:', e);
      setError('Failed to backup wallet');
      setStatus('error');
      feedback('error');
    }
  };

  const handleOverwrite = () => {
    setShowConflictDialog(false);
    handleBackup(true);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          status === 'success' || lastBackup ? 'bg-success/10' : 'bg-base-blue/10'
        }`}>
          {status === 'success' || lastBackup ? (
            <Check className="w-5 h-5 text-success" />
          ) : (
            <Cloud className="w-5 h-5 text-base-blue" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">Google Drive Backup</p>
          <p className="text-xs text-muted-foreground">
            {lastBackup 
              ? `Last backup: ${formatDate(lastBackup)}`
              : 'Securely backup your wallet to cloud'
            }
          </p>
        </div>
        {!showPinInput && status !== 'success' && (
          <Button
            size="sm"
            variant={lastBackup ? 'outline' : 'default'}
            onClick={handleStartBackup}
            disabled={status === 'authenticating'}
            className={lastBackup ? '' : 'bg-base-blue hover:bg-base-blue/90'}
          >
            {status === 'authenticating' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : lastBackup ? (
              <><RefreshCw className="w-4 h-4 mr-1.5" /> Update</>
            ) : (
              'Backup'
            )}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {showPinInput && status !== 'success' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">
                Enter your PIN to encrypt and backup your wallet
              </p>
              
              <div className="flex gap-3">
                <Input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="h-12 text-xl text-center tracking-[0.5em] font-bold rounded-xl flex-1"
                  maxLength={4}
                  disabled={status === 'verifying' || status === 'backing_up'}
                />
                <Button
                  onClick={() => handleBackup()}
                  disabled={pin.length !== 4 || status === 'verifying' || status === 'backing_up'}
                  className="h-12 px-6 bg-base-blue hover:bg-base-blue/90"
                >
                  {status === 'verifying' || status === 'backing_up' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Cloud className="w-5 h-5" />
                  )}
                </Button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 mt-3 text-destructive"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border">
              <div className="bg-success/10 rounded-xl p-3 flex items-center gap-3">
                <Check className="w-5 h-5 text-success" />
                <p className="text-sm text-success font-medium">
                  Wallet backed up successfully!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conflict Dialog */}
      <AnimatePresence>
        {showConflictDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-3xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Existing Backup Found</h3>
                  <p className="text-sm text-muted-foreground">
                    From {existingBackupDate ? formatDate(existingBackupDate) : 'an earlier date'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                We found a wallet backup in your Google Drive. Overwriting will replace the old backup permanently.
              </p>

              <div className="space-y-3">
                <Button
                  onClick={handleOverwrite}
                  variant="destructive"
                  className="w-full h-12 rounded-xl"
                >
                  Overwrite with Current Wallet
                </Button>
                <Button
                  onClick={() => {
                    setShowConflictDialog(false);
                    setStatus('idle');
                  }}
                  variant="outline"
                  className="w-full h-12 rounded-xl"
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                ⚠️ This action cannot be undone
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GoogleDriveBackup(props: GoogleDriveBackupProps) {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden opacity-50">
        <div className="px-4 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Cloud className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Google Drive Backup</p>
            <p className="text-xs text-muted-foreground">Not configured</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BackupContent {...props} />
    </GoogleOAuthProvider>
  );
}
