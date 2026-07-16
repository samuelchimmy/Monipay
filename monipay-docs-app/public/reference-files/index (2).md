---
title: MoniBot Tempo Routing & Keywords
description: MoniBot routes payments to Tempo when commands contain 'on tempo', 'tempo', 'alphausd', or 'ausd'. Single-tx atomic batch execution.
canonical: https://docs.monipay.xyz/monibot/tempo-routing
---

# MoniBot Tempo routing

MoniBot detects Tempo intent from these keywords (case-insensitive):

- `on tempo`
- `tempo`
- `alphausd`
- `ausd`

When detected, MoniBot:

1. Resolves recipients' Tempo addresses
2. Constructs a single batch-call transaction
3. Uses the **MoniBot UUID** sponsor for fee payment
4. Executes atomically (TIP-20 transfer with memo)

This bypasses standard EVM allowance flows — Tempo's TIP-20 standard makes per-token approvals unnecessary for sponsor-relayed flows.
