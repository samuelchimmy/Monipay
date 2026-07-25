import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Code, Key, Eye, EyeOff, Copy, Check, RefreshCw, 
  Link as LinkIcon, ExternalLink, Loader2, AlertTriangle,
  Webhook, Shield, ChevronRight
} from 'lucide-react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { feedback } from '@/lib/feedback';

interface DeveloperSettingsProps {
  profileId: string;
  onClose?: () => void;
}

export function DeveloperSettings({ profileId, onClose }: DeveloperSettingsProps) {
  const { 
    activeKey, 
    isLoading, 
    error, 
    fetchKeys, 
    generateKeys, 
    revokeKey, 
    updateWebhook 
  } = useApiKeys(profileId);

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState<'public' | 'secret' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [showConfirmGenerate, setShowConfirmGenerate] = useState(false);

  // Load keys on mount
  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Set webhook URL from active key
  useEffect(() => {
    if (activeKey?.webhook_url) {
      setWebhookUrl(activeKey.webhook_url);
    }
  }, [activeKey]);

  const handleCopy = async (text: string, type: 'public' | 'secret') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    feedback('copy');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerateKeys = async () => {
    if (activeKey && !showConfirmGenerate) {
      setShowConfirmGenerate(true);
      return;
    }

    setIsGenerating(true);
    setShowConfirmGenerate(false);
    
    const result = await generateKeys();
    
    if (result) {
      setNewSecretKey(result.secretKey);
      setShowSecretKey(true);
      feedback('success');
    } else {
      feedback('error');
    }
    
    setIsGenerating(false);
  };

  const handleSaveWebhook = async () => {
    setIsSavingWebhook(true);
    
    // Basic URL validation
    if (webhookUrl && !webhookUrl.startsWith('http')) {
      feedback('error');
      setIsSavingWebhook(false);
      return;
    }
    
    const success = await updateWebhook(webhookUrl || null);
    
    if (success) {
      feedback('success');
    } else {
      feedback('error');
    }
    
    setIsSavingWebhook(false);
  };

  return (
    <div className="space-y-6">
      {/* API Keys Section */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-base-blue/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-base-blue" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">API Keys</h3>
              <p className="text-xs text-muted-foreground">
                Use these keys to integrate MoniPay with your app
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && !activeKey ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeKey ? (
            <>
              {/* Public Key */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Public Key
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono text-sm text-foreground overflow-hidden">
                    <span className="truncate block">{activeKey.public_key}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(activeKey.public_key, 'public')}
                    className="rounded-xl flex-shrink-0"
                  >
                    {copied === 'public' ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Secret Key */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Secret Key
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono text-sm text-foreground flex items-center gap-2">
                    {showSecretKey && newSecretKey ? (
                      <span className="truncate">{newSecretKey}</span>
                    ) : (
                      <span className="text-muted-foreground">{activeKey.secret_key_preview}</span>
                    )}
                  </div>
                  {newSecretKey && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="rounded-xl flex-shrink-0"
                      >
                        {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(newSecretKey, 'secret')}
                        className="rounded-xl flex-shrink-0"
                      >
                        {copied === 'secret' ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
                
                {newSecretKey && (
                  <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        <strong>Save this secret key now!</strong> It won't be shown again. 
                        Store it securely in your server environment.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Regenerate Button */}
              <AnimatePresence mode="wait">
                {showConfirmGenerate ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl"
                  >
                    <p className="text-sm text-destructive mb-3">
                      This will invalidate your current keys. Are you sure?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleGenerateKeys}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Yes, Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowConfirmGenerate(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Button
                      variant="outline"
                      onClick={handleGenerateKeys}
                      disabled={isGenerating}
                      className="w-full"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Rotate API Keys
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="text-center py-6">
              <Key className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No API keys generated yet</p>
              <Button
                onClick={handleGenerateKeys}
                disabled={isGenerating}
                className="bg-base-blue hover:bg-base-blue/90"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Key className="w-4 h-4 mr-2" />
                )}
                Generate API Keys
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Webhook Section */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Webhook URL</h3>
              <p className="text-xs text-muted-foreground">
                Receive payment notifications at this endpoint
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <Input
              placeholder="https://yoursite.com/webhook/monipay"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <Button
            onClick={handleSaveWebhook}
            disabled={isSavingWebhook}
            className="w-full bg-base-blue hover:bg-base-blue/90"
          >
            {isSavingWebhook ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Save Webhook URL
          </Button>

          <div className="p-3 bg-muted rounded-xl">
            <p className="text-xs text-muted-foreground">
              Webhooks are signed with HMAC-SHA256 using your secret key. 
              Verify the <code className="text-foreground">X-MoniPay-Signature</code> header 
              to ensure authenticity.
            </p>
          </div>
        </div>
      </div>

      {/* Documentation Link */}
      <a
        href="https://docs.monipay.xyz"
        className="block bg-card border border-border rounded-2xl p-4 hover:border-base-blue/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Code className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">API Documentation</h3>
            <p className="text-xs text-muted-foreground">
              Learn how to integrate MoniPay into your app
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </a>
    </div>
  );
}
