/**
 * ERC-8004 Express Middleware for Agent-to-Agent Reputation
 */

import { executeGiveFeedback } from '../../shared/blockchain.js';

const MY_AGENT_ID = '51818';
const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const FEEDBACK_HINT = 'https://8004scan.io/agents/base/51818';

export function erc8004Middleware(req, res, next) {
  // 1. Set outbound headers for every response
  res.setHeader('X-ERC8004-Agent-Id', MY_AGENT_ID);
  res.setHeader('X-ERC8004-Registry', REGISTRY_ADDRESS);
  res.setHeader('X-ERC8004-Feedback-Hint', FEEDBACK_HINT);

  // 2. Detect inbound peer agent ID
  const peerAgentId = req.header('X-ERC8004-Agent-Id');

  if (peerAgentId) {
    // Intercept response finish to trigger on-chain feedback
    res.on('finish', () => {
      // Only give feedback for successful requests (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const receipt = `api_req_${Date.now()}_${req.path.replace(/\//g, '_')}`;

        // Trigger feedback in the background
        // Prefer Celo for lower gas, fallback to Base
        const chains = ['celo', 'base', 'bsc'];

        console.log(`[ERC-8004] Peer agent ${peerAgentId} detected. Queuing feedback on-chain...`);

        (async () => {
          for (const chain of chains) {
            try {
              await executeGiveFeedback(peerAgentId, 5, `ipfs://${receipt}`, chain);
              break; // Success
            } catch (e) {
              console.error(`[ERC-8004] Failed to give feedback on ${chain}:`, e.message);
            }
          }
        })();
      }
    });
  }

  next();
}
