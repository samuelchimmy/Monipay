
-- Drop the existing source check constraint
ALTER TABLE transactions DROP CONSTRAINT transactions_source_check;

-- Add new source check constraint that includes MoniBot transaction types
ALTER TABLE transactions ADD CONSTRAINT transactions_source_check 
  CHECK (source = ANY (ARRAY[
    'p2p'::text, 
    'payment_link'::text, 
    'online_order'::text, 
    'invoice'::text, 
    'external'::text, 
    'withdrawal'::text,
    'monibot_p2p'::text,
    'monibot_grant'::text
  ]));
