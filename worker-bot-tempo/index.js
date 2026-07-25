/**
 * MoniBot Tempo Worker v1.0
 * 
 * Processes campaign grants and P2P commands on Tempo Testnet.
 * Uses native fee sponsorship (no EIP-712 relayer needed).
 * aUSD (TIP-20, 6 decimals).
 */

import 'dotenv/config';
import express from 'express';
import { initSupabase, processCampaignQueue, getSupabase } from './database.js';
import { initTwitter } from './twitter.js';
import { initBlockchain } from './blockchain.js';
import { initP2P, pollP2PCommands } from './p2p.js';

const PORT = process.env.PORT || 3002;
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
    token: 'aUSD',
    lastPoll,
    cycleCount,
    processedCount,
    errorCount,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MoniBot Tempo Worker v1.0 running on port ${PORT}`);
});

console.log('┌─────────────────────────────────────────────────┐');
console.log('│      MoniBot Tempo Worker v1.0                 │');
console.log('│    Fee Sponsorship + aUSD (Testnet)            │');
console.log('└─────────────────────────────────────────────────┘\n');

initSupabase();
await initTwitter();
await initBlockchain();
initP2P(getSupabase());

console.log(`\n📋 Configuration:`);
console.log(`   Chain:            Tempo Testnet (42431)`);
console.log(`   Token:            aUSD (6 decimals)`);
console.log(`   Poll Interval:    ${POLL_INTERVAL}ms`);

console.log('');

async function pollAndProcess() {
  cycleCount++;
  lastPoll = new Date().toISOString();
  console.log(`\n🔄 [Cycle ${cycleCount}] Polling at ${lastPoll}`);

  try {
    const campaignProcessed = await processCampaignQueue();
    const p2pProcessed = await pollP2PCommands();
    processedCount += campaignProcessed + p2pProcessed;
    console.log(`   📊 Cycle ${cycleCount} done: campaigns=${campaignProcessed}, p2p=${p2pProcessed}, total=${processedCount}`);
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

console.log('🚀 Tempo Worker is now live!\n');
pollAndProcess();
setInterval(pollAndProcess, POLL_INTERVAL);
