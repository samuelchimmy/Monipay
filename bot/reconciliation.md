# Supabase ↔ On-chain Reconciliation — Celo registry

**Contract:** `0x6bB3C64C382fcF8fB65b24234C455bB62b155742`
**Chain truth verified:** 2026-07-11, Forno + Ankr agree on all 66 IOUs (0 disagreements).
**Join key:** Supabase `iou_id` = on-chain IOU index (confirmed: amounts, expiries, and
`keccak256(recipient_id)` all line up on matched rows).

## Root cause of the miscomputed table

The chain is the source of truth for `claimed / refunded`. Several Supabase rows still say
`status = 'pending'` but the IOU was **already claimed on-chain** — the off-chain table never
recorded batch-claim transactions. So your "pending" total is overstated. Two more rows were
hand-flipped to `claimed` today but left with `claimed_at = null` (and no `tx_hash_claim`).

Net effect: Supabase shows more pending USD₮ than actually exists on-chain. Actual on-chain
pending for Celo is **10 IOUs / 19.00 USD₮** (was reported as 12 / 34.50 — now stale after
#18 and #33 were claimed).

## Rows to fix (only Celo rows from your export)

### A. Marked `pending` in Supabase, but `claimed` on-chain → set to claimed

| Supabase id | iou_id | amount | on-chain state | recipient_id |
|---|---|---|---|---|
| a38873b0-0dc2-418e-9c8a-87020d7ec91a | 31 | 5 | **claimed** | discord:945762954618490890 |
| 2cea5abd-f352-4998-9dca-5df2847bc792 | 32 | 0.510204 | **claimed** | telegram:1258612814 |
| 416a5c78-bd1a-4896-9118-7863d90e8b50 | 33 | 1 | **claimed** | telegram:jadeofwallstreet1 |
| 756d0c96-221f-4c25-988c-2dafc1c7ace2 | 35 | 4 | **claimed** | telegram:1258612814 |
| 98938190-0042-41fb-9e69-5ce621b0daf0 | 36 | 4 | **claimed** | telegram:1258612814 |
| b54cb7bb-b241-4174-8828-c2acab5c53de | 38 | 4 | **claimed** | telegram:1258612814 |
| 761e12bb-c6e5-42d6-bf04-320c9f861442 | 46 | 0.5 | **claimed** | discord:972216322480025670 |

### B. Marked `claimed` in Supabase but `claimed_at` / `tx_hash_claim` are null → backfill

| Supabase id | iou_id | amount | note |
|---|---|---|---|
| 72dbf6d5-a11f-4dbd-b165-0dc85608d0d3 | 34 | 4 | on-chain claimed ✓, but claimed_at null |
| 0a4f40b5-d4eb-4a2f-8d97-20ce065a954c | 37 | 4 | on-chain claimed ✓, but claimed_at null |

### C. Correctly `pending` (matches chain) — no change

| Supabase id | iou_id | amount | recipient_id |
|---|---|---|---|
| 21134941-1ff9-47aa-af58-aa3eed03c15c | 65 | 1 | telegram:jadeofwallstreet1 |

## Still-pending Celo IOUs NOT in your export (9 rows)

On-chain pending but absent from the pasted rows — likely other pay-tags/senders:
`#41, #47, #50, #51, #52, #53, #54, #55, #59` (each 2.00 USD₮). Their recipientIds are in
`pending-ious.md`. Share the full `chain='celo'` slice and I'll decode + reconcile them too.

## Notes / caveats

- **amount vs net:** Supabase `amount` is the **gross** send. On-chain V1 `feeBps = 0` for the
  later IOUs (gross = net), but early ones (#0–#30) took a 0.5 USD₮ fee, so `netAmount` < gross
  there. Reconcile *status* by iou_id; don't expect gross to equal on-chain net for old rows.
- I have **not** written anything to Supabase. `fix.sql` below is proposed only — review first.
- `claimed_at` / `tx_hash_claim` for section A/B can be backfilled exactly from the on-chain
  `Claimed` event logs if you want true timestamps rather than `now()`. Say the word and I'll
  pull them.
