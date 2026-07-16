---
title: How MoniPay Works — Wallet, Gasless Relayer, Fee Model
description: Deep dive into MoniPay's architecture: local-key wallet, EIP-712 paymaster relayer, multi-chain routing, and the 1% platform fee model. Built for self-custody.
keywords: how monipay works, gasless transactions, eip-712 paymaster, meta-transactions, non-custodial wallet architecture, monipay fee model
canonical: https://docs.monipay.xyz/how-it-works
---

# How MoniPay works

MoniPay turns blockchains into a usable payment rail by hiding three sources of friction: addresses, gas, and key management. This page explains how.

## The wallet model

Every MoniPay user has **one Ethereum-compatible private key** that controls addresses on every supported EVM chain (Base, BSC, Tempo, Ink, Celo) plus a separate Ed25519 key for Solana.

```
PIN (user) ─► PBKDF2 ─► AES-256-GCM key ─► encrypts private key ─► localStorage
```

- The encrypted blob lives in `localStorage` (web) or the secure enclave / Keychain (mobile).
- The PIN is never transmitted, never stored, never recoverable.
- The Solana key is **localStorage-only** and validated at import against the database-bound address.
- Decryption happens client-side at signing time.

This is the **Walkaway Test** in action: the encrypted blob plus your PIN is the entire wallet. Export it, import it into any compatible tool, you keep your funds.

## Gasless transactions (EVM)

MoniPay implements **ERC-2771-style meta-transactions** with our own paymaster relayer.

```
1. User taps "Send 5 USDC to @alice"
2. App resolves @alice to her Base address via the MoniTag registry
3. App constructs an EIP-712 typed-data message:
     "I authorize transferring 5 USDC to 0xalice..., nonce N"
4. User signs locally with their decrypted private key
5. App POSTs the signature + payload to the MoniPay relayer (edge function)
6. Relayer validates, submits the tx on-chain, pays gas in ETH/BNB
7. The MoniPayRouter contract enforces:
     - signature recovers to the claimed sender
     - nonce is fresh (anti-replay)
     - 1% platform fee is split atomically
     - 99% goes to recipient
8. Tx confirms in <2s on Base
```

The user never holds ETH or BNB. The relayer's wallet is auto-monitored and refilled.

## Tempo: native fee sponsorship

Tempo (chain ID 42431) introduces an **EIP-2718 type 0x76** transaction with a native `feePayer` field. MoniPay uses this directly — no relayer wrapper, no EIP-712 dance. Fees are paid in AlphaUSD by a sponsor wallet, atomic with the transfer.

## Solana: feePayer relay

Solana transactions support multi-signer atomicity. MoniPay's relayer signs the **fee** while the user signs the **transfer** — both signatures land in one transaction. Same 1% platform split, settled in USDC SPL.

## Multi-chain routing

When a payment is initiated, MoniPay's router checks the sender's balances across chains and picks the optimal source:

1. If the recipient is on the same chain → direct send.
2. If not → automatic cross-chain routing (currently same-chain only; cross-chain bridge planned).
3. If the sender's preferred chain has zero balance → app suggests funding or switching.

## Fee model

- **User fee:** **0** — gas is fully sponsored.
- **Platform fee:** **1%** of every payment, deducted atomically by the smart contract.
  - For social payments (MoniBot), the fee is **on top** of the user-typed amount. The recipient gets the full amount; the sender pays amount + 1%.
  - For direct app payments, recipient gets full amount; platform fee comes from the same transfer via the contract split.
- **MoniBot fees** also apply when a sponsored account uses gas grants.

## Database & state

MoniPay uses **Supabase (Lovable Cloud)** for:

- Profiles, MoniTag registry, social identity links
- Transaction history (receipts) — on-chain hash is canonical
- Merchant orders, products, customers
- Edge functions for the relayer, MoniBot worker, webhook signing

The blockchain remains the source of truth for **funds**. The database is for **UX** (history, names, receipts).

## Read next

- [Smart contracts & ABIs](/contracts/)
- [Security model](/security/)
- [Supported chains](/chains/)
