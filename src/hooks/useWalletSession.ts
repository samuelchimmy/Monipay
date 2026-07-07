/**
 * useWalletSession — single source of truth for the active auth path.
 *
 * - 'minipay'         : running inside MiniPay WebView, injected wallet auto-connected
 * - 'external_wallet' : MetaMask / Rabby / Coinbase / WalletConnect connected via wagmi
 * - 'legacy'          : standard MoniPay account (PIN + encrypted local key)
 * - 'detecting'       : initial state, hook still resolving
 *
 * Path A (legacy) continues to use PayTagContext — this hook only owns
 * sessions for Paths B and C. The hook is safe to call anywhere wagmi is
 * mounted (App is already wrapped in WagmiWrapper).
 */

import { useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { CELO_CHAIN_ID_HEX } from "@/lib/celoWallet";

export type SessionType =
  | "detecting"
  | "minipay"
  | "external_wallet"
  | "legacy";

export interface WalletSession {
  sessionType: SessionType;
  address: `0x${string}` | null;
  isReady: boolean;
  initError: string | null;
  /** EVM `eth_sendTransaction`-style helper. Null until ready. */
  sendTransaction: ((params: unknown) => Promise<`0x${string}`>) | null;
  /** Personal sign helper. Null until ready. */
  signMessage: ((message: string) => Promise<`0x${string}`>) | null;
}

const hasLegacyProfile = (): boolean => {
  try {
    return !!localStorage.getItem("paytag_profile");
  } catch {
    return false;