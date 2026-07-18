export function extractTelegramMentions(msg) {
  const mentions = [];
  if (!msg.entities || !msg.text) return mentions;

  for (const entity of msg.entities) {
    if (entity.type === 'mention') {
      const username = msg.text.substring(entity.offset + 1, entity.offset + entity.length);
      if (username.toLowerCase() !== 'monibot') mentions.push({ username: username.toLowerCase() });
    } else if (entity.type === 'text_mention' && entity.user && !entity.user.is_bot) {
      mentions.push({
        username: entity.user.username?.toLowerCase() || entity.user.first_name,
        userId: String(entity.user.id),
      });
    }
  }

  return mentions;
}
