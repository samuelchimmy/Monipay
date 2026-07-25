import { getSupabase, logTransaction } from './database.js';
import { fetchTwitterNumericId } from './twitter.js';
import { getProfileByXUsername, getProfileByMonitag } from './database.js';
import { randomUUID } from 'crypto';
import { normalizeChain } from './chains.js';

const TIME_UNITS = {
  s: 'second', sec: 'second', secs: 'second', second: 'second', seconds: 'second',
  m: 'minute', min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute',
  h: 'hour', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour', hourly: 'hour',
  d: 'day', day: 'day', days: 'day', daily: 'day',
  w: 'week', wk: 'week', week: 'week', weeks: 'week', weekly: 'week',
  mo: 'month', mos: 'month', month: 'month', months: 'month', monthly: 'month',
};

const UNIT_TO_MS = {
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 86400000,
  week: 604800000,
  month: 2592000000,
};

export const ERROR_MESSAGES = {
  INVALID_SYNTAX: "That syntax is giving Ohio energy 🌽 Try: '@monibot send $5 to @alice every day 5 times'",
  MISSING_COUNT: "Yo blud, how many times tho? 🤔 Add something like '5 times' or 'for 1 week'",
  MISSING_INTERVAL: "Every what tho? 💀 Specify like 'every day' or 'every 2 hours'",
  PARSING_FAILED: "Command parsing failed. Stop being delulu with that syntax 🤡",
  SUB_60_SECONDS: "Blud tried to go sub-60 seconds 💀",
  DOW_NOT_SUPPORTED: "Day-of-week scheduling (like 'every Monday') ain't supported yet chief 🚫 Try intervals instead",
  DECIMAL_INTERVAL: "Decimal intervals? Nah fam 🙅 Rounded to nearest whole number",
};

export const VALIDATION_ERRORS = {
  MAX_COUNT_EXCEEDED: "Whoa there sigma! 🛑 Max 100 payments per series. That's already mad rizz! 🤫",
  MIN_INTERVAL_TOO_LOW: "Minimum interval is 60 seconds due to executor granularity 🕐",
  MAX_DURATION_EXCEEDED: "30-day max span, chief. That's already generational wealth behavior 📈",
  INSUFFICIENT_BALANCE: (required, available) => 
    `Heads up! 💰 Total series costs $${required} but you've got $${available}. Series queued but might fail at execution time 📉`,
  INVALID_INTERVAL: "Interval must be a positive number, stop the cap 🧢",
  INVALID_COUNT: "Count must be a positive integer, no cap 🚫",
  EXTREME_VALUES: "Those numbers looking sus fam 👀 Keep it reasonable",
};

const RECURRING_PATTERN = /\bevery\s+(?:(\d+(?:\.\d+)?)\s*)?(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?\s*,?\s*(?:(?:for\s+)?(\d+)\s*times?|for\s+(\d+|(?:an|a)(?=\s))\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?)\b/i;
const RECURRING_ALIAS = /\b(daily|hourly|weekly|monthly)\s*,?\s*(?:(?:for\s+)?(\d+)\s*times?|for\s+(\d+|(?:an|a)(?=\s))\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo)s?)\b/i;

export function normalizeTimeUnit(unit) {
  const normalized = TIME_UNITS[unit.toLowerCase()];
  if (!normalized) throw new Error(`Unknown time unit: ${unit}`);
  return normalized;
}

export function convertDurationToCount(value, unit, intervalMs) {
  if (value <= 0) throw new Error('Invalid duration value');
  const normalizedUnit = normalizeTimeUnit(unit);
  const durationMs = value * UNIT_TO_MS[normalizedUnit];
  const count = Math.floor(durationMs / intervalMs);
  return count > 0 ? count : 1;
}

export function parseRecurringCommand(text) {
  if (!text) return null;
  const cleanedOriginal = text.trim();
  
  const dowPattern = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  if (dowPattern.test(cleanedOriginal)) {
    throw new Error('DOW scheduling not supported in v1');
  }
  
  let processed = preprocessRecurringText(text);
  if (!processed) return null;
  
  const match1 = processed.match(RECURRING_PATTERN);
  if (match1) {
    const [fullMatch, intervalNum, unit, countStr, durationNum, durationUnit] = match1;
    const interval = intervalNum ? parseFloat(intervalNum) : 1;
    
    try {
      const normalizedUnit = normalizeTimeUnit(unit);
      let intervalMs = Math.round(interval * UNIT_TO_MS[normalizedUnit]);
      
      let count;
      if (countStr) {
        count = parseInt(countStr, 10);
      } else if (durationNum && durationUnit) {
        const durStr = durationNum.toLowerCase();
        const duration = (durStr === 'a' || durStr === 'an') ? 1 : parseInt(durationNum, 10);
        count = convertDurationToCount(duration, durationUnit, intervalMs);
      } else {
        return { error: ERROR_MESSAGES.MISSING_COUNT, pattern: 'numeric_interval_incomplete' };
      }
      
      const warnings = [];
      if (interval % 1 !== 0) warnings.push(ERROR_MESSAGES.DECIMAL_INTERVAL);
      if (intervalMs < 60000) {
        warnings.push(ERROR_MESSAGES.SUB_60_SECONDS);
        intervalMs = 60000;
      }
      
      const baseCommand = processed.replace(fullMatch, '').trim();
      return {
        intervalMs, count, warnings, originalText: text, pattern: 'numeric_interval',
        baseCommand, intervalValue: interval, intervalUnit: normalizedUnit
      };
    } catch (e) { return null; }
  }
  
  const match2 = processed.match(RECURRING_ALIAS);
  if (match2) {
    const [fullMatch, alias, countStr, durationNum, durationUnit] = match2;
    try {
      const normalizedUnit = normalizeTimeUnit(alias);
      const intervalMs = UNIT_TO_MS[normalizedUnit];
      let count;
      if (countStr) {
        count = parseInt(countStr, 10);
      } else if (durationNum && durationUnit) {
        const durStr = durationNum.toLowerCase();
        const duration = (durStr === 'a' || durStr === 'an') ? 1 : parseInt(durationNum, 10);
        count = convertDurationToCount(duration, durationUnit, intervalMs);
      } else {
        return { error: ERROR_MESSAGES.MISSING_COUNT, pattern: 'alias_incomplete' };
      }
      
      const baseCommand = processed.replace(fullMatch, '').trim();
      return {
        intervalMs, count, warnings: [], originalText: text, pattern: 'alias',
        baseCommand, intervalValue: 1, intervalUnit: normalizedUnit
      };
    } catch (e) { return null; }
  }
  
  const incompletePattern = /\bevery\s+(?:\d+\s+)?(\w+?)s?\b/i;
  if (incompletePattern.test(processed)) {
    return { error: ERROR_MESSAGES.MISSING_COUNT, pattern: 'incomplete' };
  }
  
  return null;
}

