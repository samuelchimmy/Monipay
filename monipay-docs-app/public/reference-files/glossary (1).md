---
title: MoniPay Glossary — Terminology for Users, Merchants and Developers
description: Definitions for every MoniPay-specific term — MoniTag™, MoniBot, MagicPay, AlphaUSD, paymaster, TIP-20, EIP-2718 type 0x76, Walkaway Test, feePayer, Ed25519, secp256k1, 2D nonces and more.
keywords: monipay glossary, monitag definition, monibot definition, magicpay claim, alphausd, tip-20 token, paymaster crypto, walkaway test definition, ed25519, eip-2718, feepayer
canonical: https://docs.monipay.xyz/reference/glossary
---

# Glossary

**AES-256-GCM** — Authenticated symmetric encryption with a 256-bit key. MoniPay encrypts every user's private key with AES-256-GCM, keyed by a PBKDF2 derivation of the user's PIN.

**AlphaUSD (αUSD)** — Tempo's primary stablecoin. 18 decimals. TIP-20 standard. Contract `0x20c0000000000000000000000000000000000001`.

**Atomic split** — The single-transaction transfer pattern MoniPay's router contracts use to send 99% of a payment to the recipient and 1% to the platform treasury without any intermediate state.

**Base** — Coinbase's Ethereum L2. MoniPay's home chain. Token: native USDC, 6 decimals.

**Base58** — Solana's canonical address encoding. Case-sensitive, no normalization.

**BEP-20** — BSC's token standard, broadly ERC-20-compatible. BSC USDT is BEP-20 with **18** decimals.

**Builder code (ERC-8021)** — On-chain attribution suffix that lets a builder count originated transactions. MoniPay's Base builder code is `bc_qt9yxo1d`.

**Ed25519** — Solana's signing curve. Used for Solana keypairs.

**EIP-712** — Ethereum's typed structured-data signing standard. MoniPay's EVM routers verify EIP-712 signatures to authorise meta-transactions.

**EIP-2718 type 0x76** — Tempo's native transaction envelope type. Supports `feePayer` sponsorship, 2D nonces, and atomic batch calls as first-class fields.

**executor wallet** — MoniBot's hot wallet that submits social-payment transactions and pays gas. Per-chain, monitored, refilled on low-balance alerts.

**fee-on-top** — MoniBot's social-payment fee model. Sender pays `amount + 1%`, recipient receives the full amount. Contrast with the in-app **fee-split** model.

**`feePayer`** — A Solana and Tempo transaction field naming a non-sender account that pays the fee. The foundation of MoniPay's gasless UX on those chains.

**Hammer** — MoniPay's product philosophy. A tool you own and walk away with, not a service you depend on. See the [Walkaway Test](/security/walkaway-test).

**IOURegistry** — On-chain registry that backs MagicPay claims. Holds escrowed funds for unaddressed recipients until they prove control of the linked social handle.

**MagicPay** — A claim link issued when a MoniBot recipient has no linked MoniTag. Backed by the on-chain `IOURegistry`. Recipient redeems by signing up and proving handle ownership.

**MiniPay** — Opera's mobile wallet on Celo. MoniPay runs as a mini-app inside MiniPay.

**MoniBot** — MoniPay's autonomous AI agent for social payments on Twitter/X, Bluesky, Discord, and Telegram.

**MoniPay** — The product. A gasless, non-custodial, multi-chain stablecoin wallet and payment platform.

**MoniTag™** — Your permanent username on MoniPay. Lowercase `m`, uppercase `T`, ™ on first use.

**paymaster** — A relayer that pays gas on a user's behalf in exchange for the user's signature on an off-chain typed-data message.

**PBKDF2** — Password-Based Key Derivation Function. MoniPay uses PBKDF2 with a high iteration count to derive an AES key from the user's PIN.

**RLS** — Row Level Security. Supabase's database access control. MoniPay's tables are deny-all by default with explicit policies per access path.

**secp256k1** — Ethereum's signing curve. Used for EVM keypairs (Base, BSC, Celo, Ink).

**Smart Feedback** — MoniBot's optional AI-evaluated reply quality gate for airdrop and grant campaigns. Powered by Gemini 1.5-flash.

**Soft delete** — MoniPay account deletion sets `profiles.status = 'deactivated'` rather than dropping rows. Data is retained for legal compliance. Re-import is blocked.

**TIP-20** — Tempo's stablecoin standard. ERC-20-like, with on-chain transfer memos and delegated-transfer semantics for sponsorship.

**Two-dimensional (2D) nonce** — Tempo's `(nonceKey, nonce)` pair that allows parallel-safe concurrent transactions without single-account nonce contention.

**USDC** — Circle's regulated US-dollar stablecoin. Native on Base (6 dec), available as SPL on Solana (6 dec), and as USDT0 omnichain variant on Ink.

**USDT** — Tether's US-dollar stablecoin. Native on BSC as BEP-20 (18 decimals).

**Walkaway Test** — MoniPay's resilience principle: if MoniPay disappeared tomorrow, you could still spend the funds in your wallet from any compatible wallet. Non-negotiable.

**worker bot** — Per-platform MoniBot service that polls the social platform, parses commands, and submits on-chain transactions via the chain-specific `MoniBotRouter`.
