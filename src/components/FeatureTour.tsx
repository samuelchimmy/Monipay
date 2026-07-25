import { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { MoniPayLogo } from './MoniPayLogo';
import { Check, QrCode, Wallet, ArrowUpRight, Send, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FundWalletModal } from './FundWalletModal';
import { usePayTag } from '@/contexts/PayTagContext';
import { feedback } from '@/lib/feedback';

interface FeatureTourProps {
  onComplete: () => void;
}

/* ── Screen 1: Send Money Instantly ── */
function SendMoneyCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-[260px]"
    >
      {/* Main card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_12px_32px_hsl(var(--foreground)/0.12)]">
        {/* Send header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Send className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-foreground">Sending USDC</p>
            <p className="text-[9px] text-muted-foreground">Gasless · Instant</p>
          </div>
        </div>

        {/* Recipient */}
        <div className="rounded-xl bg-muted/50 p-3 mb-3">
          <p className="text-[9px] text-muted-foreground mb-1">To</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[8px] font-bold text-primary">A</span>
            </div>
            <span className="text-sm font-bold text-foreground">@alice</span>
          </div>
        </div>

        {/* Amount */}
        <div className="text-center mb-3">
          <p className="text-3xl font-black text-foreground tracking-tight">$50.00</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">50.00 USDC on Base</p>
        </div>

        {/* Fee line */}
        <div className="flex items-center justify-between text-[9px] mb-3 px-1">
          <span className="text-muted-foreground">Network Fee</span>
          <span className="font-semibold text-primary">Sponsored ✨</span>
        </div>

        {/* Confirm button mock */}
        <div className="rounded-xl bg-primary py-2.5 text-center">
          <p className="text-[11px] font-bold text-primary-foreground">Confirm & Send</p>
        </div>
      </div>

      {/* Success toast */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.9, type: 'spring', stiffness: 220, damping: 20 }}
        className="mx-auto mt-3 w-[200px] rounded-xl border border-success/30 bg-card p-2.5 text-center shadow-lg"
      >
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center">
            <Check className="w-3 h-3 text-success" strokeWidth={3} />
          </div>
          <p className="text-[10px] font-bold text-foreground">Sent in 10 seconds</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Screen 2: Payment Terminal (Receipt) ── */
function PaymentTerminalCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-[220px]"
    >
      {/* Receipt card */}
      <div className="rounded-t-2xl border border-border bg-card overflow-hidden shadow-[0_12px_32px_hsl(var(--foreground)/0.12)]">
        <div className="p-4">
          {/* Logo */}
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-5 h-5 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[8px]" style={{ fontFamily: 'Montserrat, sans-serif' }}>M</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-[11px] font-bold text-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>Moni</span>
              <span className="text-[11px] font-bold text-primary" style={{ fontFamily: 'Montserrat, sans-serif' }}>PAY</span>
            </div>
          </div>

          <p className="text-center text-[8px] text-muted-foreground mb-2">Transaction Receipt</p>

          <p className="text-center text-[10px] font-semibold text-foreground">@shopkeeper</p>
          <p className="text-center text-[7px] text-muted-foreground mb-2">Feb 25, 2026 · 2:15 PM</p>

          <div className="border-t border-dashed border-border mb-2" />

          {/* Items */}
          <div className="space-y-1 mb-2">
            <div className="flex justify-between text-[8px]">
              <span className="text-foreground">Premium Headphones</span>
              <span className="font-semibold text-foreground">$89.00</span>
            </div>
            <div className="flex justify-between text-[8px]">
              <span className="text-foreground">USB-C Cable</span>
              <span className="font-semibold text-foreground">$12.00</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border mb-2" />

          <div className="space-y-1 mb-2">
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">$101.00</span>
            </div>
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Fee (1%)</span>
              <span className="text-muted-foreground">-$1.01</span>
            </div>
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="text-primary font-medium text-[6px]">Sponsored ✨</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border my-2" />

          <div className="flex justify-between text-[10px]">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-black text-success">$99.99</span>
          </div>

          <p className="text-center text-[7px] font-bold text-foreground mt-3">PAYMENT CONFIRMED ✓</p>
          <p className="text-center text-[6px] text-muted-foreground mt-1">Powered by MoniPay</p>
        </div>
      </div>

      {/* Torn edge */}
      <svg className="w-full h-2.5 text-card" viewBox="0 0 100 10" preserveAspectRatio="none">
        <path
          d="M0,0 L0,5 L3,3 L6,6 L9,2 L12,5 L15,3 L18,7 L21,4 L24,6 L27,3 L30,5 L33,2 L36,6 L39,4 L42,7 L45,3 L48,5 L51,7 L54,4 L57,6 L60,3 L63,5 L66,7 L69,4 L72,6 L75,3 L78,5 L81,7 L84,4 L87,6 L90,3 L93,5 L96,7 L100,4 L100,0 Z"
          fill="currentColor"
        />
      </svg>
    </motion.div>
  );
}

