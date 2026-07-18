/**
 * Nigerian Pidgin Vocabulary for MoniBot
 */

export const PIDGIN_COMMAND_VERBS = [
  'dash', 'settle', 'chook', 'wire', 'spray', 'jolly', 'whack', 'flow',
  'bless', 'slide', 'tip', 'give', 'transfer', 'pay', 'send',
  'drop', 'airdrop', 'claim', 'nak', 'wack', 'bam', 'shack', 'chop',
  'show love', 'carry go', 'shukura', 'settle me', 'dash me', 'show me love',
  'bless me', 'wire me', 'spray me'
];

export const PIDGIN_BALANCE_VERBS = [
  'how much i get', 'check my raba', 'how much dey', 'check balance',
  'how much', 'wetin remain', 'balance'
];

export const PIDGIN_MONEY_SLANG = [
  'raba', 'cheddar', 'ego', 'kpa', 'owo', 'pepper', 'bar', 'bread',
  'control', 'mulla', 'stack', 'bag', 'shishi', 'kudi', 'change', 'notes',
  'funds', 'ginger', 'moni', 'alanza'
];

export const PIDGIN_GREETINGS_CONFIRMATIONS = [
  'abeg', 'howfar', 'sharp sharp', 'correct', 'confirm', 'ocha', 'don done',
  'oya', 'barka', 'ese', 'naode', 'no wahala', 'i beg', 'welldone', 'kedu',
  'padi', 'guy', 'bra', 'boss', 'ment', 'no cap', 'real gee', 'hwfar', 'awfa'
];

export const PIDGIN_EACH_EQUIVALENTS = [
  'each each', 'per head', 'per person', 'for everybody', 'everybody', 'each'
];

export const PIDGIN_ERROR_CONTEXTS = [
  'wahala', 'no gree', 'e no work', 'waiting happen', 'bad luck', 'fail',
  'error', 'don cast', 'cast', 'ti lule'
];

export const ALL_RESERVED_WORDS = [
  ...PIDGIN_COMMAND_VERBS,
  ...PIDGIN_BALANCE_VERBS,
  ...PIDGIN_MONEY_SLANG,
  ...PIDGIN_GREETINGS_CONFIRMATIONS,
  ...PIDGIN_EACH_EQUIVALENTS,
  'monibot', 'monipay', 'hey', 'hi', 'hello', 'to', 'for', 'with', 'help', 'me', 'each', 'usdc', 'usdt', 'give', 'send', 'pay', 'wire', 'bless'
].map(word => word.toLowerCase());

/**
 * Detects if the text contains Nigerian Pidgin English patterns.
 * @param {string} text 
 * @returns {'pidgin' | 'english'}
 */
export function detectLanguage(text) {
  const lower = text.toLowerCase();
  
  // Specific Pidgin markers that are highly likely to indicate Pidgin usage
  const highConfidencePidginMarkers = [
    'dash', 'settle', 'chook', 'wire', 'spray', 'raba', 'ego', 'kpa', 
    'owo', 'pepper', 'abeg', 'howfar', 'sharp sharp', 'shishi', 'don done',
    'oya', 'mulla', 'kudi', 'wahala', 'alanza', 'ti lule', 'don cast',
    'hwfar', 'awfa', 'each each', 'per head'
  ];

  if (highConfidencePidginMarkers.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(lower);
  })) {
    return 'pidgin';
  }

  // Check for phrases in balance verbs that are clearly Pidgin
  const pidginBalancePhrases = [
    'how much i get', 'how much dey', 'wetin remain', 'check my raba'
  ];

  if (pidginBalancePhrases.some(phrase => lower.includes(phrase))) {
    return 'pidgin';
  }

  return 'english';
}
