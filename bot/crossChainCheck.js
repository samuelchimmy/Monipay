/**
 * MoniBot Worker - Cross-Chain Balance Check (v4.1)
 *
 * SINGLE SOURCE OF TRUTH: chains.js
 * Supports auto-rerouting across Base, BSC, Celo, Ink, and Solana.
 *
 * DUAL ALLOWANCE FIX:
 * - context='p2p'      → checks allowance against config.routerAddress
 * - context='magicpay' → checks allowance against config.magicPayAddress
 * This is critical: routing a MagicPay to a chain where only the Router
 * is approved will lock funds permanently.
 */

import { createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { CHAIN_CONFIGS, getChainConfig, isTestnet } from './chains.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ============ Internal Chain Fund Checker ============

/**
 * Check balance AND both allowances (router + magicpay) for a chain.
 * Returns structured result; caller applies context logic.
 *
 * @param {string} walletAddress
 * @param {number} amount
 * @param {string} chainName
 * @returns {Promise<object>}
 */
async function checkChainFunds(walletAddress, amount, chainName) {
  if (!walletAddress || typeof walletAddress !== 'string') {
    return { hasBalance: false, hasRouterAllowance: false, hasMagicPayAllowance: false, balance: 0, chain: chainName, symbol: 'UNKNOWN' };
  }

  const config = getChainConfig(chainName);
  const isSolana = chainName?.toLowerCase() === 'solana';

  // ── SOLANA BRANCH (Relay) ──────────────────────────────────────────────────
  if (isSolana) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/relay-solana-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ action: 'getBalance', address: walletAddress }),
      });
      const data = await resp.json();
      const balance = data.balance || 0;

      return {
        hasBalance: balance >= amount,
        hasRouterAllowance: true,   // Solana relay manages permissions internally
        hasMagicPayAllowance: false, // MagicPay is EVM-only
        balance,
        chain: 'solana',
        symbol: config.symbol || 'USDC'
      };
    } catch (e) {
      console.warn(`  ⚠️ Solana check failed: ${e.message}`);
      return { hasBalance: false, hasRouterAllowance: false, hasMagicPayAllowance: false, balance: 0, chain: 'solana', symbol: 'USDC' };
    }
  }

  // ── EVM ADDRESS SAFETY ────────────────────────────────────────────────────
  if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
    return { hasBalance: false, hasRouterAllowance: false, hasMagicPayAllowance: false, balance: 0, chain: chainName, symbol: config.symbol };
  }

  // ── EVM BRANCH (RPC Failover Loop) ────────────────────────────────────────
  for (const rpc of config.rpcs) {
    try {
      const client = createPublicClient({
        transport: http(rpc, { retryCount: 1, retryDelay: 500 }),
      });

      const reads = [
        client.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [walletAddress] }),
        client.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'allowance', args: [walletAddress, config.routerAddress] }),
      ];

      // Only read magicPayAllowance if the chain has a MagicPay contract
      if (config.magicPayAddress) {
        reads.push(
          client.readContract({ address: config.tokenAddress, abi: erc20Abi, functionName: 'allowance', args: [walletAddress, config.magicPayAddress] })
        );
      } else {
        reads.push(Promise.resolve(0n));
      }

      const [balance, routerAllowance, magicPayAllowance] = await Promise.all(reads);

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
      // Try next RPC in loop
    }
  }

  return { hasBalance: false, hasRouterAllowance: false, hasMagicPayAllowance: false, balance: 0, chain: chainName, symbol: config.symbol };
}

// ============ Public: Find Alternate Chain ============

/**
 * Find an alternate chain with sufficient funds and the correct allowance
 * for the given transaction context.
 *
 * @param {string} walletAddress - Sender's wallet
 * @param {number} amount - Amount required
 * @param {string} currentChain - Chain that just failed (excluded from search)
 * @param {string} context - 'p2p' or 'magicpay'
 * @returns {Promise<object|null>}
 */
export async function findAlternateChain(walletAddress, amount, currentChain, context = 'p2p') {
  const alternates = Object.keys(CHAIN_CONFIGS).filter(c =>
    c.toLowerCase() !== currentChain.toLowerCase() && !isTestnet(c)
  );

  console.log(`  🔄 [Cross-Chain] Checking for $${amount} (${context}) on: ${alternates.join(', ')}...`);

  const rawChecks = await Promise.all(
    alternates.map(chain => checkChainFunds(walletAddress, amount, chain))
  );

  // ── Apply context-aware allowance logic ───────────────────────────────────
  const checks = rawChecks.map(c => {
    // Solana: only viable for p2p (relay handles it), never for magicpay
    if (c.chain === 'solana') {
      const isP2P = context === 'p2p' || context === 'p2p_command';
      return { ...c, hasAllowance: isP2P ? c.hasRouterAllowance : false };
    }

    const hasAllowance = context === 'magicpay'
      ? c.hasMagicPayAllowance
      : c.hasRouterAllowance;

    return { ...c, hasAllowance };
  });

  // ── Tier 1: Has balance AND correct allowance ─────────────────────────────
  const viable = checks.find(c => c.hasBalance && c.hasAllowance);
  if (viable) {
    console.log(`  ✅ [Sigma Move] Found viable funds on ${viable.chain.toUpperCase()}: ${viable.balance.toFixed(2)} ${viable.symbol}`);
    return {
      chain: viable.chain,
      balance: viable.balance,
      symbol: viable.symbol,
      needsAllowance: false,
    };
  }

  // ── Tier 2: Has balance but missing the specific allowance ────────────────
  const hasBalanceOnly = checks.find(c => c.hasBalance);
  if (hasBalanceOnly) {
    console.log(`  🟡 [Aura Warning] ${hasBalanceOnly.chain.toUpperCase()} has balance but missing ${context} allowance.`);
    return {
      chain: hasBalanceOnly.chain,
      balance: hasBalanceOnly.balance,
      symbol: hasBalanceOnly.symbol,
      needsAllowance: true,
      context,
    };
  }

  console.log(`  💀 [Cooked] No funds found on any alternate chain.`);
  return null;
}

/**
 * Legacy wrapper — preserves any existing calls to checkBscFunds.
 */
export async function checkBscFunds(walletAddress, amount) {
  const result = await checkChainFunds(walletAddress, amount, 'bsc');
  return {
    hasBalance: result.hasBalance,
    hasAllowance: result.hasRouterAllowance,
    balance: result.balance,
    chain: 'bsc',
    symbol: result.symbol,
  };
}
