-- =====================================================================
-- FINAL FIX — orphan on-chain IOUs (celo + ink)   [supersedes prior draft]
-- Generated 2026-07-11. On-chain data dual-RPC verified; creation tx/time
-- from IOUCreated logs; senders resolved from profiles; recipients proven
-- unrecoverable (absent from ious, wallet_profiles, and monibot_transactions).
--
-- CONTEXT — why recipient identity is a sentinel here:
--   These 10 IOUs are ORPHANS: on-chain money with no off-chain record.
--   The recipient plaintext handle (what the sender typed at send time) was
--   never persisted to Supabase and cannot be derived from the keccak hash.
--   The claim path (claim-social-funds) does NOT read ious.recipient_id — it
--   authorizes against the CLAIMANT's own linked socials and derives the
--   on-chain recipientId from the request — so a sentinel recipient_id is
--   SAFE (no misattribution, no wrong-claim risk). The only limitation: these
--   rows won't surface in a recipient's "pending IOUs" list until the real
--   handle is backfilled from the bot command logs (see BACKFILL note).
--
-- Amount convention matches existing rows: store GROSS.
--   celo V1 fee=0  -> gross=net=2.00
--   ink  fee=0.05  -> gross=1.00 (on-chain net 0.95), like existing ink rows.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 0 — DIAGNOSTIC (writes nothing). Confirm these are truly absent.
-- ---------------------------------------------------------------------
SELECT chain, iou_id, status, recipient_id, sender_pay_tag, amount
FROM public.ious
WHERE (chain='celo' AND iou_id IN ('41','47','50','51','52','53','54','55','59'))
   OR (chain='ink'  AND iou_id = '13')
ORDER BY chain, iou_id::int;

-- ---------------------------------------------------------------------
-- STEP 1 — ink #6 claim backfill (idempotent; no-op if absent/correct).
-- ---------------------------------------------------------------------
UPDATE public.ious
SET status='claimed', claimed_at=COALESCE(claimed_at, now()), updated_at=now()
WHERE chain='ink' AND iou_id='6' AND status<>'claimed';

