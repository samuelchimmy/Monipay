/**
 * MoniBot Worker — Sports Oracle v1.0
 *
 * Responsibilities:
 *   1. syncMatchResults()      — poll WC2026 API (dual fallback), upsert sports_match_results
 *   2. evaluateConditionalJobs() — for every settled match, atomically lock + evaluate + fire/cancel
 *
 * Design decisions:
 *   - Atomic UPDATE WHERE status='pending' prevents double-firing under high concurrency
 *   - Recipient resolved fresh at fire time; falls back to MagicPay via Twitter ID if unregistered
 *   - sendTransactionWithNonce (Mutex pattern from Discord bot) prevents nonce collisions under burst
 *   - 10-minute stability window after match finished=TRUE before evaluation
 *   - PQueue concurrency=1 per-chain for belt-and-suspenders nonce safety
 */

import { getSupabase, logTransaction, getProfileByMonitag, getProfileByXUsername } from './database.js';
import { executeP2PViaRouter, executeMagicPay, sendTransactionWithNonce, normalizeChain, getChainConfig } from './blockchain.js';
import { fetchTwitterNumericId } from './twitter.js';
import { findAlternateChain } from './crossChainCheck.js';
// ── Team Alias Map — All 48 WC2026 Teams ─────────────────────────────────────
// Maps every possible user input string → canonical display name
// Canonical names match what the API returns (normalised lowercase for lookup)

