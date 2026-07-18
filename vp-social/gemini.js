/**
 * MoniBot VP-Social - AI Module (v6.0 Sigma Edition)
 *
 * Specific replies stay actionable, but the personality wrapper now varies so
 * consecutive tweets do not sound copy-pasted.
 */

const MONIBOT_AI_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1/monibot-ai`
  : 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/monibot-ai';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const SIGMA_VOCAB = {
  broke: ['cooked', 'down bad', 'in shambles', 'built different (broke edition)', 'on fumes'],
  success: ['W Aura', 'certified sigma move', 'no cap bussin', 'goated fr', 'ate and left no crumbs'],
  blocked: ['NPC behavior', 'skill issue', 'ratio incoming', 'L + no maidens', 'touched grass wrong'],
  waiting: ['on ice', 'in the shadow realm', 'locked in escrow', 'parked fr', 'vibing in the vault'],
  fix: ['fix your aura', 'get your bag right', 'touch the settings', 'do the thing', 'sort it out no cap'],
  recipient: ['the homie', 'your guy', 'the sigma', 'bro', 'bestie'],
};

const PIDGIN_VOCAB = {
  broke: [
    'sapa dey wire', 'pocket dry', 'no bar', 'cooked (sapa edition)', 'zero balance level',
    'money no dey', 'account red', 'sapa don hold me', 'no kobo for wallet'
  ],
  success: [
    'Bag don land', 'Oshey! Confirm movement', 'Better bar don enter', 'sharp cash out', 'movement don set',
    'Oga, movement confirmed', 'bag secured sharp sharp', 'money don enter vault'
  ],
  blocked: [
    'Wahala dey', 'NPC behavior', 'L + no maidens', 'comot for road', 'skill issue',
    'level no set', 'your vibe no pure', 'way blocked'
  ],
  waiting: [
    'e still dey road', 'escrow don hold am', 'chill first', 'it dey vault', 'no shake, e go land',
    'patience small', 'movement still dey queue'
  ],
  fix: [
    'go set your level', 'check your settings', 'arrange your bag', 'fix am sharp sharp', 'sort yourself out',
    'arrange your way', 'go redo am'
  ],
  recipient: [
    'my person', 'the gee', 'odogwu', 'brother mi', 'the homie',
    'the boss', 'my guy'
  ],
};

const lastPickByCategory = new Map();

let lastQuotaError = 0;
let backoffMs = 0;

export function initGemini() {
  console.log('✅ MoniBot Sigma AI initialized (VP-Social v6.0) 🗿');
}

function pick(category, isPidgin = false) {
  const pool = isPidgin ? PIDGIN_VOCAB[category] : SIGMA_VOCAB[category];
  if (!pool?.length) return '';
  if (pool.length === 1) return pool[0];

  const last = lastPickByCategory.get(category);
  let choice = pool[Math.floor(Math.random() * pool.length)];
  while (choice === last) {
    choice = pool[Math.floor(Math.random() * pool.length)];
  }

  lastPickByCategory.set(category, choice);
  return choice;
}

export function buildTxContext(tx) {
  const isPidgin = tx.language === 'pidgin' || tx.payload?.language === 'pidgin';
  const chain = tx.chain ? tx.chain.toUpperCase() : null;
  const isMagic = tx.type === 'magicpay' || tx.recipient_pay_tag?.startsWith('MagicPay:');

  const symbolMap = {
    INK: 'USDT0',
    CELO: 'USDT',
    BSC: 'USDT',
    BASE: 'USDC',
    SOLANA: 'USDC',
    TEMPO: 'aUSD'
  };

  let symbol = chain ? symbolMap[chain] || 'USDC' : 'USDC';

  const amount = tx.amount ? `$${parseFloat(tx.amount).toFixed(2)}` : null;
  const fee = tx.fee ? `$${parseFloat(tx.fee).toFixed(2)}` : null;
  const payer = tx.payer_pay_tag ? `@${tx.payer_pay_tag}` : 'blud';
  const recipient_username = tx.recipient_username || null;

  let recip = 'the recipient';
  if (tx.recipient_pay_tag) {
    if (tx.recipient_pay_tag.startsWith('MagicPay:')) {
      const val = tx.recipient_pay_tag.split(':')[1] || '';
      if (/^\d+$/.test(val)) {
        recip = recipient_username ? `MagicPay @${recipient_username}` : 'MagicPay';
      } else {
        recip = `@${val}`;
      }
    } else {
      recip = `@${tx.recipient_pay_tag}`;
    }
  }

  const isMulti = tx.type === 'p2p_multi' || tx.type === 'multi_send';
  const isGrant = tx.type === 'grant' || tx.type === 'campaign_grant';
  const shortHash = tx.tx_hash?.startsWith('0x')
    ? `${tx.tx_hash.substring(0, 18)}...`
    : null;
  const detail = tx.error_reason || null;

  const sender_source = tx.sender_source || tx.payload?.sender_source || 'profile';
  const magicpay_claim_mode = tx.magicpay_claim_mode || tx.payload?.magicpay_claim_mode || 'default';

  const isMiniPaySender = sender_source === 'wallet_profiles' || sender_source === 'wallet_profile';
  const useMiniPay = isMiniPaySender || magicpay_claim_mode.startsWith('minipay') || magicpay_claim_mode === 'mandatory';
  const platformName = useMiniPay ? 'MiniPay' : 'MoniPay';

  return {
    chain, symbol, amount, fee, payer, recip, recipient_username,
    isMagic, isMulti, isGrant, shortHash, detail, isPidgin,
    sender_source, magicpay_claim_mode, useMiniPay, platformName, isMiniPaySender
  };
}

async function callMoniBotAI(action, context) {
  const now = Date.now();
  if (backoffMs > 0 && now < lastQuotaError + backoffMs) {
    return null;
  }

  try {
    const response = await fetch(MONIBOT_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action, context }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        backoffMs = Math.min(backoffMs > 0 ? backoffMs * 2 : 60000, 300000);
        lastQuotaError = now;
      }
      return null;
    }

    const data = await response.json();
    if (data.text && !data.fallback) backoffMs = 0;
    return data.text || null;
  } catch (error) {
    console.error('  ❌ AI request failed:', error.message);
    return null;
  }
}

function getTemplateType(tx) {
  const outcome = tx.tx_hash || '';
  const status = tx.status || '';
  const type = tx.type || '';

  if (outcome === 'SPORTS_CREATE') return 'sports_create';
  if (outcome === 'SPORTS_CANCEL') return 'sports_cancel';
  if (outcome === 'SPORTS_CONDITION_CANCELLED') return 'sports_cancelled';
  if (tx.error_reason && tx.error_reason.includes('SPORTS_CONDITION_MET')) return 'sports_success';
  if (outcome === 'ERROR_SPORTS_MATCH_NOT_FOUND') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_SYNTAX') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_SELF') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_DB_FAILED') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_CANCEL_SYNTAX') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_CANCEL_NOT_FOUND') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_CANCEL_OWNER') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_CANCEL_STATE') return 'verbatim_error';
  if (outcome === 'ERROR_SPORTS_CANCEL_DB') return 'verbatim_error';

  if (outcome === 'RECURRING_CREATE') return 'recurring_create';
  if (outcome === 'RECURRING_STATUS') return 'recurring_status';
  if (outcome === 'RECURRING_CANCEL') return 'recurring_cancel';
  if (outcome === 'RECURRING_LIST') return 'recurring_list';
  if (outcome === 'ABOUT_SHOW') return 'about_show';
  if (outcome === 'COMMANDS_LIST_SHOW') return 'commands_list_show';

  if (outcome === 'SCHEDULE_CREATE') return 'schedule_create';
  if (outcome === 'BALANCE_CHECK') return 'balance_check';
  if (outcome === 'HELP_SHOW') return 'help_show';
  if (outcome === 'SETUP_SHOW') return 'setup_show';
  if (outcome === 'LINK_SHOW') return 'link_show';
  if (outcome === 'SET_CHAIN_SUCCESS') return 'set_chain_success';
  if (outcome === 'LEADERBOARD_SHOW') return 'leaderboard_show';

  if (status === 'limit_reached' || outcome === 'LIMIT_REACHED') return 'limit_reached';
  if (outcome.startsWith('0x')) {
    const isMagicPay = type === 'magicpay' || tx.recipient_pay_tag?.startsWith('MagicPay:');
    if (type === 'p2p_multi' || type === 'multi_send') return 'multi_success';
    return isMagicPay ? 'magicpay_success' : 'success';
  }
  if (outcome === 'ERROR_MAGIC_PAY_ALLOWANCE') return 'error_magicpay_allowance';
  if (outcome === 'ERROR_MAGIC_PAY_BALANCE') return 'error_magicpay_balance';
  if (outcome === 'ERROR_ALLOWANCE') return 'error_allowance';
  if (outcome === 'ERROR_BALANCE') return 'error_balance';
  if (outcome === 'ERROR_TARGET_NOT_FOUND') return 'error_target';
  if (outcome === 'ERROR_SENDER_NOT_FOUND') return 'error_sender';
  if (outcome === 'ERROR_DUPLICATE_GRANT') return 'error_duplicate_grant';
  if (outcome === 'ERROR_TREASURY_EMPTY') return 'error_treasury_empty';
  if (outcome === 'ERROR_DUPLICATE_TWEET') return 'error_duplicate_tweet';
  if (outcome === 'ERROR_MINIPAY_SENDER_CHAIN_RESTRICTION') return 'error_minipay_sender_restriction';
  if (outcome === 'ERROR_MINIPAY_RECIPIENT_CHAIN_RESTRICTION') return 'error_minipay_recipient_restriction';
  if (outcome === 'ERROR_CELO_ONLY_SENDER') return 'verbatim_error';
  if (outcome === 'ERROR_CELO_ONLY_RECIPIENT') return 'verbatim_error';
  if (outcome.includes('ERROR_REVERTED')) return 'error_reverted';
  if (outcome.includes('ERROR_BLOCKCHAIN')) return 'error_blockchain';
  if (outcome.includes('MAX_RETRIES')) return 'max_retries';
  if (outcome === 'SKIP_NO_PAYTAG') return 'skip_no_paytag';
  if (outcome === 'SKIP_CAMPAIGN_INACTIVE') return 'skip_campaign_inactive';
  if (outcome.includes('SKIP_DUPLICATE')) return 'skip_duplicate';
  if (outcome === 'SKIP_INVALID_SYNTAX') return 'skip_invalid_syntax';
  return 'default';
}

/**
 * Post-processes all replies to adhere to brainrot and rebranding rules:
 * 1. Replace links/URLs with "MoniPay app"
 * 2. Change USDC to USD
 * 3. Correct the network if it was hardcoded to Base
 * 4. Fix MagicPay handle formatting (MagicPay:123 -> MagicPay, MagicPay:user -> @user)
 */
export function postProcessBrainrot(text, ctx) {
  if (!text) return text;
  let processed = text;

  // ── Obfuscate Financial Terms (Brainrot Edition) ────────────────────────
  // X flags financial terms, so we swap them for Gen Alpha slop.
  const brainrotMap = {
    'Transfer successful': 'Bag secured',
    'transfer successful': 'bag secured',
    'Transaction complete': 'Aura proof locked',
    'Payment sent': 'Bag slid',
    'payment sent': 'bag slid',
    'Transaction hash': 'Receipt',
    'transaction hash': 'receipt',
    'Transaction': 'Movement',
    'transaction': 'movement',
    'sent from': 'slid from',
    'sent to': 'slid to',
    'sent': 'slid',
    'Sent': 'Slid',
    'slid by': 'slid from',
    'fee': 'tax',
    'Transfer complete': 'Bag secured',
    'securely': 'no cap',
    'fastest path': 'speedrun',
    'claim': 'snag',
    'Failed': 'Cooked',
    'failed': 'cooked',
    'check': 'audit',
    'settings': 'controls',
    'vault': 'stash',
    'Vault': 'Stash',
  };

  Object.entries(brainrotMap).forEach(([word, slop]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    processed = processed.replace(regex, slop);
  });

  // Replace links and common domain with dynamic app name
  processed = processed.replace(/https?:\/\/\S+/g, `${ctx.platformName} app`);
  processed = processed.replace(/monipay\.xyz/g, `${ctx.platformName} app`);

  // Correct network label and token if hardcoded to Base/USDC in the AI output
  if (ctx.chain) {
    // Replace "on Base" or "via Base" with actual chain
    processed = processed.replace(/\bon Base\b/gi, `on ${ctx.chain}`);
    processed = processed.replace(/\bvia Base\b/gi, `via ${ctx.chain}`);
    // Replace hardcoded USDC with correct symbol
    processed = processed.replace(/\bUSDC\b/g, ctx.symbol);
  } else {
    // If no chain, remove the "on Base" or "via Base" mentions to stay generic
    processed = processed.replace(/\s\bon Base\b/gi, '');
    processed = processed.replace(/\s\bvia Base\b/gi, '');
    processed = processed.replace(/\bon Base\b/gi, '');
    processed = processed.replace(/\bvia Base\b/gi, '');
  }

  // Handle MagicPay handle cleanup in the middle of sentences
  // e.g. "monitag: MagicPay:1558028737043730433" -> "monitag: MagicPay @username" (if username exists)
  // e.g. "monitag: MagicPay:jade" -> "monitag: @jade"
  processed = processed.replace(/MagicPay:([a-zA-Z0-9_]+)/g, (match, val) => {
    if (/^\d+$/.test(val)) {
      return ctx.recipient_username ? `MagicPay @${ctx.recipient_username}` : 'MagicPay';
    }
    return `@${val}`;
  });

  // Global rebranding if MiniPay context
  if (ctx.useMiniPay) {
    processed = processed.replace(/MoniPay(?!\sdot\sxyz)/gi, 'MiniPay');
  }

  return processed;
}

/**
 * Post-processes AI/Template output to replace standard terms with robust Nigerian Pidgin.
 * Only active when ctx.isPidgin is true.
 */
export function postProcessPidgin(text, ctx) {
  if (!text) return text;
  let processed = text;

  const pidginMap = {
    // Confirmation
    'Transfer successful': 'Bag don land',
    'transfer successful': 'bag don land',
    'Transaction complete': 'Movement don set',
    'Payment sent': 'Bar don slide',
    'payment sent': 'bar don slide',
    'Transfer complete': 'Bag don land',
    'Success!': 'Confirm!',
    'Success': 'Confirm',
    'confirmed': 'confirm',
    'Confirmed': 'Confirm',

    // Actions/Movement
    'Transaction': 'Movement',
    'transaction': 'movement',
    'sent from': 'don slide from',
    'sent to': 'don slide to',
    'sent': 'don move',
    'Sent': 'Don move',
    'slid from': 'don move from',
    'slid to': 'don move to',
    'slid': 'don move',
    'Slid': 'Don move',

    // Errors/Permissions
    'needs more': 'need more',
    'needs permission': 'need permission',
    'Top up at': 'Top up for',
    'Go to': 'Go for',
    'Tell \'em to get locked in': 'Tell them make they lock in',
    'Check the vault first': 'Check the vault first',
    'More drops soon': 'More drops dey come',
    'Wait a minute': 'Wait small',
    'Fix the format': 'Arrange the format',
    'The whole squad caught the bag': 'Everywhere burst, the whole squad catch the bag',
    'straight to the vault': 'sharp sharp to the vault',

    // Sigma terms that might come from AI
    'Bag secured': 'Bag don land',
    'Aura proof locked': 'Movement don set',
    'Bag slid': 'Bar don slide',
    'Receipt': 'Evidence',
    'receipt': 'evidence',
    'no cap bussin': 'sharp cash out',
    'W Aura': 'Better level',
    'certified sigma move': 'Confirm movement',
    'goated fr': 'movement don set',
    'ate and left no crumbs': 'bag don land',
    'NPC behavior': 'Wahala dey',
    'skill issue': 'Wahala dey',
    'L + no maidens': 'comot for road',
    'on ice': 'e still dey road',
    'locked in escrow': 'escrow don hold am',
    'fix your aura': 'go set your level',
    'get your bag right': 'arrange your bag',
    'the homie': 'my person',
    'your guy': 'the gee',
    'the sigma': 'odogwu',
    'securely': 'no cap',
    'fastest path': 'speedrun',
    'claim': 'snag',
  };

  // Sort keys by length descending to avoid partial matches
  const sortedKeys = Object.keys(pidginMap).sort((a, b) => b.length - a.length);

  sortedKeys.forEach((word) => {
    const pidgin = pidginMap[word];
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    processed = processed.replace(regex, pidgin);
  });

  // Replace links and common domain with dynamic app name
  processed = processed.replace(/https?:\/\/\S+/g, `${ctx.platformName} app`);
  processed = processed.replace(/monipay\.xyz/g, `${ctx.platformName} app`);

  // Correct network label and token if hardcoded to Base/USDC in the AI output
  if (ctx.chain) {
    processed = processed.replace(/\bon Base\b/gi, `on ${ctx.chain}`);
    processed = processed.replace(/\bvia Base\b/gi, `via ${ctx.chain}`);
    processed = processed.replace(/\bUSDC\b/g, ctx.symbol);
  } else {
    processed = processed.replace(/\s\bon Base\b/gi, '');
    processed = processed.replace(/\s\bvia Base\b/gi, '');
    processed = processed.replace(/\bon Base\b/gi, '');
    processed = processed.replace(/\bvia Base\b/gi, '');
  }

  processed = processed.replace(/MagicPay:([a-zA-Z0-9_]+)/g, (match, val) => {
    if (/^\d+$/.test(val)) {
      return ctx.recipient_username ? `MagicPay @${ctx.recipient_username}` : 'MagicPay';
    }
    return `@${val}`;
  });

  // Global rebranding if MiniPay context
  if (ctx.useMiniPay) {
    processed = processed.replace(/MoniPay(?!\sdot\sxyz)/gi, 'MiniPay');
  }

  return processed;
}

function formatInterval(intervalMs) {
  const seconds = intervalMs / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const weeks = days / 7;
  
  if (weeks >= 1 && weeks % 1 === 0) return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  if (days >= 1 && days % 1 === 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hours >= 1 && hours % 1 === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes >= 1 && minutes % 1 === 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

function buildSpecificReply(templateType, ctx, tx) {
  const chainName = ctx.chain || '';
  const isPidgin = ctx.isPidgin;
  const onChain = chainName ? ` on ${chainName}` : '';
  const toChain = chainName ? ` to ${chainName}` : '';

  const pk = (cat) => pick(cat, isPidgin);

  switch (templateType) {
    case 'sports_create': {
      try {
        const meta = JSON.parse(ctx.detail);
        return `⚽ World Cup Conditional Sport P2P Locked In! Sliding $${meta.amount.toFixed(2)} to @${meta.targetTag} on ${meta.chain.toUpperCase()} if ${meta.condDesc} (ID: ${meta.jobId.slice(0, 8)})${meta.balanceWarning || ''}. We cookin' fr fr! 🗿`;
      } catch (e) {
        return `⚽ World Cup Conditional Sport P2P Locked In! Check your MoniPay dashboard for details. Sigma oracle locked! 🗿`;
      }
    }

    case 'sports_cancel': {
      try {
        const meta = JSON.parse(ctx.detail);
        return `🛑 Conditional Sport P2P (ID: ${meta.jobId.slice(0, 8)}) is cancelled. No payment will go through, no cap 🧢`;
      } catch (e) {
        return `🛑 Conditional Sport P2P cancelled, no cap 🧢`;
      }
    }

    case 'sports_cancelled': {
      try {
        const meta = JSON.parse(ctx.detail);
        const resultPart = meta.result ? ` finished ${meta.result}` : '';
        const condPart = meta.conditionNeeded ? ` (if ${meta.conditionNeeded})` : '';
        return `Match settled: ${meta.match}${resultPart}. Your condition${condPart} failed, so Conditional Sport P2P is cancelled and no funds were slid. L + ratio 🗿`;
      } catch (e) {
        return `Condition failed. Conditional Sport P2P cancelled, no funds slid. L + ratio 🗿`;
      }
    }

    case 'sports_success': {
      try {
        const meta = JSON.parse(ctx.detail);
        const resultPart = meta.result ? ` finished ${meta.result}` : '';
        if (ctx.isMagic) {
          const targetUser = ctx.recipient_username ? `@${ctx.recipient_username}` : ctx.recip;
          if (ctx.chain === 'CELO') {
            if (isPidgin) {
              return `🏆 W Aura! Match don settle: ${meta.match}${resultPart}. Condition meet! ${targetUser} get ${ctx.amount} ${ctx.symbol} MagicPay wey park for shadow realm on Celo! 🗿\n\nTo claim:\n• Download MiniPay app, open MoniPay miniapp beta via monipay.xyz/minipay & link your X account. Certified sigma move! 🗿`;
            }
            return `🏆 W Aura! Match settled: ${meta.match}${resultPart}. Condition met! ${targetUser} has ${ctx.amount} ${ctx.symbol} MagicPay parked in the shadow realm on Celo! 🗿\n\nTo claim:\n• Download MiniPay app, access MoniPay miniapp beta via monipay.xyz/minipay and link your X account. Certified sigma move! 🗿`;
          } else {
            const chainDisplay = ctx.chain || 'Base';
            if (isPidgin) {
              return `🏆 W Aura! Match don settle: ${meta.match}${resultPart}. Condition meet! ${targetUser} get ${ctx.amount} ${ctx.symbol} MagicPay wey park for shadow realm on ${chainDisplay}! 🗿\n\nTo claim:\n• Connect/create wallet for monipay.xyz and link your X account to claim. Certified sigma move! 🗿`;
            }
            return `🏆 W Aura! Match settled: ${meta.match}${resultPart}. Condition met! ${targetUser} has ${ctx.amount} ${ctx.symbol} MagicPay parked in the shadow realm on ${chainDisplay}! 🗿\n\nTo claim:\n• Create or connect a wallet at monipay.xyz and link your X account to claim. Certified sigma move! 🗿`;
          }
        }
        return `🏆 W Aura! Match settled: ${meta.match}${resultPart}. Condition met! Sliding ${ctx.amount} ${ctx.symbol} to ${ctx.recip} on ${ctx.chain}. Certified sigma move! 🗿`;
      } catch (e) {
        if (ctx.isMagic) {
          const targetUser = ctx.recipient_username ? `@${ctx.recipient_username}` : ctx.recip;
          const chainDisplay = ctx.chain || 'Base';
          if (ctx.chain === 'CELO') {
            return `🏆 W Aura! Condition met! ${targetUser} has ${ctx.amount || 'the bag'} MagicPay parked in the shadow realm on Celo! 🗿\n\nTo claim:\n• Download MiniPay app, access MoniPay miniapp beta via monipay.xyz/minipay and link your X account. Certified sigma move! 🗿`;
          }
          return `🏆 W Aura! Condition met! ${targetUser} has ${ctx.amount || 'the bag'} MagicPay parked in the shadow realm on ${chainDisplay}! 🗿\n\nTo claim:\n• Connect/create a wallet at monipay.xyz and link your X account to claim. Certified sigma move! 🗿`;
        }
        return `🏆 W Aura! Condition met. Funds sent to recipient. Certified sigma move! 🗿`;
      }
    }

    case 'recurring_create': {
      try {
        const meta = JSON.parse(ctx.detail);
        const intervalStr = formatInterval(meta.intervalMs);
        const total = meta.amount * meta.count;
        const recLabel = meta.isMagicPay ? `MagicPay @${meta.targetTag}` : `@${meta.targetTag}`;
        return `⏰ Recurring Payment Scheduled! 🔄\n\nID: ${meta.seriesId.slice(0, 8)}\n💰 Amount: $${meta.amount.toFixed(2)} each\n🔄 Interval: Every ${intervalStr}\n🔢 Count: ${meta.count}\n👥 Recipient: ${recLabel}\n⛓️ Chain: ${meta.chain.toUpperCase()}\n💵 Total: $${total.toFixed(2)}${meta.balanceWarning || ''}\n\nSigma energy activated 🗿`;
      } catch (e) {
        return `⏰ Recurring Payment Scheduled! 🔄\n\nCheck your MoniPay dashboard for details. Sigma activated 🗿`;
      }
    }

    case 'schedule_create': {
      try {
        const meta = JSON.parse(ctx.detail);
        const recLabel = meta.isMagicPay ? `MagicPay @${meta.targetTag}` : `@${meta.targetTag}`;
        return `⏰ Payment Scheduled, no cap! 🔄\n\nID: ${meta.seriesId.slice(0, 8)}\n💰 Amount: $${meta.amount.toFixed(2)}\n👥 Recipient: ${recLabel}\n⏳ Target: ${meta.timeDesc}\n⛓️ Chain: ${meta.chain.toUpperCase()}${meta.balanceWarning || ''}\n\nSigma scheduler locked in 🗿`;
      } catch (e) {
        return `⏰ Payment Scheduled, no cap! 🔄\n\nCheck your MoniPay dashboard for details. Sigma locked in 🗿`;
      }
    }

    case 'help_show': {
      if (isPidgin) {
        return `🗿 MoniBot: The Most Sigma Payment AI on X 📈\n\nMonipay na AI-powered social payments layer wey dey allow you run financial intents directly inside social conversations for X, and this Monibot AI agent na Monipay dey power am.\n\nCheatsheet:\n• Slide cash: @monibot send $5 to @username\n• AutoPay: send $5 to @username every day 7 times\n• Schedule: send $5 to @username in 10 minutes\n• Aura check: @monibot balance\n• Link: @monibot link\n• About MoniBot: @monibot about\n• Command list: @monibot command list\n• Leaderboard: @monibot leaderboard\n\nStop being an NPC, full guide for monipay.xyz ⚡`;
      }
      return `🗿 MoniBot: The Most Sigma Payment AI on X 📈\n\nMonipay is an AI-powered social payments layer that enables financial intents to be executed directly inside social conversations on X, and the Monibot AI agent is powered by Monipay.\n\nCheatsheet:\n• Slide cash: @monibot send $5 to @username\n• AutoPay: send $5 to @username every day 7 times\n• Schedule: send $5 to @username in 10 minutes\n• Aura check: @monibot balance\n• Link: @monibot link\n• About MoniBot: @monibot about\n• Command list: @monibot command list\n• Leaderboard: @monibot leaderboard\n\nStop being an NPC, full guide at monipay.xyz ⚡`;
    }

    case 'about_show': {
      if (isPidgin) {
        return `🤖 About MoniBot & MoniPay:\n\nMonipay na AI-powered social payments layer wey dey allow you run financial intents directly inside social conversations for X, and this Monibot AI agent na Monipay dey power am.\n\nBeta Features:\n• Gasless P2P, Escrow, and Recurring payments\n• Supported chains: Base (USDC), Celo (USDT), BSC (USDT), Ink (USDT0), Solana (USDC), and Tempo (aUSD)\n• Escrow & MagicPay support for people wey no get wallet\n• Non-custodial & trustless level\n\nGo set your level for monipay.xyz, no cap! 🗿`;
      }
      return `🤖 About MoniBot & MoniPay:\n\nMonipay is an AI-powered social payments layer that enables financial intents to be executed directly inside social conversations on X, and the Monibot AI agent is powered by Monipay.\n\nFeatures:\n• Gasless P2P, Escrow, and Recurring payments\n• Supported chains: Base (USDC), Celo (USDT), BSC (USDT), Ink (USDT0), Solana (USDC), and Tempo (aUSD)\n• Escrow & MagicPay support for users without wallets\n• Fully non-custodial and trustless\n\nGet locked in, stop being cooked! 🗿`;
    }

    case 'commands_list_show': {
      if (isPidgin) {
        return `📜 MoniBot Complete Command Guide & Reference (Pidgin Edition) 📜\n\nMonipay na AI-powered social payments layer wey dey allow you run financial intents directly inside social conversations for X, and this Monibot AI agent na Monipay dey power am.\n\nSee all commands wey you fit run:\n\n1️⃣ P2P Payments & Tips:\n• Format: @monibot send [amount] to @[username] [on chain]\n• Example: @monibot send $5 to @alice\n• Example: @monibot slide $2.5 USDC to @bob on base\n• Slang: slide, bless, give, pay, transfer, dash\n\n2️⃣ Scheduled Payments:\n• Format: @monibot send [amount] to @[username] in [time]\n• Example: @monibot send $10 to @alice in 10 minutes\n• Example: @monibot slide $5 to @bob in 2 hours on celo\n\n3️⃣ Recurring Payments (AutoPay):\n• Format: @monibot send [amount] to @[username] every [interval] [count] times\n• Example: @monibot send $5 to @alice every day 7 times\n• Example: @monibot pay $20 to @bob every week 4 times\n\n4️⃣ Series/Recurring Management:\n• Check active: @monibot active series\n• Check status: @monibot series status [series_id]\n• Cancel: @monibot cancel series [series_id]\n\n5️⃣ World Cup Sports Conditional P2P:\n• Format: @monibot send [amount] to @[username] if [team/condition] wins [on chain]\n• Example: @monibot send $5 to @alice if argentina wins\n• Example: @monibot tip $10 to @bob if chelsea beats arsenal\n• Cancel: @monibot cancel sport [job_id]\n\n6️⃣ Account & Settings:\n• Link X: @monibot link\n• Setup: @monibot setup\n• Balance: @monibot balance\n• Preferred chain: @monibot set chain [chain_name] (e.g. base, celo, bsc, ink, solana, tempo)\n• Leaderboard: @monibot leaderboard\n• Help: @monibot help\n• Info: @monibot about\n\nGo set your level for monipay.xyz, no cap! 🗿`;
      }
      return `📜 MoniBot Complete Command Guide & Reference 📜\n\nMonipay is an AI-powered social payments layer that enables financial intents to be executed directly inside social conversations on X, and the Monibot AI agent is powered by Monipay.\n\nHere are all the commands you can run:\n\n1️⃣ P2P Payments & Tips:\n• Format: @monibot send [amount] to @[username] [on chain]\n• Example: @monibot send $5 to @alice\n• Example: @monibot tip 2.5 USDC to @bob on base\n• Slang: slide, bless, give, pay, transfer\n\n2️⃣ Scheduled Payments:\n• Format: @monibot send [amount] to @[username] in [time]\n• Example: @monibot send $10 to @alice in 10 minutes\n• Example: @monibot slide $5 to @bob in 2 hours on celo\n\n3️⃣ Recurring Payments (AutoPay):\n• Format: @monibot send [amount] to @[username] every [interval] [count] times\n• Example: @monibot send $5 to @alice every day 7 times\n• Example: @monibot pay $20 to @bob every week 4 times\n\n4️⃣ Series/Recurring Management:\n• Check active: @monibot active series\n• Check status: @monibot series status [series_id]\n• Cancel: @monibot cancel series [series_id]\n\n5️⃣ World Cup Sports Conditional P2P:\n• Format: @monibot send [amount] to @[username] if [team/condition] wins [on chain]\n• Example: @monibot send $5 to @alice if argentina wins\n• Example: @monibot tip $10 to @bob if chelsea beats arsenal\n• Cancel: @monibot cancel sport [job_id]\n\n6️⃣ Account & Settings:\n• Link X: @monibot link\n• Setup: @monibot setup\n• Balance: @monibot balance\n• Preferred chain: @monibot set chain [chain_name] (e.g. base, celo, bsc, ink, solana, tempo)\n• Leaderboard: @monibot leaderboard\n• Help: @monibot help\n• Info: @monibot about\n\nGet locked in and stop being an NPC! 🗿`;
    }

    case 'setup_show': {
      return `📖 How to get W Aura (Setup Guide) fr fr:\n\n1. Visit monipay.xyz & snag your unique MoniTag\n2. Link X in Settings > MoniBot AI\n3. Fund wallet (USDC/USDT)\n4. Click 'Set Allowance' so bot can slide funds\n\nGet locked in, stop being cooked! 🗿`;
    }

    case 'link_show': {
      try {
        const meta = JSON.parse(ctx.detail);
        if (meta.linked) {
          return `You're already goated fr! Linked to monitag @${meta.payTag} 🫡`;
        }
        return `🔗 Link Your MoniPay Account, no cap:\n\n1. Go to monipay.xyz\n2. Settings > MoniBot AI\n3. Click 'Link X' and authorize\n\nOne-time setup, then slide funds instantly! 🗿`;
      } catch (e) {
        return `🔗 Link Your MoniPay Account:\n\nGo to Settings > MoniBot AI on monipay.xyz to connect your X account. 🗿`;
      }
    }

    case 'set_chain_success': {
      return `⛓️ Chain Preference Updated, W Aura! 📈\n\nYour preferred network is now set to ${chainName || ctx.detail || 'Base'} fr. No cap! 🗿`;
    }

    case 'leaderboard_show': {
      try {
        const meta = JSON.parse(ctx.detail);
        if (!meta.topSigmas || meta.topSigmas.length === 0) {
          return `🏆 X Aura Leaderboard is empty. Start sliding guap to claim your spot as the Top G! 💸`;
        }
        let listStr = '';
        meta.topSigmas.forEach((entry, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
          listStr += `${medal} @${entry.tag}: $${entry.volume.toFixed(2)}\n`;
        });
        return `🏆 X Aura Leaderboard (Top Volume) 📈\n\n${listStr}\nCertified Sigma Moves only! 🗿`;
      } catch (e) {
        return `🏆 X Aura Leaderboard\n\nCheck your MoniPay dashboard for top contributors.`;
      }
    }

    case 'recurring_status': {
      try {
        const progress = JSON.parse(ctx.detail);
        const total = progress.total || (progress.completed + progress.pending + progress.failed);
        const completed = progress.completed;
        const failed = progress.failed;
        const pending = progress.pending;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const barCount = Math.round(percent / 10);
        const progressBar = '█'.repeat(barCount) + '░'.repeat(10 - barCount);
        return `📊 Series Progress Update\n\nID: ${progress.seriesId.slice(0, 8)}\n${progressBar} *${percent}%*\n✅ Completed: ${completed}/${total}\n⏳ Pending: ${pending}\n❌ Failed: ${failed}\n\nStill cooking 🔥`;
      } catch (e) {
        return `📊 Series Progress Update\n\nCheck your MoniPay dashboard for progress. Still cooking 🔥`;
      }
    }

    case 'recurring_cancel': {
      try {
        const meta = JSON.parse(ctx.detail);
        return `🛑 Series Cancelled!\n\nStopped ${meta.cancelledCount} pending payments for series ${meta.seriesId.slice(0, 8)}, no cap 🧢`;
      } catch (e) {
        return `🛑 Series Cancelled!\n\nPending payments stopped, no cap 🧢`;
      }
    }

    case 'recurring_list': {
      try {
        const meta = JSON.parse(ctx.detail);
        if (!meta.list || meta.list.length === 0) {
          return `Your Active Series 📊\n\nNo active series found. Use @monibot send $5 to @username every day 7 times to start!`;
        }
        let listStr = '';
        meta.list.forEach((s, idx) => {
          listStr += `${idx + 1}. ${s.seriesId.slice(0, 8)}: ${s.completed}/${s.total} to @${s.target}\n`;
        });
        return `Your Active Series 📊\n\n${listStr}\nUse @monibot series status <id> to check!`;
      } catch (e) {
        return `Your Active Series 📊\n\nCheck your MoniPay dashboard for list of active series.`;
      }
    }

    case 'balance_check': {
      const balVal = (tx && tx.amount !== undefined && tx.amount !== null) ? parseFloat(tx.amount).toFixed(2) : '0.00';
      if (isPidgin) {
        return `💳 Balance Check: You get $${balVal} ${ctx.symbol} for ${ctx.chain || 'Base'}, no cap. Your bag set! 🗿`;
      }
      return `💳 Balance Check: You have $${balVal} ${ctx.symbol} on ${ctx.chain || 'Base'}, no cap. Keep stacking! 🗿`;
    }

    case 'verbatim_error':
      return ctx.detail || `Movement failed. Check your ${ctx.platformName} app settings. 💀`;

    case 'error_balance':
      if (ctx.useMiniPay) {
        return `💀 Insufficient funds on Celo.\n\nYou have: ${ctx.detail || 'less than needed'}\n\nTop up your MiniPay wallet, then retry. 🗿`;
      }
      if (isPidgin) return `${pk('broke')}. ${ctx.detail || `${ctx.amount || 'That movement'} need more ${ctx.symbol}${onChain}.`}\n\nTop up for ${ctx.platformName} app then ${pk('fix')}. 💀`;
      return `${pk('broke')}. ${ctx.detail || `${ctx.amount || 'That movement'} needs more ${ctx.symbol}${onChain}.`}\n\nTop up at ${ctx.platformName} app then ${pk('fix')}. 💀`;

    case 'error_allowance':
      if (ctx.useMiniPay) {
        return `📉 Allowance too low on Celo.\n\nFix this:\n1. Open MiniPay app\n2. Go to Monipay miniapp\n3. Tap "Approve Spending Allowance"`;
      }
      if (isPidgin) return `${pk('blocked')}. ${ctx.detail || `MoniBot need more permission to slide ${ctx.amount || 'that bag'} ${ctx.symbol}${onChain}.`}\n\nGo for Settings > MoniBot > Set Permission and ${pk('fix')}. 📉`;
      return `${pk('blocked')}. ${ctx.detail || `MoniBot needs more permission to slide ${ctx.amount || 'that bag'} ${ctx.symbol}${onChain}.`}\n\nGo to Settings > MoniBot > Set Permission and ${pk('fix')}. 📉`;

    case 'error_magicpay_allowance':
      if (ctx.useMiniPay) {
        return `🪄 MagicPay needs approval for ${ctx.amount || 'the movement'} on Celo.\n\nFix this:\n1. Open MiniPay app\n2. Go to Monipay miniapp\n3. Tap "Approve Spending Allowance"\n4. Set MagicPay allowance`;
      }
      if (isPidgin) return `${pk('blocked')}. ${ctx.detail || `MagicPay need permission for ${ctx.amount || 'that escrow'} ${ctx.symbol}${onChain}.`}\n\nOpen Settings > MoniBot > Set Permission > MagicPay and ${pk('fix')}. 🪄`;
      return `${pk('blocked')}. ${ctx.detail || `MagicPay needs permission for ${ctx.amount || 'that escrow'} ${ctx.symbol}${onChain}.`}\n\nOpen Settings > MoniBot > Set Permission > MagicPay and ${pk('fix')}. 🪄`;

    case 'error_minipay_sender_restriction':
      return `❌ MiniPay wallets can only send on Celo. 🗿\n\nRetry your command with "on celo":\n@monibot send ${ctx.amount || '$5'} to ${ctx.recip} on celo`;

    case 'error_minipay_recipient_restriction':
      return `❌ ${ctx.recip} is a MiniPay user — they only receive on Celo. 🗿\n\nRetry your command with "on celo":\n@monibot send ${ctx.amount || '$5'} to ${ctx.recip} on celo`;

    case 'error_magicpay_balance':
      if (isPidgin) return `${pk('broke')}. ${ctx.detail || `Need more ${ctx.symbol}${onChain} to fund that MagicPay escrow.`}\n\nTop up your vault, then ${pk('fix')}. 💀`;
      return `${pk('broke')}. ${ctx.detail || `Need more ${ctx.symbol}${onChain} to fund that MagicPay escrow.`}\n\nTop up your vault, then ${pk('fix')}. 💀`;

    case 'error_target':
      if (isPidgin) return `${ctx.recip} dey ${pk('blocked')}. ${ctx.detail || `${ctx.recip} is built different (no vault) or no fit snag bags${onChain} yet.`}\n\nTell them make they lock in for ${ctx.platformName} app so you fit ${pk('fix')}. 🤡`;
      return `${ctx.recip} is ${pk('blocked')}. ${ctx.detail || `${ctx.recip} is built different (no vault) or can't snag bags${onChain} yet.`}\n\nTell 'em to get locked in at ${ctx.platformName} app so you can ${pk('fix')}. 🤡`;

    case 'error_sender':
      if (isPidgin) return `${pk('blocked')}. ${ctx.detail || `You need vault to slide ${ctx.amount || 'funds'}${onChain}.`}\n\nGet locked in for ${ctx.platformName} app and ${pk('fix')}. 🤖`;
      return `${pk('blocked')}. ${ctx.detail || `You need a vault to slide ${ctx.amount || 'funds'}${onChain}.`}\n\nGet locked in at ${ctx.platformName} app and ${pk('fix')}. 🤖`;

    case 'error_duplicate_grant':
      if (isPidgin) return `${pk('success')} already land. ${ctx.detail || `${ctx.recip} already snag this ${ctx.isGrant ? 'drop' : 'bag'}.`}\n\nCheck the vault first. 🤫`;
      return `${pk('success')} already landed. ${ctx.detail || `${ctx.recip} already snagged this ${ctx.isGrant ? 'drop' : 'bag'}.`}\n\nCheck the vault first. 🤫`;

    case 'error_treasury_empty':
      if (isPidgin) return `Campaign don ${pk('broke')}. ${ctx.detail || `${ctx.amount || 'This drop'} ${ctx.symbol} don finish${onChain}.`}\n\nMore drops dey come, stay locked in. ⏳`;
      return `Campaign is ${pk('broke')}. ${ctx.detail || `${ctx.amount || 'This drop'} ${ctx.symbol} ran out${onChain}.`}\n\nMore drops soon, stay locked in. ⏳`;

    case 'error_duplicate_tweet':
      if (isPidgin) return `${pk('blocked')}. This tweet already trigger movement${onChain}. Send fresh command to slide again. 🗿`;
      return `${pk('blocked')}. This tweet already triggered a movement${onChain}. Send a fresh command to slide again. 🗿`;

    case 'error_reverted':
      if (isPidgin) return `${pk('blocked')}. The movement fail${onChain}.${ctx.shortHash ? ` Evidence: ${ctx.shortHash}` : ''}\n\nCheck vault plus permission, then ${pk('fix')}. 📉`;
      return `${pk('blocked')}. The movement failed${onChain}.${ctx.shortHash ? ` Receipt: ${ctx.shortHash}` : ''}\n\nCheck vault plus permission, then ${pk('fix')}. 📉`;

    case 'error_blockchain':
      if (isPidgin) return `The chain dey ${pk('blocked')} now. ${ctx.detail || `Temporary ${chainName || 'network'} RPC issue while moving ${ctx.symbol}.`}\n\nWait small and ${pk('fix')}. 🔁`;
      return `The chain is ${pk('blocked')} right now. ${ctx.detail || `Temporary ${chainName || 'network'} RPC issue while moving ${ctx.symbol}.`}\n\nWait a minute and ${pk('fix')}. 🔁`;

    case 'skip_no_paytag':
      if (isPidgin) return `No tag = no bag. Drop your ${ctx.platformName} tag so ${pk('recipient')} fit route the ${ctx.isGrant ? 'drop' : 'bag'}${onChain}. 🤫`;
      return `No tag = no bag. Drop your ${ctx.platformName} tag so ${pk('recipient')} can route the ${ctx.isGrant ? 'drop' : 'bag'}${onChain}. 🤫`;

    case 'skip_campaign_inactive':
      if (isPidgin) return `This drop don ${pk('waiting')} no more. ${ctx.detail || 'That drop don end.'}\n\nCatch the next one. 💀`;
      return `This drop is ${pk('waiting')} no more. ${ctx.detail || 'That drop already ended.'}\n\nCatch the next one. 💀`;

    case 'skip_duplicate':
      if (isPidgin) return `${pk('success')} already land. ${ctx.detail || `${ctx.recip} already dey inside ledger${onChain}.`}\n\nCheck the vault before you retry. 🗿`;
      return `${pk('success')} already landed. ${ctx.detail || `${ctx.recip} is already in the ledger${onChain}.`}\n\nCheck the vault before retrying. 🗿`;

    case 'skip_invalid_syntax':
      if (isPidgin) return `That command dey ${pk('blocked')}. Use: @monibot send $5 to @alice\n\nArrange the format and ${pk('fix')}. 🤡`;
      return `That command is ${pk('blocked')}. Use: @monibot send $5 to @alice\n\nFix the format and ${pk('fix')}. 🤡`;

    case 'limit_reached':
      if (isPidgin) return `${ctx.recip} reach there after the bag don ${pk('waiting')}. ${ctx.detail || `${ctx.amount || 'That'} ${ctx.symbol} campaign full before your reply land.`}\n\nStay locked in for the next drop. ⏳`;
      return `${ctx.recip} got there after the bag was ${pk('waiting')}. ${ctx.detail || `${ctx.amount || 'That'} ${ctx.symbol} campaign filled before your reply landed.`}\n\nStay locked in for the next drop. ⏳`;

    case 'max_retries':
      if (isPidgin) return `This one don ${pk('broke')} after many tries. Check your ${ctx.platformName} vault, then retry manually and ${pk('fix')}. 💀`;
      return `This one is ${pk('broke')} after multiple tries. Check your ${ctx.platformName} vault, then retry manually and ${pk('fix')}. 💀`;

    case 'magicpay_success': {
      if (ctx.useMiniPay && ctx.chain === 'CELO') {
        if (isPidgin) {
          return `🪄 MiniPay Magic! ${ctx.recip} your bag don land for Celo. 🗿\n\nTo snag:\n1. Install MiniPay app\n2. Open Monipay mini-app\n3. Link this X account\n4. Claim your bag securely`;
        }
        return `🪄 MiniPay Magic! Sent ${ctx.amount || 'the bag'} ${ctx.symbol} to ${ctx.recip} on Celo. 🗿\n\nHow to claim:\n1. Install MiniPay app\n2. Open Monipay miniapp\n3. Link this X account\n4. Claim your bag securely`;
      }
      let claimNote = '';
      if (ctx.magicpay_claim_mode === 'minipay_mandatory') {
        if (isPidgin) {
          claimNote = `To snag: install MiniPay app, open the ${ctx.platformName} mini-app, link your X, and claim securely. Ensure say your vault dey${onChain}.`;
        } else {
          claimNote = `@${ctx.recipient_username || 'recipient'} install MiniPay app, open the ${ctx.platformName} mini-app, link your X, and claim securely.`;
        }
      } else if (ctx.magicpay_claim_mode === 'minipay_optional') {
        if (isPidgin) {
          claimNote = `To snag: link your X at monipay dot xyz to claim — or open the ${ctx.platformName} mini-app inside MiniPay for the fastest path. Ensure say your vault dey${onChain}.`;
        } else {
          claimNote = `@${ctx.recipient_username || 'recipient'} link your X at monipay dot xyz to claim — or open the ${ctx.platformName} mini-app inside MiniPay for the fastest path.`;
        }
      } else {
        if (ctx.chain === 'CELO') {
          if (isPidgin) {
            claimNote = `To snag: link X for monipay dot xyz -> Settings -> Link X. OR use MiniPay app -> Monipay miniapp. Ensure say your vault dey${onChain}.`;
          } else {
            claimNote = `They can claim by:\n• Linking at monipay dot xyz → Settings → MoniBot → Link X\n• OR via MiniPay app → Monipay miniapp → Link X`;
          }
        } else {
          if (isPidgin) {
            claimNote = `To snag: Link X for ${ctx.platformName} app -> Settings -> Link X. Ensure say your vault dey${onChain}.`;
          } else {
            claimNote = `To snag: Link X at ${ctx.platformName} app -> Settings -> Link X. Make sure your vault is${onChain}.`;
          }
        }
      }

      if (isPidgin) {
        return `${ctx.recip} your bag dey ${pk('waiting')} 🪄\n${ctx.amount || 'Bag of'} ${ctx.symbol} dey for vault${onChain}.\n\n${claimNote}`;
      }
      if (ctx.chain === 'CELO' && !ctx.useMiniPay) {
        return `🪄 MagicPay on Celo! Sent ${ctx.amount || 'the bag'} ${ctx.symbol} to ${ctx.recip}. 🎩\n\n${claimNote}`;
      }
      return `${ctx.recip} your bag is ${pk('waiting')} 🪄\n${ctx.amount || 'A bag of'} ${ctx.symbol} is parked in the vault${onChain}.\n\n${claimNote}`;
    }

    case 'multi_success':
      if (isPidgin) return `${pk('success')}. Everywhere burst, the whole squad snag the bag${onChain}. ${ctx.amount || 'Funds'} ${ctx.symbol} slide cleanly. 🗿`;
      return `${pk('success')}. The whole squad snagged the bag${onChain}. ${ctx.amount || 'Funds'} ${ctx.symbol} slid cleanly. 🗿`;

    case 'success':
      if (ctx.isGrant) {
        if (isPidgin) return `${pk('success')}. ${ctx.recip} just snag campaign bag${onChain}. 🗿`;
        return `${pk('success')}. ${ctx.recip} just snagged a campaign bag${onChain}. 🗿`;
      }
      if (ctx.detail && ctx.detail.toLowerCase().includes('reroute')) {
        const parts = ctx.detail.split(':');
        const fromChain = parts[1] ? parts[1].toUpperCase() : '';
        const fromChainLabel = fromChain ? ` from ${fromChain}` : '';
        if (isPidgin) return `${pk('success')}. No cap, we had to reroute that bag${fromChainLabel}${toChain}, but ${ctx.recip} still get paid. Sharp sharp to the vault. 🗿`;
        return `${pk('success')}. No cap, we had to reroute that bag${fromChainLabel}${toChain}, but ${ctx.recip} still got paid. Straight to the vault. 🗿`;
      }
      if (isPidgin) return `${pk('success')}. ${ctx.recip} snag the bag${onChain}, sharp sharp to the vault. 🗿`;
      return `${pk('success')}. ${ctx.recip} snagged the bag${onChain}, straight to the vault. 🗿`;

    default:
      if (isPidgin) return `${pk('recipient')} suppose check ${ctx.platformName} for the ${ctx.symbol} info${onChain}. 🗿`;
      return `${pk('recipient')} should check ${ctx.platformName} for the ${ctx.symbol} info${onChain}. 🗿`;
  }
}

export async function generateReplyWithBackoff(tx) {
  const templateType = getTemplateType(tx);
  const txHash = tx.tx_hash || '';
  const ctx = buildTxContext(tx);

  let replyText;

  // ── Post-processing Selection ───────────────────────────────────────────
  // Informational/reference templates are pre-written verbatim and must NOT
  // be run through postProcessBrainrot/Pidgin — those replacements corrupt
  // command names (e.g. "claim"->"snag", "check"->"audit", "settings"->"controls").
  // Only apply brainrot/pidgin post-processing to transaction replies.
  const SKIP_POSTPROCESS = new Set([
    'commands_list_show', 'about_show', 'help_show', 'setup_show', 'link_show',
    'set_chain_success', 'leaderboard_show',
    'recurring_create', 'recurring_status', 'recurring_cancel', 'recurring_list',
    'schedule_create', 'balance_check',
    'sports_create', 'sports_cancel', 'sports_cancelled', 'sports_success',
  ]);

  const wrapWithFormatting = (text) => {
    if (SKIP_POSTPROCESS.has(templateType)) return text; // keep verbatim
    if (ctx.isPidgin) return postProcessPidgin(text, ctx);
    return postProcessBrainrot(text, ctx);
  };

  try {
    replyText = buildSpecificReply(templateType, ctx, tx);
  } catch (err) {
    console.error(`⚠️ buildSpecificReply failed for ${templateType}:`, err.message);
  }

  // Backup flow: If building the specific reply failed, or if we have an unmapped/default template,
  // we use callMoniBotAI as a backup (only for success/magicpay_success or chat commands where AI is needed).
  const isDefaultOrFailed = !replyText || templateType === 'default';
  const canUseAI = templateType === 'success' || templateType === 'magicpay_success' || templateType === 'chat' || templateType === 'default';

  if (isDefaultOrFailed && canUseAI) {
    try {
      console.log(`  🌐 Invoking AI reply generator as backup for: ${templateType}`);
      const aiResult = await callMoniBotAI('generate-reply', {
        ...tx,
        ...ctx,
        isMiniPaySender: ctx.useMiniPay,
        recipient_tag: tx.recipient_pay_tag || 'unknown',
        recipient_username: tx.recipient_username || null,
        payer_tag: tx.payer_pay_tag || 'MoniBot',
        persona: 'gen_alpha_sigma',
        language: ctx.isPidgin ? 'pidgin' : 'english',
        token: ctx.symbol,
        template_type: templateType,
      });
      if (aiResult) replyText = aiResult;
    } catch (aiErr) {
      console.error('  ❌ Backup AI reply generation failed:', aiErr.message);
    }
  }

  // Ensure claim instructions are appended for MagicPay if not already present
  if (replyText && templateType === 'magicpay_success' && !replyText.includes(`${ctx.platformName} app`) && !replyText.includes('MiniPay')) {
    let claimNote = '';
    const onChain = ctx.chain ? ` on ${ctx.chain}` : '';

    if (ctx.magicpay_claim_mode === 'minipay_mandatory' || ctx.magicpay_claim_mode === 'mandatory') {
      if (ctx.isPidgin) {
        claimNote = `\n\nTo snag: install MiniPay app, open the ${ctx.platformName} mini-app, link your X, and claim securely. Ensure say your vault dey${onChain}.`;
      } else {
        claimNote = `\n\nHow to claim:\n1. Install MiniPay app\n2. Open ${ctx.platformName} miniapp\n3. Link this X account\n4. Claim your bag securely`;
      }
    } else if (ctx.magicpay_claim_mode === 'minipay_optional') {
      if (ctx.isPidgin) {
        claimNote = `\n\nTo snag: link your X at monipay dot xyz to claim — or open the ${ctx.platformName} mini-app inside MiniPay for the fastest path. Ensure say your vault dey${onChain}.`;
      } else {
        claimNote = `\n\n@${ctx.recipient_username || 'recipient'} link your X at monipay dot xyz to claim — or open the ${ctx.platformName} mini-app inside MiniPay for the fastest path.`;
      }
    } else {
      if (ctx.isPidgin) {
        claimNote = `\n\nTo snag: Link X for ${ctx.platformName} app -> Settings -> Link X. Ensure say your vault dey${onChain}.`;
      } else {
        claimNote = `\n\nTo snag: Link X at ${ctx.platformName} app -> Settings -> Link X. Make sure your vault is${onChain}.`;
      }
    }
    replyText += claimNote;
  }

  replyText = wrapWithFormatting(replyText);

  if (txHash.startsWith('0x')) {
    const chainLabel = ctx.chain ? ` on ${ctx.chain}` : '';
    const feeNote = ctx.fee && ctx.fee !== '$0.00' ? ` (${ctx.isPidgin ? 'fee' : 'tax'} ${ctx.fee})` : '';
    const amountLine = ctx.amount
      ? `${ctx.amount} ${ctx.symbol}${chainLabel}${feeNote}`
      : `${ctx.symbol}${chainLabel}${feeNote}`.trim();
    const hashLine = ctx.shortHash ? `${ctx.isPidgin ? 'Evidence' : 'Proof'}: ${ctx.shortHash}` : null;
    let combined = [replyText, amountLine, hashLine].filter(Boolean).join('\n');

    // ── MiniPay Sender Confirmation Suffix ────────────────────────────────
    const isSuccess = templateType.includes('success');
    if (ctx.isMiniPaySender && !ctx.isMagic && isSuccess) {
      combined += ' via MiniPay! 🗿';
    }

    return combined;
  }

  return replyText;
}

export async function generateReply(tx) {
  return generateReplyWithBackoff(tx);
}

// ============ Campaign & Winner Announcements ============

export async function generateCampaignAnnouncement({ budget, grantAmount, maxParticipants }) {
  const result = await callMoniBotAI('generate-campaign', { budget, grantAmount, maxParticipants });
  const raw = result || `W Aura Drop!\n\nFirst ${maxParticipants} to drop their monitag get $${grantAmount} USDC!\n\nSign up at MoniPay app`;

  return postProcessBrainrot(raw, { platformName: 'MoniPay', useMiniPay: false });
}

export async function generateWinnerAnnouncement({ winners, count, grantAmount, originalAuthor }) {
  const result = await callMoniBotAI('generate-winner', { winners, count, grantAmount, originalAuthor });
  const winnerList = winners.map(w => `@${w.payTag || w.username}`).join(', ');
  const raw = result || `Congrats to our Sigmas!\n\n${winnerList}\n\nEach getting $${grantAmount || 1.00} USDC! 🗿`;

  // Use a minimal context for global announcements (non-Pidgin, non-MiniPay by default)
  return postProcessBrainrot(raw, { platformName: 'MoniPay', useMiniPay: false });
}
