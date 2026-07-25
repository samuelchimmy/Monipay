-- ============================================================
-- MoniBot — sports_match_results DB Repair Script
-- Run this in the Supabase SQL Editor.
-- Reads api_raw ground-truth names, re-normalizes, and fixes
-- home_team / away_team / winner_team / outcome for every row.
-- Safe: only updates rows where something actually changed.
-- ============================================================

-- Step 1: Create a normalizer function (matches sportsOracle.js logic)
-- Maps common API names to the canonical display name used by the bot.
CREATE OR REPLACE FUNCTION normalize_wc_team(raw_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  lower_name TEXT;
BEGIN
  IF raw_name IS NULL THEN RETURN NULL; END IF;

  lower_name := lower(trim(raw_name));

  RETURN CASE lower_name
    -- United States
    WHEN 'usa' THEN 'united states'
    WHEN 'us' THEN 'united states'
    WHEN 'united states' THEN 'united states'
    WHEN 'usmnt' THEN 'united states'
    WHEN 'united states of america' THEN 'united states'

    -- Mexico
    WHEN 'mexico' THEN 'mexico'
    WHEN 'mex' THEN 'mexico'
    WHEN 'el tri' THEN 'mexico'

    -- Canada
    WHEN 'canada' THEN 'canada'
    WHEN 'can' THEN 'canada'
    WHEN 'canmnt' THEN 'canada'

    -- Argentina
    WHEN 'argentina' THEN 'argentina'
    WHEN 'arg' THEN 'argentina'
    WHEN 'albiceleste' THEN 'argentina'

    -- Chile
    WHEN 'chile' THEN 'chile'
    WHEN 'chi' THEN 'chile'

    -- Peru
    WHEN 'peru' THEN 'peru'
    WHEN 'per' THEN 'peru'

    -- Australia
    WHEN 'australia' THEN 'australia'
    WHEN 'aus' THEN 'australia'
    WHEN 'socceroos' THEN 'australia'

    -- Spain
    WHEN 'spain' THEN 'spain'
    WHEN 'esp' THEN 'spain'

    -- Portugal
    WHEN 'portugal' THEN 'portugal'
    WHEN 'por' THEN 'portugal'
    WHEN 'selecao' THEN 'portugal'

    -- Morocco
    WHEN 'morocco' THEN 'morocco'
    WHEN 'mar' THEN 'morocco'

    -- Uruguay
    WHEN 'uruguay' THEN 'uruguay'
    WHEN 'uru' THEN 'uruguay'

    -- France
    WHEN 'france' THEN 'france'
    WHEN 'fra' THEN 'france'

    -- Brazil
    WHEN 'brazil' THEN 'brazil'
    WHEN 'bra' THEN 'brazil'
    WHEN 'brasil' THEN 'brazil'

    -- Colombia
    WHEN 'colombia' THEN 'colombia'
    WHEN 'col' THEN 'colombia'

    -- England
    WHEN 'england' THEN 'england'
    WHEN 'eng' THEN 'england'

    -- Germany
    WHEN 'germany' THEN 'germany'
    WHEN 'ger' THEN 'germany'
    WHEN 'die mannschaft' THEN 'germany'

    -- Japan
    WHEN 'japan' THEN 'japan'
    WHEN 'jpn' THEN 'japan'

    -- Belgium
    WHEN 'belgium' THEN 'belgium'
    WHEN 'bel' THEN 'belgium'

    -- Saudi Arabia
    WHEN 'saudi arabia' THEN 'saudi arabia'
    WHEN 'ksa' THEN 'saudi arabia'
    WHEN 'saudi' THEN 'saudi arabia'

    -- Netherlands
    WHEN 'netherlands' THEN 'netherlands'
    WHEN 'ned' THEN 'netherlands'
    WHEN 'holland' THEN 'netherlands'

    -- Ecuador
    WHEN 'ecuador' THEN 'ecuador'
    WHEN 'ecu' THEN 'ecuador'

    -- Senegal
    WHEN 'senegal' THEN 'senegal'
    WHEN 'sen' THEN 'senegal'

    -- Iran
    WHEN 'iran' THEN 'iran'
    WHEN 'irn' THEN 'iran'

    -- Switzerland
    WHEN 'switzerland' THEN 'switzerland'
    WHEN 'sui' THEN 'switzerland'

    -- Cameroon
    WHEN 'cameroon' THEN 'cameroon'
    WHEN 'cmr' THEN 'cameroon'

    -- Serbia
    WHEN 'serbia' THEN 'serbia'
    WHEN 'srb' THEN 'serbia'

    -- New Zealand
    WHEN 'new zealand' THEN 'new zealand'
    WHEN 'nzl' THEN 'new zealand'

    -- Croatia
    WHEN 'croatia' THEN 'croatia'
    WHEN 'cro' THEN 'croatia'

    -- South Africa
    WHEN 'south africa' THEN 'south africa'
    WHEN 'rsa' THEN 'south africa'
    WHEN 'bafana bafana' THEN 'south africa'

    -- South Korea
    WHEN 'south korea' THEN 'south korea'
    WHEN 'kor' THEN 'south korea'
    WHEN 'korea republic' THEN 'south korea'
    WHEN 'korea' THEN 'south korea'

    -- Ukraine
    WHEN 'ukraine' THEN 'ukraine'
    WHEN 'ukr' THEN 'ukraine'

    -- Costa Rica
    WHEN 'costa rica' THEN 'costa rica'
    WHEN 'crc' THEN 'costa rica'

    -- Qatar
    WHEN 'qatar' THEN 'qatar'
    WHEN 'qat' THEN 'qatar'

    -- Panama
    WHEN 'panama' THEN 'panama'
    WHEN 'pan' THEN 'panama'

    -- Italy
    WHEN 'italy' THEN 'italy'
    WHEN 'ita' THEN 'italy'

    -- Egypt
    WHEN 'egypt' THEN 'egypt'
    WHEN 'egy' THEN 'egypt'

    -- Austria
    WHEN 'austria' THEN 'austria'
    WHEN 'aut' THEN 'austria'

    -- Ghana
    WHEN 'ghana' THEN 'ghana'
    WHEN 'gha' THEN 'ghana'

    -- Hungary
    WHEN 'hungary' THEN 'hungary'
    WHEN 'hun' THEN 'hungary'

    -- Indonesia
    WHEN 'indonesia' THEN 'indonesia'
    WHEN 'idn' THEN 'indonesia'

    -- Nigeria
    WHEN 'nigeria' THEN 'nigeria'
    WHEN 'nga' THEN 'nigeria'

    -- Denmark
    WHEN 'denmark' THEN 'denmark'
    WHEN 'den' THEN 'denmark'

    -- Poland
    WHEN 'poland' THEN 'poland'
    WHEN 'pol' THEN 'poland'

    -- Algeria ← key team that was being misidentified
    WHEN 'algeria' THEN 'algeria'
    WHEN 'alg' THEN 'algeria'

    -- Bosnia
    WHEN 'bosnia and herzegovina' THEN 'bosnia and herzegovina'
    WHEN 'bosnia' THEN 'bosnia and herzegovina'
    WHEN 'bih' THEN 'bosnia and herzegovina'

    -- Cape Verde (API returns 'Cape Verde Islands')
    WHEN 'cape verde' THEN 'cape verde'
    WHEN 'cpv' THEN 'cape verde'
    WHEN 'cape verde islands' THEN 'cape verde'
    WHEN 'republic of cape verde' THEN 'cape verde'

    -- Czechia
    WHEN 'czechia' THEN 'czechia'
    WHEN 'czech republic' THEN 'czechia'
    WHEN 'cze' THEN 'czechia'

    -- DR Congo
    WHEN 'dr congo' THEN 'dr congo'
    WHEN 'democratic republic of congo' THEN 'dr congo'
    WHEN 'cod' THEN 'dr congo'
    WHEN 'congo dr' THEN 'dr congo'

    -- Haiti
    WHEN 'haiti' THEN 'haiti'
    WHEN 'hai' THEN 'haiti'

    -- Iraq
    WHEN 'iraq' THEN 'iraq'
    WHEN 'irq' THEN 'iraq'

    -- Ivory Coast
    WHEN 'ivory coast' THEN 'ivory coast'
    WHEN 'cote d''ivoire' THEN 'ivory coast'
    WHEN 'civ' THEN 'ivory coast'

    -- Jordan
    WHEN 'jordan' THEN 'jordan'
    WHEN 'jor' THEN 'jordan'

    -- Norway
    WHEN 'norway' THEN 'norway'
    WHEN 'nor' THEN 'norway'

    -- Paraguay
    WHEN 'paraguay' THEN 'paraguay'
    WHEN 'par' THEN 'paraguay'

    -- Scotland
    WHEN 'scotland' THEN 'scotland'
    WHEN 'sco' THEN 'scotland'

    -- Sweden
    WHEN 'sweden' THEN 'sweden'
    WHEN 'swe' THEN 'sweden'

    -- Tunisia
    WHEN 'tunisia' THEN 'tunisia'
    WHEN 'tun' THEN 'tunisia'

    -- Turkiye
    WHEN 'turkiye' THEN 'turkiye'
    WHEN 'turkey' THEN 'turkiye'
    WHEN 'tur' THEN 'turkiye'

    -- Uzbekistan
    WHEN 'uzbekistan' THEN 'uzbekistan'
    WHEN 'uzb' THEN 'uzbekistan'

    -- Curacao (API returns accented 'Curaçao')
    WHEN 'curacao' THEN 'curacao'
    WHEN 'cur' THEN 'curacao'
    WHEN 'curaçao' THEN 'curacao'

    -- Fallback: return the lowercased raw name as-is
    ELSE lower_name
  END;
END;
$$;

-- ============================================================
-- Step 2: Preview what WILL change (run this first to review)
-- ============================================================
SELECT
  id,
  finished,
  home_team    AS "old_home",
  away_team    AS "old_away",
  winner_team  AS "old_winner",
  outcome      AS "old_outcome",
  normalize_wc_team(
    COALESCE(
      (api_raw::jsonb)->>'home_team_name_en',
      (api_raw::jsonb)->'homeTeam'->>'name',
      (api_raw::jsonb)->>'team1'
    )
  ) AS "new_home",
  normalize_wc_team(
    COALESCE(
      (api_raw::jsonb)->>'away_team_name_en',
      (api_raw::jsonb)->'awayTeam'->>'name',
      (api_raw::jsonb)->>'team2'
    )
  ) AS "new_away",
  -- winner/outcome only computed for FINISHED matches; NULL for upcoming
  CASE WHEN finished = true THEN
    CASE
      WHEN home_score > away_score THEN normalize_wc_team(COALESCE(
        (api_raw::jsonb)->>'home_team_name_en',
        (api_raw::jsonb)->'homeTeam'->>'name',
        (api_raw::jsonb)->>'team1'))
      WHEN away_score > home_score THEN normalize_wc_team(COALESCE(
        (api_raw::jsonb)->>'away_team_name_en',
        (api_raw::jsonb)->'awayTeam'->>'name',
        (api_raw::jsonb)->>'team2'))
      ELSE 'draw'
    END
  END AS "new_winner",
  CASE WHEN finished = true THEN
    CASE
      WHEN home_score > away_score THEN 'home_win'
      WHEN away_score > home_score THEN 'away_win'
      ELSE 'draw'
    END
  END AS "new_outcome",
  home_score,
  away_score
FROM sports_match_results
WHERE api_raw IS NOT NULL
ORDER BY finished DESC, id;


-- ============================================================
-- Step 3a: Fix team names for ALL rows (finished + upcoming)
-- ============================================================
WITH corrected AS (
  SELECT
    id,
    normalize_wc_team(
      COALESCE(
        (api_raw::jsonb)->>'home_team_name_en',
        (api_raw::jsonb)->'homeTeam'->>'name',
        (api_raw::jsonb)->>'team1'
      )
    ) AS correct_home,
    normalize_wc_team(
      COALESCE(
        (api_raw::jsonb)->>'away_team_name_en',
        (api_raw::jsonb)->'awayTeam'->>'name',
        (api_raw::jsonb)->>'team2'
      )
    ) AS correct_away
  FROM sports_match_results
  WHERE api_raw IS NOT NULL
)
UPDATE sports_match_results AS s
SET
  home_team = c.correct_home,
  away_team = c.correct_away
FROM corrected c
WHERE s.id = c.id
  AND (
    s.home_team IS DISTINCT FROM c.correct_home OR
    s.away_team IS DISTINCT FROM c.correct_away
  )
RETURNING s.id, s.home_team AS "fixed_home", s.away_team AS "fixed_away";


-- ============================================================
-- Step 3b: Fix winner_team + outcome ONLY for FINISHED matches
-- ============================================================
WITH corrected AS (
  SELECT
    id,
    normalize_wc_team(
      COALESCE(
        (api_raw::jsonb)->>'home_team_name_en',
        (api_raw::jsonb)->'homeTeam'->>'name',
        (api_raw::jsonb)->>'team1'
      )
    ) AS correct_home,
    normalize_wc_team(
      COALESCE(
        (api_raw::jsonb)->>'away_team_name_en',
        (api_raw::jsonb)->'awayTeam'->>'name',
        (api_raw::jsonb)->>'team2'
      )
    ) AS correct_away,
    CASE
      WHEN home_score > away_score THEN normalize_wc_team(COALESCE(
        (api_raw::jsonb)->>'home_team_name_en',
        (api_raw::jsonb)->'homeTeam'->>'name',
        (api_raw::jsonb)->>'team1'))
      WHEN away_score > home_score THEN normalize_wc_team(COALESCE(
        (api_raw::jsonb)->>'away_team_name_en',
        (api_raw::jsonb)->'awayTeam'->>'name',
        (api_raw::jsonb)->>'team2'))
      ELSE 'draw'
    END AS correct_winner,
    CASE
      WHEN home_score > away_score THEN 'home_win'
      WHEN away_score > home_score THEN 'away_win'
      ELSE 'draw'
    END AS correct_outcome
  FROM sports_match_results
  WHERE api_raw IS NOT NULL
    AND finished = true   -- ← ONLY finished matches get winner/outcome
)
UPDATE sports_match_results AS s
SET
  winner_team = c.correct_winner,
  outcome     = c.correct_outcome
FROM corrected c
WHERE s.id = c.id
  AND (
    s.winner_team IS DISTINCT FROM c.correct_winner OR
    s.outcome     IS DISTINCT FROM c.correct_outcome
  )
RETURNING s.id, s.winner_team AS "fixed_winner", s.outcome AS "fixed_outcome";


-- ============================================================
-- Step 3c: Ensure unfinished matches have NULL winner/outcome
-- (cleans up any prior accidental values)
-- ============================================================
UPDATE sports_match_results
SET winner_team = NULL, outcome = NULL
WHERE finished = false
  AND (winner_team IS NOT NULL OR outcome IS NOT NULL)
RETURNING id, home_team, away_team;


-- ============================================================
-- Step 4: Cleanup — drop the helper function when done
-- ============================================================
-- DROP FUNCTION IF EXISTS normalize_wc_team(TEXT);
