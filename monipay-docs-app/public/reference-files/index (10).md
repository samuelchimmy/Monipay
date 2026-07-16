---
title: Supported Chains — MoniPay Multi-Chain Stablecoin Network
description: MoniPay supports gasless stablecoin payments on Base (USDC), BSC (USDT), Solana (USDC SPL), Tempo (AlphaUSD), Ink and Celo (cUSD via MiniPay).
keywords: monipay chains, base usdc payments, bsc usdt payments, solana usdc spl, tempo ausd, celo minipay cusd, multi-chain stablecoin wallet
canonical: https://docs.monipay.xyz/chains/
---

# Supported chains

MoniPay is multi-chain by default. One MoniTag, one PIN, one encrypted key — wallets on every supported network.

| Chain | Token | Decimals | Gas model | Status |
|---|---|---|---|---|
| [Base](/chains/base) | USDC | 6 | EIP-712 paymaster | Production |
| [BSC](/chains/bsc) | USDT | 18 | EIP-712 paymaster | Production |
| [Solana](/chains/solana) | USDC SPL | 6 | feePayer relay | Production |
| [Tempo](/chains/tempo) | AlphaUSD | 18 | Native fee sponsorship (type 0x76) | Testnet (Moderato) |
| [Ink](/chains/ink) | USDC | 6 | EIP-712 paymaster | Coming soon |
| [Celo / MiniPay](/chains/celo) | cUSD | 18 | EIP-712 paymaster | Production |

All chains share:

- The same MoniTag identity
- The same 1% platform fee model
- Zero user-paid gas
- Atomic fee/transfer split via the on-chain router contract
