/**
 * MoniBot Discord - Recurring Payment Validator
 * Validates recurring payment constraints and safety checks
 */

// Hard limits (per spec compatibility contract)
export const MAX_JOBS_PER_SERIES = 100;
export const MIN_INTERVAL_MS = 60000; // 60 seconds (pg_cron granularity)
export const MAX_SERIES_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Brainrot-style validation error messages
 */
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

/**
 * Calculate total cost of recurring payment series
 * @param {number} amount - Amount per payment
 * @param {number} count - Number of payments
 * @param {Array} recipients - Array of recipients (for multi-recipient)
 * @returns {number} - Total cost
 */
export function calculateSeriesCost(amount, count, recipients = []) {
  const recipientCount = recipients.length > 0 ? recipients.length : 1;
  return amount * count * recipientCount;
}

/**
 * Validate recurring payment limits
 * @param {number} intervalMs - Interval in milliseconds
 * @param {number} count - Number of payments
 * @returns {Object} - Validation result
 */
export function validateRecurringLimits(intervalMs, count) {
  const errors = [];
  const warnings = [];
  
  // Validate interval is a positive number
  if (!intervalMs || intervalMs <= 0 || !Number.isFinite(intervalMs)) {
    errors.push(VALIDATION_ERRORS.INVALID_INTERVAL);
  }
  
  // Validate count is a positive integer
  if (!count || count <= 0 || !Number.isInteger(count)) {
    errors.push(VALIDATION_ERRORS.INVALID_COUNT);
  }
  
  // Check minimum interval
  if (intervalMs < MIN_INTERVAL_MS) {
    errors.push(VALIDATION_ERRORS.MIN_INTERVAL_TOO_LOW);
  }
  
  // Check maximum count
  if (count > MAX_JOBS_PER_SERIES) {
    errors.push(VALIDATION_ERRORS.MAX_COUNT_EXCEEDED);
  }
  
  // Check for extreme values
  if (intervalMs > 365 * 24 * 60 * 60 * 1000) { // More than 1 year interval
    warnings.push(VALIDATION_ERRORS.EXTREME_VALUES);
  }
  
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate series duration doesn't exceed maximum
 * @param {number} intervalMs - Interval in milliseconds
 * @param {number} count - Number of payments
 * @returns {Object} - Validation result
 */
export function validateSeriesDuration(intervalMs, count) {
  const totalDurationMs = intervalMs * count;
  
  if (totalDurationMs > MAX_SERIES_DURATION_MS) {
    return {
      ok: false,
      error: VALIDATION_ERRORS.MAX_DURATION_EXCEEDED,
      actualDurationMs: totalDurationMs,
      maxDurationMs: MAX_SERIES_DURATION_MS,
    };
  }
  
  return {
    ok: true,
    totalDurationMs,
  };
}

/**
 * Validate user balance for entire series
 * @param {Object} senderProfile - Sender's profile with balance info
 * @param {number} amount - Amount per payment
 * @param {number} count - Number of payments
 * @param {Array} recipients - Array of recipients
 * @param {string} chain - Blockchain chain (base, bsc, tempo)
 * @returns {Object} - Validation result
 */
export function validateUserBalance(senderProfile, amount, count, recipients = [], chain = 'base') {
  const totalCost = calculateSeriesCost(amount, count, recipients);
  
  // Get user's balance on the specified chain
  // Note: Actual balance checking would require integration with blockchain/database
  // This is a placeholder that can be integrated with existing balance check logic
  const userBalance = senderProfile?.balance?.[chain] || 0;
  
  if (userBalance < totalCost) {
    return {
      ok: false,
      warning: VALIDATION_ERRORS.INSUFFICIENT_BALANCE(totalCost.toFixed(2), userBalance.toFixed(2)),
      requiredBalance: totalCost,
      availableBalance: userBalance,
      shortfall: totalCost - userBalance,
    };
  }
  
  return {
    ok: true,
    totalCost,
    availableBalance: userBalance,
  };
}

/**
 * Comprehensive validation of recurring payment configuration
 * @param {Object} config - Recurring payment configuration
 * @returns {Object} - Comprehensive validation result
 */
export function validateRecurringPayment(config) {
  const {
    intervalMs,
    count,
    amount,
    recipients = [],
    senderProfile,
    chain = 'base',
  } = config;
  
  const errors = [];
  const warnings = [];
  
  // Validate limits
  const limitsValidation = validateRecurringLimits(intervalMs, count);
  if (!limitsValidation.ok) {
    errors.push(...limitsValidation.errors);
  }
  warnings.push(...limitsValidation.warnings);
  
  // Validate duration
  const durationValidation = validateSeriesDuration(intervalMs, count);
  if (!durationValidation.ok) {
    errors.push(durationValidation.error);
  }
  
  // Validate balance (warning only, doesn't block)
  if (senderProfile && amount) {
    const balanceValidation = validateUserBalance(senderProfile, amount, count, recipients, chain);
    if (!balanceValidation.ok) {
      warnings.push(balanceValidation.warning);
    }
  }
  
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    totalCost: amount ? calculateSeriesCost(amount, count, recipients) : null,
  };
}

/**
 * Add safety checks for extreme values and edge cases
 * @param {Object} config - Configuration to check
 * @returns {Object} - Safety check result
 */
export function performSafetyChecks(config) {
  const { intervalMs, count, amount } = config;
  const warnings = [];
  
  // Check for very small intervals
  if (intervalMs < 5 * 60 * 1000) { // Less than 5 minutes
    warnings.push("Very frequent payments detected ⚡ Make sure this is intentional, no cap 🧢");
  }
  
  // Check for very large counts
  if (count > 50) {
    warnings.push("That's a lot of payments fam 📊 Consider breaking into smaller series");
  }
  
  // Check for very large amounts
  if (amount && amount > 1000) {
    warnings.push("Big money moves 💰 Double check those amounts chief");
  }
  
  // Check for very long series
  const totalDays = (intervalMs * count) / (24 * 60 * 60 * 1000);
  if (totalDays > 14) {
    warnings.push(`Series spans ${Math.ceil(totalDays)} days 📅 That's some long-term sigma behavior 🗿`);
  }
  
  return {
    ok: true,
    warnings,
  };
}
