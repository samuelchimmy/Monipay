-- =============================================================
-- Migration: World Cup Promo - Sports Match Results + Indexes
-- Run: psql $DATABASE_URL -f this_file.sql
-- =============================================================

-- 1. Sports match results table (oracle writes here, never deleted)
CREATE TABLE IF NOT EXISTS sports_match_results (
  id                TEXT PRIMARY KEY,          -- e.g. "wc26_match_42"
  home_team         TEXT NOT NULL,             -- normalised display name
  away_team         TEXT NOT NULL,
  home_score        INT,
  away_score        INT,
  status            TEXT NOT NULL DEFAULT 'notstarted', -- notstarted | live | finished
  finished          BOOLEAN NOT NULL DEFAULT FALSE,
  winner_team       TEXT,                      -- normalised winner name OR 'draw'
  outcome           TEXT,                      -- 'home_win' | 'away_win' | 'draw'
  match_datetime    TIMESTAMPTZ,               -- UTC kick-off from API
  completed_at      TIMESTAMPTZ,              -- when we first saw finished=TRUE
  stability_at      TIMESTAMPTZ,              -- completed_at + 10min (oracle evaluation gate)
  venue             TEXT,
  group_name        TEXT,                      -- 'Group A' or 'Round of 16' etc.
  round             TEXT,
  api_raw           JSONB,                     -- full raw API response snapshot
  last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for oracle evaluation query
CREATE INDEX IF NOT EXISTS idx_sports_match_status
  ON sports_match_results(status);

CREATE INDEX IF NOT EXISTS idx_sports_match_stability
  ON sports_match_results(stability_at)
  WHERE finished = TRUE;

CREATE INDEX IF NOT EXISTS idx_sports_match_teams
  ON sports_match_results(home_team, away_team);

-- 2. Add type discriminator for conditional sports jobs (no column change needed
--    since scheduled_jobs.type is already TEXT — just add the new allowed value)
-- Note: If you have a CHECK constraint on type, extend it here:
-- ALTER TABLE scheduled_jobs DROP CONSTRAINT IF EXISTS scheduled_jobs_type_check;
-- ALTER TABLE scheduled_jobs ADD CONSTRAINT scheduled_jobs_type_check
--   CHECK (type IN ('scheduled_p2p','scheduled_magicpay','cross_chain_p2p',
--                   'scheduled_giveaway','conditional_sports_p2p'));

-- 3. Index to make oracle lookup of pending conditional jobs fast
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_sports_pending
  ON scheduled_jobs(type, status)
  WHERE type = 'conditional_sports_p2p' AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_sports_match
  ON scheduled_jobs((payload->>'matchId'), status)
  WHERE type = 'conditional_sports_p2p';

-- 4. Comments
COMMENT ON TABLE sports_match_results IS
  'Oracle-maintained snapshot of FIFA World Cup 2026 match results. Updated every 5 min.';

COMMENT ON COLUMN sports_match_results.stability_at IS
  'Set to completed_at + 10 minutes. Oracle only evaluates conditional jobs after this time to prevent API flip-flops.';

COMMENT ON COLUMN sports_match_results.outcome IS
  'Normalised outcome: home_win | away_win | draw. NULL until match is settled.';
