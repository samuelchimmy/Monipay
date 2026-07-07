/**
 * useOnChainIdentity — resolves on-chain names for a wallet address.
 *
 * v1 sources:
 *   - ENS reverse (Ethereum mainnet, via viem getEnsName)
 *   - Base name (Base L2, via viem getEnsName with Base chain)
 *
 * Results are cached in localStorage for 24h keyed by address.
 * Lens / Celo / Farcaster resolution can be added later.
 */

import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet, base } from "viem/chains";

export type NameSource = "ens" | "basename" | "celoname" | "lens" | "farcaster";

export interface OnChainName {
  name: string;
  type: NameSource;
  chain: string;
}

interface CacheEntry {
  ts: number;
  names: OnChainName[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheKey = (addr: string) => `monipay_onchain_names:${addr.toLowerCase()}`;
const LOOKUP_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch(() => { clearTimeout(t); resolve(null); });
  });
}

function readCache(address: string): OnChainName[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.names;
  } catch {
    return null;
  }
}

function writeCache(address: string, names: OnChainName[]) {
  try {
    localStorage.setItem(cacheKey(address), JSON.stringify({ ts: Date.now(), names }));
  } catch { /* ignore */ }
}

export function useOnChainIdentity(address: `0x${string}` | null) {
  const [names, setNames] = useState<OnChainName[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setNames([]);
      return;
    }

    const cached = readCache(address);
    if (cached) {
      setNames(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const results: OnChainName[] = [];

      // Run both lookups in parallel with a hard 4s timeout so the UI never
      // hangs waiting on slow public RPCs (cloudflare-eth, base default).
      const ethClient = createPublicClient({
        chain: mainnet,
        transport: http("https://eth.drpc.org"),
      });
      const baseClient = createPublicClient({
        chain: base,
        transport: http("https://base.drpc.org"),
      });
      const [ens, baseName] = await Promise.all([
        withTimeout(ethClient.getEnsName({ address }), LOOKUP_TIMEOUT_MS),
        withTimeout((baseClient as any).getEnsName?.({ address }) ?? Promise.resolve(null), LOOKUP_TIMEOUT_MS),
      ]);
      if (ens) results.push({ name: ens, type: "ens", chain: "ethereum" });
      if (baseName) results.push({ name: baseName as string, type: "basename", chain: "base" });

      if (cancelled) return;
      setNames(results);
      setIsLoading(false);
      // Cache even empty results so we don't re-spin on every mount.
      writeCache(address, results);
    })();

    return () => { cancelled = true; };
  }, [address]);

  return { names, isLoading };
}