---
title: MoniPay Solana Key Storage Model
description: MoniPay's Solana private key is localStorage-only and never stored in the database. Import is validated against the DB-bound address.
canonical: https://docs.monipay.xyz/security/solana-key-storage
---

# Solana key storage model

The Solana Ed25519 private key has stricter handling than EVM:

- **Generation:** at signup or chain enablement
- **Encryption:** AES-256-GCM with the same PIN-derived key
- **Storage:** `localStorage` ONLY — never written to Supabase
- **Validation on import:** when a user reinstalls and imports their wallet, the decrypted public key must match the address bound to their MoniTag in the database. Mismatches reject the import.
- **Two-step regenerate warning:** if a user opts to regenerate their Solana key, MoniPay shows a two-step confirmation explaining that funds at the old address are inaccessible from MoniPay.

This model means that even a complete server compromise would not leak Solana private keys.
