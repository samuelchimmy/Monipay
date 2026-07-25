import React from 'react';
import { TokenUSDT, TokenUSDC } from '@web3icons/react';

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export function TokenIcon({ symbol, size = 16, className = '' }: TokenIconProps) {
  switch (symbol.toUpperCase()) {
    case 'USDT':
      return <TokenUSDT size={size} variant="branded" className={`rounded-full flex-shrink-0 ${className}`} />;
    case 'USDC':
      return <TokenUSDC size={size} variant="branded" className={`rounded-full flex-shrink-0 ${className}`} />;
    case 'USDM':
      return (
        <div 
          className={`rounded-full bg-[#E5B800] flex items-center justify-center text-white font-extrabold shadow-sm flex-shrink-0 ${className}`}
          style={{ width: size, height: size, fontSize: Math.max(9, size * 0.55) }}
        >
          M
        </div>
      );
    case 'G$':
    case 'GOODDOLLAR':
      return (
        <div 
          className={`rounded-full bg-[#00AEFF] flex items-center justify-center text-white font-black shadow-sm flex-shrink-0 ${className}`}
          style={{ width: size, height: size, fontSize: Math.max(9, size * 0.55) }}
        >
          G
        </div>
      );
    default:
      return (
        <div 
          className={`rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold shadow-sm flex-shrink-0 ${className}`}
          style={{ width: size, height: size, fontSize: Math.max(9, size * 0.55) }}
        >
          {symbol.charAt(0).toUpperCase()}
        </div>
      );
  }
}
