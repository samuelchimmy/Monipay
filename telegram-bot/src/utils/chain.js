import { getServerConfig } from '../../shared/database.js';

// Token symbols that unambiguously map to a single chain (Celo-only)
const TOKEN_CHAIN_MAP = {
  'g$': 'celo',
  'gooddollar': 'celo',
  'usdm': 'celo',
};

export function detectChain(text) {
  const l = (text || '').toLowerCase();
  // Token-first detection (e.g. "send 5 G$ to @alice")
  for (const [token, chain] of Object.entries(TOKEN_CHAIN_MAP)) {
    if (l.includes(token)) return chain;
  }
  if (['on celo', 'celo', 'minipay'].some(k => l.includes(k))) return 'celo';
  return null;
}

// Extract explicit token symbol from message text
export function detectToken(text) {
  const l = (text || '').toLowerCase();
  if (l.includes('g$') || l.includes('gooddollar')) return 'G$';
  if (l.includes('usdm')) return 'USDm';
  if (l.includes('usdc')) return 'USDC';
  if (l.includes('usdt')) return 'USDT';
  return null;
}

export async function resolveChain(text, senderProfile, chatId) {
  const detected = detectChain(text || '');
  if (detected) return detected;

  if (senderProfile?.source === 'wallet_profile') {
    return 'celo';
  }

  return senderProfile?.preferred_network || await getServerConfig(String(chatId)) || 'celo';
}
