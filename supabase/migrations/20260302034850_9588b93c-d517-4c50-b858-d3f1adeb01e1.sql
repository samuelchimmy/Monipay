ALTER TABLE profiles ADD COLUMN solana_address TEXT;
CREATE INDEX idx_profiles_solana_address ON profiles(solana_address);