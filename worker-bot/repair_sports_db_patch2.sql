-- ============================================================
-- MoniBot — Follow-up patch after repair_sports_db.sql
-- Fixes accent stripping + API name variants that slipped through.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Fix 1: "curaçao" (accented) → "curacao"
UPDATE sports_match_results
SET
  away_team   = 'curacao',
  winner_team = CASE WHEN winner_team = 'curaçao' THEN 'curacao' ELSE winner_team END
WHERE away_team = 'curaçao'
   OR home_team = 'curaçao';

-- Fix 2: "cape verde islands" → "cape verde"
UPDATE sports_match_results
SET
  away_team   = CASE WHEN away_team   = 'cape verde islands' THEN 'cape verde' ELSE away_team   END,
  home_team   = CASE WHEN home_team   = 'cape verde islands' THEN 'cape verde' ELSE home_team   END,
  winner_team = CASE WHEN winner_team = 'cape verde islands' THEN 'cape verde' ELSE winner_team END
WHERE away_team = 'cape verde islands'
   OR home_team = 'cape verde islands';

-- Verify — should return 0 rows if all clean:
SELECT id, home_team, away_team, winner_team, outcome
FROM sports_match_results
WHERE home_team IN ('curaçao','cape verde islands')
   OR away_team IN ('curaçao','cape verde islands');

-- Final sanity check — all finished matches:
SELECT id, home_team, away_team, winner_team, outcome, home_score, away_score
FROM sports_match_results
WHERE finished = true
ORDER BY id;