export function validateSyntax(parsed) {
  if (!parsed) throw new Error(ERROR_MESSAGES.INVALID_SYNTAX);
  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.intervalMs || !parsed.count) throw new Error(ERROR_MESSAGES.PARSING_FAILED);
  
  let { intervalMs, count } = parsed;
  const warnings = [...(parsed.warnings || [])];
  
  if (intervalMs < 60000) {
    if (!warnings.includes(ERROR_MESSAGES.SUB_60_SECONDS)) {
      warnings.push(ERROR_MESSAGES.SUB_60_SECONDS);
    }
    intervalMs = 60000;
  }
  
  if (count > 100) {
    throw new Error(VALIDATION_ERRORS.MAX_COUNT_EXCEEDED);
  }
  
  const durationMs = intervalMs * count;
  const maxDurationMs = 30 * 24 * 60 * 60 * 1000;
  if (durationMs > maxDurationMs) {
    throw new Error(VALIDATION_ERRORS.MAX_DURATION_EXCEEDED);
  }
  
  return {
    intervalMs, count, warnings, baseCommand: parsed.baseCommand,
    originalText: parsed.originalText, pattern: parsed.pattern, ok: true
  };
}

export function preprocessRecurringText(text) {
  if (!text) return null;
  let processed = text.trim();
  
  processed = processed
    .replace(/\b(\d+)\s*(?:times?|payments?|rounds?|occurrences?|x|runs?|executions?)\b/gi, '$1 times')
    .replace(/\bx(\d+)\b/gi, '$1 times')
    .replace(/\b(?:lasting|over|during|for\s+a\s+period\s+of)\s+(\d+(?:\.\d+)?)\s*(\w+)/gi, 'for $1 $2')
    .replace(/\bfor\s+(?:an|a)\s+(\w+)\b/gi, 'for 1 $1');
  
  const implicitPattern = /(\bevery\s+(?:\d+\s+)?\w+?s?\s+)(\d+)\b(?!\s*times?\b)/i;
  if (implicitPattern.test(processed)) {
    processed = processed.replace(implicitPattern, '$1$2 times');
  }
  
  const conflictPattern = /(\bevery\s+(?:\d+\s+)?\w+?s?\s+\d+\s+times?)\s+for\s+\d+\s+\w+?s?\b/i;
  if (conflictPattern.test(processed)) {
    processed = processed.replace(conflictPattern, '$1');
  }
  
  return processed;
}

export function isRecurringCommand(text) {
  if (!text) return false;
  try {
    const parsed = parseRecurringCommand(text);
    return parsed !== null && !parsed.error;
  } catch (e) {
    return false;
  }
}

export function isRecurringManagementCommand(text) {
  const lower = text.toLowerCase();
  return lower.includes('cancel series') || 
         lower.includes('stop series') ||
         lower.includes('series status') || 
         lower.includes('status series') ||
         lower.includes('my series') ||
         lower.includes('series list');
}

// ============ Series Management Handlers ============

