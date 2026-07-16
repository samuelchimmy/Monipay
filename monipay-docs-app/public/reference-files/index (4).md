---
title: MoniPay Security — Threat Model & Best Practices
description: MoniPay's security model: AES-256-GCM key encryption, RLS-protected database, signed edge functions, rate limits, and the Walkaway Test.
keywords: monipay security, non-custodial wallet security, aes-256-gcm encryption, rls policies, threat model
canonical: https://docs.monipay.xyz/security/
---

# Security

MoniPay's security is built on three pillars: **local key encryption**, **server-side validation**, and **Walkaway-Test resilience**.

## Key encryption

- **Algorithm:** AES-256-GCM
- **KDF:** PBKDF2 with high iteration count
- **Storage:** `localStorage` (web), Keychain (iOS), KeyStore (Android)
- **Solana:** Ed25519 keypair, **localStorage-only**, never written to the database
- **Validation:** on import, the decrypted public key is matched against the database-bound address; mismatches reject

## Database (Supabase / Lovable Cloud)

- **RLS:** deny-all by default; explicit policies for each table
- **Storage buckets:** scoped by user-ID path
- **Rate limits:** `relay-payment` enforces 5/wallet/min and 10/IP/min
- **Roles:** roles live in a separate `user_roles` table with a `SECURITY DEFINER` `has_role(user_id, role)` function — no client-side admin checks

## Edge functions

- **Signed requests** via the `signedFetch` HTTP wrapper (required for native Flutter)
- HMAC-SHA256 webhook signatures for merchant callbacks
- Builder-code attribution for Base transactions (ERC-8021 `bc_qt9yxo1d`)

## Account deletion

Deletion is **soft** — `profiles.status = 'deactivated'`. Data is retained per legal/audit requirements. Re-import is blocked. Two-step DELETE confirmation prevents accidental loss.

## Read next

- [Solana key storage model](/security/solana-key-storage)
- [Walkaway Test in practice](/security/walkaway-test)
