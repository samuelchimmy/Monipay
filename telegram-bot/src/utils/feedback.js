/**
 * Feedback Utility
 * Handles eligibility checks and logging for the ERC-8004 feedback link system.
 */

/**
 * Map internal chain names to ERC-8004 feedback link IDs.
 * Base -> base, BSC -> 96451, Celo -> 9103.
 */
export function getFeedbackAgentId(chainName) {
  const chain = String(chainName || '').toLowerCase();
  if (chain === 'bsc') return '96451';
  if (chain === 'celo') return '9103';
  return '51818'; // Default/Base
}

/**
 * Determine if a user should be prompted for feedback.
 * Criteria:
 * 1. Not prompted in the last 7 days.
 * 2. Lifetime volume >= $10 OR last 5 transactions all succeeded.
 */
export async function shouldPromptFeedback(supabase, userId) {
  if (!userId) return false;

  // 1. Check 7-day cooldown
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPrompt } = await supabase
    .from('feedback_prompts')
    .select('id')
    .eq('user_id', userId)
    .gt('prompted_at', sevenDaysAgo)
    .limit(1)
    .maybeSingle();

  if (recentPrompt) return false;

  // 2. Query transactions for volume and success rate
  // Optimization: Fetch only what's needed
  const { data: txs, error } = await supabase
    .from('monibot_transactions')
    .select('amount, status')
    .eq('sender_id', userId)
    .order('created_at', { ascending: false });

  if (error || !txs || txs.length === 0) return false;

  // Calculate lifetime volume (completed transactions only)
  const lifetimeVolume = txs
    .filter(tx => tx.status === 'completed')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  if (lifetimeVolume >= 10) return true;

  // Check last 5 transactions success
  const last5 = txs.slice(0, 5);
  const allSucceeded = last5.length === 5 && last5.every(tx => tx.status === 'completed');
  if (allSucceeded) return true;

  return false;
}

/**
 * Log a feedback prompt send.
 */
export async function logFeedbackPrompt(supabase, userId, txHash) {
  await supabase.from('feedback_prompts').insert({
    user_id: userId,
    tx_hash: txHash,
    prompted_at: new Date().toISOString(),
  });
}

/**
 * Helper to send the feedback prompt to a Telegram user.
 */
export async function sendFeedbackPrompt(bot, chatId, userId, txHash, chainName, supabase) {
  if (!txHash) return;
  try {
    const eligible = await shouldPromptFeedback(supabase, userId);
    if (!eligible) return;

    const chainSlug = String(chainName || '').toLowerCase();
    const agentId = getFeedbackAgentId(chainName);
    const feedbackUrl = `https://8004scan.io/agents/${chainSlug}/${agentId}?score=5&tx=${txHash}`;

    await bot.sendMessage(chatId, "How was your experience? 🗿", {
      reply_markup: {
        inline_keyboard: [[
          { text: "👍 Rate Monipaybot on-chain", url: feedbackUrl }
        ]]
      }
    });

    await logFeedbackPrompt(supabase, userId, txHash);
  } catch (e) {
    console.error('[Feedback] Failed to send prompt:', e.message);
  }
}