/* ── Screen 3: MoniBot AI ── */
function MoniBotCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-[270px]"
    >
      {/* Tweet card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_12px_32px_hsl(var(--foreground)/0.12)]">
        {/* Tweet header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
            <Bot className="w-4 h-4 text-background" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-foreground">@monibot</p>
            <p className="text-[9px] text-muted-foreground">AI Payment Agent</p>
          </div>
        </div>

        {/* Command */}
        <div className="rounded-xl bg-muted/50 p-3 mb-3">
          <p className="text-[11px] text-foreground leading-relaxed">
            <span className="text-primary font-semibold">@you</span> tweeted:
          </p>
          <p className="text-[11px] text-foreground leading-relaxed mt-1 font-medium">
            "@monibot send $5 to @alice, @bob, @charlie"
          </p>
        </div>

        {/* Results */}
        <div className="space-y-2">
          {['@alice', '@bob', '@charlie'].map((name) => (
            <div key={name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-success" strokeWidth={3} />
                </div>
                <span className="text-[10px] font-semibold text-foreground">{name}</span>
              </div>
              <span className="text-[10px] font-bold text-success">$5.00 ✓</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-3 pt-2">
          <p className="text-[9px] text-muted-foreground text-center">3 payments · 0 gas fees · 12 seconds</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Screen 4: MagicPay (green-gradient receipt — mirrors homepage MagicPaySection) ── */
function MagicPayCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-[260px]"
    >
      <div
        className="w-full rounded-2xl p-5 text-white shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 60%, #14532d 100%)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase opacity-80">MagicPay</span>
          </div>
          <span className="text-[8px] font-bold px-2 py-0.5 bg-white/15 rounded-full">Pending Claim</span>
        </div>
        <p className="text-[10px] opacity-70 mb-1">You received</p>
        <p className="text-3xl font-extrabold tracking-tight mb-1">$25.00</p>
        <p className="text-[10px] opacity-80 mb-5">USDC on Base · from @alex</p>
        <div className="space-y-1.5 text-[10px] opacity-80 mb-5">
          <div className="flex justify-between"><span>Recipient</span><span className="font-mono">@you</span></div>
          <div className="flex justify-between"><span>Escrow</span><span>Non-custodial</span></div>
          <div className="flex justify-between"><span>Expires</span><span>in 7 days</span></div>
        </div>
        <div className="w-full bg-white text-green-800 font-bold text-[11px] py-2.5 rounded-full text-center">
          Claim $25.00 →
        </div>
        <p className="text-[9px] opacity-60 text-center mt-2.5">No wallet? No problem. We'll create one.</p>
      </div>
    </motion.div>
  );
}

const BASE_SCREENS = [
  {
    visual: SendMoneyCard,
    title: 'Send Money\nInstantly',
    subtitle: 'Type @username and an amount. Money arrives in 10 seconds. Gasless. No complicated addresses.',
  },
  {
    visual: PaymentTerminalCard,
    title: 'Your Phone is a\nPayment Terminal',
    subtitle: 'Share a payment link, run an online store, show a QR code, or send an invoice. Get paid in stablecoins.',
  },
  {
    visual: MoniBotCard,
    title: 'AI That Sends\nPayments for You',
    subtitle: 'Tweet @monibot send $5 to @alice and watch it happen. Campaigns on X & Discord — autonomously.',
  },
  {
    visual: MagicPayCard,
    title: 'MagicPay to\nAnyone, Anywhere',
    subtitle: 'Send stablecoins to any @handle on X, Discord, or Telegram. Funds sit in non-custodial escrow until they claim. Sender-refundable.',
  },
];

const CELO_SCREENS = [
  {
    visual: SendMoneyCard,
    title: 'Gasless USDT\non Celo',
    subtitle: 'Send USDT to any MoniTag™ on Celo. Zero gas, zero complexity. Built for mobile-first markets.',
  },
  {
    visual: MoniBotCard,
    title: 'MoniBot AI\nAgent on Celo',
    subtitle: 'Autonomous AI payments via Twitter, Discord, and Telegram. Send, receive, and run campaigns on Celo.',
  },
  {
    visual: PaymentTerminalCard,
    title: 'Full Merchant\nSuite',
    subtitle: 'Product catalog, invoices, QR codes, and payment links. Everything a merchant needs on Celo.',
  },
  {
    visual: MagicPayCard,
    title: 'MagicPay on Celo',
    subtitle: 'Send USDT to any social handle. Funds stay in non-custodial escrow until the recipient claims with their MoniTag™.',
  },
];

const SOLANA_SCREENS = [
  {
    visual: SendMoneyCard,
    title: 'USDC on Solana\nIn ~400ms',
    subtitle: 'Send USDC to any MoniTag™ on Solana. Sub-cent fees, ~400ms finality. The fastest payment experience in crypto.',
  },
  {
    visual: MoniBotCard,
    title: 'MoniBot Agent\non Solana',
    subtitle: 'Autonomous AI payments via Twitter, Discord, and Telegram. Campaign grants and P2P transfers on Solana.',
  },
  {
    visual: PaymentTerminalCard,
    title: 'Accept Payments\non Solana',
    subtitle: 'QR codes, payment links, invoices, and a full merchant suite. Accept USDC on Solana with 1% fees.',
  },
  {
    visual: MagicPayCard,
    title: 'MagicPay on Solana',
    subtitle: 'Send USDC by social handle on Solana. Non-custodial escrow until claimed. Sender-refundable.',
  },
];

export function FeatureTour({ onComplete }: FeatureTourProps) {
  const { profile, isCeloMode, isSolanaMode } = usePayTag();
  const SCREENS = isSolanaMode ? SOLANA_SCREENS : isCeloMode ? CELO_SCREENS : BASE_SCREENS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showFundWallet, setShowFundWallet] = useState(false);

  const totalScreens = SCREENS.length + 1;
  const isLastScreen = currentIndex === totalScreens - 1;
  const isFeatureScreen = currentIndex < SCREENS.length;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalScreens) return;
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
      feedback('tap');
    },
    [currentIndex, totalScreens]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const threshold = 50;
      if (info.offset.x < -threshold) goTo(currentIndex + 1);
      else if (info.offset.x > threshold) goTo(currentIndex - 1);
    },
    [currentIndex, goTo]
  );

  const handleComplete = () => {
    feedback('confirm');
    onComplete();
  };

  const handleNext = () => {
    if (isLastScreen) {
      handleComplete();
    } else {
      goTo(currentIndex + 1);
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 260 : -260, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -260 : 260, opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 290, damping: 32 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col"
          >
            {isFeatureScreen ? (
              <>
                {/* Solid color top section */}
                <div className="relative flex-[1.1] overflow-hidden bg-primary">
                  {/* Subtle circles — no gradient */}
                  <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-primary-foreground/8" />
                  <div className="absolute -right-12 top-12 h-32 w-32 rounded-full bg-primary-foreground/8" />
                  {/* Curved bottom edge */}
                  <div className="absolute -bottom-20 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-[100%] bg-background" />

                  <div className="relative z-10 flex h-full items-center justify-center px-6 pb-10 pt-12">
                    {(() => {
                      const Visual = SCREENS[currentIndex].visual;
                      return <Visual />;
                    })()}
                  </div>
                </div>

                {/* Text section */}
                <div className="flex-[0.9] px-8 pt-6 text-center">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.45 }}
                    className="whitespace-pre-line text-[32px] font-black leading-[1.1] tracking-tight text-foreground"
                  >
                    {SCREENS[currentIndex].title}
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.45 }}
                    className="mx-auto mt-3 max-w-xs text-[14px] leading-relaxed text-muted-foreground"
                  >
                    {SCREENS[currentIndex].subtitle}
                  </motion.p>
                </div>
              </>
            ) : (
              /* ── Last Screen ── */
              <div className="flex flex-1 flex-col">
                <div className="relative flex-[1.1] overflow-hidden bg-primary">
                  <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-primary-foreground/8" />
                  <div className="absolute -right-12 top-12 h-32 w-32 rounded-full bg-primary-foreground/8" />
                  <div className="absolute -bottom-20 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-[100%] bg-background" />

                  <div className="relative z-10 flex h-full items-center justify-center px-6 pb-10 pt-12">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 210, damping: 20 }}
                      className="relative"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.18, 1], opacity: [0.32, 0.08, 0.32] }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-full bg-primary-foreground/20 blur-2xl"
                        style={{ margin: -30 }}
                      />
                      <MoniPayLogo size={104} color="hsl(var(--primary-foreground))" animationMode="splash" />
                    </motion.div>
                  </div>
                </div>

                <div className="flex-[0.9] px-8 pt-6 text-center">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.45 }}
                    className="text-[32px] font-black leading-[1.1] tracking-tight text-foreground"
                  >
                    Ready to Send{'\n'}Money?
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.45 }}
                    className="mx-auto mt-3 max-w-xs text-[14px] leading-relaxed text-muted-foreground"
                  >
                    Your wallet is set up. Start sending and receiving payments instantly.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.36, duration: 0.45 }}
                    className="mx-auto mt-8 w-full max-w-xs space-y-3"
                  >
                    <Button
                      size="lg"
                      onClick={handleComplete}
                      className="h-14 w-full rounded-xl text-base font-black"
                    >
                      ENTER
                    </Button>

                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setShowFundWallet(true)}
                      className="h-14 w-full gap-2 rounded-xl border-0 bg-foreground text-base font-bold text-background hover:bg-foreground/90"
                    >
                      <Wallet className="h-5 w-5" />
                      Fund Wallet
                    </Button>
                  </motion.div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation — feature screens only */}
      {!isLastScreen && (
        <div className="relative z-10 px-6 pb-8">
          <div className="mb-6 flex items-center justify-center gap-2">
            {Array.from({ length: totalScreens }).map((_, i) => (
              <button key={i} onClick={() => goTo(i)} className="p-0.5">
                <motion.div
                  animate={{
                    width: i === currentIndex ? 22 : 8,
                    backgroundColor: i === currentIndex
                      ? 'hsl(var(--foreground))'
                      : 'hsl(var(--muted-foreground) / 0.3)',
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="h-2 rounded-full"
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={handleComplete}
              className="h-14 flex-1 rounded-xl border-0 bg-foreground text-base font-bold text-background hover:bg-foreground/90"
            >
              Skip
            </Button>

            <Button
              size="lg"
              onClick={handleNext}
              className="h-14 flex-1 rounded-xl text-base font-black"
            >
              NEXT
            </Button>
          </div>
        </div>
      )}

      <FundWalletModal
        isOpen={showFundWallet}
        onClose={() => setShowFundWallet(false)}
        walletAddress={profile?.wallet?.address || ''}
        defaultNetwork={profile?.preferredNetwork}
        onDepositSuccess={() => {}}
      />
    </motion.div>
  );
}
