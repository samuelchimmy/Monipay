---
title: MoniPay on BSC — Gasless USDT Payments by Username
description: Send USDT on BNB Smart Chain by MoniTag username with zero gas. MoniPay's BSC implementation uses an EIP-712 paymaster and the MoniPayRouter BSC contract.
keywords: monipay bsc, bnb chain usdt payments, gasless usdt, bep-20 wallet, send usdt by username
canonical: https://docs.monipay.xyz/chains/bsc
---

# MoniPay on BSC (USDT)

BNB Smart Chain support brings the world's most-traded stablecoin into MoniPay's gasless model.

## Network

- **Chain ID:** 56
- **Token:** USDT (BEP-20, Tether-issued)
- **Decimals:** 18 (note: 18, not 6 like Ethereum USDT)
- **Explorer:** https://bscscan.com

## Why BSC?

- **USDT is the dominant stablecoin** in emerging markets
- **Liquid CEX support** — every major exchange supports BEP-20 USDT
- **Sub-cent fees** make paymaster economics trivial

## Smart contracts

- **MoniPayRouter.bsc.sol** — same architecture as Base, recompiled for 18-decimal USDT
- Verified on BscScan

## Funding

Withdraw USDT from your exchange, choose **BEP-20 (BNB Smart Chain)** as the network. Do not send via Ethereum (ERC-20) or Tron (TRC-20) — those will not credit.
