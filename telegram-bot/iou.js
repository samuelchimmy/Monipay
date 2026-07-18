/**
 * MoniBot Telegram - IOU Module
 * 
 * Handles IOU creation when a P2P recipient is a valid Telegram username
 * but NOT a registered MoniTag holder.
 *
 * Telegram does not expose user IDs from @mentions in text.
 * When a user is directly @mentioned in a group, we can check
 * msg.entities for "mention" type entities and extract the username.
 * The user ID can only be reliably obtained if the mentioned user
 * is in the same group and visible via getChat/getChatMember.
 */

const CREATE_IOU_URL = `${process.env.SUPABASE_URL}/functions/v1/create-iou`;

/**
 * Extract @username mentions from Telegram message entities.
 * Returns array of { username } (no IDs yet — need separate lookup).
 */
export function extractTelegramMentions(msg) {
  const mentions = [];
  if (!msg.entities) return mentions;
  
  for (const entity of msg.entities) {
    if (entity.type === 'mention' && msg.text) {
      // @username mention
      const username = msg.text.substring(entity.offset + 1, entity.offset + entity.length);
      if (username.toLowerCase() !== 'monibot') {
        mentions.push({ username: username.toLowerCase() });
      }
    } else if (entity.type === 'text_mention' && entity.user) {
      // Inline mention with user object (user doesn't have a username)
      if (!entity.user.is_bot) {
        mentions.push({
          username: entity.user.username?.toLowerCase() || entity.user.first_name,
          userId: String(entity.user.id),
        });
      }
    }
  }
  return mentions;
}

/**
 * Try to resolve a Telegram username to a user ID via the bot API.
 * This only works if the user has interacted with the bot or is in a shared group.
 */
export async function resolveTelegramUserId(bot, chatId, username) {
  // Telegram doesn't have a direct username→ID lookup API.
  // We can try getChatMember if in a group, but need the user ID first.
  // Fallback: store username as the identifier and resolve ID when they link.
  
  // For group chats, try to find the user in recent chat members
  // This is a best-effort approach
  return null; // Will use username as identifier
}

/**
 * Create an IOU via the edge function.
 */
export async function createIOURecord({
  senderProfileId,
  senderPayTag,
  recipientUsername,
  platform,
  platformUserId,
  amount,
  chain,
  token,
  tokenSymbol,
  txHash,
  iouId,
}) {
  try {
    const resp = await fetch(CREATE_IOU_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        senderProfileId,
        senderPayTag,
        recipientIdentifier: `${platform}:${recipientUsername}`,
        platform,
        platformUserId: platformUserId || recipientUsername, // fallback to username if ID unavailable
        amount,
        chain,
        token,
        tokenSymbol,
        iouId: iouId || `iou_${platform}_${platformUserId || recipientUsername}_${Date.now()}`,
        txHash,
        expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('❌ IOU creation failed:', data.error);
      return null;
    }
    return data.iou;
  } catch (e) {
    console.error('❌ IOU creation error:', e.message);
    return null;
  }
}
