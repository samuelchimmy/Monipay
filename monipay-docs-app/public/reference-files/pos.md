---
title: MoniPay Smart Contracts & ABIs
description: MoniPay's verified router contracts on Base, BSC, Tempo and Celo. ABIs, source code, deployment addresses.
keywords: monipay smart contracts, monipayrouter, monibotrouter, base contract, bsc contract, tempo contract, contract abi
canonical: https://docs.monipay.xyz/contracts/
---

# Smart contracts

All MoniPay router contracts are open-source and verified on the relevant explorer.

| Contract | Chain | Purpose |
|---|---|---|
| `MoniPayRouter.sol` | Base | EVM meta-tx router with 1% atomic split |
| `MoniPayRouter.bsc.sol` | BSC | BSC variant (18-decimal USDT) |
| `MonipayRouterCelo.sol` | Celo | cUSD variant for MiniPay |
| `MoniBotRouter.sol` | Base | Sponsored grants for social campaigns |
| `MonibotRouterCelo.sol` | Celo | MoniBot variant on Celo |
| `IOURegistry.sol` | EVM | IOU/credit primitive (claimable on-chain) |

## Per-chain pages

- [Base contracts](/contracts/base)
- [BSC contracts](/contracts/bsc)
- [Tempo contracts](/contracts/tempo)
- [Celo contracts](/contracts/celo)

## Common interfaces

- `IIOURegistry` — claim, settle, dispute IOUs
- `MoniPayRouter` events: `PaymentExecuted(sender, recipient, amount, fee, nonce, memo)`
- `MoniBotRouter` events: `GrantExecuted(to, amount, fee, campaignId)`
