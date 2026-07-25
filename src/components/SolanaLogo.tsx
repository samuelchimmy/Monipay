import React from 'react';

interface SolanaLogoProps {
  size?: number;
  className?: string;
}

/**
 * Official Solana gradient logo mark
 */
export function SolanaLogo({ size = 20, className = '' }: SolanaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="solana-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="50%" stopColor="#14F195" />
          <stop offset="100%" stopColor="#00C2FF" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="64" fill="black" />
      <g transform="translate(24, 34) scale(0.625)">
        <path
          d="M22.52 80.49a4.23 4.23 0 0 1 2.99-1.24h98.75a2.11 2.11 0 0 1 1.5 3.61l-19.27 19.27a4.23 4.23 0 0 1-2.99 1.24H4.75a2.11 2.11 0 0 1-1.5-3.61L22.52 80.49z"
          fill="url(#solana-grad)"
        />
        <path
          d="M22.52 3.37a4.35 4.35 0 0 1 2.99-1.24h98.75a2.11 2.11 0 0 1 1.5 3.61L106.49 24.99a4.23 4.23 0 0 1-2.99 1.24H4.75a2.11 2.11 0 0 1-1.5-3.61L22.52 3.37z"
          fill="url(#solana-grad)"
        />
        <path
          d="M106.49 41.66a4.23 4.23 0 0 0-2.99-1.24H4.75a2.11 2.11 0 0 0-1.5 3.61l19.27 19.26a4.23 4.23 0 0 0 2.99 1.24h98.75a2.11 2.11 0 0 0 1.5-3.61L106.49 41.66z"
          fill="url(#solana-grad)"
        />
      </g>
    </svg>
  );
}
