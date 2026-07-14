/**
 * MoniBot Discord - Agent Feedback Middleware
 * Implements ERC-8004 agent-to-agent feedback loops.
 */

import { giveAgentFeedback } from '../blockchain.js';
import logger from '../logger.js';

const log = logger.child({ module: 'agentFeedback' });

const AGENT_ID = '51818';
const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const FEEDBACK_HINT = 'https://8004scan.io/agents/base/51818';

/**
 * Middleware to handle ERC-8004 agent headers.
 * 1. Attaches MoniBot's agent ID and registry info to all outbound responses.
 * 2. Checks inbound requests for X-ERC8004-Agent-Id and triggers on-chain feedback.
 */
export function agentFeedbackMiddleware(req, res, next) {
  // Set outbound headers
  res.setHeader('X-ERC8004-Agent-Id', AGENT_ID);
  res.setHeader('X-ERC8004-Registry', REGISTRY);
  res.setHeader('X-ERC8004-Feedback-Hint', FEEDBACK_HINT);

  // Check for inbound peer agent ID
  const peerAgentId = req.header('X-ERC8004-Agent-Id');

  if (peerAgentId) {
    log.info('Detected peer agent request', { peerAgentId });

    // We use res.on('finish') to trigger feedback AFTER the request is successfully processed
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        log.info('Successful peer request, triggering on-chain feedback', { peerAgentId });
        // Fire and forget (it has internal logging and failover)
        giveAgentFeedback(peerAgentId, 5, `Reputation loop for peer ${peerAgentId}`);
      }
    });
  }

  next();
}

/**
 * Helper to get MoniBot's agent headers for outbound fetch calls.
 */
export function getAgentHeaders() {
  return {
    'X-ERC8004-Agent-Id': AGENT_ID,
    'X-ERC8004-Registry': REGISTRY,
    'X-ERC8004-Feedback-Hint': FEEDBACK_HINT,
  };
}
