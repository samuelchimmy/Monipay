---
title: Getting Started with MoniPay — Create a Wallet & Send USDC
description: Create a MoniPay wallet in under 60 seconds. Claim a MoniTag, fund your wallet, and send your first gasless stablecoin payment on Base, BSC, Solana or Tempo.
keywords: monipay sign up, create monipay wallet, claim monitag, send first usdc payment, gasless stablecoin tutorial
canonical: https://docs.monipay.xyz/getting-started
---

# Getting started with MoniPay

You can be sending stablecoins by username in under 60 seconds. No seed phrase ceremony, no gas top-up.

## 1. Open the app

Go to **[monipay.xyz](https://monipay.xyz)** in any modern browser, or install the iOS/Android app from [/install](https://monipay.xyz/install). The web app is a Progressive Web App — you can install it to your home screen with one tap.

## 2. Claim your MoniTag

Tap **Sign Up** and choose a MoniTag — your permanent username on MoniPay. Rules:

- Lowercase letters, numbers, dot and underscore only
- 3–20 characters
- Cannot be a reserved word (brand names, generic terms, profanity — ~150 blocked terms)
- Permanent and unique across all chains

Your MoniTag becomes your address on Base, BSC, Solana and Tempo simultaneously.

## 3. Set a 6-digit PIN

This PIN encrypts your private key locally using **AES-256-GCM**. MoniPay never sees it. **There is no PIN reset** — if you forget it, you must restore from your Google Drive backup or recovery phrase. Choose carefully.

## 4. Back up your wallet

You will be prompted to:

- **Connect Google Drive** for an encrypted backup to your private `appDataFolder` (recommended)
- **Reveal your recovery phrase** as a fallback (write it down, store offline)

Skipping backup is allowed but means a forgotten PIN is permanent loss. This is self-custody.

## 5. Fund your wallet

Tap **Fund**, choose the chain, and copy your address (or scan the QR). Send stablecoins from any exchange or wallet:

| Chain | Token | Network to select on exchange |
|---|---|---|
| Base | USDC | Base (not Ethereum mainnet) |
| BSC | USDT | BNB Smart Chain (BEP-20) |
| Solana | USDC | Solana |
| Tempo | AlphaUSD | Tempo testnet (Moderato) — use the [faucet](https://faucet.tempo.xyz) |

Deposits show a confirmation animation in the modal once detected on-chain — usually within 30 seconds.

## 6. Send your first payment

Tap **Send**, type `@username` of any MoniPay user (try `@samuel`), enter an amount, confirm with your PIN. The payment lands in seconds. **You pay zero gas.** A 1% platform fee is collected on top — the recipient receives the full amount you typed.

## What's next?

- [Set up a MoniPay merchant storefront](/merchant/storefront)
- [Generate a payment link](/integrations/payment-links)
- [Use MoniBot on Twitter, Discord, Telegram](/monibot/)
- [Connect to dApps with the Chrome extension](/integrations/chrome-extension)
