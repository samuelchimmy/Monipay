import { QRCodeSVG } from 'qrcode.react';
import moniPayLogo from '@/assets/monipay-m-logo.png';
import { cn } from '@/lib/utils';

interface BrandedQRCodeProps {
  value: string;
  size?: number;
  className?: string;
  /** Logo container size in Tailwind units (e.g., "w-10 h-10") */
  logoContainerSize?: string;
  /** Logo image size in Tailwind units (e.g., "w-7 h-7") */
  logoSize?: string;
  /** Include margin around QR code */
  includeMargin?: boolean;
}

export function BrandedQRCode({
  value,
  size = 180,
  className,
  logoContainerSize = 'w-10 h-10',
  logoSize = 'w-7 h-7',
  includeMargin = false,
}: BrandedQRCodeProps) {
  return (
    <div className={cn('bg-white p-4 rounded-2xl relative', className)}>
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        includeMargin={includeMargin}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={cn(
            'bg-white rounded-full flex items-center justify-center shadow-md border border-border/50',
            logoContainerSize
          )}
        >
          <img src={moniPayLogo} alt="MoniPay" className={logoSize} />
        </div>
      </div>
    </div>
  );
}
