/**
 * MoniBot Worker - Blockchain Module (Multi-Chain + MagicPay)
 *
 * FIX B1: getClients() always passes viemChain from chains.js.
 * FIX B2: executeMagicPay() pre-flight checks magicPayAddress allowance.
 * FIX B6: chain stored lowercase via normalizeChain().
 * FIX RPC: All execution functions loop through every RPC on a chain before
 *          giving up. RPC infrastructure failures (rate limits, timeouts,
 *          "Requested resource not found") rotate to the next endpoint
 *          automatically. Real errors (balance, allowance, duplicate) throw
 *          immediately without wasting retries.
 * FIX NONCE: Mutex+chainNonces pattern (ported from Discord bot) prevents
 *            nonce collisions when oracle fires many jobs simultaneously.
 */

// ============ Nonce Manager (Mutex pattern — safe under burst concurrency) ============

class Mutex {
  constructor() { this.queue = Promise.resolve(); }
  async run(fn) {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
}

const _chainMutexes = {};
const _chainNonces  = {};

function _getMutex(chainKey) {
  if (!_chainMutexes[chainKey]) _chainMutexes[chainKey] = new Mutex();
  return _chainMutexes[chainKey];
}

/**
 * Mutex-gated transaction sender.
 * - Fetches nonce ONCE per chain (blockTag: 'pending'), then increments in-memory.
 * - On failure: clears cache so next tx re-fetches fresh from network.
 * - Ensures sequential tx ordering even when oracle fires 10k jobs at once.
 */
export async function sendTransactionWithNonce(chainName, publicClient, walletClient, txParams) {
  const chainKey = typeof normalizeChain === 'function' ? normalizeChain(chainName) : chainName.toLowerCase();
  return _getMutex(chainKey).run(async () => {
    const address = walletClient.account.address;
    if (_chainNonces[chainKey] == null) {
      console.log(`[NonceManager] Fetching pending nonce for ${address} on ${chainKey}`);
      _chainNonces[chainKey] = await publicClient.getTransactionCount({
        address,
        blockTag: 'pending',
      });
    }
    const nonce = _chainNonces[chainKey];
    console.log(`[NonceManager] Sending tx on ${chainKey} with nonce ${nonce}`);
    try {
      const hash = await walletClient.sendTransaction({ ...txParams, nonce });
      _chainNonces[chainKey]++;
      return hash;
    } catch (err) {
      console.warn(`[NonceManager] Tx failed on ${chainKey}, clearing cached nonce. Error: ${err.message?.split('\n')[0]}`);
      _chainNonces[chainKey] = null;
      throw err;
    }