import { motion } from 'framer-motion';

interface ReceiptCardProps {
  className?: string;
}

export function ReceiptCard({ className = '' }: ReceiptCardProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.div
      initial={{ x: -15, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative w-[140px] will-change-transform ${className}`}
    >
      {/* Main receipt body */}
      <div className="bg-card shadow-xl border border-border rounded-t-xl overflow-hidden">
        {/* Receipt content */}
        <div className="p-3 pb-3">
          {/* Header */}
          <p className="text-center text-[8px] text-muted-foreground mb-2">Transaction Receipt</p>
          
          <div className="flex items-center justify-center gap-1 mb-2">
            <div className="w-5 h-5 bg-base-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-[9px]" style={{ fontFamily: 'Montserrat, sans-serif' }}>M</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-xs font-bold text-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>Moni</span>
              <span className="text-xs font-bold text-base-blue" style={{ fontFamily: 'Montserrat, sans-serif' }}>PAY</span>
            </div>
          </div>

          {/* Customer */}
          <p className="text-center text-[10px] font-semibold text-foreground">@customer</p>
          <p className="text-center text-[7px] text-muted-foreground mb-2">{currentDate} • {currentTime}</p>

          {/* Dashed separator */}
          <div className="border-t border-dashed border-border mb-2" />

          {/* Receipt details */}
          <div className="space-y-1 mb-2">
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Receipt #:</span>
              <span className="font-mono text-foreground">E2D73FA7</span>
            </div>
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium text-success">Payment Received</span>
            </div>
          </div>

          {/* Dashed separator */}
          <div className="border-t border-dashed border-border mb-2" />

          {/* Item header */}
          <div className="flex justify-between text-[6px] text-muted-foreground mb-1">
            <span>Item</span>
            <div className="flex gap-2">
              <span>Qty</span>
              <span>Price</span>
            </div>
          </div>

          {/* Item */}
          <div className="flex justify-between text-[7px] mb-2">
            <span className="text-foreground">USDC Transfer</span>
            <div className="flex gap-3">
              <span className="text-foreground">1</span>
              <span className="font-medium text-foreground">$5.00</span>
            </div>
          </div>

          {/* Dashed separator */}
          <div className="border-t border-dashed border-border mb-2" />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">$5.00</span>
            </div>
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Platform Fee (1%)</span>
              <span className="text-muted-foreground">-$0.05</span>
            </div>
            <div className="flex justify-between text-[7px]">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="text-base-blue font-medium text-[6px]">Sponsored ✨</span>
            </div>
          </div>

          {/* Dashed separator */}
          <div className="border-t border-dashed border-border my-2" />

          {/* Total */}
          <div className="flex justify-between text-[9px]">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-bold text-success">$4.95</span>
          </div>

          {/* Thank you */}
          <p className="text-center text-[8px] font-bold text-foreground mt-3 mb-1">THANK YOU!</p>
          <p className="text-center text-[6px] text-muted-foreground mb-2">Powered by MoniPay</p>

          {/* Footer branding */}
          <div className="flex items-center justify-center gap-0.5 mb-1">
            <div className="w-3 h-3 bg-base-blue rounded flex items-center justify-center">
              <span className="text-white font-bold text-[5px]">M</span>
            </div>
            <span className="text-[6px] text-base-blue font-medium">www.monipay.xyz</span>
          </div>
          <p className="text-center text-[5px] text-muted-foreground">Gasless USDC Payments on Base Chain</p>
        </div>
      </div>

      {/* Jagged torn edge at bottom */}
      <svg 
        className="w-full h-2.5 text-card drop-shadow-sm"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
      >
        <path
          d="M0,0 
             L0,5 
             L3,3 L6,6 L9,2 L12,5 L15,3 L18,7 L21,4 L24,6 L27,3 L30,5 
             L33,2 L36,6 L39,4 L42,7 L45,3 L48,5 L51,7 L54,4 L57,6 L60,3 
             L63,5 L66,7 L69,4 L72,6 L75,3 L78,5 L81,7 L84,4 L87,6 L90,3 
             L93,5 L96,7 L100,4
             L100,0 Z"
          fill="currentColor"
        />
      </svg>

      {/* Border overlay for jagged edge */}
      <svg 
        className="absolute bottom-0 left-0 w-full h-2.5 pointer-events-none"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
      >
        <path
          d="M0,5 
             L3,3 L6,6 L9,2 L12,5 L15,3 L18,7 L21,4 L24,6 L27,3 L30,5 
             L33,2 L36,6 L39,4 L42,7 L45,3 L48,5 L51,7 L54,4 L57,6 L60,3 
             L63,5 L66,7 L69,4 L72,6 L75,3 L78,5 L81,7 L84,4 L87,6 L90,3 
             L93,5 L96,7 L100,4"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="0.5"
        />
      </svg>
    </motion.div>
  );
}
