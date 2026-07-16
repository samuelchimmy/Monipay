---
title: MoniPay on Base — Gasless USDC Payments by Username
description: MoniPay is built on Base with USDC. Send USDC by MoniTag with zero gas. Powered by Coinbase's L2 and the MoniPayRouter smart contract.
keywords: monipay base, base usdc payments, gasless usdc, base layer 2 wallet, send usdc by username, base builder code
canonical: https://docs.monipay.xyz/chains/base
---

# MoniPay on Base (USDC)

Base is **MoniPay's home chain**. All product surfaces — receipts, the dashboard, merchant tools — were designed Base-first.

## Network

- **Chain ID:** 8453
- **Token:** USDC (native, Circle-issued)
- **Decimals:** 6
- **Explorer:** https://basescan.org
- **Builder code:** ERC-8021 attribution `bc_qt9yxo1d` is appended as a hex suffix to all MoniPay-routed Base transactions.

## Why Base?

- **Lowest L2 fees** of the major rollups → cheapest paymaster operation
- **Native USDC** — no bridged token risk
- **Coinbase distribution** — easy on/off-ramp via Coinbase
- **OP Stack** — same EVM tooling as Optimism

## Smart contracts

- **MoniPayRouter (Base):** atomic 99% / 1% split with EIP-712 meta-tx verification
- **MoniBotRouter (Base):** sponsored grants for social campaigns
- All contracts verified on BaseScan

## Funding your Base wallet

From Coinbase, Binance, OKX, Bybit — choose **USDC** and **Base** as the network. Sending USDC on Ethereum mainnet to a Base address will not credit and may be unrecoverable.

## Read next

- [How gasless transactions work](/how-it-works#gasless-transactions-evm)
- [Base smart contracts](/contracts/base)
