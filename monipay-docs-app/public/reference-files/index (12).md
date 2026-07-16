---
title: MoniPay on Tempo — Native Gasless AlphaUSD Payments
description: MoniPay on Tempo uses native EIP-2718 type 0x76 transactions and TIP-20 transfers. AlphaUSD payments with no native gas token required.
keywords: monipay tempo, tempo testnet moderato, alphausd payments, tip-20 token standard, eip-2718 type 0x76, native fee sponsorship
canonical: https://docs.monipay.xyz/chains/tempo
---

# MoniPay on Tempo (AlphaUSD)

Tempo is a payments-native blockchain with no native gas token. MoniPay's Tempo integration is our cleanest implementation — no relayer hacks, no meta-transaction wrappers.

## Network (Moderato Testnet)

- **Chain ID:** 42431
- **Token:** AlphaUSD (αUSD)
- **Decimals:** 18
- **Token contract:** `0x20c0000000000000000000000000000000000001`
- **RPC:** https://rpc.moderato.tempo.xyz
- **Explorer:** https://explore.tempo.xyz
- **Faucet:** https://faucet.tempo.xyz

## Why Tempo is special

Tempo introduces an **EIP-2718 type 0x76** transaction with first-class payment primitives:

- **Native fee sponsorship** via a `feePayer` field — no relayer needed
- **TIP-20** token standard with built-in transfer memos
- **2D nonces** for parallel-safe concurrent transactions
- **Batch calls** for atomic multi-recipient transfers
- **Scheduled transactions** with `validAfter` / `validBefore` windows

MoniPay uses all of these. A Tempo P2P payment is **one transaction**, signed once, with the sponsor as fee payer and the user as transfer signer.

## Funding (testnet)

Visit the [faucet](https://faucet.tempo.xyz) and request AlphaUSD. The faucet drips 1,000,000 αUSD per request.

## Read next

- [Tempo transaction model](/contracts/tempo)
