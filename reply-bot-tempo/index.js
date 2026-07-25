/**
 * MoniBot Tempo Reply Service v1.0
 * 
 * Polls monibot_transactions for chain='tempo' unreplied records.
 * Generates AI replies via monibot-ai Edge Function.
 * Posts replies with Tempo explorer links.
 */

import 'dotenv/config';
import express from 'express';
import { initSupabase, processSocialQueue } from './database.js';
import { initTwitterOAuth2 } from './twitter.js';
import { initGemini } from './gemini.js';

const PORT = process.env.PORT || 3003;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);


let processedCount = 0;
let errorCount = 0;
let cycleCount = 0;
let lastPoll = null;

const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    chain: 'tempo',
    auth: 'oauth2',
    lastPoll,
    cycleCount,
    processedCount,
    errorCount,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MoniBot Tempo Reply Service v1.0 running on port ${PORT}`);
});

console.log('┌─────────────────────────────────────────────────┐');
console.log('│      MoniBot Tempo Reply Service v1.0          │');
console.log('│    OAuth 2.0 + AI Replies (aUSD/Tempo)         │');
console.log('└─────────────────────────────────────────────────┘\n');

initSupabase();
await initTwitterOAuth2();
initGemini();

console.log(`\n📋 Configuration:`);
console.log(`   Poll Interval:    ${POLL_INTERVAL}ms`);

console.log('');

async function pollAndProcess() {
  cycleCount++;
  lastPoll = new Date().toISOString();
  console.log(`\n🔄 [Reply Cycle ${cycleCount}] at ${lastPoll}`);

  try {
    const processed = await processSocialQueue();
    processedCount += processed;
    console.log(`   📊 Reply cycle ${cycleCount} done: replied=${processed}, total=${processedCount}`);
  } catch (error) {
    console.error('❌ Poll error:', error.message, error.stack);
    errorCount++;
  }
}

// Auto-restart removed — Railway handles container restarts via restart policy

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  process.exit(0);
});

console.log('🚀 Tempo Reply Service is now live!\n');
pollAndProcess();
setInterval(pollAndProcess, POLL_INTERVAL);
