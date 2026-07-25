-- Phase 5: Add Tempo address column to profiles (additive only)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tempo_address TEXT;

-- Index for fast lookups by Tempo address
CREATE INDEX IF NOT EXISTS idx_profiles_tempo_address ON profiles(tempo_address) WHERE tempo_address IS NOT NULL;