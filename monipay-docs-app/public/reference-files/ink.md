---
title: MoniPay on Ink — Gasless USDT0 Payments on Kraken's L2 (Coming Soon)
description: MoniPay is coming to Ink, Kraken's Layer 2. Gasless USDT0 payments by MoniTag username, powered by the same non-custodial invisible-wallet architecture that ships on Base, BSC and Celo.
keywords: monipay ink, ink chain payments, kraken l2, usdt0 ink, gasless usdt0, monitag ink, ink onchain payments, op stack l2 payments, kraken layer 2 wallet, monipay router ink
canonical: https://docs.monipay.xyz/chains/ink
---

# MoniPay on Ink (Coming Soon)

Ink is **Kraken's Layer 2**, built on the OP Stack and designed as the on-chain home for Kraken's user base. MoniPay's Ink integration brings gasless, username-addressed stablecoin payments to that distribution surface — same invisible-wallet UX, same MoniTag identity, same paymaster-sponsored gas, denominated in **USDT0** (Tether's omnichain USDT, native on Ink).

## Network details

| Field | Value |
|-------|-------|
| Network | Ink Mainnet |
| Chain ID | `57073` |
| Token | USDT0 (omnichain USDT on Ink) |
| Token contract | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| Decimals | `6` |
| Native gas token | ETH |
| Explorer | https://explorer.inkonchain.com |
| Status | In development |

## Why Ink?

- **Kraken distribution.** Ink is the on-chain extension of one of the most trusted CEX brands in crypto. Kraken's existing users can move USDT0 to Ink natively and pay anyone with a MoniTag in seconds.
- **OP Stack tooling parity.** Same EVM, same Solidity, same wagmi/viem pipeline as Base. The audited `MoniPayRouter` and `MoniBotRouter` ship to Ink with no architectural changes.
- **USDT0 is the omnichain stablecoin Tether prioritizes.** Built on LayerZero's OFT standard, USDT0 moves between supported chains as a single canonical token — no bridged-wrapper risk.
- **Cheap L2 fees** make paymaster sponsorship economical at the per-transaction level.
- **Verified contracts on `explorer.inkonchain.com`** — the same transparency guarantee as Base and BSC.

## Architecture

Ink reuses MoniPay's Base architecture wholesale:

- **`MoniPayRouter` (Ink)** — atomic 99% / 1% split on USDT0 `transferFrom`, EIP-712 meta-transaction verification.
- **`MoniBotRouter` (Ink)** — sponsored social payments for Twitter, Discord, Telegram.
- **`IOURegistry` (Ink)** — MagicPay claim registry for unaddressed recipients.

Status: in development. Contract addresses are pinned in `src/config/chains.ts` once deployed and verified.

## Funding (when live)

Withdraw USDT0 from Kraken (or any chain that supports the USDT0 OFT) and select **Ink** as the destination network. The address format is a standard `0x`-prefixed Ethereum address. ETH is **not** required for gas — MoniPay's paymaster covers it.

## Read next

- [How gasless payments work](/how-it-works#gasless-transactions-evm)
- [MoniPay on Base](/chains/base) — the reference implementation Ink mirrors
- [Supported chains overview](/chains)