-- ---------------------------------------------------------------------
-- STEP 2 — INSERT the 9 attributable orphans (8 celo + ink #13).
-- Senders are REAL. recipient_id/identifier are traceable sentinels that
-- embed the on-chain recipientId hash so the real handle can be matched
-- later. ON CONFLICT keeps it safe if a row already exists.
-- To undo: DELETE FROM public.ious WHERE recipient_id LIKE 'orphan:%';
-- ---------------------------------------------------------------------
INSERT INTO public.ious
  (iou_id, chain, token, token_symbol, amount, status, expiry,
   recipient_id, recipient_identifier, sender_pay_tag, sender_profile_id,
   tx_hash_create, created_at, updated_at)
VALUES
  -- jade (profiles d438bb8e), celo USDT
  ('41','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-14T06:26:28Z',
     'orphan:0xbba29d44498fc71d970271d0c7de1f21b852d3047b026982be0faa3952afc8bb','unresolved-onchain-recipient',
     'jade','d438bb8e-5b38-4309-ba45-753d8a74f814',
     '0xfa6858e95542ca229014042593e7a2ef7784de8425594485c132c953cfdf2672','2026-06-17T06:26:28Z',now()),
  ('54','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-17T00:22:12Z',
     'orphan:0x33c78f5a9aa37c303e9e2da43acb9b69d94584268601324a56c0bed3f9b3a8cb','unresolved-onchain-recipient',
     'jade','d438bb8e-5b38-4309-ba45-753d8a74f814',
     '0xdf45a1db1ef51d85bc570f9cefea6501a2ee471c9855a9ee7d7979c31fa6886a','2026-06-20T00:22:12Z',now()),
  ('55','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-17T00:22:16Z',
     'orphan:0xd2f4355cf5206d2bb36229bde22b064c0b58e0f7cf191f25be63295c13a39a4e','unresolved-onchain-recipient',
     'jade','d438bb8e-5b38-4309-ba45-753d8a74f814',
     '0x391caa3cb892468b8cf3ed86d5ee672b81ffcabbd57136de93131e4cda5300dc','2026-06-20T00:22:16Z',now()),
  -- utdkhare (profiles 63e2bf3a), celo USDT
  ('50','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-17T00:21:57Z',
     'orphan:0xc328a2428afd97e8b3d68aca9f7e3d418036b7ff18dcaf4e2d775f0533de5a5d','unresolved-onchain-recipient',
     'utdkhare','63e2bf3a-2c7c-4249-9a27-4e7d71784b17',
     '0x2bf2a3f9eaa618829d8c227116fceaf2569387e7e72186eadd218cdae899c6fc','2026-06-20T00:21:57Z',now()),
  ('51','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-17T00:22:00Z',
     'orphan:0xf3ae73375311d8e10568bb92783d5d250ae4b56f216024f3e94500974c082344','unresolved-onchain-recipient',
     'utdkhare','63e2bf3a-2c7c-4249-9a27-4e7d71784b17',
     '0xabcf78a9bc8e40e74016313d6dc4b735aa7f4c306d7c353498a0bb0f8a48abc2','2026-06-20T00:22:00Z',now()),
  ('52','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-17T00:22:03Z',
     'orphan:0xf8a0ffc6450174b681ab71bec1f480584451c596fbab897b537d5af6ee48dfe4','unresolved-onchain-recipient',
     'utdkhare','63e2bf3a-2c7c-4249-9a27-4e7d71784b17',
     '0x46a98ea8110f3efa8bf5bb9ab522cc829da66a9777a8a8e02cd11fb62d45aea0','2026-06-20T00:22:03Z',now()),
  ('53','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-17T00:22:08Z',
     'orphan:0xb920954f7b34eb611ef0e77ec58663409599ce32e861f1ddbf3b6ac657dad06b','unresolved-onchain-recipient',
     'utdkhare','63e2bf3a-2c7c-4249-9a27-4e7d71784b17',
     '0x824f2c369b3c5c12f850f9d663962006aea2b1275fe1dba3705e8a37f129cef7','2026-06-20T00:22:08Z',now()),
  ('59','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-17T18:37:05Z',
     'orphan:0xab104ffeb859da83bb86c76792a54c3fe7dc65ae5281990111a473dc5acc4133','unresolved-onchain-recipient',
     'utdkhare','63e2bf3a-2c7c-4249-9a27-4e7d71784b17',
     '0x3d2e219d646b525a2346cbb18f5c71fda1797aa34f77f9538592d2951e997a75','2026-06-20T18:37:05Z',now()),
  -- jade (profiles d438bb8e), ink USDT0
  ('13','ink','0x0200C29006150606B650577BBE7B6248F58470c1','USDT0',1,'pending','2026-11-04T22:45:32Z',
     'orphan:0x8ec8724497b5a19524830d75040717b714c0d32481ea42293f7f5fe7322a66dd','unresolved-onchain-recipient',
     'jade','d438bb8e-5b38-4309-ba45-753d8a74f814',
     '0x20a9853784521ba6978670f63872f9b37cfa936b5371b4f6e2baec882a54d424','2026-05-08T22:45:32Z',now())
ON CONFLICT (iou_id, chain) DO NOTHING;

-- ---------------------------------------------------------------------
-- STEP 3 — celo #47 (sender hertfordharry). BLOCKED BY SCHEMA, not data.
-- hertfordharry is a MiniPay/WalletConnect user -> lives in wallet_profiles,
-- NOT profiles. But ious.sender_profile_id REFERENCES profiles(id) only
-- (verified: never re-pointed since table creation). So MiniPay-originated
-- IOUs cannot be represented with a valid sender_profile_id today.
-- Options:
--   (a) Preferred fix — allow MiniPay senders. Either add a nullable
--       sender_wallet_profile_id UUID REFERENCES wallet_profiles(id), or make
--       sender_profile_id nullable and store the sender wallet another way.
--       (This is the same MiniPay-vs-legacy split you already handle in
--        claim-social-funds by checking BOTH tables.)
--   (b) If hertfordharry ALSO has a legacy profiles row, use that id.
--   (c) Leave #47 as a pure on-chain orphan (money still claimable on-chain).
-- After choosing (a)/(b), fill the sender column(s) and run:
-- ---------------------------------------------------------------------
/*
INSERT INTO public.ious
  (iou_id, chain, token, token_symbol, amount, status, expiry,
   recipient_id, recipient_identifier, sender_pay_tag, sender_profile_id,
   tx_hash_create, created_at, updated_at)
VALUES
  ('47','celo','0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e','USDT',2,'pending','2026-12-16T21:21:50Z',
     'orphan:0xb30ff31988ea37d29e8541b0003cfdf688a97179af5191b7ebcb4ec85ba943dc','unresolved-onchain-recipient',
     'hertfordharry','<<sender_profile_id>>',
     '0x2aedc7cd7c2f960bc1cac9e92b72e98be7a37fb9fac8cf5e68fe40d29b7c17b9','2026-06-19T21:21:50Z',now())
ON CONFLICT (iou_id, chain) DO NOTHING;
*/

-- ---------------------------------------------------------------------
-- BACKFILL the real recipient handles (makes rows claimable via UI).
-- DISCOVERY KEY: the recipient's pending-IOU lookup uses the partial index
-- idx_ious_platform_user ON ious(platform, platform_user_id) WHERE status='pending'
-- -- i.e. it keys on (platform, platform_user_id), NOT recipient_id. The
-- inserted orphans have platform=NULL/platform_user_id=NULL, so they are
-- invisible to recipients until you backfill BOTH those columns.
-- The plaintext is ONLY in the original Discord/Telegram send commands.
-- Once known, for each iou:
--   UPDATE public.ious
--   SET platform = :platform,                         -- e.g. 'discord'
--       platform_user_id = :userid,                   -- e.g. '945762…'
--       recipient_id = :platform || ':' || :userid,
--       recipient_identifier = :platform || ':' || :handle
--   WHERE chain=:chain AND iou_id=:iou_id;
-- Verify the handle first: keccak256(lower(platform)||':'||userid) MUST equal
-- the hash embedded in the current 'orphan:0x…' recipient_id. Send me any
-- candidate handles and I'll confirm the exact match before you write.
-- ---------------------------------------------------------------------
