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