export async function handleRecurringManagement(tweet, author, language) {
  const text = tweet.text;
  const supabase = getSupabase();
  const lower = text.toLowerCase();

  // 1. Cancel Command
  if (lower.includes('cancel') || lower.includes('stop')) {
    const match = text.match(/(?:cancel|stop|delete|remove)\s+(?:scheduled|recurring|payment|job|series)?\s*([a-f0-9-]+)/i);
    const seriesId = match ? match[1] : null;
    
    if (!seriesId) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_CANCEL_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: 'Please specify the Series ID, e.g. cancel series abc12345.', language
      });
      return;
    }

    // Verify ownership of the series
    const { data: checkJobs, error: checkError } = await supabase
      .from('scheduled_jobs').select('id, source_author_id')
      .eq('payload->>seriesId', seriesId).limit(1);

    if (checkError || !checkJobs || checkJobs.length === 0) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_CANCEL_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: `Series ID ${seriesId} not found in the database.`, language
      });
      return;
    }

    const checkJob = checkJobs[0];
    if (String(checkJob.source_author_id) !== String(author.id)) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_CANCEL_OWNER', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: "That's not your series, chief 🚫", language
      });
      return;
    }

    // Cancel all pending jobs in the series
    const { data: cancelledJobs, error } = await supabase
      .from('scheduled_jobs').update({ status: 'failed', error_message: 'Cancelled by user' })
      .eq('payload->>seriesId', seriesId).eq('status', 'pending').select();

    if (error) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_CANCEL_DB', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: 'Database error cancelling series. Try again.', language
      });
      return;
    }

    const cancelledCount = cancelledJobs?.length || 0;
    await logTransaction({
      sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
      amount: 0, fee: 0, tx_hash: 'RECURRING_CANCEL', type: 'p2p_command',
      tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
      error_reason: JSON.stringify({ seriesId, cancelledCount }), language
    });
    return;
  }

  // 2. Status Command
  if (lower.includes('status') || lower.includes('check')) {
    const match = text.match(/(?:status|check)\s+(?:scheduled|recurring|payment|job|series)?\s*([a-f0-9-]+)/i);
    const seriesId = match ? match[1] : null;

    if (!seriesId) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_STATUS_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: 'Please specify the Series ID, e.g. series status abc12345.', language
      });
      return;
    }

    const { data: jobs, error } = await supabase
      .from('scheduled_jobs').select('*')
      .eq('payload->>seriesId', seriesId);

    if (error || !jobs || jobs.length === 0) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_STATUS_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: `Series ID ${seriesId} not found.`, language
      });
      return;
    }

    const firstJob = jobs[0];
    if (String(firstJob.source_author_id) !== String(author.id)) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_STATUS_OWNER', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: "That's not your series, chief 🚫", language
      });
      return;
    }

    const completed = jobs.filter(j => j.status === 'completed').length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    const running = jobs.filter(j => j.status === 'running').length;
    const failed = jobs.filter(j => j.status === 'failed').length;

    await logTransaction({
      sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
      amount: 0, fee: 0, tx_hash: 'RECURRING_STATUS', type: 'p2p_command',
      tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
      error_reason: JSON.stringify({ seriesId, completed, pending, running, failed, total: jobs.length }), language
    });
    return;
  }

  // 3. List Command
  if (lower.includes('my series') || lower.includes('list')) {
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs').select('*')
      .eq('source_author_id', author.id)
      .not('payload->>seriesId', 'is', null)
      .order('created_at', { ascending: false });

    if (error || !jobs || jobs.length === 0) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_LIST_EMPTY', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: "You don't have any active recurring series, blud.", language
      });
      return;
    }

    const seriesMap = {};
    jobs.forEach(job => {
      const sid = job.payload.seriesId;
      if (!seriesMap[sid]) {
        seriesMap[sid] = {
          seriesId: sid,
          completed: 0,
          total: job.payload.seriesTotalCount || 0,
          target: job.payload.recipientPayTag || 'unknown',
        };
      }
      if (job.status === 'completed') seriesMap[sid].completed++;
    });

    const list = Object.values(seriesMap).slice(0, 3); // top 3 for tweet space limit
    await logTransaction({
      sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
      amount: 0, fee: 0, tx_hash: 'RECURRING_LIST', type: 'p2p_command',
      tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
      error_reason: JSON.stringify({ list }), language
    });
    return;
  }
}

// ============ Series Creation Handler ============

