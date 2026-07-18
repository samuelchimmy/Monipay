/**
 * Bot Outbound Message Queue
 * Prevents rate-limit blocks (HTTP 429) from Telegram by queuing and throttling outgoing messages.
 */

const queue = [];
let processing = false;
const MIN_DELAY_MS = 80; // Throttling interval to stay under 30 msgs/sec

export function enqueueMessage(bot, chatId, text, options = {}) {
  return new Promise((resolve, reject) => {
    queue.push({
      bot,
      chatId,
      text,
      options,
      resolve,
      reject,
      attempt: 1
    });
    if (!processing) {
      processQueue();
    }
  });
}

async function processQueue() {
  if (queue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const item = queue.shift();
  const { bot, chatId, text, options, resolve, reject } = item;

  try {
    console.log(`[BotQueue] Sending message to ${chatId} (queue depth: ${queue.length})`);
    const result = await bot.sendMessage(chatId, text, options);
    resolve(result);
  } catch (error) {
    const is429 = error.response && error.response.statusCode === 429;
    if (is429 && item.attempt < 3) {
      const retryAfter = error.response.body?.parameters?.retry_after || 2;
      console.warn(`[BotQueue] Hit 429 rate limit. Retrying attempt ${item.attempt} in ${retryAfter}s...`);
      item.attempt += 1;
      queue.unshift(item); // Re-queue at head
      
      // Pause queue execution by postponing next processQueue call
      setTimeout(() => {
        processQueue();
      }, retryAfter * 1000);
      return;
    }
    console.error(`[BotQueue] Failed to send message to ${chatId} after ${item.attempt} attempts:`, error.message);
    reject(error);
  }

  setTimeout(() => {
    processQueue();
  }, MIN_DELAY_MS);
}
