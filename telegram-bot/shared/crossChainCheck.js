import { createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { CHAIN_CONFIGS, getChainConfig, isTestnet, resolveToken } from './chains.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function checkChainFunds(walletAddress, amount, chainName) {
  if (!walletAddress || typeof walletAddress !== 'string') {
    return { hasBalance: false, hasAllowance: false, balance: 0, chain: chainName, symbol: 'UNKNOWN' };
  }

  const config = getChainConfig(chainName);
  const isSolana = chainName?.toLowerCase() === 'solana';

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
        hasAllowance: true,
        balance,
        chain: 'solana',
        symbol: config.symbol || resolveToken('solana')
      };
    } catch {
      return { hasBalance: false, hasAllowance: false, balance: 0, chain: 'solana', symbol: config.symbol || resolveToken('solana') };
    }
  }

  if (!walletAddress.startsWith('0x')) {
    return { hasBalance: false, hasAllowance: false, balance: 0, chain: chainName, symbol: config.symbol };
  }

  for (const rpc of config.rpcs) {
    try {
      const client = createPublicClient({
        chain: config.chain,
        transport: http(rpc, { retryCount: 1, retryDelay: 500 }),
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
    } catch {}
  }

  return { hasBalance: false, hasAllowance: false, balance: 0, chain: chainName, symbol: config.symbol };
}

export async function findAlternateChain(walletAddress, amount, currentChain, context = 'p2p') {
  const alternates = Object.keys(CHAIN_CONFIGS).filter(c => c !== currentChain && !isTestnet(c));
  const rawChecks = await Promise.all(alternates.map(chain => checkChainFunds(walletAddress, amount, chain)));

  const checks = rawChecks.map(c => {
    if (c.chain === 'solana') return { ...c, hasAllowance: c.hasBalance };
    const hasAllowance = context === 'magicpay' ? c.hasMagicPayAllowance : c.hasRouterAllowance;
    return { ...c, hasAllowance };
  });

  const viable = checks.find(c => c.hasBalance && c.hasAllowance);
  if (viable) return { chain: viable.chain, balance: viable.balance, symbol: viable.symbol };

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