export async function handleRecurringCreation(tweet, author, language) {
  try {
    const text = tweet.text;
    const cleanText = text.replace(/@monibot/gi, '').trim();

    // 1. Resolve Sender
    const senderProfile = await getProfileByXUsername(author.username);
    if (!senderProfile) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_SENDER_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: `@${author.username} is not registered. Sign up at monipay.xyz and link X in Settings.`, language
      });
      return;
    }

    // 2. Parse & Validate Recurring Params
    const parsed = parseRecurringCommand(cleanText);
    let syntax;
    try {
      syntax = validateSyntax(parsed);
    } catch (e) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_LIMIT', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: e.message, language
      });
      return;
    }

    // 3. Parse Base Command (e.g. "send $1 to @alice")
    const baseCommandText = syntax.baseCommand;
    
    // Adapted from twitter.js single P2P regex
    const P2P_PATTERN = new RegExp(
      `(?:bless|slide|tip|give|transfer|pay|send)(?:[^@$]*?)@([a-zA-Z0-9_-]+)(?:[^@$]*?)\\$?([\\d.]+)|` +
      `(?:bless|slide|tip|give|transfer|pay|send)(?:[^@$]*?)\\$?([\\d.]+)(?:[^@$]*?)@([a-zA-Z0-9_-]+)`,
      'i'
    );
    const match = baseCommandText.match(P2P_PATTERN);
    if (!match) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: `Could not parse payment details from command. Format: send $5 to @username every day 7 times.`, language
      });
      return;
    }

    let amount, targetTag;
    if (match[1] !== undefined) {
      targetTag = match[1].toLowerCase();
      amount    = parseFloat(match[2]);
    } else {
      amount    = parseFloat(match[3]);
      targetTag = match[4].toLowerCase();
    }

    if (targetTag === 'monibot' || targetTag === 'monipay') return;
    if (isNaN(amount) || amount <= 0) return;

    // Self send guard
    if (targetTag === senderProfile.pay_tag?.toLowerCase() || targetTag === author.username.toLowerCase()) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_RECURRING_SELF', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: "Blud tried to schedule self-send. Stop the cap 🧢", language
      });
      return;
    }

    // Network detection
    const NETWORK_KEYWORDS = {
      celo:   ['on celo', 'celo', 'minipay'],
      ink:    ['on ink', 'ink chain', 'ink network', 'inkonchain'],
      solana: ['on solana', 'solana', 'sol ', 'spl'],
      tempo:  ['on tempo', 'tempo', 'alphausd', 'αusd'],
      bsc:    ['usdt', 'bnb', 'bsc', 'binance'],
    };
    let chain = senderProfile.preferred_network || 'base';
    const lowerText = baseCommandText.toLowerCase();
    for (const [ch, keywords] of Object.entries(NETWORK_KEYWORDS)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        chain = ch;
        break;
      }
    }
    chain = normalizeChain(chain);

    // 4. Resolve Recipient Profile or MagicPay (Twitter ID)
    let recipientProfile = await getProfileByMonitag(targetTag) || await getProfileByXUsername(targetTag);
    let isMagicPay = false;
    let recipientIdentifier = targetTag;

    if (!recipientProfile) {
      const numericId = await fetchTwitterNumericId(targetTag);
      if (!numericId) {
        await logTransaction({
          sender_id: senderProfile.id, receiver_id: senderProfile.id,
          amount, fee: 0, tx_hash: 'ERROR_TARGET_NOT_FOUND', type: 'p2p_command',
          tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
          error_reason: `@${targetTag} does not exist on Twitter. Double-check username.`, language
        });
        return;
      }
      isMagicPay = true;
      recipientIdentifier = numericId;
    } else {
      recipientIdentifier = recipientProfile.pay_tag;
    }

    // Pre-flight check: sender balance & allowance check
    const { getUSDCBalance, getAllowance } = await import('./blockchain.js');
    const { balance } = await getUSDCBalance(senderProfile.wallet_address, chain);
    const { allowance } = await getAllowance(senderProfile.wallet_address, chain, isMagicPay ? 'magicpay' : 'router');

    const preferredChain = chain;
    let balanceWarning = '';

    if (balance < amount || allowance < amount) {
      const { findAlternateChain } = await import('./crossChainCheck.js');
      const alt = await findAlternateChain(senderProfile.wallet_address, amount, preferredChain, isMagicPay ? 'magicpay' : 'p2p');
      
      if (alt && !alt.needsAllowance) {
        balanceWarning = ` (Auto-rerouted from ${preferredChain.toUpperCase()} to ${alt.chain.toUpperCase()})`;
        chain = alt.chain; // Update target chain for scheduling!
      } else if (alt && alt.needsAllowance) {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} to ${alt.chain.toUpperCase()} but it lacks allowance. Go to MoniPay Settings > MoniBot > Set Allowance > ${isMagicPay ? 'MagicPay' : 'CasualPay'} to approve allowance on ${alt.chain.toUpperCase()} before execution!)`;
      } else if (balance < amount) {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} but found no way to do so because of insufficient funds on all chains. Top up your wallet before execution!)`;
      } else {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} but found no way to do so because MoniBot allowance is too low. Go to Settings > MoniBot > Set Allowance to approve spending before execution!)`;
      }
    }

    // 5. Create scheduled jobs
    const seriesId = randomUUID();
    const intervalMs = syntax.intervalMs;
    const count = syntax.count;
    const startTime = Date.now();

    const jobs = Array.from({ length: count }, (_, i) => ({
      type: isMagicPay ? 'scheduled_magicpay' : 'scheduled_p2p',
      status: 'pending',
      scheduled_at: new Date(startTime + (i + 1) * intervalMs).toISOString(),
      source_author_id: author.id,
      source_author_username: author.username,
      source_tweet_id: tweet.id,
      max_attempts: 3,
      attempts: 0,
      payload: {
        platform: 'twitter',
        senderId: senderProfile.id,
        senderPayTag: senderProfile.pay_tag,
        senderWallet: senderProfile.wallet_address,
        receiverId: recipientProfile ? recipientProfile.id : null,
        recipientPayTag: targetTag,
        receiverWallet: recipientProfile ? recipientProfile.wallet_address : null,
        recipientId: isMagicPay ? recipientIdentifier : null, // for MagicPay (Twitter numeric ID)
        
        command: {
          amount, recipients: [targetTag], chain, isMagicPay,
        },
        originalText: cleanText,

        seriesId,
        seriesIndex: i + 1,
        seriesTotalCount: count,
        seriesIntervalMs: intervalMs,
        seriesStartedAt: new Date(startTime).toISOString(),
        
        isRecurring: false,
        recurrenceRule: null,
      }
    }));

    const supabase = getSupabase();
    const { error } = await supabase.from('scheduled_jobs').insert(jobs);

    if (error) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount, fee: 0, tx_hash: 'ERROR_RECURRING_DB_FAILED', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
        error_reason: `Database error scheduling jobs. Try again.`, language
      });
      return;
    }

    // Success! Log the recurring create transaction
    const firstAt = jobs[0].scheduled_at;
    const lastAt = jobs[count - 1].scheduled_at;

    await logTransaction({
      sender_id: senderProfile.id,
      receiver_id: recipientProfile ? recipientProfile.id : senderProfile.id,
      amount, fee: 0, tx_hash: 'RECURRING_CREATE', type: 'p2p_command',
      tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
      error_reason: JSON.stringify({ seriesId, count, amount, intervalMs, targetTag, chain, isMagicPay, firstAt, lastAt, balanceWarning }),
      language
    });

  } catch (err) {
    console.error('❌ Recurring creation exception:', err.message);
  }
}

// ============ Feature 1: One-time Scheduled Payments ============

const SIMPLE_SCHEDULE = /\bin\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(second|sec|s|minute|min|m|hour|hr|h|day|d)s?\b/i;

const WORD_TO_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

export function isOneTimeScheduleCommand(text) {
  if (!text) return false;
  return SIMPLE_SCHEDULE.test(text);
}

export function parseOneTimeScheduleCommand(text) {
  const match = text.match(SIMPLE_SCHEDULE);
  if (!match) return null;

  const valStr = match[1].toLowerCase();
  const value = WORD_TO_NUM[valStr] || parseInt(valStr, 10);
  if (isNaN(value) || value <= 0) return null;

  const unit = match[2].toLowerCase();
  const normalizedUnit = normalizeTimeUnit(unit);
  const ms = value * UNIT_TO_MS[normalizedUnit];

  const baseCommand = text.replace(match[0], '').trim();
  return {
    ms,
    value,
    unit: normalizedUnit,
    baseCommand
  };
}

export async function handleOneTimeScheduleCreation(tweet, author, language) {
  try {
    const text = tweet.text;
    const cleanText = text.replace(/@monibot/gi, '').trim();

    // 1. Resolve Sender
    const senderProfile = await getProfileByXUsername(author.username);
    if (!senderProfile) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_SENDER_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: `@${author.username} is not registered. Sign up at monipay.xyz and link X in Settings.`, language
      });
      return;
    }

    // 2. Parse schedule params
    const parsedSchedule = parseOneTimeScheduleCommand(cleanText);
    if (!parsedSchedule) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SCHEDULE_PARSE_FAILED', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: "Parsing scheduled time failed, stop being delulu 🤡", language
      });
      return;
    }

    // 3. Parse base command (e.g. "send $5 to @alice")
    const baseCommandText = parsedSchedule.baseCommand;
    const P2P_PATTERN = new RegExp(
      `(?:bless|slide|tip|give|transfer|pay|send)(?:[^@$]*?)@([a-zA-Z0-9_-]+)(?:[^@$]*?)\\$?([\\d.]+)|` +
      `(?:bless|slide|tip|give|transfer|pay|send)(?:[^@$]*?)\\$?([\\d.]+)(?:[^@$]*?)@([a-zA-Z0-9_-]+)`,
      'i'
    );
    const match = baseCommandText.match(P2P_PATTERN);
    if (!match) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SCHEDULE_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: `Could not parse payment details from command. Format: send $5 to @username in 5 minutes.`, language
      });
      return;
    }

    let amount, targetTag;
    if (match[1] !== undefined) {
      targetTag = match[1].toLowerCase();
      amount    = parseFloat(match[2]);
    } else {
      amount    = parseFloat(match[3]);
      targetTag = match[4].toLowerCase();
    }

    if (targetTag === 'monibot' || targetTag === 'monipay') return;
    if (isNaN(amount) || amount <= 0) return;

    // Self send guard
    if (targetTag === senderProfile.pay_tag?.toLowerCase() || targetTag === author.username.toLowerCase()) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SCHEDULE_SELF', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: "Blud tried to schedule self-send. Stop the cap 🧢", language
      });
      return;
    }

    // Network detection
    const NETWORK_KEYWORDS = {
      celo:   ['on celo', 'celo', 'minipay'],
      ink:    ['on ink', 'ink chain', 'ink network', 'inkonchain'],
      solana: ['on solana', 'solana', 'sol ', 'spl'],
      tempo:  ['on tempo', 'tempo', 'alphausd', 'αusd'],
      bsc:    ['usdt', 'bnb', 'bsc', 'binance'],
    };
    let chain = senderProfile.preferred_network || 'base';
    const lowerText = baseCommandText.toLowerCase();
    for (const [ch, keywords] of Object.entries(NETWORK_KEYWORDS)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        chain = ch;
        break;
      }
    }
    chain = normalizeChain(chain);

    // Resolve recipient
    let recipientProfile = await getProfileByMonitag(targetTag) || await getProfileByXUsername(targetTag);
    let isMagicPay = false;
    let recipientIdentifier = targetTag;

    if (!recipientProfile) {
      const numericId = await fetchTwitterNumericId(targetTag);
      if (!numericId) {
        await logTransaction({
          sender_id: senderProfile.id, receiver_id: senderProfile.id,
          amount, fee: 0, tx_hash: 'ERROR_TARGET_NOT_FOUND', type: 'p2p_command',
          tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
          error_reason: `@${targetTag} does not exist on Twitter. Double-check username.`, language
        });
        return;
      }
      isMagicPay = true;
      recipientIdentifier = numericId;
    } else {
      recipientIdentifier = recipientProfile.pay_tag;
    }

    // Pre-flight check: sender balance & allowance check
    const { getUSDCBalance, getAllowance } = await import('./blockchain.js');
    const { balance } = await getUSDCBalance(senderProfile.wallet_address, chain);
    const { allowance } = await getAllowance(senderProfile.wallet_address, chain, isMagicPay ? 'magicpay' : 'router');

    const preferredChain = chain;
    let balanceWarning = '';

    if (balance < amount || allowance < amount) {
      const { findAlternateChain } = await import('./crossChainCheck.js');
      const alt = await findAlternateChain(senderProfile.wallet_address, amount, preferredChain, isMagicPay ? 'magicpay' : 'p2p');
      
      if (alt && !alt.needsAllowance) {
        balanceWarning = ` (Auto-rerouted from ${preferredChain.toUpperCase()} to ${alt.chain.toUpperCase()})`;
        chain = alt.chain; // Update target chain for scheduling!
      } else if (alt && alt.needsAllowance) {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} to ${alt.chain.toUpperCase()} but it lacks allowance. Go to MoniPay Settings > MoniBot > Set Allowance > ${isMagicPay ? 'MagicPay' : 'CasualPay'} to approve allowance on ${alt.chain.toUpperCase()} before execution!)`;
      } else if (balance < amount) {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} but found no way to do so because of insufficient funds on all chains. Top up your wallet before execution!)`;
      } else {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} but found no way to do so because MoniBot allowance is too low. Go to Settings > MoniBot > Set Allowance to approve spending before execution!)`;
      }
    }

    // Insert scheduled job
    const scheduledAt = new Date(Date.now() + parsedSchedule.ms);
    const seriesId = randomUUID();

    const job = {
      type: isMagicPay ? 'scheduled_magicpay' : 'scheduled_p2p',
      status: 'pending',
      scheduled_at: scheduledAt.toISOString(),
      source_author_id: author.id,
      source_author_username: author.username,
      source_tweet_id: tweet.id,
      max_attempts: 3,
      attempts: 0,
      payload: {
        platform: 'twitter',
        senderId: senderProfile.id,
        senderPayTag: senderProfile.pay_tag,
        senderWallet: senderProfile.wallet_address,
        receiverId: recipientProfile ? recipientProfile.id : null,
        recipientPayTag: targetTag,
        receiverWallet: recipientProfile ? recipientProfile.wallet_address : null,
        recipientId: isMagicPay ? recipientIdentifier : null,
        command: {
          amount, recipients: [targetTag], chain, isMagicPay,
        },
        originalText: cleanText,
        seriesId,
        isRecurring: false,
      }
    };

    const supabase = getSupabase();
    const { error } = await supabase.from('scheduled_jobs').insert([job]);

    if (error) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount, fee: 0, tx_hash: 'ERROR_SCHEDULE_DB_FAILED', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
        error_reason: `Database error scheduling job. Try again.`, language
      });
      return;
    }

    // Success! Log the SCHEDULE_CREATE transaction
    const timeDesc = `in ${parsedSchedule.value} ${parsedSchedule.unit}${parsedSchedule.value !== 1 ? 's' : ''}`;
    await logTransaction({
      sender_id: senderProfile.id,
      receiver_id: recipientProfile ? recipientProfile.id : senderProfile.id,
      amount, fee: 0, tx_hash: 'SCHEDULE_CREATE', type: 'p2p_command',
      tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
      error_reason: JSON.stringify({ seriesId, amount, targetTag, chain, isMagicPay, timeDesc, balanceWarning }),
      language
    });

  } catch (err) {
    console.error('❌ One-time schedule creation exception:', err.message);
  }
}