const TEAM_ALIASES = {
  // Group A
  'usa': 'united states', 'us': 'united states', 'usmnt': 'united states',
  'united states': 'united states', 'america': 'united states', '🇺🇸': 'united states',

  'mexico': 'mexico', 'mex': 'mexico', 'el tri': 'mexico', '🇲🇽': 'mexico',

  'canada': 'canada', 'can': 'canada', 'canmnt': 'canada', '🇨🇦': 'canada',

  // Group B
  'argentina': 'argentina', 'arg': 'argentina', 'albiceleste': 'argentina',
  'la albiceleste': 'argentina', '🇦🇷': 'argentina', 'messi team': 'argentina',

  'chile': 'chile', 'chi': 'chile', 'la roja': 'chile', '🇨🇱': 'chile',

  'peru': 'peru', 'per': 'peru', '🇵🇪': 'peru',

  'australia': 'australia', 'aus': 'australia', 'socceroos': 'australia', '🇦🇺': 'australia',

  // Group C
  'spain': 'spain', 'esp': 'spain', 'la roja esp': 'spain', '🇪🇸': 'spain',

  'portugal': 'portugal', 'por': 'portugal', 'selecao': 'portugal', 'seleção': 'portugal',
  'la selecao': 'portugal', '🇵🇹': 'portugal', 'ronaldo team': 'portugal',

  'morocco': 'morocco', 'mar': 'morocco', 'atlas lions': 'morocco', '🇲🇦': 'morocco',
  'maroc': 'morocco',

  'uruguay': 'uruguay', 'uru': 'uruguay', 'la celeste': 'uruguay', '🇺🇾': 'uruguay',

  // Group D
  'france': 'france', 'fra': 'france', 'les bleus': 'france', '🇫🇷': 'france',

  'brazil': 'brazil', 'bra': 'brazil', 'brasil': 'brazil', 'seleção bra': 'brazil',
  'canarinho': 'brazil', '🇧🇷': 'brazil', 'selecao bra': 'brazil',

  'colombia': 'colombia', 'col': 'colombia', 'los cafeteros': 'colombia', '🇨🇴': 'colombia',

  'england': 'england', 'eng': 'england', 'three lions': 'england', '🏴󠁧󠁢󠁥󠁮󠁧󠁿': 'england',

  // Group E
  'germany': 'germany', 'ger': 'germany', 'die mannschaft': 'germany', '🇩🇪': 'germany',
  'mannschaft': 'germany',

  'japan': 'japan', 'jpn': 'japan', 'samurai blue': 'japan', '🇯🇵': 'japan',

  'belgium': 'belgium', 'bel': 'belgium', 'red devils': 'belgium', '🇧🇪': 'belgium',

  'saudi arabia': 'saudi arabia', 'ksa': 'saudi arabia', 'saudi': 'saudi arabia', '🇸🇦': 'saudi arabia',

  // Group F
  'netherlands': 'netherlands', 'ned': 'netherlands', 'holland': 'netherlands',
  'oranje': 'netherlands', '🇳🇱': 'netherlands', 'dutch': 'netherlands',

  'ecuador': 'ecuador', 'ecu': 'ecuador', 'la tri': 'ecuador', '🇪🇨': 'ecuador',

  'senegal': 'senegal', 'sen': 'senegal', 'lions of teranga': 'senegal', '🇸🇳': 'senegal',
  'teranga lions': 'senegal',

  'iran': 'iran', 'irn': 'iran', 'team melli': 'iran', '🇮🇷': 'iran',

  // Group G
  'switzerland': 'switzerland', 'sui': 'switzerland', 'die nati': 'switzerland', '🇨🇭': 'switzerland',
  'swiss': 'switzerland',

  'cameroon': 'cameroon', 'cmr': 'cameroon', 'indomitable lions': 'cameroon', '🇨🇲': 'cameroon',

  'serbia': 'serbia', 'srb': 'serbia', 'vatreni': 'serbia', '🇷🇸': 'serbia',

  'new zealand': 'new zealand', 'nzl': 'new zealand', 'all whites': 'new zealand', '🇳🇿': 'new zealand',

  // Group H
  'croatia': 'croatia', 'cro': 'croatia', 'vatreni2': 'croatia', '🇭🇷': 'croatia',
  'checkered': 'croatia',

  'south africa': 'south africa', 'rsa': 'south africa', 'bafana bafana': 'south africa',
  'bafana': 'south africa', '🇿🇦': 'south africa',

  'south korea': 'south korea', 'kor': 'south korea', 'korea': 'south korea',
  'taeguk warriors': 'south korea', '🇰🇷': 'south korea',

  'ukraine': 'ukraine', 'ukr': 'ukraine', '🇺🇦': 'ukraine',

  // Group I — Host Group
  'costa rica': 'costa rica', 'crc': 'costa rica', 'ticos': 'costa rica', '🇨🇷': 'costa rica',

  'qatar': 'qatar', 'qat': 'qatar', 'maroons': 'qatar', '🇶🇦': 'qatar',

  'panama': 'panama', 'pan': 'panama', 'canaleros': 'panama', '🇵🇦': 'panama',

  // Group J
  'italy': 'italy', 'ita': 'italy', 'azzurri': 'italy', '🇮🇹': 'italy',

  'egypt': 'egypt', 'egy': 'egypt', 'pharaohs': 'egypt', '🇪🇬': 'egypt',

  'austria': 'austria', 'aut': 'austria', '🇦🇹': 'austria',

  // Group K
  'ghana': 'ghana', 'gha': 'ghana', 'black stars': 'ghana', '🇬🇭': 'ghana',

  'hungary': 'hungary', 'hun': 'hungary', '🇭🇺': 'hungary',

  'indonesia': 'indonesia', 'idn': 'indonesia', 'garuda': 'indonesia', '🇮🇩': 'indonesia',

  // Group L
  'nigeria': 'nigeria', 'nga': 'nigeria', 'super eagles': 'nigeria', '🇳🇬': 'nigeria',
  'eagles': 'nigeria',

  'denmark': 'denmark', 'den': 'denmark', 'danish dynamite': 'denmark', '🇩🇰': 'denmark',

  'poland': 'poland', 'pol': 'poland', 'bialo-czerwoni': 'poland', '🇵🇱': 'poland',

  // Curacao (used in example intents)
  'curacao': 'curacao', 'cur': 'curacao', '🇨🇼': 'curacao',
  'curaçao': 'curacao', 'curcao': 'curacao', // API returns accented form

  // Real WC2026 qualified teams (added for completeness)
  'algeria': 'algeria', 'alg': 'algeria', '🇩🇿': 'algeria', 'les fennecs': 'algeria',
  'bosnia and herzegovina': 'bosnia and herzegovina', 'bosnia': 'bosnia and herzegovina', 'bih': 'bosnia and herzegovina', '🇧🇦': 'bosnia and herzegovina',
  'cape verde': 'cape verde', 'cpv': 'cape verde', '🇨🇻': 'cape verde', 'tubaroes azuis': 'cape verde',
  'cape verde islands': 'cape verde', 'republic of cape verde': 'cape verde', // API variations
  'czechia': 'czechia', 'czech republic': 'czechia', 'cze': 'czechia', '🇨🇿': 'czechia',
  'dr congo': 'dr congo', 'democratic republic of congo': 'dr congo', 'cod': 'dr congo', 'congo': 'dr congo', '🇨🇩': 'dr congo',
  'haiti': 'haiti', 'hai': 'haiti', '🇭🇹': 'haiti',
  'iraq': 'iraq', 'irq': 'iraq', '🇮🇶': 'iraq',
  'ivory coast': 'ivory coast', 'cote divoire': 'ivory coast', 'civ': 'ivory coast', '🇨🇮': 'ivory coast', 'les elephants': 'ivory coast',
  'jordan': 'jordan', 'jor': 'jordan', '🇯🇴': 'jordan',
  'norway': 'norway', 'nor': 'norway', '🇳🇴': 'norway',
  'paraguay': 'paraguay', 'par': 'paraguay', '🇵🇾': 'paraguay',
  'scotland': 'scotland', 'sco': 'scotland', '🏴󠁧󠁢󠁳󠁣󠁴󠁿': 'scotland',
  'sweden': 'sweden', 'swe': 'sweden', '🇸🇪': 'sweden',
  'tunisia': 'tunisia', 'tun': 'tunisia', '🇹🇳': 'tunisia',
  'turkiye': 'turkiye', 'turkey': 'turkiye', 'tur': 'turkiye', '🇹🇷': 'turkiye',
  'uzbekistan': 'uzbekistan', 'uzb': 'uzbekistan', '🇺🇿': 'uzbekistan',
};

// ── Outcome Intent Vocabulary ─────────────────────────────────────────────────

