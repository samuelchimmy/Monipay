import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, FileText, Loader2, Check, Send } from 'lucide-react';

import { feedback } from '@/lib/feedback';
import { useInvoices, InvoiceItem } from '@/hooks/useInvoices';

interface CartItem {
  product: { id: string; name: string; price: number };
  quantity: number;
}

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  cart: CartItem[];
  amount: number;
  fee: number;
  merchantReceives: number;
  recentTags?: string[];
}

export function SendInvoiceModal({
  isOpen,
  onClose,
  profileId,
  cart,
  amount,
  fee,
  merchantReceives,
  recentTags = [],
}: SendInvoiceModalProps) {
  const [recipientPayTag, setRecipientPayTag] = useState('');
  const [memo, setMemo] = useState('');
  const [tagFocused, setTagFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { createInvoice } = useInvoices(profileId);

  const handleSubmit = async () => {
    const tag = recipientPayTag.replace('@', '').trim();
    
    if (!tag) {
      feedback('error');
      return;
    }

    if (amount < 0.01) {
      feedback('error');
      return;
    }

    setIsSubmitting(true);
    feedback('tap');

    // Convert cart items to invoice items format
    const items: InvoiceItem[] = cart.map(({ product, quantity }) => ({
      name: product.name,
      quantity,
      price: product.price,
    }));

    const result = await createInvoice({
      senderProfileId: profileId,
      recipientPayTag: tag,
      amount,
      items: items.length > 0 ? items : undefined,
      memo: memo.trim() || undefined,
    });

    if (result.success) {
      feedback('payment');
      setIsSuccess(true);
      
      setTimeout(() => {
        setIsSuccess(false);
        setRecipientPayTag('');
        setMemo('');
        onClose();
      }, 2000);
    } else {
      feedback('error');
    }

    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRecipientPayTag('');
      setMemo('');
      setIsSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-3xl p-6 w-full max-w-md"
        >
          {isSuccess ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-20 h-20 mx-auto rounded-full bg-success flex items-center justify-center mb-4"
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>
              <h3 className="text-xl font-bold text-foreground">Invoice Sent!</h3>
              <p className="text-muted-foreground mt-2">
                @{recipientPayTag.replace('@', '')} will receive a notification
              </p>
            </motion.div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-base-blue/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-base-blue" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Send Invoice</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Invoice Summary */}
              <div className="bg-muted rounded-xl p-4 mb-4">
                <div className="text-center mb-3">
                  <span className="text-3xl font-bold text-foreground">
                    ${amount.toFixed(2)}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">USDC</p>
                </div>

                {cart.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-1.5 max-h-24 overflow-y-auto">
                    {cart.map(({ product, quantity }) => (
                      <div key={product.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {product.name} x{quantity}
                        </span>
                        <span className="text-foreground">
                          ${(product.price * quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">You receive</span>
                    <span className="text-success font-medium">${merchantReceives.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Platform fee (1%)</span>
                    <span className="text-foreground">${fee.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Recipient Input */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Send to PayTag
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">@</span>
                    <Input
                      placeholder="username"
                      value={recipientPayTag}
                      onChange={(e) => setRecipientPayTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      onFocus={() => setTagFocused(true)}
                      onBlur={() => setTimeout(() => setTagFocused(false), 150)}
                      className="pl-8 h-12 text-lg rounded-xl"
                      disabled={isSubmitting}
                      autoComplete="off"
                    />
                    {tagFocused && (() => {
                      const filtered = recipientPayTag
                        ? recentTags.filter(tag => tag.includes(recipientPayTag))
                        : recentTags;
                      const suggestions = filtered.slice(0, 5);
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                          {suggestions.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); setRecipientPayTag(tag); setTagFocused(false); }}
                              className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                            >
                              <span className="text-muted-foreground">@</span>
                              <span className="font-medium text-foreground">{tag}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Note (optional)
                  </label>
                  <Input
                    placeholder="Add a note..."
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="h-12 rounded-xl"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || !recipientPayTag.trim()}
                className="w-full h-14 text-lg font-semibold rounded-2xl bg-base-blue hover:bg-base-blue/90"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Send Invoice
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-4">
                The recipient will have 24 hours to pay this invoice
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