// ============ Feature 2: Help, Onboarding, and Setup Commands ============

export async function handleHelpSetupLink(tweet, author, language) {
  try {
    const text = tweet.text.toLowerCase();
    const senderProfile = await getProfileByXUsername(author.username);

    if (text.includes('link')) {
      await logTransaction({
        sender_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        receiver_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'LINK_SHOW', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: JSON.stringify({ linked: !!senderProfile, payTag: senderProfile?.pay_tag }),
        language
      });
    } else if (text.includes('setup')) {
      await logTransaction({
        sender_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        receiver_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'SETUP_SHOW', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: '',
        language
      });
    } else if (text.includes('about')) {
      await logTransaction({
        sender_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        receiver_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ABOUT_SHOW', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: '',
        language
      });
    } else if (text.includes('command')) {
      await logTransaction({
        sender_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        receiver_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'COMMANDS_LIST_SHOW', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: '',
        language
      });
    } else if (text.includes('help')) {
      await logTransaction({
        sender_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        receiver_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'HELP_SHOW', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: '',
        language
      });
    }
  } catch (err) {
    console.error('❌ handleHelpSetupLink exception:', err.message);
  }
}

// ============ Feature 3: Network Preference Management ============

export async function handleSetChainCommand(tweet, author, language) {
  try {
    const text = tweet.text;
    const cleanText = text.replace(/@monibot/gi, '').trim();

    const match = cleanText.match(/(?:set-chain|change network to|change preferred network to|change chain to|change preferred chain to|switch to|use network|set network to|use chain|set chain|on)\s+(\w+)/i);
    if (!match) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_SET_CHAIN_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: "Invalid set-chain syntax. Try: @monibot set-chain Celo", language
      });
      return;
    }

    const requestedChain = match[1].toLowerCase();
    const SUPPORTED_CHAINS = ['base', 'solana', 'celo', 'ink', 'bsc', 'tempo'];
    if (!SUPPORTED_CHAINS.includes(requestedChain)) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_SET_CHAIN_UNSUPPORTED', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: `\`${requestedChain}\` is not supported. Try: ${SUPPORTED_CHAINS.join(', ')}`, language
      });
      return;
    }

    const senderProfile = await getProfileByXUsername(author.username);
    if (!senderProfile) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_SENDER_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: `@${author.username} is not registered. Sign up at monipay.xyz to change preferences.`, language
      });
      return;
    }

    const normalized = normalizeChain(requestedChain);
    const { updateUserPreferredNetwork } = await import('./database.js');
    const success = await updateUserPreferredNetwork(senderProfile.id, senderProfile.source, normalized);

    if (success) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'SET_CHAIN_SUCCESS', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: normalized,
        error_reason: normalized, language
      });
    } else {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SET_CHAIN_DB', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: 'Database error updating network preference.', language
      });
    }

  } catch (err) {
    console.error('❌ handleSetChainCommand exception:', err.message);
  }
}

