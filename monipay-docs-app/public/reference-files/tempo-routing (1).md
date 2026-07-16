---
title: MoniBot Tempo Routing & Keywords — Single-Tx Atomic Batch Execution
description: MoniBot routes payments to Tempo when commands contain "on tempo", "tempo", "alphausd", or "ausd". Execution uses a single EIP-2718 type 0x76 transaction with native feePayer sponsorship, batch-call atomicity, and TIP-20 transfers with on-chain memo — bypassing standard EVM allowance flows.
keywords: monibot tempo, tempo routing keywords, alphausd payment commands, ausd tip command, monibot batch call, tip-20 transfer memo, tempo fee payer sponsorship, gasless tempo bot
canonical: https://docs.monipay.xyz/monibot/tempo-routing
---

# MoniBot Tempo routing

MoniBot detects Tempo intent from these case-insensitive keywords anywhere in the command body:

- `on tempo`
- `tempo`
- `alphausd`
- `ausd`

When detected, MoniBot:

1. Resolves each recipient MoniTag to a Tempo address (or mints a MagicPay claim for unlinked handles).
2. Constructs a **single** EIP-2718 type 0x76 transaction containing one TIP-20 transfer call per recipient plus the platform-fee call.
3. Sets `feePayer` to the MoniBot UUID sponsor wallet — the protocol pays the fee, not the user, not the executor.
4. Executes atomically. Either every transfer lands or none do.
5. Posts a single confirmation reply with one transaction reference covering the whole batch.

## Why this is better than the EVM path

On Base, BSC, and Celo, MoniBot has to:

- Maintain a per-token ERC-20 allowance for each user × chain pair the bot will spend from.
- Submit sequential transactions (one per recipient) to avoid nonce collisions on the executor wallet.
- Pay gas in the chain's native token (ETH, BNB, CELO) from a hot wallet that must be refilled.
- Reconcile partial failures in batch payments — recipient 3 of 10 might revert while the rest succeed.

On Tempo, none of that applies:

- **No allowance flows.** TIP-20's `delegatedTransfer` semantics and the type 0x76 envelope make per-token approvals unnecessary for sponsored execution.
- **Single transaction.** The `calls[]` array carries all recipients atomically.
- **No native gas token.** Fees are paid in stablecoin via `feePayer`. The sponsor wallet holds αUSD, not a native token.
- **No partial failures.** All-or-nothing settlement is enforced by the envelope, not by the smart contract.

## What gets attached to each transfer

Each TIP-20 transfer call sets the on-chain `memo` field to a structured payload:

- `MoniBot grant: <campaignId>` for sponsored campaign distributions
- `MoniBot P2P: <tweet/discord/telegram-id>` for peer-to-peer commands
- `MoniBot multi: <batchId>:<index>/<total>` for multi-recipient sends

This puts the payment context on-chain, so reconciliation tools and the recipient's MoniPay app can render meaningful receipts without an off-chain lookup.

## The MoniBot UUID sponsor

MoniBot uses a fixed UUID identifying its sponsor wallet on Tempo. All MoniBot-issued Tempo transactions reference the same sponsor; the wallet is monitored for low-balance alerts and auto-topup signals on the admin dashboard. See the [Tempo Routing memory note](/contracts/tempo) for the exact UUID binding.

## Failure modes

- **Sponsor out of αUSD.** MoniBot stops cleanly and surfaces an admin alert. No partial settlement. No silent retries against an empty sponsor.
- **Recipient has no Tempo address.** That recipient receives a MagicPay claim link instead; other recipients in the batch settle normally.
- **Command keyword ambiguity.** If the parser cannot decide which chain is intended, MoniBot stays silent rather than guess. Re-phrase with `on tempo`.

## Read next

- [MoniPay on Tempo](/chains/tempo)
- [Tempo smart contracts](/contracts/tempo)
- [Multi-recipient payments](/monibot/multi-recipient)
- [MoniBot fees](/monibot/fees)
