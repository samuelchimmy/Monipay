import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, Copy, Check, Share2, Printer, Link as LinkIcon, 
  ExternalLink, Loader2, Package, Calendar, Hash, 
  ToggleLeft, AlertTriangle
} from 'lucide-react';
import { usePaymentLinks, PaymentLink } from '@/hooks/usePaymentLinks';
import { feedback } from '@/lib/feedback';
import { APP_CONFIG } from '@/config/app';

interface PaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  product?: {
    id: string;
    name: string;
    price: number;
    icon?: string;
  };
  existingLink?: PaymentLink;
}

export function PaymentLinkModal({ 
  isOpen, 
  onClose, 
  profileId, 
  product, 
  existingLink 
}: PaymentLinkModalProps) {
  const { createLink, updateLink, deactivateLink, isLoading } = usePaymentLinks(profileId);
  
  const [link, setLink] = useState<PaymentLink | null>(existingLink || null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings state
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Create or fetch link on mount
  useEffect(() => {
    if (isOpen && product && !link && !existingLink) {
      createPaymentLink();
    } else if (existingLink) {
      setLink(existingLink);
      setIsActive(existingLink.is_active);
      setUsageLimit(existingLink.usage_limit?.toString() || '');
    }
  }, [isOpen, product, existingLink]);

  const createPaymentLink = async () => {
    if (!product) return;
    
    setIsCreating(true);
    
    const newLink = await createLink({
      name: product.name,
      amount: product.price,
      productId: product.id,
    });
    
    if (newLink) {
      setLink(newLink);
      feedback('success');
    } else {
      feedback('error');
    }
    
    setIsCreating(false);
  };

  const getPaymentUrl = (linkCode: string) => `${APP_CONFIG.paymentUrl}/${linkCode}`;

  const handleCopy = async () => {
    if (!link) return;
    
    await navigator.clipboard.writeText(link.url || getPaymentUrl(link.link_code));
    setCopied(true);
    feedback('copy');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!link) return;
    
    const url = link.url || getPaymentUrl(link.link_code);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pay for ${link.name}`,
          text: `Pay $${link.amount.toFixed(2)} USDC for ${link.name}`,
          url: url,
        });
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handlePrint = () => {
    if (!link) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const url = link.url || getPaymentUrl(link.link_code);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MoniPay Payment Link - ${link.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              padding: 40px; 
              text-align: center; 
            }
            .container { max-width: 400px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            .amount { font-size: 36px; font-weight: bold; color: #0052FF; margin: 16px 0; }
            .qr { margin: 24px 0; }
            .url { 
              font-size: 12px; 
              color: #666; 
              word-break: break-all; 
              padding: 12px; 
              background: #f5f5f5; 
              border-radius: 8px; 
            }
            .footer { margin-top: 24px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${link.name}</h1>
            <div class="amount">$${link.amount.toFixed(2)} USDC</div>
            <div class="qr">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" alt="QR Code" />
            </div>
            <div class="url">${url}</div>
            <div class="footer">Powered by MoniPay • Base Network</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleToggleActive = async () => {
    if (!link) return;
    
    if (isActive) {
      // Deactivate
      const success = await deactivateLink(link.link_code);
      if (success) {
        setIsActive(false);
        setLink(prev => prev ? { ...prev, is_active: false } : null);
        feedback('success');
      }
    } else {
      // Reactivate
      const success = await updateLink(link.link_code, { isActive: true });
      if (success) {
        setIsActive(true);
        setLink(prev => prev ? { ...prev, is_active: true } : null);
        feedback('success');
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!link) return;
    
    const limit = usageLimit ? parseInt(usageLimit) : null;
    const success = await updateLink(link.link_code, { 
      usageLimit: limit || undefined,
    });
    
    if (success) {
      setLink(prev => prev ? { ...prev, usage_limit: limit } : null);
      feedback('success');
      setShowSettings(false);
    } else {
      feedback('error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-base-blue" />
              <h3 className="text-xl font-bold text-foreground">Payment Link</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {isCreating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-base-blue mb-4" />
              <p className="text-muted-foreground">Creating payment link...</p>
            </div>
          ) : link ? (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl mb-4">
                  <QRCodeSVG
                    value={link.url || getPaymentUrl(link.link_code)}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                
                <h4 className="font-semibold text-foreground text-lg">{link.name}</h4>
                <p className="text-2xl font-bold text-base-blue mt-1">
                  ${link.amount.toFixed(2)} USDC
                </p>
                
                {!isActive && (
                  <div className="mt-2 px-3 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded-full">
                    Deactivated
                  </div>
                )}
              </div>

              {/* URL */}
              <div className="bg-muted rounded-xl p-3">
                <p className="font-mono text-xs text-muted-foreground break-all text-center">
                  {link.url || getPaymentUrl(link.link_code)}
                </p>
              </div>

              {/* Stats */}
              {(link.usage_count > 0 || link.usage_limit) && (
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Hash className="w-4 h-4" />
                    <span>{link.usage_count} uses</span>
                  </div>
                  {link.usage_limit && (
                    <div className="flex items-center gap-1">
                      <span>/ {link.usage_limit} max</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  className="rounded-xl flex-col h-auto py-3 gap-1"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                  <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="rounded-xl flex-col h-auto py-3 gap-1"
                >
                  <Share2 className="w-5 h-5" />
                  <span className="text-xs">Share</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  className="rounded-xl flex-col h-auto py-3 gap-1"
                >
                  <Printer className="w-5 h-5" />
                  <span className="text-xs">Print</span>
                </Button>
              </div>

              {/* Settings Toggle */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSettings ? 'Hide Settings' : 'Link Settings'}
              </button>

              {/* Settings Panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="border-t border-border pt-4">
                      {/* Active Toggle */}
                      <div className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-medium text-foreground">Link Active</p>
                          <p className="text-xs text-muted-foreground">
                            Deactivated links cannot accept payments
                          </p>
                        </div>
                        <Switch
                          checked={isActive}
                          onCheckedChange={handleToggleActive}
                          disabled={isLoading}
                        />
                      </div>

                      {/* Usage Limit */}
                      <div className="py-3">
                        <label className="text-sm font-medium text-foreground mb-2 block">
                          Usage Limit (optional)
                        </label>
                        <Input
                          type="number"
                          placeholder="Unlimited"
                          value={usageLimit}
                          onChange={(e) => setUsageLimit(e.target.value)}
                          className="h-10 rounded-xl"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum number of times this link can be used
                        </p>
                      </div>

                      <Button
                        onClick={handleSaveSettings}
                        disabled={isLoading}
                        className="w-full bg-base-blue hover:bg-base-blue/90"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Save Settings
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Failed to create payment link</p>
              <Button
                onClick={createPaymentLink}
                className="mt-4 bg-base-blue hover:bg-base-blue/90"
              >
                Try Again
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
