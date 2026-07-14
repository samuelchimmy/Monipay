/**
 * MoniBot Discord - Cross-Chain Balance Check
 * Refactored for 100% compatibility with chains.js and blockchain.js
 * Supports auto-rerouting across Base, BSC, Celo, Ink, and Solana
 */

import { createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { CHAIN_CONFIGS, getChainConfig, isTestnet } from './chains.js';
import { getAgentHeaders } from './src/middleware/agentFeedback.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Check balance and allowance for a specific chain.
 * Branches between EVM (viem) and Solana (Relay).
 *
 * @param {string} walletAddress
 * @param {number} amount
 * @param {string} chainName
 * @returns {Promise<{ hasBalance: boolean, hasAllowance: boolean, balance: number, chain: string, symbol: string }>}
 */
async function checkChainFunds(walletAddress, amount, chainName) {
  if (!walletAddress || typeof walletAddress !== 'string') {
    return { hasBalance: false, hasAllowance: false, balance: 0, chain: chainName, symbol: 'UNKNOWN' };
  }

  const config = getChainConfig(chainName);
  const isSolana = chainName?.toLowerCase() === 'solana';

  // --- SOLANA LOGIC (Fetch from Relay) ---
  if (isSolana) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/relay-solana-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          ...getAgentHeaders(),
        },
        body: JSON.stringify({ action: 'getBalance', address: walletAddress }),
      });
      const data = await resp.json();
      const balance = data.balance || 0;

      return {
        hasBalance: balance >= amount,
        hasAllowance: true, // Solana relay handles permissions on the backend
        balance: balance,
        chain: 'solana',
        symbol: config.symbol || 'USDC'
      };
    } catch (e) {
      console.warn(`  ⚠️ Solana check failed: ${e.message}`);
      return { hasBalance: false, hasAllowance: false, balance: 0, chain: 'solana', symbol: config.symbol || 'USDC' };
    }
  }

  // --- EVM LOGIC (Address Safety) ---
  // If not Solana, return early if address is not EVM compatible (0x)
  if (!walletAddress.startsWith('0x')) {
    return { hasBalance: false, hasAllowance: false, balance: 0, chain: chainName, symbol: config.symbol };
  }

  // --- EVM RPC FAILOVER LOOP ---
  for (const rpc of config.rpcs) {
    try {
      const client = createPublicClient({
        chain: config.chain, // Matches blockchain.js pattern
        transport: http(rpc, { retryCount: 1, retryDelay: 500 }), // Fast check
      });

      const [balance, routerAllowance, magicPayAllowance] = await Promise.all([
        client.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [walletAddress] }),
        client.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'allowance', args: [walletAddress, config.routerAddress] }),
        config.magicPayAddress
          ? client.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'allowance', args: [walletAddress, config.magicPayAddress] })
          : Promise.resolve(0n),
      ]);

      const balanceNum = parseFloat(formatUnits(balance, config.decimals));
      const routerAllowanceNum = parseFloat(formatUnits(routerAllowance, config.decimals));
      const magicPayAllowanceNum = parseFloat(formatUnits(magicPayAllowance, config.decimals));

      return {
        hasBalance: balanceNum >= amount,
        hasRouterAllowance: routerAllowanceNum >= amount,
        hasMagicPayAllowance: magicPayAllowanceNum >= amount,
        balance: balanceNum,
        chain: chainName,
        symbol: config.symbol,
      };
    } catch (e) {
      console.warn(`  ⚠️ Check failed on ${chainName} (${rpc}): ${e.message}`);
    }
  }

  return { hasBalance: false, hasAllowance: false, balance: 0, chain: chainName, symbol: config.symbol };
}

/**
 * Find an alternate chain with sufficient funds.
 * Excludes current chain and testnets.
 *
 * @param {string} walletAddress
 * @param {number} amount
 * @param {string} currentChain
 * @param {string} context - 'p2p' or 'magicpay'
 * @returns {Promise<object|null>}
 */
export async function findAlternateChain(walletAddress, amount, currentChain, context = 'p2p') {
  // Exclude current chain and strictly exclude testnets
  const alternates = Object.keys(CHAIN_CONFIGS).filter(c =>
    c !== currentChain && !isTestnet(c)
  );

  console.log(`  🔄 Cross-chain check (${context}): looking for $${amount} on ${alternates.join(', ')}...`);

  const rawChecks = await Promise.all(
    alternates.map(chain => checkChainFunds(walletAddress, amount, chain))
  );

  // Apply context-aware allowance logic
  const checks = rawChecks.map(c => {
    // Solana always has allowance in this system
    if (c.chain === 'solana') return { ...c, hasAllowance: c.hasBalance };

    const hasAllowance = context === 'magicpay' ? c.hasMagicPayAllowance : c.hasRouterAllowance;
    return { ...c, hasAllowance };
  });

  // Tier 1: Chain with both Balance and correct Allowance
  const viable = checks.find(c => c.hasBalance && c.hasAllowance);
  if (viable) {
    console.log(`  ✅ Found funds on ${viable.chain}: ${viable.balance.toFixed(2)} ${viable.symbol}`);
    return { chain: viable.chain, balance: viable.balance, symbol: viable.symbol };
  }

  // Tier 2: Chain with Balance but missing specific Allowance
  const hasBalanceOnly = checks.find(c => c.hasBalance);
  if (hasBalanceOnly) {
    return {
      chain: hasBalanceOnly.chain,
      balance: hasBalanceOnly.balance,
      symbol: hasBalanceOnly.symbol,
      needsAllowance: true,
      context
    };
  }

  return null;
}
