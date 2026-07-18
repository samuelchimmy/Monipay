import { enqueueMessage } from './src/utils/botQueue.js';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Running Outbound Message Queue Unit Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Mock bot
let messageSendTimes = [];
let total429sEncountered = 0;

const mockBot = {
  sendMessage: async (chatId, text, options) => {
    const now = Date.now();
    messageSendTimes.push(now);
    
    // Simulate a 429 error on the 5th message (first attempt only)
    if (text.includes('msg #5') && !options._attempted) {
      options._attempted = true; // flag to pass on next attempt
      total429sEncountered += 1;
      const error = new Error('Rate limit exceeded');
      error.response = {
        statusCode: 429,
        body: {
          parameters: {
            retry_after: 1 // retry after 1 second
          }
        }
      };
      throw error;
    }
    
    console.log(`[MockBot] Sent: "${text}" at +${now - startTime}ms`);
    return { message_id: Math.random() };
  }
};

const startTime = Date.now();

// Enqueue 8 messages concurrently
const promises = [];
for (let i = 1; i <= 8; i++) {
  promises.push(
    enqueueMessage(mockBot, 12345, `msg #${i}`, { _attempted: false })
      .then(() => console.log(`   ✅ Promise resolved for msg #${i}`))
      .catch((err) => console.error(`   ❌ Promise rejected for msg #${i}:`, err.message))
  );
}

Promise.all(promises).then(() => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Verify rate-limiting/throttling delay
  console.log(`Total time taken: ${Date.now() - startTime}ms`);
  console.log(`Total 429 errors processed: ${total429sEncountered}`);
  
  // Calculate average gap between messages (excluding the 429 delay)
  const gaps = [];
  for (let i = 1; i < messageSendTimes.length; i++) {
    const gap = messageSendTimes[i] - messageSendTimes[i-1];
    if (gap < 500) { // filter out the 1s retry delay gap
      gaps.push(gap);
    }
  }
  
  const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  console.log(`Average throttling gap between messages: ${avgGap.toFixed(1)}ms (Expected: ~80ms)`);
  
  if (avgGap >= 70 && total429sEncountered === 1) {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🗿');
  } else {
    console.log('\n❌ TEST FAILURE! Check gaps or 429 counts.');
  }
});
