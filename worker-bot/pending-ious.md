# Pending (Unclaimed) IOUs — Celo

**Contract:** `0x6bB3C64C382fcF8fB65b24234C455bB62b155742`
**Verified:** 2026-07-11, agreed by two independent RPCs (Forno + Ankr) at block ~71,894,300
**Pending count:** 10 &nbsp;•&nbsp; **Net total:** 19.00 USD₮

> ⚠️ Changed since the earlier session: **#18 (14.50) and #33 (1.00) have since been CLAIMED** and are no longer pending. The old "12 pending / 34.50" figure is stale.

| IOU | Amount (USD₮) | Full recipientId | recipient_id (decoded) | Expiry |
|-----|---------------|------------------|------------------------|--------|
| #41 | 2.00 | `0xbba29d44498fc71d970271d0c7de1f21b852d3047b026982be0faa3952afc8bb` | *(not in provided export)* | 2026-12-14 |
| #47 | 2.00 | `0xb30ff31988ea37d29e8541b0003cfdf688a97179af5191b7ebcb4ec85ba943dc` | *(not in provided export)* | 2026-12-16 |
| #50 | 2.00 | `0xc328a2428afd97e8b3d68aca9f7e3d418036b7ff18dcaf4e2d775f0533de5a5d` | *(not in provided export)* | 2026-12-17 |
| #51 | 2.00 | `0xf3ae73375311d8e10568bb92783d5d250ae4b56f216024f3e94500974c082344` | *(not in provided export)* | 2026-12-17 |
| #52 | 2.00 | `0xf8a0ffc6450174b681ab71bec1f480584451c596fbab897b537d5af6ee48dfe4` | *(not in provided export)* | 2026-12-17 |
| #53 | 2.00 | `0xb920954f7b34eb611ef0e77ec58663409599ce32e861f1ddbf3b6ac657dad06b` | *(not in provided export)* | 2026-12-17 |
| #54 | 2.00 | `0x33c78f5a9aa37c303e9e2da43acb9b69d94584268601324a56c0bed3f9b3a8cb` | *(not in provided export)* | 2026-12-17 |
| #55 | 2.00 | `0xd2f4355cf5206d2bb36229bde22b064c0b58e0f7cf191f25be63295c13a39a4e` | *(not in provided export)* | 2026-12-17 |
| #59 | 2.00 | `0xab104ffeb859da83bb86c76792a54c3fe7dc65ae5281990111a473dc5acc4133` | *(not in provided export)* | 2026-12-17 |
| #65 | 1.00 | `0xc2c3e2297e014fb23a64093577ce829d33c66b235c15cbd9740df9a84b33daef` | `telegram:jadeofwallstreet1` | 2026-12-28 |

**recipientId derivation:** `recipientId = keccak256(utf8bytes(recipient_id))`, where `recipient_id` is the Supabase column in `platform:userid` form (e.g. `telegram:jadeofwallstreet1`). Verified against 4 known values. The 9 rows marked *(not in provided export)* have on-chain IOUs but were not included in the pasted Supabase excerpt — provide their rows (or the full `ious` table filtered to `chain='celo'`) and I'll decode each.

None are expired (all Dec 2026), so all 10 are claimable but not yet refundable.
