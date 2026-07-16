---
title: MoniPay on Solana — Gasless USDC SPL Payments by Username
description: MoniPay on Solana lets you send USDC SPL by MoniTag with zero SOL needed. Twin-key Ed25519 architecture with feePayer relay for atomic gasless transfers.
keywords: monipay solana, solana usdc payments, usdc spl, gasless solana wallet, fee payer relay, solana ed25519 wallet
canonical: https://docs.monipay.xyz/chains/solana
---

# MoniPay on Solana (USDC SPL)

Solana support brings sub-cent, sub-second payments to MoniPay with the same gasless UX as our EVM chains.

## Network

- **Cluster:** Mainnet Beta
- **Token:** USDC (SPL, Circle-issued)
- **Decimals:** 6
- **Explorer:** https://solscan.io

## Architecture

MoniPay on Solana uses an **Ed25519 keypair** generated alongside your EVM key, encrypted with the same PIN. The encrypted Solana key is **localStorage-only** — it is never written to the database. On import, the decrypted public key is validated against the database-bound address; mismatches are rejected.

## Gasless via feePayer

Solana natively supports multi-signer transactions. Every MoniPay Solana payment is signed by:

1. The **user** — authorizing the SPL token transfer
2. The **MoniPay sponsor wallet** — paying the SOL fee

Both signatures travel in one atomic transaction. If either is invalid, nothing happens. The user never needs SOL.

## 1% fee split

The same atomic split as EVM: a single transaction transfers 99% to the recipient and 1% to the MoniPay treasury, both as USDC SPL.

## Funding

Withdraw USDC from your exchange, choose **Solana** as the network. Do not send Ethereum-side USDC.

## Read next

- [Solana key storage model](/security/solana-key-storage)
