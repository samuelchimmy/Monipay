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
