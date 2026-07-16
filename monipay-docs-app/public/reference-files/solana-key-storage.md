---
title: MoniPay Solana Key Storage Model — localStorage-Only, DB-Validated Import
description: MoniPay's Solana Ed25519 private key is generated client-side, AES-256-GCM encrypted with the user's PIN, and stored in localStorage only — never written to the database. Import validates the decrypted public key against the database-bound address; mismatches reject. Regeneration carries a two-step warning.
keywords: solana key storage, ed25519 key encryption, monipay solana security, non custodial solana wallet, aes-256-gcm solana, browser localstorage wallet, solana key import validation, solana key regeneration
canonical: https://docs.monipay.xyz/security/solana-key-storage
---

# Solana key storage model

MoniPay's Solana key handling is **stricter** than its EVM key handling, because Solana's threat surface is different and the consequences of a compromised key are immediate (no MoniBot allowance flow, no on-chain pause to lean on).

## The model

- **Generation.** An Ed25519 keypair is generated client-side at signup or when the user enables Solana on an existing account. No keys ever leave the device.
- **Encryption.** The private key is encrypted with **AES-256-GCM** using a key derived from the user's PIN via PBKDF2 with a high iteration count and a per-user salt.
- **Storage.** The encrypted blob is stored in `localStorage` **only**. It is never written to the Supabase database, never sent to any MoniPay edge function, never logged. The database stores only the **public** Solana address bound to the user's MoniTag.
- **Validation on import.** When a user reinstalls MoniPay (new device, browser cache cleared, factory reset) and re-imports their wallet, the decrypted public key derived from the imported keypair **must match** the address bound to their MoniTag in the database. Mismatches reject the import with an explicit error.
- **Two-step regenerate warning.** If a user opts to regenerate their Solana key (a destructive operation), MoniPay shows a two-step confirmation explaining clearly that funds at the old address are inaccessible from MoniPay after regeneration.

## Why localStorage-only

The Solana key is the most sensitive credential MoniPay handles, and storing it server-side — even encrypted — creates two failure modes that storing it client-side does not:

1. **Server compromise leaks every key blob at once.** A single breach of an encrypted-at-rest database is one decryption pipeline away from every user's funds. Storing nothing means there is nothing to leak.
2. **Server-mediated decryption normalises the wrong mental model.** If users believe MoniPay can recover their key, they treat the PIN as a forgettable password. The Walkaway Test depends on users understanding that their PIN is the **only** thing that decrypts their key.

The cost of this model is that a user who clears their browser storage **and** loses their Google Drive backup **and** never wrote down their recovery phrase has no path to their Solana funds. This is the explicit trade — and it is the same trade every honest self-custody wallet makes.

## Why validate on import

A malicious import would set the local public key to an attacker-controlled address while leaving the MoniTag bound to the legitimate user. Future MoniBot grants, MagicPay claims, and inbound payments resolved by MoniTag would route to the attacker. Validating that the imported public key matches the MoniTag-bound address closes that hole.

## How regeneration works

Regenerating a Solana key generates a new Ed25519 keypair, re-binds the MoniTag to the new public key, and forgets the old one. The old funds remain on-chain at the old address; MoniPay has no path to them. The two-step warning makes this consequence inescapable — users have to acknowledge it twice before the regeneration proceeds.

## What this means in practice

- Server breach → Solana keys are safe. They were never on the server.
- Lost device with no backup → funds at that Solana address are unreachable from MoniPay. Same as every self-custody wallet.
- Lost PIN → funds at that Solana address are unreachable. The PIN is the encryption key.
- Malicious import attempt → rejected by the address-match check.

## Read next

- [The Walkaway Test](/security/walkaway-test)
- [Security overview](/security/)
- [MoniPay on Solana](/chains/solana)
