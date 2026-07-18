import { generateSeriesId, VALIDATION_LIMITS } from './recurringPayments.js';

/**
 * Series Calculator
 * 
 * This module calculates execution times and generates job data structures
 * for recurring payment series. Each recurring payment becomes multiple
 * independent scheduled jobs created upfront.
 */

// ============================================================================
// EXECUTION TIME CALCULATION
// ============================================================================

/**
 * Calculate all execution times for a recurring series
 * @param {Date} startTime - First execution time
 * @param {number} intervalMs - Interval between executions in milliseconds
 * @param {number} count - Number of executions
 * @returns {Date[]} Array of execution timestamps in chronological order
 */
export function calculateExecutionTimes(startTime, intervalMs, count) {
  if (!startTime || !(startTime instanceof Date)) {
    throw new Error('startTime must be a valid Date object');
  }
  
  if (!intervalMs || intervalMs < VALIDATION_LIMITS.MIN_INTERVAL_MS) {
    throw new Error(`intervalMs must be at least ${VALIDATION_LIMITS.MIN_INTERVAL_MS}ms`);
  }
  
  if (!count || count < 1 || count > VALIDATION_LIMITS.MAX_JOB_COUNT) {
    throw new Error(`count must be between 1 and ${VALIDATION_LIMITS.MAX_JOB_COUNT}`);
  }

  const times = [];
  let currentTime = startTime.getTime();

  for (let i = 0; i < count; i++) {
    times.push(new Date(currentTime));
    currentTime += intervalMs;
  }

  return times;
}

/**
 * Calculate first execution time (now + one interval)
 * @param {number} intervalMs - Interval in milliseconds
 * @returns {Date} First execution time
 */
export function calculateFirstExecutionTime(intervalMs) {
  const now = Date.now();
  // Ensure minimum interval is respected
  const safeInterval = Math.max(intervalMs, VALIDATION_LIMITS.MIN_INTERVAL_MS);
  return new Date(now + safeInterval);
}

/**
 * Validate that execution times are within acceptable ranges
 * @param {Date[]} times - Array of execution times
 * @returns {Object} {isValid: boolean, message: string}
 */
export function validateExecutionTimes(times) {
  if (!Array.isArray(times) || times.length === 0) {
    return { isValid: false, message: 'No execution times provided' };
  }

  const now = Date.now();
  const firstTime = times[0].getTime();
  const lastTime = times[times.length - 1].getTime();

  // Check that first time is in the future
  if (firstTime <= now) {
    return { isValid: false, message: 'First execution time must be in the future' };
  }

  // Check total duration
  const totalDuration = lastTime - firstTime;
  if (totalDuration > VALIDATION_LIMITS.MAX_DURATION_MS) {
    const maxDays = VALIDATION_LIMITS.MAX_DURATION_MS / 86400000;
    return {
      isValid: false,
      message: `Total duration exceeds maximum of ${maxDays} days`
    };
  }

  // Verify monotonicity (each time is after the previous)
  for (let i = 1; i < times.length; i++) {
    if (times[i].getTime() <= times[i - 1].getTime()) {
      return {
        isValid: false,
        message: `Execution times are not in chronological order at index ${i}`
      };
    }
  }

  // Verify minimum interval between executions
  for (let i = 1; i < times.length; i++) {
    const interval = times[i].getTime() - times[i - 1].getTime();
    if (interval < VALIDATION_LIMITS.MIN_INTERVAL_MS) {
      return {
        isValid: false,
        message: `Interval between executions is less than minimum (60 seconds) at index ${i}`
      };
    }
  }

  return { isValid: true };
}

// ============================================================================
// JOB SERIES GENERATION
// ============================================================================

/**
 * Create a series of scheduled job objects from a recurring command
 * @param {Object} params - Parameters for job series creation
 * @param {Object} params.recurringCommand - Parsed recurring command
 * @param {Object} params.parsedPaymentCommand - Parsed payment command (from p2p parser)
 * @param {Object} params.sender - Sender profile object
 * @param {Object} params.messageContext - Message context (chat, platform, etc.)
 * @param {string} params.originalText - Original command text
 * @returns {Object} {seriesId, jobs: Array, metadata: Object}
 */
