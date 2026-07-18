import { isCommandProcessed } from '../../shared/database.js';

export async function isDuplicateTelegramCommand(messageId) {
  return isCommandProcessed('telegram', String(messageId));
}