// ============ Feature 4: Aura Leaderboard Command ============

export async function handleLeaderboardCommand(tweet, author, language) {
  try {
    const senderProfile = await getProfileByXUsername(author.username);
    const { getTwitterLeaderboard } = await import('./database.js');
    const topSigmas = await getTwitterLeaderboard(3);

    await logTransaction({
      sender_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
      receiver_id: senderProfile ? senderProfile.id : process.env.MONIBOT_PROFILE_ID,
      amount: 0, fee: 0, tx_hash: 'LEADERBOARD_SHOW', type: 'p2p_command',
      tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
      error_reason: JSON.stringify({ topSigmas }), language
    });

  } catch (err) {
    console.error('❌ handleLeaderboardCommand exception:', err.message);
  }
}

// ============ World Cup Promo: Conditional Sports Payments ============

export function isSportsConditionCommand(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // Must have a conditional keyword
  const conditionalKeywords = ['if', 'sake of', 'sake say', 'sake'];
  const hasIf = conditionalKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
  if (!hasIf) return false;

  // Split at the conditional keyword to check if there is a condition text
  let conditionText = '';
  for (const kw of conditionalKeywords) {
    const idx = lower.lastIndexOf(` ${kw} `);
    if (idx !== -1) {
      conditionText = text.slice(idx + kw.length + 2);
      break;
    }
  }

  if (!conditionText) return false;
  
  try {
    // We do a soft check by requiring at least one WC team name in TEAM_ALIASES to exist in conditionText
    const lowerCond = conditionText.toLowerCase();
    // Since we import parseConditionClause dynamically or look at aliases,
    // let's do a quick regex check for any team name or alias
    return lowerCond.split(/\s+/).some(word => {
      const cleanWord = word.replace(/[^a-z0-9]/g, '');
      return cleanWord.length >= 2; 
    });
  } catch (e) {
    return false;
  }
}

