-- Celo IOU reconciliation fix (PROPOSED — review before running)
-- Source of truth: on-chain contract 0x6bB3C64C382fcF8fB65b24234C455bB62b155742
-- Verified 2026-07-11 (Forno + Ankr agree on all 66 IOUs).
-- NOTE: claimed_at is set to now() as a placeholder. For exact on-chain claim
--       timestamps + tx_hash_claim, backfill from the contract's Claimed event
--       logs instead (ask and these can be generated precisely).

BEGIN;

-- A. Rows that are actually CLAIMED on-chain but still 'pending' in Supabase.
UPDATE ious
SET status = 'claimed',
    claimed_at = COALESCE(claimed_at, now()),
    updated_at = now()
WHERE chain = 'celo'
  AND id IN (
    'a38873b0-0dc2-418e-9c8a-87020d7ec91a', -- iou_id 31
    '2cea5abd-f352-4998-9dca-5df2847bc792', -- iou_id 32
    '416a5c78-bd1a-4896-9118-7863d90e8b50', -- iou_id 33
    '756d0c96-221f-4c25-988c-2dafc1c7ace2', -- iou_id 35
    '98938190-0042-41fb-9e69-5ce621b0daf0', -- iou_id 36
    'b54cb7bb-b241-4174-8828-c2acab5c53de', -- iou_id 38
    '761e12bb-c6e5-42d6-bf04-320c9f861442'  -- iou_id 46
  )
  AND status <> 'claimed';

-- B. Rows already 'claimed' but missing claimed_at (placeholder; prefer chain backfill).
UPDATE ious
SET claimed_at = COALESCE(claimed_at, now()),
    updated_at = now()
WHERE chain = 'celo'
  AND id IN (
    '72dbf6d5-a11f-4dbd-b165-0dc85608d0d3', -- iou_id 34
    '0a4f40b5-d4eb-4a2f-8d97-20ce065a954c'  -- iou_id 37
  )
  AND claimed_at IS NULL;

-- Verify before COMMIT:
--   SELECT iou_id, status, claimed_at FROM ious WHERE chain='celo' ORDER BY iou_id;

COMMIT;
