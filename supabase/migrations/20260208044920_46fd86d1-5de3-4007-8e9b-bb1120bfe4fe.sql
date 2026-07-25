-- Backfill recipient_pay_tag from profiles table for all monibot_transactions where it's null
UPDATE monibot_transactions mt
SET recipient_pay_tag = p.pay_tag
FROM profiles p
WHERE mt.receiver_id = p.id
  AND mt.recipient_pay_tag IS NULL;

-- Also backfill payer_pay_tag where it's null (for p2p_command type transactions)
UPDATE monibot_transactions mt
SET payer_pay_tag = p.pay_tag
FROM profiles p
WHERE mt.sender_id = p.id
  AND mt.payer_pay_tag IS NULL;