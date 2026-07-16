---
title: MoniPay Tempo Smart Contracts — TIP-20, EIP-2718 Type 0x76, Native Fee Sponsorship
description: MoniPay on Tempo uses TIP-20 stablecoin transfers with on-chain memos and EIP-2718 type 0x76 transactions with native feePayer sponsorship, 2D nonces, and atomic batch calls.
keywords: monipay tempo contracts, tip-20 token standard, eip-2718 type 0x76, tempo fee payer, 2d nonces, atomic batch call, alphausd contract, tempo transfer memo
canonical: https://docs.monipay.xyz/contracts/tempo
---

# Tempo smart contracts

Tempo is payments-native. The features MoniPay implements as contract wrappers on Base and BSC are first-class primitives in the Tempo protocol, so the on-chain router footprint is **smaller** than on EVM chains.

## What replaces the EVM router

| EVM workaround | Tempo native primitive |
|----------------|------------------------|
| EIP-712 meta-transaction relayer | `feePayer` field on type 0x76 |
| `MoniPayRouter.transfer` wrapper | TIP-20 `transfer(to, amount, memo)` |
| Sequential nonce + relayer queue | 2D nonces (parallel-safe) |
| Multi-tx multi-recipient loop | Single transaction with `calls[]` array |
| Off-chain memo storage | On-chain TIP-20 memo bytes |

## EIP-2718 type 0x76

Tempo's transaction envelope is its own EIP-2718-registered type. Every MoniPay-issued Tempo transaction is a type 0x76 with at minimum:

- `from` — the user signing the transfer
- `feePayer` — MoniPay's sponsor wallet, signing the fee
- `calls[]` — one or more contract calls executed atomically
- `nonceKey` and `nonce` — the 2D nonce coordinates

The user signs the transfer authorization. The sponsor signs the fee. Both signatures travel in one envelope. Either signature missing or invalid and the entire envelope reverts.

## TIP-20 transfers with memo

TIP-20 is Tempo's stablecoin standard. It extends the ERC-20 interface with an on-chain memo field on every transfer:

```solidity
function transfer(address to, uint256 amount, bytes calldata memo) external returns (bool);
```

MoniPay populates `memo` with structured payment references — invoice ID, MagicPay claim ID, MoniBot campaign tag — so on-chain history is self-describing without off-chain lookups.

## 2D nonces

Standard EVM nonces are a single increasing integer per account, which forces strict serialisation. Tempo's 2D nonce is `(nonceKey, nonce)`. Two transactions with different `nonceKey` values can execute in any order, so MoniBot can submit concurrent campaign disbursements without nonce contention.

## Atomic batch calls

The `calls[]` array in a single type 0x76 transaction executes atomically. MoniBot uses this for multi-recipient grants — one signature, one fee, all-or-nothing settlement across up to ~50 recipients per call (limited by the per-tx gas budget, which on Tempo is denominated in stablecoin).

## MoniBot router on Tempo

The Tempo MoniBot router is a thin Solidity contract that:

1. Verifies the call was sponsored by the configured MoniBot UUID sponsor
2. Performs the TIP-20 transfer with the campaign memo
3. Emits the same `GrantExecuted` event used on EVM chains

The router does not need to verify EIP-712 signatures — the protocol already enforces both the user's transfer signature and the sponsor's fee signature at envelope verification time.

## Read next

- [MoniPay on Tempo](/chains/tempo)
- [MoniBot Tempo routing](/monibot/tempo-routing)
- [Multi-recipient payments](/monibot/multi-recipient)
