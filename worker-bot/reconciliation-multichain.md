# Multi-chain IOU Reconciliation — base / bsc / ink

**Verified:** 2026-07-11, each chain scanned on two independent RPCs — **0 disagreements**.
**recipientId scheme** (same as celo): `keccak256(utf8(recipient_id))`, `recipient_id` = `platform:userid`.

| Chain | Registry | id | dec | on-chain IOUs | pending | pending net |
|---|---|---|---|---|---|---|
| base | `0x1945c633659Ae71991aE37eE2Bdfe64E00514650` | 8453 | 6 | 3 (#0–2) | 0 | 0 |
| bsc  | `0xF602b559eE5c51ED122F667d101be105d9eDf90d` | 56 | 18 | 2 (#0–1) | 0 | 0 |
| ink  | `0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08` | 57073 | 6 | 14 (#0–13) | **1** | **0.95** |

## base — clean ✅
All 3 IOUs claimed on-chain; all to `discord:943111032870682654` (gogorama). Every base row in
your export is `claimed`. **No status drift, no fix needed.**

## bsc — clean ✅
Both IOUs claimed on-chain; to `discord:943111032870682654`. Note bsc uses **18 decimals**
(net 0.15 USDT each). Your bsc export row is `claimed`. **No status drift, no fix needed.**

## ink — one pending + two orphan rows ⚠️

All 12 ink rows in your export are `claimed`, and each matches on-chain status by `iou_id`
(gross − ~0.05 fee = on-chain net; mapping confirmed). **No pending→claimed drift.**

**But two on-chain ink IOUs have no row in the export you shared:**

| ink IOU | net | state | expiry | recipient (decoded) | sender |
|---|---|---|---|---|---|
| #6 | 0.95 | claimed | 2026-10-19 | *(not in shared data)* | 0xD468…fbc50 |
| #13 | 0.95 | **pending** | 2026-11-04 | *(not in shared data)* | 0xD468…fbc50 |

- **#13 is genuinely pending on-chain (0.95 USDT0, claimable, not expired).** Its recipientId is
  `0x8ec8724497b5a19524830d75040717b714c0d32481ea42293f7f5fe7322a66dd`, which does **not** hash
  from any `recipient_id` in your export — meaning the recipient isn't among the people in the
  pasted rows.
- **#6** recipientId `0x37e102b3…`-adjacent; also not in the shared universe.

### What this means
Your `ious` table (as shared) is **missing rows for ink #6 and #13**. If the export was the
complete table, these are **orphan on-chain IOUs** (money on-chain with no DB record) — a real
integrity gap, and #13's 0.95 is an unrecorded claimable balance. If the export was filtered,
those rows may exist in your DB and just weren't pasted.

### Next step (need input)
Run this against your DB and share the result so I can classify #6 and #13:

```sql
SELECT id, iou_id, status, recipient_id, amount, tx_hash_create
FROM ious
WHERE chain = 'ink' AND iou_id IN (6, 13);
```

- **If rows exist:** I'll reconcile status the same way as celo (and generate `fix-ink.sql` if
  #13's row is wrongly marked claimed/absent-of-pending).
- **If no rows:** they're orphans — I can reconstruct the intended rows from the on-chain
  `Created` event logs (sender, recipientId, amount, tx hash, timestamp) so you can backfill.

## Summary
- **base, bsc: fully reconciled, nothing to fix.**
- **ink: no status drift on known rows, but 1 pending (0.95) + 1 claimed IOU are absent from the
  shared table.** Confirm whether they exist in your DB.
- No writes performed. base/bsc need no SQL.
