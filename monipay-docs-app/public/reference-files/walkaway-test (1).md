---
title: The Walkaway Test — MoniPay's Resilience Promise to Every User
description: The Walkaway Test is MoniPay's non-negotiable promise: if MoniPay's company, servers and team disappeared tomorrow, you could still spend the funds in your wallet from any compatible wallet. Standard cryptography, standard tokens, exportable keys, no custody, on-chain history.
keywords: walkaway test, self custody wallet, non custodial crypto, exportable wallet, no custody crypto, monipay resilience, crypto wallet survives, lose company keep funds, self sovereign wallet
canonical: https://docs.monipay.xyz/security/walkaway-test
---

# The Walkaway Test

> **If MoniPay's company, servers and team disappeared tomorrow, could you still spend the funds in your wallet?**

The answer must always be **yes**. This is non-negotiable. It is the single principle that every product decision at MoniPay is evaluated against. If a feature would make the answer "no" or "maybe", that feature does not ship.

## How we keep it true

### 1. Standard cryptography

- **EVM chains** — secp256k1 keypairs, the same curve every Ethereum wallet uses (MetaMask, Rabby, Coinbase Wallet, hardware wallets).
- **Solana** — Ed25519 keypairs, the same curve every Solana wallet uses (Phantom, Solflare, Backpack).
- **PIN-based encryption** — AES-256-GCM with PBKDF2 key derivation. Not proprietary. Not custom.

If MoniPay vanished, you would still hold a standard hex private key. You would not be holding a MoniPay-specific token bound to a MoniPay-specific contract.

### 2. Standard tokens

- USDC, USDT, AlphaUSD, cUSD, USDC SPL.
- No MoniPay-only wrappers. No yield-bearing proxy positions. No staking derivatives.

The token in your wallet is the same token the issuer minted. Circle's USDC contract is Circle's USDC contract. You can spend it from any wallet that supports the chain.

### 3. Exportable keys

- The encrypted key blob lives on your device.
- Your PIN decrypts it into a standard hex private key.
- You can import that key into MetaMask, Phantom, or any other compatible wallet.

There is no "MoniPay export endpoint" you depend on. The decryption happens in your browser or app, with cryptography you can independently verify.

### 4. No funds in custody

- The 1% platform fee is collected **at transfer time** by the on-chain router contract.
- MoniPay never holds user balances between transactions.
- There is no "settlement account" you need MoniPay to release funds from.

A custodial exchange disappearing is a catastrophe because user funds were pooled in the exchange's wallet. MoniPay disappearing is an inconvenience because user funds were always in the user's own wallet.

### 5. On-chain history is the source of truth

- The MoniPay database is for UX — fast balance lookups, transaction history rendering, MoniTag resolution, social linking.
- Every payment is settled and recorded on-chain. The block explorer is the bank statement.
- If the MoniPay database vanished, your transaction history and balances would still be reconstructable from `MoniPayRouter` events on the explorer.

## What you lose if MoniPay disappears

You lose the **convenience layer**: the MoniTag resolver, the merchant tools, MoniBot, the dashboard, the Google Drive backup orchestration. You keep:

- The funds at your wallet address.
- The ability to spend them from any compatible wallet.
- The on-chain receipt history.
- The standard cryptography that lets you do all of the above without MoniPay's permission.

## Why this matters

The history of consumer crypto is mostly the history of platforms that did not pass this test. MoniPay is built on the opposite assumption: the platform is a hammer, not a service. A hammer you own and walk away with. Not a service you depend on for permission to use what you bought.

## Read next

- [Solana key storage model](/security/solana-key-storage)
- [Security overview](/security/)
- [What is MoniPay?](/what-is-monipay)