const WIN_VERBS = [
  'wins', 'win', 'beats', 'beat', 'defeats', 'defeat', 'overcomes', 'overcome',
  'thrashes', 'thrash', 'destroys', 'destroy', 'hammers', 'hammer', 'chops', 'chop',
  'goes over', 'go over', 'takes out', 'take out', 'eliminates', 'eliminate',
  // Pidgin
  'dey win', 'go chop', 'don chop', 'wack', 'slap down', 'hammer down',
  'show them', 'run am', 'carry', 'won',
];

const LOSE_VERBS = [
  'loses to', 'lose to', 'lost to', 'falls to', 'fall to', 'gets beaten by',
  'get beaten by', 'beaten by', 'eliminated by', 'goes down to', 'go down to',
  // Pidgin
  'dey lose', 'fall',
];

const DRAW_VERBS = [
  'draws', 'draw', 'drew', 'draws with', 'draw with', 'ties', 'tie', 'tied',
  'level', 'levels', 'all square', 'finish level', 'end level', 'stalemate',
  'equal', 'same score', 'no winner',
  // Pidgin
  'dey draw', 'draw draw', 'e draw', 'finish draw',
];

const SCORE_PATTERN = /\b(\d{1,2})\s*[-:]\s*(\d{1,2})\b/;

// ── 3-Source API Fetching ─────────────────────────────────────────────────────

async function fetchFootballData() {
  const token = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    console.warn('[SportsOracle] ⚠️ Missing FOOTBALL_DATA_API_KEY env var — skipping Primary source');
    return null;
  }
  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': token, 'User-Agent': 'MoniBot/2.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.matches || []).map(m => ({
      homeTeam: normalizeTeamName(m.homeTeam?.name),
      awayTeam: normalizeTeamName(m.awayTeam?.name),
      homeScore: m.score?.fullTime?.home !== undefined && m.score?.fullTime?.home !== null ? Number(m.score.fullTime.home) : null,
      awayScore: m.score?.fullTime?.away !== undefined && m.score?.fullTime?.away !== null ? Number(m.score.fullTime.away) : null,
      finished: m.status === 'FINISHED',
      status: m.status === 'FINISHED' ? 'finished' : (m.status === 'IN_PLAY' || m.status === 'PAUSED' ? 'live' : 'notstarted'),
      raw: m
    }));
  } catch (err) {
    console.warn(`[SportsOracle] ⚠️ Primary (football-data.org) failed: ${err.message}`);
    return null;
  }
}

async function fetchApiFootball() {
  const token = process.env.API_FOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY;
  if (!token) {
    console.warn('[SportsOracle] ⚠️ Missing API_FOOTBALL_API_KEY env var — skipping Fallback source');
    return null;
  }
  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
      headers: { 'x-apisports-key': token, 'User-Agent': 'MoniBot/2.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.response || []).map(r => {
      const statusShort = r.fixture?.status?.short;
      const finished = ['FT', 'AET', 'PEN'].includes(statusShort);
      const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT'].includes(statusShort);
      return {
        homeTeam: normalizeTeamName(r.teams?.home?.name),
        awayTeam: normalizeTeamName(r.teams?.away?.name),
        homeScore: r.goals?.home !== undefined && r.goals?.home !== null ? Number(r.goals.home) : null,
        awayScore: r.goals?.away !== undefined && r.goals?.away !== null ? Number(r.goals.away) : null,
        finished,
        status: finished ? 'finished' : isLive ? 'live' : 'notstarted',
        raw: r
      };
    });
  } catch (err) {
    console.warn(`[SportsOracle] ⚠️ Fallback (API-Football) failed: ${err.message}`);
    return null;
  }
}

async function fetchOpenFootball() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json', {
      headers: { 'User-Agent': 'MoniBot/2.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.matches || []).map(m => {
      const hasScore = m.score?.ft !== undefined && m.score?.ft !== null;
      return {
        homeTeam: normalizeTeamName(m.team1),
        awayTeam: normalizeTeamName(m.team2),
        homeScore: hasScore ? Number(m.score.ft[0]) : null,
        awayScore: hasScore ? Number(m.score.ft[1]) : null,
        finished: hasScore,
        status: hasScore ? 'finished' : 'notstarted',
        raw: m
      };
    });
  } catch (err) {
    console.warn(`[SportsOracle] ⚠️ Sanity Check (openfootball) failed: ${err.message}`);
    return null;
  }
}

// ── Team Name Normalisation ───────────────────────────────────────────────────