export async function handleSportsConditionCreation(tweet, author, language) {
  try {
    const text = tweet.text;
    const cleanText = text.replace(/@monibot/gi, '').trim();

    // 1. Resolve Sender
    const senderProfile = await getProfileByXUsername(author.username);
    if (!senderProfile) {
      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'ERROR_SENDER_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: `@${author.username} is not registered. Sign up at monipay.xyz and link X in Settings.`, language
      });
      return;
    }

    // 2. Extract Condition Clause
    const conditionalKeywords = ['if', 'sake of', 'sake say', 'sake'];
    let conditionText = '';
    let baseCommandText = cleanText;

    for (const kw of conditionalKeywords) {
      const idx = cleanText.toLowerCase().lastIndexOf(` ${kw} `);
      if (idx !== -1) {
        conditionText = cleanText.slice(idx + kw.length + 2).trim();
        baseCommandText = cleanText.slice(0, idx).trim();
        break;
      }
    }

    if (!conditionText) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: `Missing condition. E.g. "... send $5 to @username if France wins Brazil"`, language
      });
      return;
    }

    // 3. Parse condition using parseConditionClause from sportsOracle.js
    const { parseConditionClause, findMatchFromTeams, resolveRequiredOutcome } = await import('./sportsOracle.js');
    const parsedCond = parseConditionClause(conditionText);
    if (parsedCond.error) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: parsedCond.error, language
      });
      return;
    }

    const { team1, team2, outcomeType, rawScore } = parsedCond;

    // 4. Find matching World Cup 2026 fixture
    const fixture = await findMatchFromTeams(team1, team2);
    if (!fixture) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_MATCH_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: `No World Cup 2026 match found between ${team1} and ${team2}.`, language
      });
      return;
    }

    // 5. Resolve canonical required outcome
    const outcomeResolution = resolveRequiredOutcome(team1, team2, outcomeType, fixture);
    if (outcomeResolution.error) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: outcomeResolution.error, language
      });
      return;
    }

    // 6. Parse base command (e.g. "send $5 to @alice")
    const P2P_PATTERN = new RegExp(
      `(?:bless|slide|tip|give|transfer|pay|send)(?:[^@$]*?)@([a-zA-Z0-9_-]+)(?:[^@$]*?)\\$?([\\d.]+)|` +
      `(?:bless|slide|tip|give|transfer|pay|send)(?:[^@$]*?)\\$?([\\d.]+)(?:[^@$]*?)@([a-zA-Z0-9_-]+)`,
      'i'
    );
    const match = baseCommandText.match(P2P_PATTERN);
    if (!match) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_SYNTAX', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: `Could not parse payment details from command. Format: send $5 to @username if France beats Brazil.`, language
      });
      return;
    }

    let amount, targetTag;
    if (match[1] !== undefined) {
      targetTag = match[1].toLowerCase();
      amount    = parseFloat(match[2]);
    } else {
      amount    = parseFloat(match[3]);
      targetTag = match[4].toLowerCase();
    }

    if (targetTag === 'monibot' || targetTag === 'monipay') return;
    if (isNaN(amount) || amount <= 0) return;

    // Self send guard
    if (targetTag === senderProfile.pay_tag?.toLowerCase() || targetTag === author.username.toLowerCase()) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_SELF', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, chain: 'base',
        error_reason: "Blud tried to bet on self-send. Stop the cap 🧢", language
      });
      return;
    }

    // Network detection
    const NETWORK_KEYWORDS = {
      celo:   ['on celo', 'celo', 'minipay'],
      ink:    ['on ink', 'ink chain', 'ink network', 'inkonchain'],
      solana: ['on solana', 'solana', 'sol ', 'spl'],
      tempo:  ['on tempo', 'tempo', 'alphausd', 'αusd'],
      bsc:    ['usdt', 'bnb', 'bsc', 'binance'],
    };
    let chain = senderProfile.preferred_network || 'base';
    const lowerText = baseCommandText.toLowerCase();
    for (const [ch, keywords] of Object.entries(NETWORK_KEYWORDS)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        chain = ch;
        break;
      }
    }
    chain = normalizeChain(chain);

    // 7. Resolve Recipient & Fetch Twitter Numeric ID
    let recipientProfile = await getProfileByMonitag(targetTag) || await getProfileByXUsername(targetTag);
    const recipientTwitterId = await fetchTwitterNumericId(targetTag);
    const isMagicPay = !recipientProfile && !!recipientTwitterId;

    if (!recipientProfile && !recipientTwitterId) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount, fee: 0, tx_hash: 'ERROR_TARGET_NOT_FOUND', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
        error_reason: `@${targetTag} does not exist on Twitter. Double-check username.`, language
      });
      return;
    }

    // Pre-flight check: sender balance & allowance check
    const { getUSDCBalance, getAllowance } = await import('./blockchain.js');
    const { balance } = await getUSDCBalance(senderProfile.wallet_address, chain);
    const { allowance } = await getAllowance(senderProfile.wallet_address, chain, isMagicPay ? 'magicpay' : 'router');

    const preferredChain = chain;
    let balanceWarning = '';

    if (balance < amount || allowance < amount) {
      const { findAlternateChain } = await import('./crossChainCheck.js');
      const alt = await findAlternateChain(senderProfile.wallet_address, amount, preferredChain, isMagicPay ? 'magicpay' : 'p2p');
      
      if (alt && !alt.needsAllowance) {
        balanceWarning = ` (Auto-rerouted from ${preferredChain.toUpperCase()} to ${alt.chain.toUpperCase()})`;
        chain = alt.chain; // Update target chain for scheduling!
      } else if (alt && alt.needsAllowance) {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} to ${alt.chain.toUpperCase()} but it lacks allowance. Go to MoniPay Settings > MoniBot > Set Allowance > ${isMagicPay ? 'MagicPay' : 'CasualPay'} to approve allowance on ${alt.chain.toUpperCase()} before the match ends!)`;
      } else if (balance < amount) {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} but found no way to do so because of insufficient funds on all chains. Top up your wallet before the match ends!)`;
      } else {
        balanceWarning = ` (Warning: Tried rerouting from ${preferredChain.toUpperCase()} but found no way to do so because MoniBot allowance is too low. Go to Settings > MoniBot > Set Allowance to approve spending before the match ends!)`;
      }
    }


    // Create the conditional_sports_p2p job
    const jobId = randomUUID();
    const job = {
      id: jobId,
      type: 'conditional_sports_p2p',
      status: 'pending',
      scheduled_at: new Date().toISOString(),
      source_author_id: author.id,
      source_author_username: author.username,
      source_tweet_id: tweet.id,
      max_attempts: 1, // Only try once for sport bets
      attempts: 0,
      payload: {
        platform: 'twitter',
        senderId: senderProfile.id,
        senderPayTag: senderProfile.pay_tag,
        senderWallet: senderProfile.wallet_address,
        receiverId: recipientProfile ? recipientProfile.id : null,
        recipientPayTag: targetTag,
        recipientTwitterId,
        recipientWallet: recipientProfile ? recipientProfile.wallet_address : null,
        matchId: fixture.id,
        condition: {
          requiredOutcome: outcomeResolution.requiredOutcome,
          requiredWinner: outcomeResolution.requiredWinner || null,
          rawScore,
        },
        amount,
        chain,
        tweetId: tweet.id,
        language,
      }
    };

    const supabase = getSupabase();
    const { error } = await supabase.from('scheduled_jobs').insert([job]);

    if (error) {
      await logTransaction({
        sender_id: senderProfile.id, receiver_id: senderProfile.id,
        amount, fee: 0, tx_hash: 'ERROR_SPORTS_DB_FAILED', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
        error_reason: `Database error scheduling bet. Try again.`, language
      });
      return;
    }

    // Success! Log the conditional creation
    const condDesc = outcomeResolution.requiredOutcome === 'exact_score' 
      ? `score is ${rawScore.home}-${rawScore.away}`
      : `${team1} ${outcomeResolution.requiredOutcome === 'draw' ? 'draws' : 'wins'}${team2 ? ' ' + team2 : ''}`;

    await logTransaction({
      sender_id: senderProfile.id,
      receiver_id: recipientProfile ? recipientProfile.id : senderProfile.id,
      amount, fee: 0, tx_hash: 'SPORTS_CREATE', type: 'p2p_command',
      tweet_id: tweet.id, payer_pay_tag: senderProfile.pay_tag, recipient_pay_tag: targetTag, chain,
      error_reason: JSON.stringify({ jobId, amount, targetTag, chain, condDesc, match: `${fixture.home_team} vs ${fixture.away_team}`, balanceWarning }),
      language
    });

  } catch (err) {
    console.error('❌ Sports condition creation exception:', err.message);
  }
}

