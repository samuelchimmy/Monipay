/**
 * MoniPay Name Service (MNS) — On-chain resolution stub.
 *
 * STATUS: SCAFFOLDING ONLY. The MNS smart contract has not been deployed.
 * All resolution continues through Supabase (`check-paytag` / `usePayTagLookup`).
 *
 * When `MNS_ENABLED=true` and a registry contract address is populated on a
 * chain config, future code can route to `resolveMonitagOnChain()` and fall
 * back to Supabase on null. Until then this function is a deliberate no-op
 * so call sites can be wired up incrementally without behavior changes.
 *
 * Intended contract surface (see mem://features/mns-architecture):
 *   register(monitag, owner)
 *   setResolution(monitag, chainId, addr)
 *   resolve(monitag, chainId) view returns (bytes)
 *   ownerOf(monitag) view returns (address)
 *   transfer(monitag, newOwner)
 */
import { MNS_ENABLED } from "@/lib/featureFlags";
import type { SupportedNetwork } from "@/config/chains";

export async function resolveMonitagOnChain(
  _monitag: string,
  _chain: SupportedNetwork,
): Promise<string | null> {
  if (!MNS_ENABLED) return null;
  // Contract not deployed yet — return null so callers fall back to Supabase.
  return null;
}

export function isMnsActive(): boolean {
  return MNS_ENABLED;
}