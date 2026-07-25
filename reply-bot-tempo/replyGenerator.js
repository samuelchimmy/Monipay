/**
 * Tempo Reply Generator
 * 
 * Generates Tempo-specific reply templates with aUSD references
 * and Tempo explorer links.
 */

const EXPLORER_URL = 'https://explore.tempo.xyz';

const GRANT_TEMPLATES = [
  "Transfer confirmed on Tempo. aUSD delivered instantly",
  "Grant processed on Tempo. Check your balance",
  "Payment complete. Your aUSD just landed via Tempo",
  "Done on Tempo. Funds in your wallet now",
  "Tempo delivery complete. aUSD transferred",
  "Grant sent on Tempo testnet. Zero fees, instant settlement",
  "aUSD delivered. Powered by Tempo's native fee sponsorship",
  "Tempo grant processed. Your testnet funds are ready",
];

const P2P_TEMPLATES = [
  "Sent on Tempo. aUSD transferred successfully",
  "Payment complete on Tempo. Recipient notified",
  "Transfer done. aUSD moved via Tempo network",
  "Processed on Tempo. Payment delivered instantly",
  "Tempo transfer confirmed. Zero gas fees",
  "P2P complete on Tempo. aUSD in recipient's wallet",
];

const IOU_TEMPLATES = [
  "Funds escrowed on Tempo! Create a MoniPay account to claim",
  "aUSD secured on-chain. Sign up at monipay.xyz/claim to collect",
  "IOU created on Tempo. Your funds are waiting. Create your MoniTag™ to claim",
  "Money held securely on Tempo. Nobody can touch it except you. Claim at monipay.xyz/claim",
  "Payment locked on Tempo testnet. Sign up on MoniPay to receive your aUSD",
];

const ERROR_TEMPLATES = [
  "Transfer couldn't be processed right now. Try again shortly",
  "Something went wrong on our end. We're looking into it",
];

// Memory to avoid duplicate replies
const recentReplies = [];
const MAX_MEMORY = 50;

function getRandomTemplate(templates) {
  // Try to find one not recently used
  for (let i = 0; i < 5; i++) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const similarity = recentReplies.some(r => {
      const words1 = r.split(' ');
      const words2 = template.split(' ');
      const common = words1.filter(w => words2.includes(w)).length;
      return common / Math.max(words1.length, words2.length) > 0.7;
    });
    if (!similarity) {
      recentReplies.push(template);
      if (recentReplies.length > MAX_MEMORY) recentReplies.shift();
      return template;
    }
  }
  // Fallback
  return templates[Math.floor(Math.random() * templates.length)];
}

export async function generateReply(tx) {
  try {
    const isIOU = (tx.tx_hash || '').startsWith('IOU_CREATED') || tx.type === 'p2p_iou';
    const templates = isIOU ? IOU_TEMPLATES
      : tx.type === 'grant' ? GRANT_TEMPLATES
      : P2P_TEMPLATES;
    let reply = getRandomTemplate(templates);

    // Personalize IOU messages
    if (isIOU) {
      const amount = tx.amount ? `$${parseFloat(tx.amount).toFixed(2)} αUSD` : '';
      const sender = tx.payer_pay_tag ? `@${tx.payer_pay_tag}` : 'Someone';
      const recipient = tx.recipient_pay_tag || 'you';
      reply = `Hey @${recipient}, ${sender} sent you ${amount}! ${reply}`;
    } else if (tx.amount) {
      // Add amount + fee details (fee-on-top model — show full commanded amount)
      const amountLabel = `$${parseFloat(tx.amount).toFixed(2)} αUSD`;
      const feeLabel = tx.fee ? `Fee: $${parseFloat(tx.fee).toFixed(4)}` : '';
      const recipientLabel = tx.recipient_pay_tag ? `To: ${tx.recipient_pay_tag}` : '';
      const details = [amountLabel, feeLabel, recipientLabel].filter(Boolean).join(' · ');
      reply += `\n${details}`;
    }

    // Add shortened tx hash (no explorer link per policy)
    if (tx.tx_hash && !tx.tx_hash.startsWith('skip_') && !tx.tx_hash.startsWith('failed_') && !tx.tx_hash.startsWith('IOU_CREATED')) {
      reply += `\ntx: ${tx.tx_hash.slice(0, 18)}`;
    }

    // Add unique suffix to prevent duplicate detection
    const uniqueSuffix = ` ⚡${Date.now().toString(36).slice(-4)}`;
    reply += uniqueSuffix;

    return reply;
  } catch (error) {
    console.error('Reply generation error:', error.message);
    return getRandomTemplate(ERROR_TEMPLATES);
  }
}