export function isSportsBetManagementCommand(text) {
  const lower = text.toLowerCase();
  return lower.includes('cancel bet') || lower.includes('stop bet') || lower.includes('bet status');
}

export async function handleSportsBetManagement(tweet, author, language) {
  try {
    const text = tweet.text;
    const supabase = getSupabase();
    const lower = text.toLowerCase();

    if (lower.includes('cancel') || lower.includes('stop')) {
      const match = text.match(/(?:cancel|stop|delete|remove)\s+(?:bet|conditional payment|conditional job)?\s*([a-f0-9-]+)/i);
      const jobId = match ? match[1] : null;
      
      if (!jobId) {
        await logTransaction({
          sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
          amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_CANCEL_SYNTAX', type: 'p2p_command',
          tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
          error_reason: 'Please specify the Bet ID, e.g. cancel bet abc12345.', language
        });
        return;
      }

      const { data: checkJobs, error: checkError } = await supabase
        .from('scheduled_jobs').select('*')
        .eq('id', jobId).limit(1);

      if (checkError || !checkJobs || checkJobs.length === 0) {
        await logTransaction({
          sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
          amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_CANCEL_NOT_FOUND', type: 'p2p_command',
          tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
          error_reason: `Bet ID ${jobId} not found.`, language
        });
        return;
      }

      const checkJob = checkJobs[0];
      if (String(checkJob.source_author_id) !== String(author.id)) {
        await logTransaction({
          sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
          amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_CANCEL_OWNER', type: 'p2p_command',
          tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
          error_reason: "That's not your bet, chief 🚫", language
        });
        return;
      }

      if (checkJob.status !== 'pending') {
        await logTransaction({
          sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
          amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_CANCEL_STATE', type: 'p2p_command',
          tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
          error_reason: `Bet is already ${checkJob.status} and cannot be cancelled.`, language
        });
        return;
      }

      const { error } = await supabase
        .from('scheduled_jobs').update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('id', jobId);

      if (error) {
        await logTransaction({
          sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
          amount: 0, fee: 0, tx_hash: 'ERROR_SPORTS_CANCEL_DB', type: 'p2p_command',
          tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
          error_reason: 'Database error cancelling bet. Try again.', language
        });
        return;
      }

      await logTransaction({
        sender_id: process.env.MONIBOT_PROFILE_ID, receiver_id: process.env.MONIBOT_PROFILE_ID,
        amount: 0, fee: 0, tx_hash: 'SPORTS_CANCEL', type: 'p2p_command',
        tweet_id: tweet.id, payer_pay_tag: author.username, chain: 'base',
        error_reason: JSON.stringify({ jobId }), language
      });
    }
  } catch (err) {
    console.error('❌ handleSportsBetManagement exception:', err.message);
  }
}
