/**
 * useMiniPay.ts — NEW FILE
 * Location: src/hooks/useMiniPay.ts
 *
 * Detects whether the app is running inside MiniPay's webview,
 * connects to the injected wallet, and switches to Celo Mainnet.
 *
 * Returns:
 *   isMiniPay  — null while detecting, false if not MiniPay, true if confirmed
 *   address    — the injected wallet address (null until connected)
 *   isReady    — true once address is confirmed and chain is Celo
 *
 * Used by MiniPay.tsx (the /minipay route) to gate rendering.
 * Has zero effect on any other page/route.
 */

import { useState, useEffect } from 'react';
import { CELO_CHAIN_ID_HEX } from '@/lib/celoWallet';

export interface MiniPayInit {
  /** null = detecting, false = not MiniPay, true = confirmed MiniPay */
  isMiniPay: boolean | null;
  /** Injected wallet address. null until eth_requestAccounts resolves. */
  address: `0x${string}` | null;
  /** True once address is available and chain switch was attempted */
  isReady: boolean;
  /** Non-null if something went wrong during init */
  initError: string | null;
}

export function useMiniPay(): MiniPayInit {
  const [isMiniPay, setIsMiniPay] = useState<boolean | null>(null);
  const [address, setAddress]     = useState<`0x${string}` | null>(null);
  const [isReady, setIsReady]     = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const eth = (window as any).ethereum;

      // Not inside MiniPay
      if (!eth || !eth.isMiniPay) {
        setIsMiniPay(false);
        return;
      }

      setIsMiniPay(true);