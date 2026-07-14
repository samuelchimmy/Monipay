/**
 * MoniBot Discord - Input Validation Module
 * Validates all user inputs and AI-parsed results before they reach payment logic.
 */

import { AMOUNT_LIMITS, SUPPORTED_CHAINS, VALID_AI_COMMAND_TYPES, GIVEAWAY_LIMITS } from './constants.js';
import logger from './logger.js';

const log = logger.child({ module: 'validation' });

// ============ Amount Validation ============

/**
 * Validates a payment amount.
 * Returns { valid: true, amount } or { valid: false, reason }.
 */
export function validateAmount(amount) {
  if (amount === null || amount === undefined) {
    return { valid: false, reason: 'Amount is required.' };
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (typeof num !== 'number' || !Number.isFinite(num)) {
    return { valid: false, reason: 'Amount must be a valid number.' };
  }

  if (num < AMOUNT_LIMITS.MIN) {
    return { valid: false, reason: `Minimum amount is $${AMOUNT_LIMITS.MIN}.` };
  }

  if (num > AMOUNT_LIMITS.MAX) {
    return { valid: false, reason: `Maximum amount is $${AMOUNT_LIMITS.MAX.toLocaleString()}.` };
  }

  // Check for excessive decimal places (max 6 for USDC-type tokens)
  const parts = String(num).split('.');
  if (parts[1] && parts[1].length > 6) {
    return { valid: false, reason: 'Amount cannot have more than 6 decimal places.' };
  }

  return { valid: true, amount: num };
}

// ============ Chain Validation ============

/**
 * Validates a chain name.
 * Returns normalized lowercase chain or null if invalid.
 */
export function validateChain(chain) {
  if (!chain || typeof chain !== 'string') return null;
  const normalized = chain.toLowerCase().trim();
  if (SUPPORTED_CHAINS.includes(normalized)) return normalized;
  return null;
}

// ============ Recipient Validation ============

/**
 * Validates a list of recipient tags.
 * Returns { valid: true, recipients } or { valid: false, reason }.
 */
export function validateRecipients(recipients) {
  if (!Array.isArray(recipients)) {
    return { valid: false, reason: 'Recipients must be an array.' };
  }

  if (recipients.length === 0) {
    return { valid: false, reason: 'At least one recipient is required.' };
  }

  if (recipients.length > 20) {
    return { valid: false, reason: 'Maximum of 20 recipients per transaction.' };
  }

  const cleaned = recipients
    .filter(r => r && typeof r === 'string')
    .map(r => r.trim().toLowerCase().replace(/^@/, ''));

  if (cleaned.length === 0) {
    return { valid: false, reason: 'No valid recipients found.' };
  }

  // Check for reserved names
  const reserved = ['monibot', 'monipay', 'everyone', 'here'];
  const filtered = cleaned.filter(r => !reserved.includes(r));

  if (filtered.length === 0) {
    return { valid: false, reason: 'No valid recipients (all are reserved names).' };
  }

  return { valid: true, recipients: filtered };
}

// ============ AI Result Validation ============

/**
 * Validates a command parsed by the AI module.
 * Returns the validated command object or null if invalid.
 * This prevents malicious or hallucinated AI outputs from reaching payment logic.
 */
export function validateAICommand(aiResult) {
  if (!aiResult || typeof aiResult !== 'object') {
    log.warn('AI result is null or not an object');
    return null;
  }

  const { type, amount, recipients, chain, maxParticipants } = aiResult;

  // Validate type
  if (!type || !VALID_AI_COMMAND_TYPES.includes(type)) {
    log.warn('AI returned invalid command type', { type });
    return null;
  }

  // For chat/help/setup/link/balance, no further validation needed
  if (['chat', 'help', 'setup', 'link'].includes(type)) {
    return { type };
  }

  if (type === 'balance') {
    return { type, chain: validateChain(chain) || undefined };
  }

  // For payment commands, validate amount
  if (['p2p', 'p2p_multi', 'giveaway'].includes(type)) {
    const amountResult = validateAmount(amount);
    if (!amountResult.valid) {
      log.warn('AI returned invalid amount', { amount, reason: amountResult.reason });
      return null;
    }

    const validated = {
      type,
      amount: amountResult.amount,
      chain: validateChain(chain) || undefined,
    };

    // Validate recipients for P2P commands
    if (type === 'p2p' || type === 'p2p_multi') {
      if (recipients && Array.isArray(recipients) && recipients.length > 0) {
        const recipientResult = validateRecipients(recipients);
        if (!recipientResult.valid) {
          log.warn('AI returned invalid recipients', { recipients, reason: recipientResult.reason });
          return null;
        }
        validated.recipients = recipientResult.recipients;
      } else if (type === 'p2p') {
        // Single P2P requires at least one recipient
        log.warn('AI P2P command missing recipients');
        return null;
      }
    }

    // Validate maxParticipants for giveaway
    if (type === 'giveaway') {
      const participants = parseInt(maxParticipants);
      if (!Number.isFinite(participants) || participants < GIVEAWAY_LIMITS.MIN_PARTICIPANTS || participants > GIVEAWAY_LIMITS.MAX_PARTICIPANTS) {
        log.warn('AI returned invalid maxParticipants', { maxParticipants });
        return null;
      }
      validated.maxParticipants = participants;
    }

    return validated;
  }

  // set_chain
  if (type === 'set_chain') {
    const validChain = validateChain(chain);
    if (!validChain) {
      log.warn('AI returned invalid chain for set_chain', { chain });
      return null;
    }
    return { type, chain: validChain };
  }

  return null;
}

/**
 * Validates a regex-parsed command's amount.
 * Mutates the command in-place to ensure the amount is safe.
 * Returns { valid: true } or { valid: false, reason }.
 */
export function validateParsedCommand(command) {
  if (!command) return { valid: false, reason: 'No command' };

  // Only validate commands that have amounts
  if (command.amount !== undefined) {
    const amountResult = validateAmount(command.amount);
    if (!amountResult.valid) {
      return amountResult;
    }
    command.amount = amountResult.amount;
  }

  // Validate chain if present
  if (command.chain) {
    command.chain = validateChain(command.chain);
  }

  // Validate maxParticipants for giveaways
  if (command.type === 'giveaway' && command.maxParticipants !== undefined) {
    const p = parseInt(command.maxParticipants);
    if (!Number.isFinite(p) || p < GIVEAWAY_LIMITS.MIN_PARTICIPANTS || p > GIVEAWAY_LIMITS.MAX_PARTICIPANTS) {
      return { valid: false, reason: `Giveaway participants must be between ${GIVEAWAY_LIMITS.MIN_PARTICIPANTS} and ${GIVEAWAY_LIMITS.MAX_PARTICIPANTS}.` };
    }
    command.maxParticipants = p;
  }

  return { valid: true };
}
