/**
 * MoniBot BSC Worker - IOU Module
 * 
 * Handles IOU creation when a P2P recipient is a valid X/Twitter user
 * but NOT a registered MoniTag holder. BSC variant (USDT).
 *
 * X/Twitter User ID Resolution:
 * - Method 1 (preferred): Extract from tweet.entities.mentions (already in payload)
 * - Method 2 (fallback): User Lookup API: GET /2/users/by/username/:username
 */

const CREATE_IOU_URL = `${process.env.SUPABASE_URL}/functions/v1/create-iou`;

/**
 * Extract mentioned user IDs from tweet entities.
 */
export function extractMentionedUsers(tweet) {
  const mentions = [];
  if (!tweet.entities?.mentions) return mentions;

  for (const m of tweet.entities.mentions) {
    const username = (m.username || '').toLowerCase();
    if (username === 'monibot' || username === 'monipay') continue;
    if (m.id) {
      mentions.push({ username, userId: m.id });
    } else {
      mentions.push({ username, userId: null });
    }
  }
  return mentions;
}

/**
 * Resolve a Twitter username to a user ID via the User Lookup endpoint.
 */
export async function resolveXUserId(twitterClient, username) {
  try {
    const result = await twitterClient.v2.userByUsername(username);
    if (result.data?.id) {
      return { username: result.data.username.toLowerCase(), userId: result.data.id };
    }
    return null;
  } catch (e) {
    console.error(`   ⚠️ X User Lookup failed for @${username}:`, e.message);
    return null;
  }
}

/**
 * Resolve recipient: try tweet entities first, then User Lookup API.
 */
export async function resolveXRecipient(twitterClient, tweet, targetUsername) {
  const mentions = extractMentionedUsers(tweet);
  const fromEntities = mentions.find(m => m.username === targetUsername.toLowerCase());
  if (fromEntities?.userId) {
    console.log(`   🔍 Resolved @${targetUsername} from tweet entities: ID ${fromEntities.userId}`);
    return fromEntities;
  }

  console.log(`   🔍 Looking up @${targetUsername} via X User Lookup API...`);
  const lookup = await resolveXUserId(twitterClient, targetUsername);
  if (lookup) {
    console.log(`   ✅ Resolved @${targetUsername}: ID ${lookup.userId}`);
    return lookup;
  }

  return null;
}

/**
 * Create an IOU via the create-iou edge function.
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
        recipientIdentifier: `twitter:${recipientUsername}`,
        platform,
        platformUserId: platformUserId || recipientUsername,
        amount,
        chain,
        token,
        tokenSymbol,
        iouId: iouId || `iou_twitter_${platformUserId || recipientUsername}_${Date.now()}`,
        txHash,
        expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
