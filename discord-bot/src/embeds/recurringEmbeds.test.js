import { describe, it, expect } from 'vitest';
import { buildRecurringConfirmation } from './recurringEmbeds.js';

describe('Recurring Embeds', () => {
  it('should format the confirmation description correctly with sender and recipient', () => {
    const seriesData = {
      seriesId: 'e2e0375d-1234-5678-abcd-ef0123456789',
      count: 3,
      firstAt: new Date('2026-06-11T05:04:00.000Z'),
      lastAt: new Date('2026-06-11T05:08:00.000Z'),
      amount: 5.00,
      totalAmount: 15.00,
      intervalMs: 120000,
      recipients: ['@Jadetest'],
      chain: 'celo',
      warnings: ['Heads up! 💰 Total series costs $15.00 but you\'ve got $0.00. Series queued but might fail at execution time 📉'],
      proTips: ['Very frequent payments detected ⚡ Make sure this is intentional, no cap 🧢'],
      autoRouted: false,
      senderLabel: 'Samuelchimmy',
      recipientLabels: ['Jadetest'],
    };

    const msg = buildRecurringConfirmation(seriesData);
    const description = msg.embeds[0].data.description;
    
    console.log('--- TEST DESCRIPTION OUTPUT ---');
    console.log(description);
    console.log('-------------------------------');

    expect(description).toContain('👤 **Sender**: Samuelchimmy');
    expect(description).toContain('👥 **Recipient**: Jadetest');
    expect(description).toContain('🚀 **First Payment**:');
    expect(description).toContain('🏁 **Final Payment**:');
    expect(description).toContain('🔄 **Interval**: Every 2 minutes');
    expect(description).toContain('💰 **Amount Each**: $5.00');
    expect(description).toContain('🔢 **Times**: 3');
    expect(description).toContain('💵 **Total Amount**: $15.00');
    expect(description).toContain('⛓️ **Chain**: CELO');
  });
});
