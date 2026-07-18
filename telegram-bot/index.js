import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { initSupabase } from './shared/database.js';
import { handleHelp, handleStart } from './src/handlers/help.js';
import { handleAbout } from './src/handlers/about.js';
import { handleNaturalLanguage } from './src/handlers/chat.js';
import { pollScheduledJobResults } from './src/handlers/schedule.js';
import { 
  handleCancelSeries, 
  handleSeriesStatus, 
  handleMySeries 
} from './src/handlers/recurring.js';
import { handleCallbackQueryListener } from './src/handlers/interactive.js';

initSupabase();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: false,
    params: { timeout: 10 }
  }
});

// Graceful error logging to prevent massive TLS/socket dump crashes on Railway
bot.on('polling_error', (error) => {
  console.error('❌ Telegram polling error:', error.message || error);
});
bot.on('webhook_error', (error) => {
  console.error('❌ Telegram webhook error:', error.message || error);
});
bot.on('error', (error) => {
  console.error('❌ Telegram bot error:', error.message || error);
});


// Clear any stale webhook/session and start polling with retry backoff.
// Railway rolling deploys briefly run two containers — the 409 Conflict
// means the old instance is still polling. We wait and retry until it clears.
(async () => {
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 5000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await bot.deleteWebHook({ drop_pending_updates: true });
      await bot.startPolling();
      console.log('✅ Telegram polling started');
      return;
    } catch (e) {
      const is409 = e.message && e.message.includes('409');
      if (is409 && attempt < MAX_RETRIES) {
        console.warn(`⚠️ Polling conflict (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error('❌ Failed to start polling:', e.message);
        return;
      }
    }
  }
})();


const app = express();
app.get('/health', (_, res) => res.json({ status: 'ok', platform: 'telegram', uptime: process.uptime() }));
app.listen(process.env.PORT || 3000);

bot.onText(/\/start/, (msg) => setImmediate(() => handleStart(bot, msg)));
bot.onText(/\/help/, (msg) => setImmediate(() => handleHelp(bot, msg)));
bot.onText(/\/about/, (msg) => setImmediate(() => handleAbout(bot, msg)));
bot.onText(/\/(cancel_series|cancel)/, (msg) => setImmediate(() => handleCancelSeries(bot, msg)));
bot.onText(/\/series_status/, (msg) => setImmediate(() => handleSeriesStatus(bot, msg)));
bot.onText(/\/my_series/, (msg) => setImmediate(() => handleMySeries(bot, msg)));
bot.on('message', (msg) => setImmediate(() => handleNaturalLanguage(bot, msg)));
bot.on('callback_query', (query) => setImmediate(() => handleCallbackQueryListener(bot, query)));

setInterval(() => pollScheduledJobResults(bot), 30 * 1000);

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
  console.error('❌ Unhandled Promise Rejection:\n', msg);
});

process.on('uncaughtException', (error) => {
  const msg = error instanceof Error ? error.stack || error.message : String(error);
  console.error('❌ Uncaught Exception:\n', msg);
});

process.on('SIGTERM', () => { bot.stopPolling(); process.exit(0); });
process.on('SIGINT', () => { bot.stopPolling(); process.exit(0); });

