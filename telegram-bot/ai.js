/**
 * MoniBot Telegram - AI Module
 * 
 * Uses the monibot-ai edge function for:
 * - Natural language command parsing (NLP)
 * - Conversational chat responses
 * - Temporal expression parsing (scheduling)
 * 
 * Falls back to regex parsing if AI is unavailable.
 */

export { aiParseCommand, aiChat, aiTransactionReply, aiParseSchedule } from './shared/ai.js';