export function createJobSeries({
  recurringCommand,
  parsedPaymentCommand,
  sender,
  messageContext,
  originalText
}) {
  // Generate unique series ID
  const seriesId = generateSeriesId();

  // Calculate execution times
  const firstTime = recurringCommand.firstRunTime
    ? new Date(recurringCommand.firstRunTime)
    : calculateFirstExecutionTime(recurringCommand.intervalMs);
  const executionTimes = calculateExecutionTimes(
    firstTime,
    recurringCommand.intervalMs,
    recurringCommand.repeatCount
  );

  // Validate execution times
  const validation = validateExecutionTimes(executionTimes);
  if (!validation.isValid) {
    throw new Error(`Invalid execution times: ${validation.message}`);
  }

  // Get sender wallet address for the active chain
  const chain = parsedPaymentCommand.chain || sender.preferred_network || 'base';
  const senderAddr = sender.addresses 
    ? (sender.addresses[chain] || sender.addresses.celo) 
    : sender.wallet_address;

  // Create job objects
  const jobs = [];
  for (let i = 0; i < executionTimes.length; i++) {
    const job = {
      type: parsedPaymentCommand.type === 'giveaway' ? 'scheduled_giveaway' : 'scheduled_p2p',
      scheduled_at: executionTimes[i].toISOString(),
      payload: {
        platform: messageContext.platform,
        chatId: messageContext.chatId,
        senderId: sender.id,
        senderPlatformId: messageContext.senderPlatformId,
        senderSource: sender.source || 'profile',
        senderPayTag: sender.pay_tag,
        senderWallet: senderAddr,
        command: parsedPaymentCommand,
        originalText,
        // Series metadata
        seriesId,
        seriesIndex: i + 1,
        seriesTotalCount: recurringCommand.repeatCount,
        seriesInterval: recurringCommand.interval,
        seriesFirstRun: executionTimes[0].toISOString(),
        seriesLastRun: executionTimes[executionTimes.length - 1].toISOString(),
      },
      status: 'pending',
      source_author_id: messageContext.sourceAuthorId,
      source_author_username: messageContext.sourceAuthorUsername,
      source_tweet_id: messageContext.sourceTweetId,
    };

    jobs.push(job);
  }

  // Create series metadata for tracking
  const metadata = {
    seriesId,
    totalJobs: jobs.length,
    firstExecution: executionTimes[0],
    lastExecution: executionTimes[executionTimes.length - 1],
    interval: recurringCommand.interval,
    intervalMs: recurringCommand.intervalMs,
    totalDuration: recurringCommand.totalDuration,
    perPaymentAmount: parsedPaymentCommand.amount,
    totalAmount: parsedPaymentCommand.amount * recurringCommand.repeatCount,
    chain,
    createdAt: new Date(),
  };

  return {
    seriesId,
    jobs,
    metadata
  };
}

// ============================================================================
// SERIES METADATA HELPERS
// ============================================================================

/**
 * Format series metadata for user-friendly display
 * @param {Object} metadata - Series metadata object
 * @returns {string} Formatted summary for display
 */
