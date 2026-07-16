---
title: MoniPay on Solana — Gasless USDC SPL Payments by Username With Twin-Key Ed25519
description: MoniPay on Solana lets you send USDC SPL by MoniTag with zero SOL needed. Twin-key Ed25519 architecture with feePayer relay, atomic 1% fee split in a single transaction, sub-cent fees, sub-second confirmation. Private key is localStorage-only and validated on import.
keywords: monipay solana, solana usdc payments, usdc spl gasless, fee payer relay solana, solana ed25519 wallet, monitag solana, solana stablecoin payments, no sol needed, solana username payments
canonical: https://docs.monipay.xyz/chains/solana
---

# MoniPay on Solana (USDC SPL)

Solana support brings **sub-cent, sub-second** stablecoin payments to MoniPay with the same gasless UX as our EVM chains. Send USDC SPL to any `@MoniTag` without holding SOL, without seed phrases, without leaving the chain you started on.

## Network

| Field | Value |
|-------|-------|
| Cluster | Mainnet Beta |
| Token | USDC (SPL, Circle-issued native) |
| Token mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Decimals | 6 |
| Native fee token | SOL (paymaster-sponsored, user holds none) |
| Block time | ~400ms |
| Explorer | https://solscan.io |

## Twin-key Ed25519 architecture

When you enable Solana on your MoniPay account, an Ed25519 keypair is generated alongside your existing EVM secp256k1 key. Both are encrypted with the same PIN-derived AES-256-GCM key. The Solana key is **`localStorage`-only** — it is never written to the database. On import (new device, browser cache cleared), the decrypted Solana public key must match the address bound to your MoniTag; mismatches reject the import. See [Solana key storage model](/security/solana-key-storage).

## Gasless via `feePayer`

Solana natively supports multi-signer transactions. Every MoniPay Solana payment is signed by **two** parties:

1. The **user** — authorising the SPL token transfer instruction(s).
2. The **MoniPay sponsor wallet** — listed as `feePayer`, paying the SOL fee.

Both signatures travel in one atomic transaction. The cluster verifies both before execution. If either signature is invalid, nothing happens. The user never needs to acquire or hold SOL.

## 1% atomic fee split

A single Solana transaction contains:

- A USDC SPL transfer of 99% to the recipient's associated token account
- A USDC SPL transfer of 1% to the MoniPay treasury's associated token account
- The `feePayer` field set to MoniPay's sponsor

The cluster either executes both transfers and pays the fee, or rejects the whole transaction. There is no partial state.

## Multi-recipient on Solana

Multi-recipient payments bundle multiple transfer instructions into a single transaction up to the per-tx instruction limit (~12 SPL-token transfers depending on instruction size). Larger batches split across multiple transactions, each fee-paid by MoniPay's Solana sponsor. See [multi-recipient](/monibot/multi-recipient).

## Funding

Withdraw USDC from your exchange and select **Solana** as the network. The address format is a Base58 string. Do not send Ethereum-side USDC, Polygon USDC, or any other chain's USDC — those will not credit your Solana MoniPay balance.

Recommended on-ramps for Solana USDC: Coinbase, Binance, OKX, Bybit, Kraken — all support direct USDC SPL withdrawal.

## MoniBot on Solana

MoniBot supports USDC-denominated social payments on Solana for senders who have linked a Solana MoniTag. Commands like `@monibot send $5 to @alice on solana` route through the Solana sponsor with the same fee-on-top model documented on [MoniBot fees](/monibot/fees).

## Common pitfalls

- **Wrong chain on withdrawal.** Always confirm Solana network. EVM-side USDC will not credit.
- **Cleared browser storage without a backup.** The Solana key is `localStorage`-only and AES-encrypted with your PIN. Lose both and the Solana funds are unreachable from MoniPay (the Walkaway Test applies — you can still hold the key elsewhere if you exported it).
- **Associated token account creation.** Solana requires a recipient to have a USDC ATA before they can receive USDC. MoniPay's sponsor pays the ATA-creation rent for first-time recipients transparently.

## Read next

- [Solana key storage model](/security/solana-key-storage)
- [The Walkaway Test](/security/walkaway-test)
- [MoniBot Tempo routing](/monibot/tempo-routing)
- [Supported chains overview](/chains/)
