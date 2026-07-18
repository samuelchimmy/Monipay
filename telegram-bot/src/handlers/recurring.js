import { getProfileByPlatformId } from '../../shared/database.js';
import {
  cancelRecurringSeries,
  getSeriesStatus,
  formatSeriesStatus,
  getUserSeries,
  formatUserSeriesList
} from '../utils/seriesManager.js';
import { isValidSeriesId } from '../utils/recurringPayments.js';
import { escapeMd } from '../utils/replies.js';

/**
 * Recurring Payment Management Handler
 * 
 * Handles commands for managing recurring payment series:
 * - /cancel_series <seriesId> - Cancel a recurring payment series
 * - /series_status <seriesId> - Check status of a specific series
 * - /my_series - List all user's recurring payment series
 */

/**
 * Handle series cancellation command
 * Command format: /cancel_series <seriesId>
 */
export async function handleCancelSeries(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  // Extract series ID from command
  const commandText = msg.text.trim();
  const parts = commandText.split(/\s+/);
  
  if (parts.length < 2) {
    await bot.sendMessage(chatId,
      `❌ *Usage:* \`/cancel_series <series_id>\`\n\n` +
      `Example: \`/cancel_series a1b2c3d4-...\`\n\n` +
      `Get your series IDs with \`/my_series\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const seriesId = parts[1];

  // Validate series ID format
  if (!isValidSeriesId(seriesId)) {
    await bot.sendMessage(chatId,
      `❌ Invalid series ID format.\n\nSeries IDs should look like: \`a1b2c3d4-1234-4567-89ab-123456789abc\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Verify user is linked
  const profile = await getProfileByPlatformId('telegram', userId);
  if (!profile) {
    await bot.sendMessage(chatId,
      `🔗 *Link your account first.*\n\nGo to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI → Link Telegram`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
    return;
  }

  await bot.sendChatAction(chatId, 'typing');

  // Cancel the series
  const result = await cancelRecurringSeries(seriesId, userId, 'telegram');

  if (result.success) {
    await bot.sendMessage(chatId,
      `✅ *Series Cancelled Successfully*\n\n` +
      `${escapeMd(result.message)}\n\n` +
      `_Series ID: ${seriesId}_`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await bot.sendMessage(chatId,
      `❌ *Cancellation Failed*\n\n${escapeMd(result.message)}`,
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Handle series status check command
 * Command format: /series_status <seriesId>
 */
export async function handleSeriesStatus(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  // Extract series ID from command
  const commandText = msg.text.trim();
  const parts = commandText.split(/\s+/);
  
  if (parts.length < 2) {
    await bot.sendMessage(chatId,
      `❌ *Usage:* \`/series_status <series_id>\`\n\n` +
      `Example: \`/series_status a1b2c3d4-...\`\n\n` +
      `Get your series IDs with \`/my_series\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const seriesId = parts[1];

  // Validate series ID format
  if (!isValidSeriesId(seriesId)) {
    await bot.sendMessage(chatId,
      `❌ Invalid series ID format.\n\nSeries IDs should look like: \`a1b2c3d4-1234-4567-89ab-123456789abc\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await bot.sendChatAction(chatId, 'typing');

  // Get series status
  const status = await getSeriesStatus(seriesId);

  if (!status) {
    await bot.sendMessage(chatId,
      `❌ *Series Not Found*\n\nNo recurring payment series found with ID: \`${seriesId}\`\n\n` +
      `Check your series list with \`/my_series\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Format and send status
  const formattedStatus = formatSeriesStatus(status);
  await bot.sendMessage(chatId, formattedStatus, { parse_mode: 'Markdown' });
}

/**
 * Handle list user series command
 * Command format: /my_series [active]
 */
export async function handleMySeries(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  // Check for "active" filter
  const commandText = msg.text.trim().toLowerCase();
  const activeOnly = commandText.includes('active');

  // Verify user is linked
  const profile = await getProfileByPlatformId('telegram', userId);
  if (!profile) {
    await bot.sendMessage(chatId,
      `🔗 *Link your account first.*\n\nGo to [monipay.xyz](https://monipay.xyz) → Settings → MoniBot AI → Link Telegram`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
    return;
  }

  await bot.sendChatAction(chatId, 'typing');

  // Get user's series
  const seriesList = await getUserSeries(userId, { activeOnly, limit: 20 });

  // Format and send list
  const formattedList = formatUserSeriesList(seriesList);
  await bot.sendMessage(chatId, formattedList, { parse_mode: 'Markdown' });
}

/**
 * Parse recurring management command from natural language
 * Supports commands like:
 * - "cancel series <id>"
 * - "show my recurring payments"
 * - "check status of series <id>"
 */
export async function handleRecurringManagementNL(bot, msg, text) {
  const chatId = msg.chat.id;
  const lowerText = text.toLowerCase().trim();

  // Cancel series patterns
  if (lowerText.match(/cancel.*(series|recurring|payment)/i) || lowerText.match(/stop.*(series|recurring)/i)) {
    // Try to extract series ID
    const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      // Create a mock message with the command
      const mockMsg = { ...msg, text: `/cancel_series ${uuidMatch[0]}` };
      await handleCancelSeries(bot, mockMsg);
      return true;
    } else {
      await bot.sendMessage(chatId,
        `🔄 To cancel a recurring payment series, use:\n\n` +
        `\`/cancel_series <series_id>\`\n\n` +
        `Get your series IDs with \`/my_series\``,
        { parse_mode: 'Markdown' }
      );
      return true;
    }
  }

  // Status check patterns
  if (lowerText.match(/status.*(series|recurring)/i) || lowerText.match(/check.*(series|recurring)/i)) {
    const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      const mockMsg = { ...msg, text: `/series_status ${uuidMatch[0]}` };
      await handleSeriesStatus(bot, mockMsg);
      return true;
    } else {
      await bot.sendMessage(chatId,
        `🔍 To check series status, use:\n\n` +
        `\`/series_status <series_id>\`\n\n` +
        `Get your series IDs with \`/my_series\``,
        { parse_mode: 'Markdown' }
      );
      return true;
    }
  }

  // List series patterns
  if (lowerText.match(/(?:my|show|list).*(series|recurring|scheduled)/i) || 
      lowerText.match(/recurring.*(payment|list)/i)) {
    const mockMsg = { ...msg, text: '/my_series' };
    await handleMySeries(bot, mockMsg);
    return true;
  }

  return false;
}