export function formatSeriesMetadata(metadata) {
  const {
    totalJobs,
    firstExecution,
    lastExecution,
    interval,
    perPaymentAmount,
    totalAmount,
    chain
  } = metadata;

  // Format dates to match "Jun 10, 2026 09:58:00"
  const formatDate = (date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = months[date.getUTCMonth()];
    const d = date.getUTCDate();
    const y = date.getUTCFullYear();
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${m} ${d}, ${y} ${hh}:${mm}:${ss}`;
  };

  // Format interval to match "Every 1 minute"
  const formatInterval = (interval) => {
    const match = interval.match(/^(\d+)([smhdw])$/);
    if (!match) return interval;
    
    const value = parseInt(match[1]);
    const unitMap = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week' };
    const unit = unitMap[match[2]] || match[2];
    
    const unitLabel = value > 1 ? `${unit}s` : unit;
    return `Every ${value} ${unitLabel}`;
  };

  return {
    totalJobs,
    firstExecutionFormatted: formatDate(firstExecution),
    lastExecutionFormatted: formatDate(lastExecution),
    intervalFormatted: formatInterval(interval),
    perPaymentAmount: perPaymentAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    chain: chain.toUpperCase()
  };
}

/**
 * Verify series metadata consistency across all jobs
 * @param {Array} jobs - Array of job objects
 * @returns {Object} {isConsistent: boolean, issues: Array}
 */
export function verifySeriesConsistency(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return { isConsistent: false, issues: ['No jobs provided'] };
  }

  const issues = [];
  const firstJob = jobs[0];
  const seriesId = firstJob.payload?.seriesId;
  const totalCount = firstJob.payload?.seriesTotalCount;
  const interval = firstJob.payload?.seriesInterval;

  // Check that all jobs have the same seriesId
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    
    if (job.payload?.seriesId !== seriesId) {
      issues.push(`Job ${i} has mismatched seriesId`);
    }
    
    if (job.payload?.seriesTotalCount !== totalCount) {
      issues.push(`Job ${i} has mismatched seriesTotalCount`);
    }
    
    if (job.payload?.seriesInterval !== interval) {
      issues.push(`Job ${i} has mismatched seriesInterval`);
    }
    
    if (job.payload?.seriesIndex !== i + 1) {
      issues.push(`Job ${i} has incorrect seriesIndex (expected ${i + 1}, got ${job.payload?.seriesIndex})`);
    }
  }

  // Check that job count matches totalCount
  if (jobs.length !== totalCount) {
    issues.push(`Job count (${jobs.length}) doesn't match seriesTotalCount (${totalCount})`);
  }

  return {
    isConsistent: issues.length === 0,
    issues
  };
}

// ============================================================================
// TIMEZONE AND DST HANDLING
// ============================================================================

/**
 * Adjust execution times for timezone and DST changes
 * Note: This is a placeholder for future timezone-aware scheduling
 * Currently, all times are stored and calculated in UTC
 * @param {Date[]} times - Array of execution times in UTC
 * @param {string} timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns {Date[]} Adjusted execution times
 */
export function adjustForTimezone(times, timezone = 'UTC') {
  // For now, return times as-is (all UTC)
  // Future enhancement: use date-fns-tz or similar for proper timezone handling
  console.log(`[SeriesCalculator] Timezone adjustment requested for ${timezone}, but not yet implemented. Using UTC.`);
  return times;
}

/**
 * Check if any execution times fall during DST transition
 * @param {Date[]} times - Array of execution times
 * @param {string} timezone - IANA timezone string
 * @returns {Object} {hasDstTransition: boolean, affectedIndices: Array}
 */
export function checkDstTransitions(times, timezone = 'UTC') {
  // Placeholder for DST detection
  // Future enhancement: detect DST transitions and warn users
  return {
    hasDstTransition: false,
    affectedIndices: []
  };
}

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} JobSeriesResult
 * @property {string} seriesId - Unique identifier for the series
 * @property {Array} jobs - Array of scheduled job objects ready for database insertion
 * @property {Object} metadata - Series metadata for tracking and display
 */

/**
 * @typedef {Object} SeriesMetadata
 * @property {string} seriesId - Unique series identifier
 * @property {number} totalJobs - Total number of jobs in series
 * @property {Date} firstExecution - First execution time
 * @property {Date} lastExecution - Last execution time
 * @property {string} interval - Interval string (e.g., "1m")
 * @property {number} intervalMs - Interval in milliseconds
 * @property {number} totalDuration - Total duration in milliseconds
 * @property {number} perPaymentAmount - Amount per payment
 * @property {number} totalAmount - Total amount for all payments
 * @property {string} chain - Blockchain network
 * @property {Date} createdAt - Series creation timestamp
 */

/**
 * @typedef {Object} MessageContext
 * @property {string} platform - Platform identifier ('telegram', 'discord', 'x')
 * @property {string} chatId - Chat/channel identifier
 * @property {string} senderPlatformId - Sender's platform-specific ID
 * @property {string} sourceAuthorId - Source author ID
 * @property {string} sourceAuthorUsername - Source author username
 * @property {string} sourceTweetId - Source message/tweet ID
 */
