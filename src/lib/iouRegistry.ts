/**
 * IOURegistry (MagicPay) — frontend utilities
 *
 * The IOURegistry contract identifies recipients by a keccak256 hash of
 * `${platform}:${userId}` so social handles never appear on-chain.
 *
 * Identity hashing is the single source of truth — bots, edge functions and
 * the frontend MUST all derive the recipientId the exact same way.
 */
import { keccak256, toBytes } from "viem";
import { CHAIN_CONFIGS, type EvmNetwork } from "@/config/chains";

export type IOUPlatform = "discord" | "telegram" | "twitter" | "x";

/**
 * Compute the on-chain recipientId hash.
 * Mirrors `keccak256(abi.encodePacked(platform, ":", userId))` in Solidity.
 */
export function getRecipientId(platform: IOUPlatform | string, userId: string | number): `0x${string}` {
  const normalized = `${String(platform).toLowerCase()}:${String(userId)}`;