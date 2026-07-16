---
title: MoniPay Tempo Contracts & TIP-20
description: MoniPay on Tempo uses TIP-20 token transfers and EIP-2718 type 0x76 transactions with native fee sponsorship.
canonical: https://docs.monipay.xyz/contracts/tempo
---

# Tempo contracts

Tempo's payment-native primitives mean MoniPay's router footprint on Tempo is **smaller** than on Base/BSC.

- **TIP-20 transfer** with on-chain memo replaces the ERC-20 + meta-tx wrapper
- **EIP-2718 type 0x76** transaction native fee sponsorship via `feePayer` field
- **2D nonces** allow concurrent transaction submission without nonce collisions
- **Batch calls** for atomic multi-recipient grants (one signature, all-or-nothing)

The MoniBotRouter on Tempo executes batch grants with the MoniBot UUID sponsor as fee payer.
