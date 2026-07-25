ALTER TABLE monibot_transactions ADD COLUMN language TEXT DEFAULT 'english';

-- Note: Celo chain payments also benefit from language detection.
-- Nigerian Pidgin (pid) is common in Celo Africa DAO communities.
-- Ensure lang column supports 'pid', 'en', 'yo', 'ig', 'ha' values.
