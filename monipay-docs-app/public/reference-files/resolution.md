---
title: How MoniTag Resolution Works — Username to Address Across Every Chain
description: MoniTag resolution turns @username into the correct blockchain address per chain. Normalization rules, 60-second cache TTL, EVM lowercase + Solana Base58, fail-closed safety, and cache invalidation triggers.
keywords: monitag resolution, username to address crypto, ens alternative resolution, cross chain username, monipay address lookup, paytag api, monitag cache, send crypto by username
canonical: https://docs.monipay.xyz/monitag/resolution
---

# How MoniTag resolution works

When you type `@alice` and pick a chain, MoniPay turns the username into the correct on-chain address for that chain in a deterministic, cached, fail-closed pipeline.

## The resolution pipeline

1. **Normalize.** Strip the leading `@`, lowercase the result, strip surrounding whitespace. `@Alice`, `alice `, and `alice` are equivalent.
2. **Look up.** Query the MoniTag registry (Supabase / on-chain registry) scoped to the chosen chain — `base_address`, `bsc_address`, `solana_address`, `tempo_address`, `celo_address`, etc.
3. **Cache.** Store the result in an in-memory + `localStorage`-backed cache with a **60-second TTL**.
4. **Return.** EVM addresses are returned lowercase (canonical for downstream signing and indexing); Solana addresses are returned in Base58 (the canonical Solana format).
5. **Fail closed.** If the MoniTag has no wallet bound on the chosen chain, the send is **blocked** with a clear error — never silently routed to a different chain.

## Why fail-closed matters

A username can resolve on one chain and not another. `@alice` might have a Base address but no Solana keypair. Auto-routing to "the chain alice is on" sounds friendly but creates two problems:

- The sender thought they were sending on chain X. The receipt says chain Y. Reconciliation breaks.
- The sender's MoniBot command (`send $5 to @alice on base`) is explicit — overriding it would be wrong.

MoniPay therefore returns an unambiguous **no address on this chain** error, surfaces a "fund on chain X instead" suggestion in the UI, and lets the sender decide.

## Cache invalidation

The 60-second TTL is short enough to make username changes (rare) propagate quickly, and long enough to absorb the burst of repeat lookups during a multi-recipient payment. The cache is invalidated immediately on:

- A social-link change for the local user
- An account update event broadcast over Supabase realtime
- A MoniTag transfer event in the on-chain registry (where applicable)

## Address normalization rules

- **EVM chains** — always lowercase. The MoniPay database stores lowercase; the signing flow lowercases before hashing; the explorer URLs lowercase before linking. Mixed-case EIP-55 checksumming is for display only.
- **Solana** — Base58, case-sensitive, no normalization. Validation rejects any string that fails Base58 parsing.
- **Tempo** — same format as EVM (0x-prefixed hex); lowercase normalization applies.

## Performance

The cache hit rate during ordinary use is high — a typical send hits 3–5 cache reads per recipient (lookup, balance check, receipt render). A multi-recipient batch of 10 hits the same MoniTag rows repeatedly, all served from cache after the first lookup.

## Read next

- [MoniTag overview](/monitag/)
- [Reserved usernames](/monitag/reserved-usernames)
- [Address normalization (memory note)](/security/)
