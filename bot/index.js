/**
 * MoniBot Worker - Entry Point (v5.0)
 *
 * FIX B3: initTwitterClient() is now async (resolves MONIBOT_USER_ID on startup).
 *         Called with await here.
 */

import dotenv from 'dotenv';
import { initTwitterClient, pollCampaigns, pollCommands } from './twitter.js';
import { initGemini } from './gemini.js';
import { initSupabase, checkAndCompleteCampaigns } from './database.js';
import { MONIBOT_ROUTER_ADDRESS } from './blockchain.js';
import { processScheduledJobs } from './scheduler.js';
import { syncMatchResults, evaluateConditionalJobs } from './sportsOracle.js';

dotenv.config();

// ============ Env Validation ============

const requiredEnvVars = [
  'TWITTER_API_KEY', 'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET',
  'MONIBOT_PRIVATE_KEY', 'BASE_RPC_URL',
  'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
  'MONIBOT_PROFILE_ID', 'GEMINI_API_KEY',
];

// MONIBOT_USER_ID is resolved automatically if missing, but logging a warning helps
if (!process.env.MONIBOT_USER_ID) {
  console.warn('⚠️ MONIBOT_USER_ID not set in .env — will be resolved via Twitter API on startup. Set it to skip the API call.');
}

const POLL_INTERVAL_MS        = parseInt(process.env.POLL_INTERVAL_MS) || 60000;
const CAMPAIGN_CHECK_INTERVAL  = 300000; // 5 min
const ORACLE_SYNC_INTERVAL_MS  = parseInt(process.env.ORACLE_SYNC_INTERVAL_MS) || 300000; // 5 min

console.log('┌─────────────────────────────────────────────────┐');
console.log('│           MoniBot Silent Worker v5.0           │');
console.log('│       Router Architecture + Social Escrow      │');
console.log('└─────────────────────────────────────────────────┘\n');

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

// ============ Initialization ============

async function bootstrap() {
  try {
    initSupabase();
    await initTwitterClient();   // ✅ async now — resolves MONIBOT_USER_ID
    initGemini();
    console.log('✅ All services initialized.\n');
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

// ============ Main Loop ============

let cycleCount = 0;
let lastCampaignCheck = 0;

async function mainLoop() {
  cycleCount++;
  const ts = new Date().toLocaleTimeString();
  try {
    console.log(`\n🔄 [${ts}] Cycle #${cycleCount}`);
    console.log('─'.repeat(40));

    await pollCommands();
    // await pollCampaigns();
    await processScheduledJobs();
    await evaluateConditionalJobs();  // Sports Oracle: evaluate pending conditional jobs

    const now = Date.now();
    if (now - lastCampaignCheck > CAMPAIGN_CHECK_INTERVAL) {
      await checkAndCompleteCampaigns();
      lastCampaignCheck = now;
    }

    console.log('─'.repeat(40));
    console.log(`✅ Cycle complete. Sleep ${POLL_INTERVAL_MS / 1000}s`);
  } catch (error) {
    console.error('❌ Loop error:', error.message);
  }
}

// ============ Lifecycle ============

process.on('SIGINT',  () => { console.log('\n🛑 SIGINT. Shutting down.'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑 SIGTERM. Shutting down.'); process.exit(0); });

// Start
bootstrap().then(() => {
  mainLoop();
  setInterval(mainLoop, POLL_INTERVAL_MS);

  // Sports Oracle: sync match results independently every 5 minutes
  syncMatchResults(); // run immediately on boot
  setInterval(async () => {
    try { await syncMatchResults(); } catch (e) { console.error('[SportsOracle] Sync error:', e.message); }
  }, ORACLE_SYNC_INTERVAL_MS);

  console.log(`⚽ Sports Oracle running (sync every ${ORACLE_SYNC_INTERVAL_MS / 60000} min).`);
});
