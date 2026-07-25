import { useEffect, useRef, useState } from 'react';
import QRCodeStyling, { Options } from 'qr-code-styling';
import moniPayLogo from '@/assets/monipay-m-logo.png';
import { cn } from '@/lib/utils';
import { Copy, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';

interface BrandedQRProps {
  /** Data to encode in QR (address, JSON, etc.) */
  value: string;
  /** Size of the QR code in pixels */
  size?: number;
  /** Optional PayTag to display (e.g., @username) */
  payTag?: string;
  /** Optional subtitle text (e.g., address or phone) */
  subtitle?: string;
  /** Show copy/share buttons */
  showActions?: boolean;
  /** What to copy when copy button is pressed */
  copyValue?: string;
  /** Additional className for container */
  className?: string;
  /** Use compact mode (smaller frame) */
  compact?: boolean;
}

const QR_OPTIONS: Partial<Options> = {
  type: 'svg',
  margin: 0,
  qrOptions: {
    typeNumber: 0,
    mode: 'Byte',
    errorCorrectionLevel: 'H',
  },
  dotsOptions: {
    type: 'rounded',
    color: '#000000',
  },
  cornersSquareOptions: {
    type: 'square',
    color: '#000000',
  },
  cornersDotOptions: {
    type: 'square',
    color: '#000000',
  },
  backgroundOptions: {
    color: 'transparent',
  },
  imageOptions: {
    crossOrigin: 'anonymous',
    margin: 4,
    imageSize: 0.22,
    hideBackgroundDots: true,
  },
};

// Corner target circle component - positioned relative to QR code
function CornerTarget({ position, size = 44 }: { position: 'tl' | 'tr' | 'bl'; size?: number }) {
  const positionClasses = {
    tl: 'top-0 left-0',
    tr: 'top-0 right-0',
    bl: 'bottom-0 left-0',
  };

  return (
    <div className={cn('absolute', positionClasses[position])}>
      <div 
        className="rounded-full border-[5px] border-black flex items-center justify-center bg-white"
        style={{ width: size, height: size }}
      >
        <div 
          className="rounded-full bg-black" 
          style={{ width: size * 0.35, height: size * 0.35 }}
        />
      </div>
    </div>
  );
}

export function BrandedQR({
  value,
  size = 220,
  payTag,
  subtitle,
  showActions = false,
  copyValue,
  className,
  compact = false,
}: BrandedQRProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null);
  const [copied, setCopied] = useState(false);

  // Frame dimensions - QR fills most of the space
  const frameSize = size + 40;
  const stripePadding = compact ? 8 : 10;
  const qrPadding = compact ? 16 : 20;

  // Initialize QR code
  useEffect(() => {
    if (!qrCode.current) {
      qrCode.current = new QRCodeStyling({
        ...QR_OPTIONS,
        width: size,
        height: size,
        data: value,
        image: moniPayLogo,
      });
    }
  }, []);

  // Append to DOM
  useEffect(() => {
    if (qrRef.current && qrCode.current) {
      qrRef.current.innerHTML = '';
      qrCode.current.append(qrRef.current);
    }
  }, []);

  // Update when value or size changes
  useEffect(() => {
    if (qrCode.current) {
      qrCode.current.update({
        data: value,
        width: size,
        height: size,
      });
    }
  }, [value, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue || value);
      setCopied(true);
      feedback('tap');
      toast.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: payTag ? `Pay ${payTag}` : 'MoniPay',
      text: payTag ? `Send money to ${payTag} on MoniPay` : 'Send money via MoniPay',
      url: copyValue || value,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        feedback('success');
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* The Premium QR Frame */}
      <div
        className="relative rounded-[20px] overflow-hidden"
        style={{ width: frameSize, height: frameSize }}
      >
        {/* Background stripes layer - diagonal lines across entire frame */}
        <svg
          className="absolute inset-0"
          width={frameSize}
          height={frameSize}
          viewBox={`0 0 ${frameSize} ${frameSize}`}
          fill="none"
        >
          {/* Base blue background for corners */}
          <rect width={frameSize} height={frameSize} rx="20" fill="#0052FF" />
          
          {/* Diagonal stripe pattern - runs from top-right to bottom-left direction */}
          {/* Dark stripe */}
          <path 
            d={`M${frameSize * 0.15} 0 L0 ${frameSize * 0.15} L0 ${frameSize * 0.28} L${frameSize * 0.28} 0 Z`}
            fill="#2a2a2a"
          />
          <path 
            d={`M${frameSize} ${frameSize * 0.72} L${frameSize * 0.72} ${frameSize} L${frameSize * 0.85} ${frameSize} L${frameSize} ${frameSize * 0.85} Z`}
            fill="#2a2a2a"
          />
          
          {/* Light blue stripe */}
          <path 
            d={`M${frameSize * 0.28} 0 L0 ${frameSize * 0.28} L0 ${frameSize * 0.38} L${frameSize * 0.38} 0 Z`}
            fill="#93C5FD"
          />
          <path 
            d={`M${frameSize} ${frameSize * 0.62} L${frameSize * 0.62} ${frameSize} L${frameSize * 0.72} ${frameSize} L${frameSize} ${frameSize * 0.72} Z`}
            fill="#93C5FD"
          />
          
          {/* White stripes - 3 thick + 1 thin center */}
          <path 
            d={`M${frameSize * 0.38} 0 L0 ${frameSize * 0.38} L0 ${frameSize * 0.44} L${frameSize * 0.44} 0 Z`}
            fill="white"
          />
          <path 
            d={`M${frameSize} ${frameSize * 0.56} L${frameSize * 0.56} ${frameSize} L${frameSize * 0.62} ${frameSize} L${frameSize} ${frameSize * 0.62} Z`}
            fill="white"
          />
          
          <path 
            d={`M${frameSize * 0.44} 0 L0 ${frameSize * 0.44} L0 ${frameSize * 0.48} L${frameSize * 0.48} 0 Z`}
            fill="white"
          />
          <path 
            d={`M${frameSize} ${frameSize * 0.52} L${frameSize * 0.52} ${frameSize} L${frameSize * 0.56} ${frameSize} L${frameSize} ${frameSize * 0.56} Z`}
            fill="white"
          />
          
          {/* Thin center white stripe */}
          <path 
            d={`M${frameSize * 0.49} 0 L0 ${frameSize * 0.49} L0 ${frameSize * 0.51} L${frameSize * 0.51} 0 Z`}
            fill="white"
          />
          <path 
            d={`M${frameSize} ${frameSize * 0.49} L${frameSize * 0.49} ${frameSize} L${frameSize * 0.51} ${frameSize} L${frameSize} ${frameSize * 0.51} Z`}
            fill="white"
          />
        </svg>

        {/* White QR container - seamlessly integrated */}
        <div 
          className="absolute bg-white rounded-[14px]"
          style={{ 
            top: stripePadding, 
            left: stripePadding, 
            right: stripePadding, 
            bottom: stripePadding 
          }}
        >
          {/* QR Code Container */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ padding: qrPadding - stripePadding }}
          >
            <div
              ref={qrRef}
              className="bg-white"
              style={{ width: size, height: size }}
            />
          </div>


          {/* Center Logo (Small Rounded Square) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className="bg-white rounded-xl flex items-center justify-center shadow-sm"
              style={{ width: size * 0.18, height: size * 0.18 }}
            >
              <img 
                src={moniPayLogo} 
                alt="MoniPay" 
                style={{ width: size * 0.12, height: size * 0.12 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* User Details */}
      {(payTag || subtitle) && (
        <div className="mt-4 text-center">
          {payTag && (
            <p className="text-xl font-bold text-foreground font-mono">
              {payTag.startsWith('@') ? payTag : `@${payTag}`}
            </p>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="flex items-center gap-3 mt-4">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="rounded-full px-6 gap-2 border-border"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            className="rounded-full px-6 gap-2 border-border"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>
      )}
    </div>
  );
}

// Simple version without decorative frame for inline use
export function BrandedQRSimple({
  value,
  size = 180,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!qrCode.current) {
      qrCode.current = new QRCodeStyling({
        ...QR_OPTIONS,
        width: size,
        height: size,
        data: value,
        image: moniPayLogo,
        cornersSquareOptions: {
          type: 'square',
          color: '#000000',
        },
        cornersDotOptions: {
          type: 'square',
          color: '#000000',
        },
      });
    }
  }, []);

  useEffect(() => {
    if (qrRef.current && qrCode.current) {
      qrRef.current.innerHTML = '';
      qrCode.current.append(qrRef.current);
    }
  }, []);

  useEffect(() => {
    if (qrCode.current) {
      qrCode.current.update({
        data: value,
        width: size,
        height: size,
      });
    }
  }, [value, size]);

  return (
    <div className={cn('bg-white p-4 rounded-2xl relative', className)}>
      <div ref={qrRef} style={{ width: size, height: size }} />
      {/* Center Logo (Rounded Square) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
          <img src={moniPayLogo} alt="MoniPay" className="w-7 h-7" />
        </div>
      </div>
    </div>
  );
}
