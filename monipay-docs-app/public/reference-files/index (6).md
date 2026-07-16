---
title: What is MoniPay? — Gasless Stablecoin Payments by Username
description: MoniPay is a non-custodial, gasless, multi-chain stablecoin wallet that lets anyone send USDC, USDT and AlphaUSD by MoniTag username. Built on Base, BSC, Solana and Tempo.
keywords: what is monipay, monipay wallet, gasless crypto wallet, non-custodial stablecoin wallet, send crypto by username, monitag
canonical: https://docs.monipay.xyz/what-is-monipay
---

# What is MoniPay?

**MoniPay** is the simplest way to send and receive stablecoins. It replaces long blockchain addresses with **MoniTag™ usernames** (e.g. `@samuel`), removes gas fees from the user experience entirely, and stays **non-custodial** — your keys never leave your device.

> Send `$5` to `@alice` in two taps. No gas. No seed phrase friction. Works on Base, BSC, Solana and Tempo from a single account.

## The MoniPay thesis

Crypto payments have failed consumers for a decade because the UX is hostile: 42-character addresses, native gas tokens, signing prompts written in hex, lost-key panic. **MoniPay collapses all of that into a username and a PIN.**

- **Username, not address.** `@samuel` resolves to a wallet on every supported chain.
- **PIN, not seed phrase.** Your private key is encrypted locally with AES-256-GCM using your PIN. No 12-word ceremony to lose.
- **Zero gas.** A paymaster sponsors fees on Base, BSC, Tempo and Solana. Users hold only stablecoins.
- **One account, every chain.** USDC on Base, USDT on BSC, AlphaUSD on Tempo, USDC SPL on Solana — same MoniTag, same login.

## A Hammer, not a service

MoniPay is built like a **tool**, not a managed service. We call this the **Walkaway Test**:

> If MoniPay's company, servers and team disappeared tomorrow, could you still spend the funds in your wallet?

The answer is **yes**. Your encrypted private key sits in `localStorage` (or your phone's secure enclave) and can be exported, decrypted with your PIN, and imported into MetaMask, Rabby, Phantom or any compatible wallet. MoniPay is the convenience layer; the wallet is yours.

## What MoniPay is not

- **Not a custodial exchange.** We never hold your funds.
- **Not a stablecoin issuer.** We move USDC, USDT, AlphaUSD and other regulated stablecoins.
- **Not a chain.** MoniPay is an application layer that runs on Base, BSC, Solana and Tempo.
- **Not a Web3 social app.** MoniBot adds social distribution, but the core product is a payment rail.

## Who is MoniPay for?

- **Consumers** who want Venmo-simple crypto payments without gas anxiety.
- **Merchants** who want to accept stablecoins online or in-person without POS hardware.
- **Creators** who want to receive tips and run airdrops via Twitter, Discord and Telegram.
- **Developers** who want to embed gasless stablecoin payments into their app or website.

## Read next

- [Getting started](/getting-started)
- [How MoniPay works](/how-it-works)
- [Why MoniTag matters](/monitag/)
