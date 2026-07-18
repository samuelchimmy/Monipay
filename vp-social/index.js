/**
 * MoniBot VP-Social - Entry Point (v5.0)
 *
 * FIX B4: Imports processSocialQueue and processScheduledJobs from
 *         socialQueue.js (not database.js). The old circular import
 *         database.js ↔ twitter-oauth2.js is now fully broken.
 *
 * FIX M4: node-cron is now actually wired up for campaign posting
 *         (was listed in package.json but never called). Campaigns
 *         post at 9am and 4pm EST by default.
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import { initTwitterOAuth2 } from './twitter-oauth2.js';
import { initGemini } from './gemini.js';
import { initSupabase } from './database.js';
import { processSocialQueue, processScheduledJobs } from './socialQueue.js';  // ✅ FIX B4
import { postCampaign } from './campaigns.js';

dotenv.config();

// ============ Config ============

const SOCIAL_QUEUE_INTERVAL_MS    = parseInt(process.env.SOCIAL_QUEUE_INTERVAL_MS)    || 30000;
const SCHEDULED_JOBS_INTERVAL_MS  = parseInt(process.env.SCHEDULED_JOBS_INTERVAL_MS)  || 15000;
const CAMPAIGN_GRANT_AMOUNT       = parseFloat(process.env.CAMPAIGN_GRANT_AMOUNT)      || 0.25;
const CAMPAIGN_MAX_PARTICIPANTS   = parseInt(process.env.CAMPAIGN_MAX_PARTICIPANTS)    || 10;
const CAMPAIGN_NETWORK            = process.env.CAMPAIGN_NETWORK                       || 'base';
const ENABLE_AUTO_CAMPAIGNS       = process.env.ENABLE_AUTO_CAMPAIGNS === 'true';

// ============ Bootstrap ============

async function bootstrap() {
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│          MoniBot VP-Social v5.0                │');
  console.log('│      Personality Layer: Sigma Activated 🗿      │');
  console.log('└─────────────────────────────────────────────────┘\n');

  try {
    initSupabase();                    // DB first (no circular deps now)
    await initTwitterOAuth2();         // Refreshes token + caches myUserId (FIX B5)
    initGemini();

    console.log('\n📋 Config:');
    console.log(`   Social Queue:       ${SOCIAL_QUEUE_INTERVAL_MS}ms`);
    console.log(`   Scheduled Jobs:     ${SCHEDULED_JOBS_INTERVAL_MS}ms`);
    console.log(`   Auto Campaigns:     ${ENABLE_AUTO_CAMPAIGNS ? 'ENABLED' : 'disabled'}`);
    console.log(`   Campaign Amount:    $${CAMPAIGN_GRANT_AMOUNT} x ${CAMPAIGN_MAX_PARTICIPANTS} per drop`);
    console.log(`   Campaign Network:   ${CAMPAIGN_NETWORK.toUpperCase()}`);

    startLoops();
  } catch (error) {
    console.error('❌ Critical Startup Failure:', error.message);
    process.exit(1);
  }
}

// ============ Loops ============

let socialQueueCycle   = 0;
let scheduledJobsCycle = 0;

async function socialQueueLoop() {
  socialQueueCycle++;
  try { await processSocialQueue(); }
  catch (e) { console.error('❌ Social queue loop error:', e.message); }
}

async function scheduledJobsLoop() {
  scheduledJobsCycle++;
  try { await processScheduledJobs(); }
  catch (e) { console.error('❌ Scheduled jobs loop error:', e.message); }
}

function startLoops() {
  console.log('\n🚀 VP-Social is live!\n');

  // Immediate first runs
  socialQueueLoop();
  scheduledJobsLoop();

  // Recurring intervals
  setInterval(socialQueueLoop,   SOCIAL_QUEUE_INTERVAL_MS);
  setInterval(scheduledJobsLoop, SCHEDULED_JOBS_INTERVAL_MS);

  // ── FIX M4: Campaign cron (was in package.json but never wired up) ────────
  if (ENABLE_AUTO_CAMPAIGNS) {
    // 9:00 AM EST = 14:00 UTC
    cron.schedule('0 14 * * *', async () => {
      console.log('\n📢 [Cron] 9AM EST campaign drop...');
      await postCampaign('morning', CAMPAIGN_MAX_PARTICIPANTS, CAMPAIGN_GRANT_AMOUNT, CAMPAIGN_NETWORK);
    }, { timezone: 'UTC' });

    // 4:00 PM EST = 21:00 UTC
    cron.schedule('0 21 * * *', async () => {
      console.log('\n📢 [Cron] 4PM EST campaign drop...');
      await postCampaign('afternoon', CAMPAIGN_MAX_PARTICIPANTS, CAMPAIGN_GRANT_AMOUNT, CAMPAIGN_NETWORK);
    }, { timezone: 'UTC' });

    console.log('   Campaign cron: 9AM + 4PM EST daily ✅');
  }

  // Auto-restart every 90 minutes for fresh OAuth tokens
  const AUTO_RESTART_MS = 90 * 60 * 1000;
  setInterval(() => {
    console.log(`\n🔄 90-min restart. Cycles: ${socialQueueCycle} social, ${scheduledJobsCycle} jobs.`);
    process.exit(0);
  }, AUTO_RESTART_MS);

  console.log(`   Auto-restart:     90min cycle`);
  console.log('   Press Ctrl+C to stop.\n');
}

// ============ Graceful Shutdown ============

process.on('SIGINT',  () => { console.log(`\n🛑 SIGINT. ${socialQueueCycle} social, ${scheduledJobsCycle} job cycles.`); process.exit(0); });
process.on('SIGTERM', () => { console.log(`\n🛑 SIGTERM. ${socialQueueCycle} social, ${scheduledJobsCycle} job cycles.`); process.exit(0); });

bootstrap();
