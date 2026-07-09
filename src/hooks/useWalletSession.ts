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
  }
};

export function useWalletSession(): WalletSession {
  const [sessionType, setSessionType] = useState<SessionType>("detecting");
  const [miniPayAddress, setMiniPayAddress] = useState<`0x${string}` | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const { address: wagmiAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // MiniPay detection runs once on mount. Wagmi state is layered on top.
  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const eth = (typeof window !== "undefined" ? (window as any).ethereum : null) as any;

      if (eth?.isMiniPay) {
        try {
          const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
          if (!accounts?.length) throw new Error("MiniPay returned no accounts");
          if (cancelled) return;

          // Best-effort Celo switch — ignore errors, MiniPay defaults to Celo.
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: CELO_CHAIN_ID_HEX }],
            });
          } catch (switchErr: any) {
            if (switchErr?.code === 4902) {
              try {
                await eth.request({
                  method: "wallet_addEthereumChain",
                  params: [{
                    chainId: CELO_CHAIN_ID_HEX,
                    chainName: "Celo Mainnet",
                    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
                    rpcUrls: ["https://forno.celo.org"],
                    blockExplorerUrls: ["https://celoscan.io"],
                  }],
                });
              } catch { /* ignore */ }
            }
          }

          if (cancelled) return;
          setMiniPayAddress((accounts[0] as `0x${string}`).toLowerCase() as `0x${string}`);
          setSessionType("minipay");
          setIsReady(true);
          return;
        } catch (err: any) {
          if (cancelled) return;
          setInitError(err?.message ?? "MiniPay init failed");
          setSessionType("minipay");
          setIsReady(true);
          return;
        }
      }

      // Not MiniPay. Resolve between external_wallet and legacy.
      if (cancelled) return;
      if (isConnected && wagmiAddress) {
        setSessionType("external_wallet");
      } else {
        setSessionType(hasLegacyProfile() ? "legacy" : "legacy");
      }
      setIsReady(true);
    }

    detect();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to wagmi connect/disconnect after initial detection (skip MiniPay).
  useEffect(() => {
    if (!isReady) return;
    if (sessionType === "minipay") return;
    if (isConnected && wagmiAddress) {
      setSessionType("external_wallet");
    } else if (sessionType === "external_wallet") {
      setSessionType("legacy");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, wagmiAddress]);

  const address: `0x${string}` | null =
    sessionType === "minipay"
      ? miniPayAddress
      : sessionType === "external_wallet" && wagmiAddress
        ? (wagmiAddress.toLowerCase() as `0x${string}`)
        : null;

  const sendTransaction = useMemo(() => {
    if (sessionType === "minipay") {
      return async (params: unknown): Promise<`0x${string}`> => {
        const eth = (window as any).ethereum;
        try {
          // CIP-64 Fee Abstraction: Remove EIP-1559 fields for MiniPay
          const txParams = { ...(params as any) };
          delete txParams.maxFeePerGas;
          delete txParams.maxPriorityFeePerGas;
          
          // Inject USDm as the default fee currency if none provided
          if (!txParams.feeCurrency) {
            txParams.feeCurrency = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
          }

          return await eth.request({ method: "eth_sendTransaction", params: [txParams] });
        } catch (err: any) {
          const errMsg = err?.message?.toLowerCase() || '';
          if (errMsg.includes('insufficient funds') || errMsg.includes('gas required exceeds allowance') || errMsg.includes('insufficient balance')) {
            // Low-Balance Redirect Rule for MiniPay Grant
            window.location.href = 'https://link.minipay.xyz/add_cash?tokens=USDm,USDC,USDT';
            await new Promise(() => {}); // Prevent resolution/further execution
          }
          throw err;
        }
      };
    }
    if (sessionType === "external_wallet" && walletClient) {
      return async (params: unknown): Promise<`0x${string}`> => {
        // wagmi/viem signature differs from raw eth_sendTransaction; pass through.
        // Callers should construct a viem-compatible request object.
        return await (walletClient as any).sendTransaction(params);
      };
    }
    return null;
  }, [sessionType, walletClient]);

  const signMessage = useMemo(() => {