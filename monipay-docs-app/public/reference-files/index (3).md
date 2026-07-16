---
title: How MoniTag Resolution Works
description: MoniTag resolution turns @username into the right blockchain address per chain, with caching, normalization, and fallback handling.
canonical: https://docs.monipay.xyz/monitag/resolution
---

# How MoniTag resolution works

When you type `@alice` and pick a chain, MoniPay:

1. **Normalizes** — strips `@`, lowercases.
2. **Looks up** the MoniTag in Supabase, scoped to the chosen chain (e.g. `base_address`, `bsc_address`, `solana_address`, `tempo_address`).
3. **Caches** the result for 60 seconds (TTL).
4. **Returns** the address. EVM addresses are returned lowercase; Solana addresses in Base58.
5. **Fails closed** — if the user has no wallet on that chain, the send is blocked with a clear error.

Cache invalidation happens on social-link changes and account updates.
