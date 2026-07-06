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
  return keccak256(toBytes(normalized));
}

/**
 * Minimal IOURegistry ABI used by the frontend.
 * Includes the new batched executeCreate / batchClaim / batchRefund / getPendingIOUs
 * surface plus the `ious(uint256)` getter and IOU events.
 */
export const IOU_REGISTRY_ABI = [
  {
    type: "function",
    name: "executeCreate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipientId", type: "bytes32" },
    ],
    outputs: [{ name: "iouId", type: "uint256" }],
  },
  {
    type: "function",
    name: "batchClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "iouIds", type: "uint256[]" },
      { name: "claimant", type: "address" },
      { name: "recipientId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "batchRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "iouIds", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getPendingIOUs",
    stateMutability: "view",
    inputs: [{ name: "recipientId", type: "bytes32" }],
    outputs: [
      { name: "ids", type: "uint256[]" },
      { name: "count", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "ious",
    stateMutability: "view",
    inputs: [{ name: "iouId", type: "uint256" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "grossAmount", type: "uint256" },
      { name: "netAmount", type: "uint256" },
      { name: "recipientId", type: "bytes32" },
      { name: "expiry", type: "uint64" },
      { name: "claimed", type: "bool" },
      { name: "refunded", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "IOUCreated",
    inputs: [
      { name: "iouId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "recipientId", type: "bytes32", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },