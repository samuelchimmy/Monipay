import { getBalance } from '../../shared/blockchain.js';
import { getProfileByPlatformId } from '../../shared/database.js';
import { detectChain } from '../utils/parseCommand.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { escapeMd } from '../utils/replies.js';

const ACTIVE_CHAINS = ['base', 'bsc', 'celo', 'ink', 'solana'];

export async function handleBalance(bot, msg, overrideText = null) {
  const rl = checkRateLimit(String(msg.from.id));
  if (!rl.allowed) {
    await bot.sendMessage(msg.chat.id, `⏳ Slow down fam. Try again in ${rl.retryAfter}s.`);
    return;
  }

  // Typing indicator — instant feedback
  await bot.sendChatAction(msg.chat.id, 'typing');

  const profile = await getProfileByPlatformId('telegram', String(msg.from.id));
  if (!profile) {
    await bot.sendMessage(msg.chat.id,
      `❌ Not linked fam. Use /help to set up your MoniPay account.`
    );
    return;
  }

  // Detect explicit chain from command text
  const inputText = overrideText || msg.text || '';
  const requestedChain = detectChain(inputText);

  if (requestedChain) {
    const addr = profile.addresses[requestedChain];
    if (!addr) {
      const msgText = profile.source === 'wallet_profile'
        ? `❌ MiniPay users only have bags on CELO. Check that instead, blud. 🗿\n\nTry: \`balance on celo\``
        : `❌ You don't have a wallet configured for ${requestedChain.toUpperCase()} yet.\n\nTry another chain or visit monipay.xyz to set one up.`;
      await bot.sendMessage(msg.chat.id, msgText, { parse_mode: 'Markdown' });
      return;
    }

    // Single chain balance
    await bot.sendChatAction(msg.chat.id, 'typing');
    try {
      const { balance, symbol } = await getBalance(addr, requestedChain);
      const emoji = balance > 0 ? '💰' : '💀';
      await bot.sendMessage(msg.chat.id,
        `${emoji} *${balance.toFixed(2)} ${symbol}* on ${requestedChain.toUpperCase()}\n\n_@${escapeMd(profile.pay_tag)}_`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await bot.sendMessage(msg.chat.id,
        `❌ Couldn't fetch ${requestedChain.toUpperCase()} balance. Chain RPC is cooked rn, try again.`
      );
    }
    return;
  }

  // All chains — fetch in parallel
  await bot.sendChatAction(msg.chat.id, 'typing');

  const results = await Promise.allSettled(
    ACTIVE_CHAINS.map(async (chain) => {
      const addr = profile.addresses[chain];
      if (!addr) return { chain, balance: 0, symbol: '', skipped: true };
      const { balance, symbol } = await getBalance(addr, chain);
      return { chain, balance, symbol };
    })
  );

  const lines = results.map((r, i) => {
    const chain = ACTIVE_CHAINS[i];
    if (r.status === 'rejected' || !r.value) return `• ${chain.toUpperCase()}: ❌ fetch failed`;
    if (r.value.skipped) return null;
    const { balance, symbol } = r.value;
    const bar = balance > 0 ? '💰' : '⬜';
    return `${bar} *${chain.toUpperCase()}:* ${balance.toFixed(2)} ${symbol}`;
  }).filter(Boolean);

  const totalNonZero = results
    .filter(r => r.status === 'fulfilled' && r.value && !r.value.skipped && r.value.balance > 0)
    .reduce((sum, r) => sum + r.value.balance, 0);

  let summary = totalNonZero > 0
    ? `\n\n💎 Total loaded: ~$${totalNonZero.toFixed(2)}`
    : `\n\n💀 All bags empty fam. Time to fund at monipay.xyz`;

  if (profile.source === 'wallet_profile') {
    summary += `\n\n🗿 MiniPay Status: Sigma bag secured on Celo. No cap.`;
  }

  await bot.sendMessage(msg.chat.id,
    `💼 *@${escapeMd(profile.pay_tag)}'s Vault*\n\n${lines.join('\n')}${summary}`,
    { parse_mode: 'Markdown' }
  );
}
