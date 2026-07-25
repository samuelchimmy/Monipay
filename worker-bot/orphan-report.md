# Orphan IOU Report — final resolution

**Date:** 2026-07-11. All on-chain data dual-RPC verified.

## Conclusion
10 pending on-chain IOUs exist that your database never recorded. **Senders are
identified; recipients are unrecoverable** from any Supabase table — they are
genuine orphans (money on-chain, no off-chain record, recipient never onboarded).

| chain | iou | net | sender (resolved) | sender profiles.id | recipient | insert |
|---|---|---|---|---|---|---|
| celo | 41 | 2.00 | jade | d438bb8e-… | unrecoverable | ✅ STEP 2 |
| celo | 47 | 2.00 | hertfordharry | **none** (wallet_profiles only) | unrecoverable | ⚠️ STEP 3 (FK blocked) |
| celo | 50 | 2.00 | utdkhare | 63e2bf3a-… | unrecoverable | ✅ STEP 2 |
| celo | 51 | 2.00 | utdkhare | 63e2bf3a-… | unrecoverable | ✅ STEP 2 |
| celo | 52 | 2.00 | utdkhare | 63e2bf3a-… | unrecoverable | ✅ STEP 2 |
| celo | 53 | 2.00 | utdkhare | 63e2bf3a-… | unrecoverable | ✅ STEP 2 |
| celo | 54 | 2.00 | jade | d438bb8e-… | unrecoverable | ✅ STEP 2 |
| celo | 55 | 2.00 | jade | d438bb8e-… | unrecoverable | ✅ STEP 2 |
| celo | 59 | 2.00 | utdkhare | 63e2bf3a-… | unrecoverable | ✅ STEP 2 |
| ink  | 13 | 0.95 | jade | d438bb8e-… | unrecoverable | ✅ STEP 2 |

Total orphaned pending value: **18.00 USDT (celo) + 0.95 USDT0 (ink) = 18.95**.

## How each conclusion was reached
1. **Senders** — Query 1 mapped on-chain sender wallets → profiles:
   `0xd468…`=jade, `0x2325c3c1…`=utdkhare (profiles row exists),
   `0xa7150dca…`=hertfordharry (wallet_profiles only, **no profiles row**).
2. **Recipients (hash reversal)** — the on-chain `recipientId` is
   `keccak256(lower(platform)||':'||userId)`. Hasher **proven** correct by
   reproducing 4 known recipientIds and recovering investormalami (#31) and
   hertfordharry-as-recipient (#46) from `wallet_profiles`.
   Hashing the **entire** `wallet_profiles` directory (all x/discord/telegram/
   bluesky ids + usernames, both cases) against the 10 targets → **0 matches**.
3. **Recipients (tx-hash join)** — joined all 10 creation tx hashes to
   `monibot_transactions.tx_hash` → **0 matches** (all null). The sends were
   never logged off-chain at all.

→ The recipient handle survives only in the original bot command (Discord/
Telegram message) that triggered each send. Not in Supabase.

## Why this is safe to insert (and its one limit)
`claim-social-funds` derives the on-chain `recipientId` from the **claimant's
own** request + verifies against the claimant's linked socials. It never reads
`ious.recipient_id`. So:
- ✅ A sentinel `recipient_id` cannot misattribute funds or enable a wrong claim.
- ⚠️ It also won't appear in a recipient's "pending IOUs" list (that lists by
  plaintext `recipient_id`) until backfilled with the real handle.

Funds remain claimable on-chain regardless — the blocker is *discovery*, not
access.

## Recommended actions
1. Run `final-fix.sql` STEP 0 (confirm absence) → STEP 1 (ink #6) → STEP 2
   (insert 9 attributable orphans with sentinels).
2. #47: give hertfordharry a `profiles` row (or the correct id), then STEP 3.
3. Recover the 10 real handles from bot logs; send them to me — I'll verify
   each against the embedded keccak hash before you UPDATE `recipient_id`.
4. Consider a guard so future `executeCreate` calls always write the `ious`
   row (these orphans imply the create path can succeed on-chain without a DB
   insert — the same class of gap that caused this).
