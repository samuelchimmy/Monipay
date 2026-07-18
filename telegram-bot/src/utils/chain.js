import { getServerConfig } from '../../shared/database.js';

// Token symbols that unambiguously map to a single chain
const TOKEN_CHAIN_MAP = {
  'g$': 'celo',
  'gooddollar': 'celo',
  'usdm': 'celo',
  'αusd': 'tempo',
  'alphausd': 'tempo',
  'usdt0': 'ink',
  'bnb': 'bsc',
  'spl': 'solana',
};

export function detectChain(text) {
  const l = (text || '').toLowerCase();
  // Token-first detection (e.g. "send 5 G$ to @alice")
  for (const [token, chain] of Object.entries(TOKEN_CHAIN_MAP)) {
    if (l.includes(token)) return chain;
  }
  if (['on celo', 'celo', 'minipay'].some(k => l.includes(k))) return 'celo';
  if (['on ink', 'ink chain', 'ink network', 'inkonchain'].some(k => l.includes(k))) return 'ink';
  if (['on solana', 'solana', 'sol '].some(k => l.includes(k))) return 'solana';
  if (['on tempo', 'tempo'].some(k => l.includes(k))) return 'tempo';
  if (['usdt', 'bnb', 'bsc'].some(k => l.includes(k))) return 'bsc';
  if (['on base', 'base chain'].some(k => l.includes(k))) return 'base';
  return null;
}

// Extract explicit token symbol from message text
export function detectToken(text) {
  const l = (text || '').toLowerCase();
  if (l.includes('g$') || l.includes('gooddollar')) return 'G$';
  if (l.includes('usdm')) return 'USDm';
  if (l.includes('usdc')) return 'USDC';
  if (l.includes('usdt0')) return 'USDT0';
  if (l.includes('usdt')) return 'USDT';
  if (l.includes('αusd') || l.includes('alphausd')) return 'αUSD';
  return null;
}

export async function resolveChain(text, senderProfile, chatId) {
  const detected = detectChain(text || '');
  if (detected) return detected;

  if (senderProfile?.source === 'wallet_profile') {
    return 'celo';
  }

  return senderProfile?.preferred_network || await getServerConfig(String(chatId)) || 'base';
}