export function normalizeTeamName(raw) {
  if (!raw) return null;
  const lower = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    .replace(/['''`]/g, "'")
    .replace(/[^a-z0-9 '\u{1F1E0}-\u{1F1FF}🏴]/gu, '') // keep letters, numbers, flags
    .replace(/\s+/g, ' ')
    .trim();

  // Direct alias lookup
  if (TEAM_ALIASES[lower]) return TEAM_ALIASES[lower];

  // Partial match: check if any alias is a whole-word match in the input
  const isWordChar = (char) => /[a-z0-9]/.test(char);
  for (const [alias, canonical] of Object.entries(TEAM_ALIASES)) {
    // Check if alias is a whole word in lower
    const idx = lower.indexOf(alias);
    if (idx !== -1) {
      const charBefore = idx > 0 ? lower[idx - 1] : '';
      const charAfter = idx + alias.length < lower.length ? lower[idx + alias.length] : '';
      const isMatch = (!isWordChar(alias[0]) || !isWordChar(charBefore)) &&
                      (!isWordChar(alias[alias.length - 1]) || !isWordChar(charAfter));
      if (isMatch) return canonical;
    }

    // Check if lower is a whole word in alias
    const revIdx = alias.indexOf(lower);
    if (revIdx !== -1) {
      const charBefore = revIdx > 0 ? alias[revIdx - 1] : '';
      const charAfter = revIdx + lower.length < alias.length ? alias[revIdx + lower.length] : '';
      const isMatch = (!isWordChar(lower[0]) || !isWordChar(charBefore)) &&
                      (!isWordChar(lower[lower.length - 1]) || !isWordChar(charAfter));
      if (isMatch) return canonical;
    }
  }

  return null; // Not a WC2026 team
}

// ── Match Resolution ──────────────────────────────────────────────────────────

/**
 * Given team names from a command, find the exact WC2026 fixture.
 * Returns the match row from sports_match_results or null.
 */
export async function findMatchFromTeams(team1Canonical, team2Canonical) {
  const supabase = getSupabase();

  // Try both orderings (home vs away)
  const { data, error } = await supabase
    .from('sports_match_results')
    .select('*')
    .or(
      `and(home_team.eq.${team1Canonical},away_team.eq.${team2Canonical}),` +
      `and(home_team.eq.${team2Canonical},away_team.eq.${team1Canonical})`
    )
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0];
}

// ── Condition Parsing — The Tight Intent Parser ───────────────────────────────

/**
 * Parses the sports condition from a tweet's conditional clause.
 *
 * Strategy (tight 3-step pipeline):
 *   1. Strip @mentions, emojis-as-team-names (flag emojis only), normalize text
 *   2. Extract team names using TEAM_ALIASES (anchor step — if no team found, abort)
 *   3. Determine outcome direction from surrounding verb context
 *
 * Returns: { team1, team2, outcome, rawScore } or { error: string }
 */
export function parseConditionClause(conditionText) {
  if (!conditionText) return { error: 'No condition text provided' };

  const raw = conditionText.trim().toLowerCase();

  // ── Step 1: Check for exact score ────────────────────────────────────────
  const scoreMatch = raw.match(SCORE_PATTERN);
  const rawScore = scoreMatch ? { home: parseInt(scoreMatch[1]), away: parseInt(scoreMatch[2]) } : null;

  // ── Step 2: Extract team names ────────────────────────────────────────────
  // Remove @username tokens first (they could coincidentally match team names)
  const cleanRaw = raw.replace(/@[a-z0-9_]+/gi, '').trim();

  const foundTeams = [];

  // Try all aliases from longest to shortest (prevents partial false-positive)
  const aliasEntries = Object.entries(TEAM_ALIASES).sort((a, b) => b[0].length - a[0].length);
  const usedRanges = []; // Track consumed character ranges to avoid double-matching
  const isWordChar = (char) => /[a-z0-9]/.test(char);

  for (const [alias, canonical] of aliasEntries) {
    let idx = cleanRaw.indexOf(alias);
    while (idx !== -1) {
      // Check if the match is a whole word
      const charBefore = idx > 0 ? cleanRaw[idx - 1] : '';
      const charAfter = idx + alias.length < cleanRaw.length ? cleanRaw[idx + alias.length] : '';

      const isMatch = (!isWordChar(alias[0]) || !isWordChar(charBefore)) &&
                      (!isWordChar(alias[alias.length - 1]) || !isWordChar(charAfter));

      if (isMatch) {
        // Check this range isn't already consumed by an earlier (longer) match
        const overlaps = usedRanges.some(([s, e]) => idx < e && idx + alias.length > s);
        if (!overlaps) {
          if (!foundTeams.find(t => t.canonical === canonical)) {
            foundTeams.push({ canonical, idx, alias });
            usedRanges.push([idx, idx + alias.length]);
          }
          break; // Found a valid occurrence of this alias, proceed to next alias
        }
      }
      idx = cleanRaw.indexOf(alias, idx + 1);
    }
  }

  if (foundTeams.length === 0) {
    return { error: 'No recognised World Cup 2026 team found in condition. Check spelling or use full country name.' };
  }

  // Sort teams by position in text so team1 = left, team2 = right
  foundTeams.sort((a, b) => a.idx - b.idx);
  const team1 = foundTeams[0].canonical;
  const team2 = foundTeams[1]?.canonical || null;

  // ── Step 3: Determine outcome ─────────────────────────────────────────────
  let outcomeType = null;

  // Check draw first (symmetric — doesn't matter who is team1/team2)
  if (DRAW_VERBS.some(v => cleanRaw.includes(v))) {
    outcomeType = 'draw';
  }
  // Check lose verb (means team2 is the winner)
  else if (LOSE_VERBS.some(v => cleanRaw.includes(v))) {
    // "if Brazil loses to Argentina" → Argentina wins
    outcomeType = 'team2_wins'; // Inverted
  }
  // Check win verb
  else if (WIN_VERBS.some(v => cleanRaw.includes(v))) {
    outcomeType = 'team1_wins';
  }
  // Exact score with no verb
  else if (rawScore && team1 && team2) {
    outcomeType = 'exact_score';
  }
  else {
    return {
      error: team2
        ? `Couldn't determine outcome type. Try: "${team1} wins ${team2}", "${team1} draws ${team2}", or a score like 2-1`
        : `Who are they playing? Mention both teams, e.g. "if ${team1} beats Morocco"`,
    };
  }

  // Ambiguity guard: if only one team mentioned + win verb, we need an opponent
  if (!team2 && outcomeType !== 'draw') {
    return { error: `Who is ${team1} playing against? Mention both teams for a win/loss condition.` };
  }

  return { team1, team2, outcomeType, rawScore };
}

/**
 * Resolves { team1, team2, outcomeType } against a fixture row to get the
 * canonical requiredOutcome stored in the job payload.
 *
 * requiredOutcome values: 'home_win' | 'away_win' | 'draw' | 'exact_score'
 */
export function resolveRequiredOutcome(team1, team2, outcomeType, fixture) {
  const homeTeam = fixture.home_team;
  const awayTeam = fixture.away_team;

  if (outcomeType === 'draw') return { requiredOutcome: 'draw' };

  if (outcomeType === 'team1_wins') {
    if (team1 === homeTeam) return { requiredOutcome: 'home_win', requiredWinner: team1 };
    if (team1 === awayTeam) return { requiredOutcome: 'away_win', requiredWinner: team1 };
    return { error: `${team1} is not in this fixture (${homeTeam} vs ${awayTeam})` };
  }

  if (outcomeType === 'team2_wins') {
    // lose verb → team2 is the winner
    if (team2 === homeTeam) return { requiredOutcome: 'home_win', requiredWinner: team2 };
    if (team2 === awayTeam) return { requiredOutcome: 'away_win', requiredWinner: team2 };
    return { error: `${team2} is not in this fixture (${homeTeam} vs ${awayTeam})` };
  }

  if (outcomeType === 'exact_score') {
    return { requiredOutcome: 'exact_score' }; // rawScore stored separately in payload
  }

  return { error: `Unknown outcome type: ${outcomeType}` };
}

// ── Condition Evaluation ──────────────────────────────────────────────────────

/**
 * Returns true if the settled match result satisfies the job condition.
 */
function evaluateCondition(jobPayload, match) {
  const { requiredOutcome, rawScore } = jobPayload.condition;

  if (requiredOutcome === 'draw') return match.outcome === 'draw';
  if (requiredOutcome === 'home_win') return match.outcome === 'home_win';
  if (requiredOutcome === 'away_win') return match.outcome === 'away_win';
  if (requiredOutcome === 'exact_score' && rawScore) {
    return match.home_score === rawScore.home && match.away_score === rawScore.away;
  }
  return false;
}

// ── Recipient Resolution (with MagicPay fallback) ─────────────────────────────

/**
 * Always re-resolves recipient at fire time.
 * Waterfall:
 *   1. Try fresh getProfileByMonitag → CasualPay (P2P)
 *   2. Fallback: MagicPay via stored Twitter numeric ID (immutable)
 */
async function resolveRecipientAtFireTime(jobPayload) {
  const { recipientPayTag, recipientTwitterId, chain } = jobPayload;

  try {
    const tag = recipientPayTag.replace('@', '');
    const profile = await getProfileByMonitag(tag) || await getProfileByXUsername(tag);
    if (profile?.wallet_address) {
      console.log(`[SportsOracle] Recipient resolved fresh → CasualPay: ${profile.wallet_address}`);
      return {
        mode: 'p2p',
        toAddress: profile.wallet_address,
        receiverId: profile.id,
        displayTag: recipientPayTag,
      };
    }
  } catch (err) {
    console.warn(`[SportsOracle] getProfileByMonitag failed for ${recipientPayTag}: ${err.message}`);
  }

  // Fallback: MagicPay via immutable Twitter ID
  if (recipientTwitterId) {
    console.log(`[SportsOracle] ⚡ Falling back to MagicPay — Twitter ID: ${recipientTwitterId}`);
    return {
      mode: 'magicpay',
      recipientTwitterId,
      receiverId: null,
      displayTag: `MagicPay:${recipientTwitterId}`,
    };
  }

  throw new Error(`ERROR_RECIPIENT_UNRESOLVABLE:Cannot resolve recipient for ${recipientPayTag} — no wallet and no Twitter ID stored.`);
}

// ── Fire or Cancel Conditional Job ───────────────────────────────────────────

async function fireConditionalJob(job, match, conditionMet) {
  const payload = job.payload;
  const { senderWallet, amount, chain, tweetId, senderPayTag, senderId } = payload;
  const supabase = getSupabase();
  const jobIdShort = job.id.slice(0, 8);
  const referenceId = `sports_${jobIdShort}`; // unique on-chain replay guard

  console.log(`[SportsOracle] ${conditionMet ? '✅ Firing' : '❌ Cancelling'} job ${jobIdShort} — ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`);

  if (!conditionMet) {
    // Condition NOT met → cancel, no payment
    await logTransaction({
      sender_id: senderId,
      receiver_id: senderId,
      amount,
      fee: 0,
      tx_hash: 'SPORTS_CONDITION_CANCELLED',
      type: 'p2p_command',
      tweet_id: tweetId,
      payer_pay_tag: senderPayTag,
      recipient_pay_tag: payload.recipientPayTag,
      recipient_username: payload.recipientPayTag ? payload.recipientPayTag.replace('@', '') : null,
      chain: normalizeChain(chain || 'base'),
      error_reason: JSON.stringify({
        jobId: jobIdShort,
        match: `${match.home_team} vs ${match.away_team}`,
        result: `${match.home_score}-${match.away_score}`,
        outcome: match.outcome,
        conditionNeeded: payload.condition?.requiredOutcome,
        conditionMet: false,
      }),
      language: payload.language || 'english',
    });

    await supabase.from('scheduled_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    return;
  }

  // Condition MET → resolve recipient and fire payment
  let recipient;
  try {
    recipient = await resolveRecipientAtFireTime(payload);
  } catch (resolveErr) {
    await logTransaction({
      sender_id: senderId, receiver_id: senderId,
      amount, fee: 0, tx_hash: 'ERROR_RECIPIENT_UNRESOLVABLE', type: 'p2p_command',
      tweet_id: tweetId, payer_pay_tag: senderPayTag,
      recipient_pay_tag: payload.recipientPayTag,
      recipient_username: payload.recipientPayTag ? payload.recipientPayTag.replace('@', '') : null,
      chain: normalizeChain(chain || 'base'),
      error_reason: resolveErr.message,
      language: payload.language || 'english',
    });
    await supabase.from('scheduled_jobs')
      .update({ status: 'failed', error_message: resolveErr.message })
      .eq('id', job.id);
    return;
  }

  let finalChain = normalizeChain(chain || 'base');
  let txResult;

  try {
    try {
      if (recipient.mode === 'p2p') {
        txResult = await executeP2PViaRouter(senderWallet, recipient.toAddress, amount, referenceId, finalChain);
      } else {
        txResult = await executeMagicPay(senderWallet, recipient.recipientTwitterId, amount, finalChain);
      }
    } catch (txErr) {
      const errMsg = txErr.message || '';
      const context = recipient.mode === 'magicpay' ? 'magicpay' : 'p2p';
      if (
        errMsg.includes('ERROR_BALANCE') ||
        errMsg.includes('ERROR_ALLOWANCE') ||
        errMsg.includes('ERROR_MAGIC_PAY_BALANCE') ||
        errMsg.includes('ERROR_MAGIC_PAY_ALLOWANCE') ||
        errMsg.includes('ERROR_RPC_EXHAUSTED')
      ) {
        console.log(`[SportsOracle] 🔄 Attempting cross-chain reroute from ${finalChain.toUpperCase()}...`);
        const alt = await findAlternateChain(senderWallet, amount, finalChain, context);
        if (alt && !alt.needsAllowance) {
          console.log(`[SportsOracle] 🔀 Rerouting job to ${alt.chain.toUpperCase()}...`);
          finalChain = alt.chain;
          if (recipient.mode === 'p2p') {
            txResult = await executeP2PViaRouter(senderWallet, recipient.toAddress, amount, referenceId, finalChain);
          } else {
            txResult = await executeMagicPay(senderWallet, recipient.recipientTwitterId, amount, finalChain);
          }
        } else {
          throw txErr;
        }
      } else {
        throw txErr;
      }
    }

    await logTransaction({
      sender_id: senderId,
      receiver_id: recipient.receiverId || senderId,
      amount,
      fee: txResult.fee || 0,
      tx_hash: txResult.hash, // real 0x hash → VP-Social sees it as success
      type: recipient.mode === 'magicpay' ? 'magicpay' : 'p2p_command',
      tweet_id: tweetId,
      payer_pay_tag: senderPayTag,
      recipient_pay_tag: recipient.displayTag,
      recipient_username: payload.recipientPayTag ? payload.recipientPayTag.replace('@', '') : null,
      chain: finalChain,
      error_reason: JSON.stringify({
        jobId: jobIdShort,
        event: 'SPORTS_CONDITION_MET',
        match: `${match.home_team} vs ${match.away_team}`,
        result: `${match.home_score}-${match.away_score}`,
        outcome: match.outcome,
      }),
      language: payload.language || 'english',
    });

    await supabase.from('scheduled_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    console.log(`[SportsOracle] 🏆 Job ${jobIdShort} fired → ${txResult.hash}`);

  } catch (txErr) {
    const errCode = txErr.message?.split(':')[0] || 'ERROR_SPORTS_TX';
    await logTransaction({
      sender_id: senderId, receiver_id: recipient.receiverId || senderId,
      amount, fee: 0, tx_hash: errCode, type: 'p2p_command',
      tweet_id: tweetId, payer_pay_tag: senderPayTag,
      recipient_pay_tag: recipient.displayTag,
      recipient_username: payload.recipientPayTag ? payload.recipientPayTag.replace('@', '') : null,
      chain: finalChain,
      error_reason: txErr.message,
      language: payload.language || 'english',
    });
    await supabase.from('scheduled_jobs')
      .update({ status: 'failed', error_message: txErr.message })
      .eq('id', job.id);
    console.error(`[SportsOracle] ❌ Job ${jobIdShort} payment failed: ${txErr.message.split('\n')[0]}`);
  }
}

// ── Match Result Sync ─────────────────────────────────────────────────────────

export async function syncMatchResults() {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const STABILITY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  console.log('[SportsOracle] 🔄 Starting 3-source consensus match sync cycle...');

  const pData = await fetchFootballData();
  const fData = await fetchApiFootball();
  const oData = await fetchOpenFootball();

  // ── Source election ────────────────────────────────────────────────────────
  // Use the first available source as "primary" (determines match list).
  // Remaining sources act as consensus validators.
  // Priority: football-data.org → API-Football → OpenFootball
  let primaryData = null;
  let primaryName = '';
  let secondaryData = null;
  let secondaryName = '';
  let tertiaryData = null;

  if (pData) {
    primaryData = pData;   primaryName = 'football-data.org';
    secondaryData = fData; secondaryName = 'API-Football';
    tertiaryData = oData;
  } else if (fData) {
    console.warn('[SportsOracle] ⚠️ Primary (football-data.org) unavailable — promoting API-Football to primary');
    primaryData = fData;   primaryName = 'API-Football';
    secondaryData = oData; secondaryName = 'OpenFootball';
    tertiaryData = null;
  } else if (oData) {
    console.warn('[SportsOracle] ⚠️ Primary and secondary unavailable — promoting OpenFootball to primary (no consensus possible)');
    primaryData = oData;   primaryName = 'OpenFootball';
    secondaryData = null;
    tertiaryData = null;
  } else {
    console.error('[SportsOracle] ❌ All 3 data sources failed — skipping sync cycle');
    return;
  }

  console.log(`[SportsOracle] ✅ Sync using primary=${primaryName}, secondary=${secondaryName || 'none'}`);

  // Map secondary/tertiary by teams for lookup
  const secondaryMap = {};
  if (secondaryData) {
    for (const match of secondaryData) {
      if (match.homeTeam && match.awayTeam) {
        secondaryMap[`${match.homeTeam}_vs_${match.awayTeam}`] = match;
      }
    }
  }

  const tertiaryMap = {};
  if (tertiaryData) {
    for (const match of tertiaryData) {
      if (match.homeTeam && match.awayTeam) {
        tertiaryMap[`${match.homeTeam}_vs_${match.awayTeam}`] = match;
      }
    }
  }

  for (const pMatch of primaryData) {
    try {
      const { homeTeam, awayTeam, homeScore, awayScore, finished, status } = pMatch;
      if (!homeTeam || !awayTeam) continue; // TBD knockout slot

      const key1 = `${homeTeam}_vs_${awayTeam}`;
      const key2 = `${awayTeam}_vs_${homeTeam}`;

      const sMatch = secondaryMap[key1] || secondaryMap[key2];
      const tMatch = tertiaryMap[key1] || tertiaryMap[key2];

      let finalFinished = finished;
      let finalStatus = status;
      let finalHomeScore = homeScore;
      let finalAwayScore = awayScore;
      let disputed = false;

      if (finished) {
        // Consensus Settlement Rule:
        // Must have at least one other source agree on the score X-Y.
        // Exception: if only one source is available (OpenFootball promoted),
        // accept single-source settlement with a warning.
        const agreementList = [];
        if (sMatch && sMatch.finished && sMatch.homeScore === homeScore && sMatch.awayScore === awayScore) {
          agreementList.push(secondaryName);
        }
        if (tMatch && tMatch.finished && tMatch.homeScore === homeScore && tMatch.awayScore === awayScore) {
          agreementList.push('OpenFootball');
        }

        if (agreementList.length >= 1) {
          finalFinished = true;
          finalStatus = 'finished';
        } else if (!secondaryData && !tertiaryData) {
          // Single source mode — accept but log warning
          console.warn(`[SportsOracle] ⚠️ Single-source settlement for ${homeTeam} vs ${awayTeam} (${homeScore}-${awayScore}) — no consensus partners available`);
          finalFinished = true;
          finalStatus = 'finished';
        } else {
          // Check if other sources disagree on the score
          const hasOtherScores = (sMatch && sMatch.finished) || (tMatch && tMatch.finished);
          if (hasOtherScores) {
            disputed = true;
            finalFinished = true; // Still marked as finished to halt processing
            finalStatus = 'disputed';
            console.error(`[SportsOracle] 🚨 DISPUTE DETECTED for ${homeTeam} vs ${awayTeam}: Primary score ${homeScore}-${awayScore}. Secondary (${secondaryName}): ${sMatch?.homeScore}-${sMatch?.awayScore}, Tertiary: ${tMatch?.homeScore}-${tMatch?.awayScore}. Settlement locked.`);
          } else {
            // Secondary sources not responding/not finished. Wait for consensus.
            finalFinished = false;
            finalStatus = 'live';
          }
        }
      } else {
        // Match not finished on primary. Check if it is live on any source.
        const anyLive = status === 'live' || sMatch?.status === 'live' || tMatch?.status === 'live';
        finalStatus = anyLive ? 'live' : 'notstarted';
        finalFinished = false;
      }

      // Derive match ID — look up existing database row to preserve ID mapping (e.g. "10")
      let matchId = pMatch.raw.id || pMatch.raw.match_id;
      if (!matchId) {
        const existingMatch = await findMatchFromTeams(homeTeam, awayTeam);
        if (existingMatch) {
          matchId = existingMatch.id;
        } else {
          matchId = String(`${homeTeam}_vs_${awayTeam}`).replace(/\s+/g, '_');
        }
      } else {
        matchId = String(matchId).replace(/\s+/g, '_');
      }

      // Determine outcome (only when consensus is reached and not disputed)
      let outcome = null;
      let winnerTeam = null;

      if (finalFinished && finalStatus === 'finished' && finalHomeScore !== null && finalAwayScore !== null) {
        if (finalHomeScore > finalAwayScore) { outcome = 'home_win'; winnerTeam = homeTeam; }
        else if (finalAwayScore > finalHomeScore) { outcome = 'away_win'; winnerTeam = awayTeam; }
        else { outcome = 'draw'; winnerTeam = 'draw'; }
      }

      // Build upsert row
      const row = {
        id: matchId,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: finalHomeScore,
        away_score: finalAwayScore,
        status: finalStatus,
        finished: finalFinished,
        winner_team: winnerTeam,
        outcome,
        match_datetime: pMatch.raw.utcDate || pMatch.raw.local_date || pMatch.raw.date || null,
        venue: pMatch.raw.venue?.name || pMatch.raw.venue || null,
        group_name: pMatch.raw.group || pMatch.raw.stage || null,
        round: pMatch.raw.round || pMatch.raw.stage || null,
        api_raw: pMatch.raw,
        last_synced_at: now,
      };

      // Set completed_at and stability_at for newly settled matches
      if (finalFinished && finalStatus === 'finished') {
        const { data: existing } = await supabase
          .from('sports_match_results')
          .select('completed_at')
          .eq('id', matchId)
          .single();

        if (!existing?.completed_at) {
          row.completed_at = now;
          row.stability_at = new Date(Date.now() + STABILITY_WINDOW_MS).toISOString();
          console.log(`[SportsOracle] 🏁 Match settled by consensus: ${homeTeam} ${finalHomeScore}-${finalAwayScore} ${awayTeam} (outcome: ${outcome})`);
        }
      }

      await supabase.from('sports_match_results').upsert(row, { onConflict: 'id' });

    } catch (gameErr) {
      console.warn(`[SportsOracle] ⚠️ Error processing match sync: ${gameErr.message}`);
    }
  }
}

// ── Conditional Job Evaluation ────────────────────────────────────────────────

export async function evaluateConditionalJobs() {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  // Query settled matches past stability window (exclude disputed matches)
  const { data: settledMatches, error: matchErr } = await supabase
    .from('sports_match_results')
    .select('*')
    .eq('finished', true)
    .eq('status', 'finished') // Only process when status is exactly 'finished' (prevents running disputed matches)
    .lte('stability_at', now);

  if (matchErr) {
    console.error('[SportsOracle] ❌ Failed to fetch settled matches:', matchErr.message);
    return;
  }

  if (!settledMatches || settledMatches.length === 0) return;

  for (const match of settledMatches) {
    // Find pending conditional jobs for this match
    const { data: jobs, error: jobErr } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('type', 'conditional_sports_p2p')
      .eq('status', 'pending')
      .eq('payload->>matchId', match.id);

    if (jobErr || !jobs || jobs.length === 0) continue;

    console.log(`[SportsOracle] 🔎 ${jobs.length} pending job(s) for match ${match.id}`);

    for (const job of jobs) {
      // ── Atomic lock: only one process wins this job ───────────────────────
      const { data: locked, error: lockErr } = await supabase
        .from('scheduled_jobs')
        .update({ status: 'processing', started_at: now })
        .eq('id', job.id)
        .eq('status', 'pending') // This is the atomic guard
        .select('id')
        .single();

      if (lockErr || !locked) {
        console.log(`[SportsOracle] ⏭️ Job ${job.id.slice(0, 8)} already claimed by another process — skipping`);
        continue;
      }

      try {
        const conditionMet = evaluateCondition(job.payload, match);
        await fireConditionalJob(job, match, conditionMet);
      } catch (evalErr) {
        console.error(`[SportsOracle] ❌ Evaluation error for job ${job.id.slice(0, 8)}:`, evalErr.message);
        await supabase.from('scheduled_jobs')
          .update({ status: 'failed', error_message: evalErr.message })
          .eq('id', job.id);
      }
    }
  }
}
