/**
 * MoniBot Discord - Nonce Manager
 * Per-chain transaction queue with mutex to prevent nonce collisions.
 * 
 * Problem: If two payments fire simultaneously on the same chain, both call
 * getNonce() → get the same nonce → one transaction reverts.
 * 
 * Solution: Queue transactions per-chain so only one executes at a time.
 */

import logger from './logger.js';

const log = logger.child({ module: 'nonceManager' });

/**
 * Simple async mutex/queue per chain.
 * Ensures only one transaction executes at a time per chain.
 */
class ChainQueue {
  constructor(chainName, concurrency = 1) {
    this.chain = chainName;
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.totalProcessed = 0;
    this.totalErrors = 0;
  }

  /**
   * Enqueue a transaction function. Returns a promise that resolves
   * with the function's return value or rejects with its error.
   */
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._processNext();
    });
  }

  async _processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    this.running++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      this.totalProcessed++;
      resolve(result);
    } catch (err) {
      this.totalErrors++;
      reject(err);
    } finally {
      this.running--;
      this._processNext();
    }
  }

  get pending() {
    return this.queue.length;
  }

  get stats() {
    return {
      chain: this.chain,
      running: this.running,
      pending: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
    };
  }
}

// ============ Global Chain Queues ============

const chainQueues = new Map();

/**
 * Get or create a chain queue with concurrency of 1 (serial execution).
 */
function getQueue(chainName) {
  const key = chainName.toLowerCase();
  if (!chainQueues.has(key)) {
    chainQueues.set(key, new ChainQueue(key, 1));
    log.info('Created transaction queue', { chain: key });
  }
  return chainQueues.get(key);
}

/**
 * Execute a transaction function within the chain's serial queue.
 * This guarantees that only one transaction per chain is in-flight at a time,
 * preventing nonce collisions.
 * 
 * @param {string} chainName - The chain to queue on (e.g., 'base', 'bsc')
 * @param {Function} txFn - Async function that executes the transaction
 * @returns {Promise<any>} - The result of txFn
 * 
 * @example
 * const result = await withNonceQueue('base', async () => {
 *   return await executeP2P(from, to, amount, id, 'base');
 * });
 */
export async function withNonceQueue(chainName, txFn) {
  const queue = getQueue(chainName);
  const queuePosition = queue.pending;

  if (queuePosition > 0) {
    log.info('Transaction queued', { chain: chainName, position: queuePosition });
  }

  return queue.enqueue(txFn);
}

/**
 * Get stats for all chain queues. Useful for health checks.
 */
export function getQueueStats() {
  const stats = {};
  for (const [chain, queue] of chainQueues.entries()) {
    stats[chain] = queue.stats;
  }
  return stats;
}

/**
 * Get the number of pending transactions across all chains.
 */
export function getTotalPending() {
  let total = 0;
  for (const queue of chainQueues.values()) {
    total += queue.pending + queue.running;
  }
  return total;
}

export default { withNonceQueue, getQueueStats, getTotalPending };
