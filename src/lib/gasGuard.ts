/**
 * gasGuard.ts
 *
 * Proactive low-gas detection that runs **before** the user is asked to sign
 * an approval (MagicPay router, CasualPay router, network activation, etc.).
 *
 * If the wallet's native balance on the target chain is below the activation
 * threshold, we call the existing `activation-funder` edge function which
 * tops up the wallet (bypassing the device rate-limit for known wallets via
 * its `isTopUp` branch). We then poll briefly so the caller can sign as soon
 * as gas lands.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupportedNetwork } from "@/config/chains";

type FundChain = "BASE" | "BSC" | "CELO" | "INK";

function toFundChain(network: SupportedNetwork): FundChain | null {
  if (network === "base") return "BASE";
  if (network === "bsc") return "BSC";
  if (network === "celo") return "CELO";
  if (network === "ink") return "INK";
  return null; // tempo (fee-sponsored) and solana don't need native gas
}

export interface GasGuardResult {
  funded: boolean;
  reason?: string;
  alreadyFunded?: boolean;
  pending?: boolean;
}

/**
 * Ensure the wallet has enough native gas to sign one approval on `network`.
 * Returns `{ funded: true }` if the wallet already has enough OR if a top-up
 * succeeded. Returns `{ funded: false, reason }` otherwise — caller should
 * surface a toast instead of attempting the on-chain write blindly.
 */
export async function ensureGasForApproval(
  network: SupportedNetwork,
  walletAddress: string,
): Promise<GasGuardResult> {
  const chain = toFundChain(network);
  if (!chain) return { funded: true };           // tempo / solana
  if (!walletAddress) return { funded: false, reason: "missing wallet" };

  try {
    const { getDeviceId } = await import("@/lib/deviceId");
    const deviceId = getDeviceId();

    // 1) Quick balance check.
    const check = await supabase.functions.invoke<any>("activation-funder", {
      body: { action: "checkGasBalance", walletAddress, chain },
    });
    if (!check.error && check.data?.hasEnoughForActivation) {
      return { funded: true, alreadyFunded: true };
    }

    // 2) Request top-up. `fund` already handles top-ups for existing wallets.
    const topup = await supabase.functions.invoke<any>("activation-funder", {
      body: { action: "fund", walletAddress, chain, deviceId },
    });

    if (topup.error) {
      console.warn("[gasGuard] fund call errored:", topup.error);
      return { funded: false, reason: "Top-up request failed" };
    }
    const data = topup.data;
    if (data?.alreadyFunded) return { funded: true, alreadyFunded: true };
    if (data?.success) {
      // Wait briefly for the tx to land. Celo ~5s block time, others ~2-3s.
      await new Promise((r) => setTimeout(r, chain === "CELO" ? 8000 : 6000));
      return { funded: true };
    }
    if (data?.funderEmpty) {
      return { funded: false, reason: data?.error || "Activation funder is temporarily low. Please try again shortly." };
    }
    if (data?.pending) {
      return { funded: false, pending: true, reason: data?.message || "Top-up pending" };
    }
    return { funded: false, reason: data?.error || "Top-up did not complete" };
  } catch (err: any) {
    console.warn("[gasGuard] unexpected error:", err);
    return { funded: false, reason: err?.message || "Gas guard failed" };
  }
}