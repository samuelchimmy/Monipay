/**
 * MoniBot BSC Worker - Entry Point
 * 
 * BSC variant of the Silent Worker Bot.
 * Polls Twitter for campaign replies and P2P commands,
 * then executes transactions via the MoniBotRouter contract on BSC.
 * 
 * Key Differences from Base Worker:
 * - Uses BSC_RPC_URL instead of BASE_RPC_URL
 * - 90-minute auto-restart for OAuth token refresh
 * - All transactions use USDT (18 decimals)
 * 
 * Required Environment Variables:
 * - TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 * - MONIBOT_PRIVATE_KEY (Executor wallet - must be authorized on BSC MoniBotRouter)
 * - MONIBOT_PROFILE_ID (Bot's profile UUID in database)
 * - MONIBOT_WALLET_ADDRESS (Bot's wallet address for ledger sync)
 * - SUPABASE_URL, SUPABASE_SERVICE_KEY
 * - BSC_RPC_URL (BSC Mainnet RPC endpoint)
 */

import dotenv from 'dotenv';
import { initTwitterClient, pollCampaigns, pollCommands } from './twitter.js';
import { initGemini } from './gemini.js';
import { initSupabase, checkAndCompleteCampaigns } from './database.js';
import { MONIBOT_ROUTER_ADDRESS } from './blockchain.js';
import { processScheduledJobs } from './scheduler.js';

dotenv.config();

// ============ Configuration ============

const requiredEnvVars = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET',
  'MONIBOT_PRIVATE_KEY',
  'BSC_RPC_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'MONIBOT_PROFILE_ID'
];

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 60000;
const CAMPAIGN_CHECK_INTERVAL_MS = parseInt(process.env.CAMPAIGN_CHECK_INTERVAL_MS) || 300000;
const ENABLE_CAMPAIGNS = process.env.ENABLE_CAMPAIGNS !== 'false';
const ENABLE_P2P_COMMANDS = process.env.ENABLE_P2P_COMMANDS !== 'false';

// Auto-restart removed — Railway handles container restarts via restart policy

// ============ Validation ============

console.log('🤖 MoniBot BSC Worker Starting...\n');

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

// ============ Startup Banner ============

console.log('┌─────────────────────────────────────────────────┐');
console.log('│        MoniBot BSC Silent Worker v1.0          │');
console.log('│     Router-Based + DB-Driven (USDT/BSC)       │');
console.log('└─────────────────────────────────────────────────┘\n');

console.log('📋 Configuration:');
console.log(`   Chain:            BSC Mainnet (56)`);
console.log(`   Token:            USDT (18 decimals)`);
console.log(`   Profile ID:       ${process.env.MONIBOT_PROFILE_ID}`);
console.log(`   Router Address:   ${MONIBOT_ROUTER_ADDRESS}`);
console.log(`   RPC Endpoint:     ${process.env.BSC_RPC_URL.substring(0, 40)}...`);
console.log(`   Poll Interval:    ${POLL_INTERVAL_MS}ms`);
console.log(`   Campaign Check:   ${CAMPAIGN_CHECK_INTERVAL_MS}ms`);
console.log(`   Campaigns:        ${ENABLE_CAMPAIGNS ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`   P2P Commands:     ${ENABLE_P2P_COMMANDS ? '✅ Enabled' : '❌ Disabled'}`);
console.log('');
console.log('');

// ============ Initialization ============

try {
  initTwitterClient();
  initGemini();
  initSupabase();
  console.log('\n✅ All services initialized successfully!\n');
} catch (error) {
  console.error('❌ Failed to initialize services:', error.message);
  process.exit(1);
}

// ============ Main Loop ============

let cycleCount = 0;
let lastCampaignCheck = 0;

async function mainLoop() {
  cycleCount++;
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  
  try {
    console.log(`\n🔄 [${timestamp}] Poll Cycle #${cycleCount} [BSC]`);
    console.log('─'.repeat(40));
    
    if (ENABLE_CAMPAIGNS) {
      await pollCampaigns();
    }
    
    if (ENABLE_P2P_COMMANDS) {
      await pollCommands();
    }
    
    await processScheduledJobs();
    
    const now = Date.now();
    if (now - lastCampaignCheck > CAMPAIGN_CHECK_INTERVAL_MS) {
      await checkAndCompleteCampaigns();
      lastCampaignCheck = now;
    }
    
    console.log('─'.repeat(40));
    console.log(`✅ Cycle #${cycleCount} complete. Next in ${POLL_INTERVAL_MS / 1000}s`);
    
  } catch (error) {
    console.error('❌ Error in main loop:', error.message);
  }
}

// Auto-restart removed — Railway handles container restarts via restart policy

// ============ Graceful Shutdown ============

process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT. Shutting down gracefully...');
  console.log(`📊 Completed ${cycleCount} poll cycles.`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM. Shutting down gracefully...');
  console.log(`📊 Completed ${cycleCount} poll cycles.`);
  process.exit(0);
});

// ============ Start ============

console.log('🚀 MoniBot BSC Worker is now running!');
console.log('   Press Ctrl+C to stop.\n');

mainLoop();
setInterval(mainLoop, POLL_INTERVAL_MS);
