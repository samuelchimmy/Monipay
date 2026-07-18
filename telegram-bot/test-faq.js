import { handleFeatureExplanationNL } from './src/handlers/featureExplanation.js';

console.log('🧪 Testing Feature Explanation (FAQ) Triggers\n');

// Mock bot that records sent messages
class MockBot {
  constructor() {
    this.sentMessages = [];
  }
  async sendMessage(chatId, text, options) {
    this.sentMessages.push({ chatId, text, options });
  }
}

const testCases = [
  // 1. CasualPay
  { input: 'what is casualpay?', expectedTopic: 'CasualPay' },
  { input: 'explain casual pay', expectedTopic: 'CasualPay' },
  { input: 'tell me about direct p2p transfers', expectedTopic: 'CasualPay' },

  // 2. MagicPay
  { input: 'what is MagicPay?', expectedTopic: 'MagicPay' },
  { input: 'how does magic pay work', expectedTopic: 'MagicPay' },
  { input: 'explain escrow shadow realm', expectedTopic: 'MagicPay' },

  // 3. Scheduling
  { input: 'How does scheduling works', expectedTopic: 'Scheduling' },
  { input: 'explain schedule', expectedTopic: 'Scheduling' },
  { input: 'how to schedule a payment', expectedTopic: 'Scheduling' },

  // 4. Recurring
  { input: 'How does recurring payment works', expectedTopic: 'Recurring' },
  { input: 'tell me about auto-pay', expectedTopic: 'Recurring' },
  { input: 'what is sigma autopay', expectedTopic: 'Recurring' },

  // 5. MiniPay vs MoniPay
  { input: 'what is the difference between minipay and monipay users', expectedTopic: 'MiniPay vs MoniPay' },
  { input: 'minipay vs monipay', expectedTopic: 'MiniPay vs MoniPay' },

  // 6. Rerouting
  { input: 'how does auto-rerouting work?', expectedTopic: 'Auto-Rerouting' },
  { input: 'explain multi-chain failover', expectedTopic: 'Auto-Rerouting' },

  // 7. Giveaways
  { input: 'what are giveaways?', expectedTopic: 'Giveaways' },
  { input: 'how does airdrop work', expectedTopic: 'Giveaways' },

  // 8. Aura
  { input: 'how to see the aura leaderboard?', expectedTopic: 'Aura' },
  { input: 'what is aura score', expectedTopic: 'Aura' },

  // 9. Linking
  { input: 'how to link my wallet', expectedTopic: 'Account Linking' },
  { input: 'explain connect telegram', expectedTopic: 'Account Linking' },

  // 10. Preferred Chain
  { input: 'how to change my preferred chain', expectedTopic: 'Preferred Chain' },
  { input: 'switch my preferred network', expectedTopic: 'Preferred Chain' },

  // 11. General Overview
  { input: 'what is monibot?', expectedTopic: 'Overview' },
  { input: 'what can you do', expectedTopic: 'Overview' },
  { input: 'explain features', expectedTopic: 'Overview' },

  // 12. Sports P2P
  { input: 'tell me about sports p2p', expectedTopic: 'Sports P2P' },
  { input: 'how to bet on football match', expectedTopic: 'Sports P2P' },
  { input: 'explain the world cup sports oracle', expectedTopic: 'Sports P2P' }
];

async function runTests() {
  let passedCount = 0;
  let failedCount = 0;

  for (const tc of testCases) {
    const bot = new MockBot();
    const msg = { chat: { id: 42 } };

    const handled = await handleFeatureExplanationNL(bot, msg, tc.input);

    if (!handled) {
      console.error(`❌ FAILED: "${tc.input}" was not handled at all.`);
      failedCount++;
      continue;
    }

    const lastMsg = bot.sentMessages[0]?.text || '';
    let matchedTopic = null;

    if (lastMsg.includes('The Legend of CasualPay')) matchedTopic = 'CasualPay';
    else if (lastMsg.includes('The MagicPay Wizardry')) matchedTopic = 'MagicPay';
    else if (lastMsg.includes('The Scheduling Time-Warp')) matchedTopic = 'Scheduling';
    else if (lastMsg.includes('Sigma AutoPay')) matchedTopic = 'Recurring';
    else if (lastMsg.includes('Clash of Wallets')) matchedTopic = 'MiniPay vs MoniPay';
    else if (lastMsg.includes('Multi-Chain Auto-Rerouting')) matchedTopic = 'Auto-Rerouting';
    else if (lastMsg.includes('Giveaways (Aura Booster)')) matchedTopic = 'Giveaways';
    else if (lastMsg.includes('Aura Leaderboard')) matchedTopic = 'Aura';
    else if (lastMsg.includes('Account Linking (The Portal)')) matchedTopic = 'Account Linking';
    else if (lastMsg.includes('Preferred Chain Settings')) matchedTopic = 'Preferred Chain';
    else if (lastMsg.includes('Full Feature Overview')) matchedTopic = 'Overview';
    else if (lastMsg.includes('Conditional Sports P2P')) matchedTopic = 'Sports P2P';

    if (matchedTopic === tc.expectedTopic) {
      console.log(`✅ PASSED: "${tc.input}" -> Matched ${matchedTopic}`);
      passedCount++;
    } else {
      console.error(`❌ FAILED: "${tc.input}" -> Expected ${tc.expectedTopic}, but got ${matchedTopic || 'Unknown/Incorrect story'}`);
      failedCount++;
    }
  }

  console.log(`\n📊 Test Summary: ${passedCount} passed, ${failedCount} failed`);
  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 All FAQ Trigger tests passed successfully!');
  }
}

runTests();
