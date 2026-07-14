/**
 * MoniBot Discord - MagicPay Module
 * 
 * Handles MagicPay (Social Escrow) creation when a P2P recipient is a
 * valid Discord user but NOT a registered MoniTag holder.
 */

import { getSupabase } from './database.js';
import { getAgentHeaders } from './src/middleware/agentFeedback.js';

const CREATE_MAGIC_PAY_URL = `${process.env.SUPABASE_URL}/functions/v1/create-iou`;

const SLANG_LOGS = [
  "MagicPay bridge: Certified Sigma activity 🤫🧏‍♂️",
  "Resolving recipient with maximum Rizz... 📈",
  "MagicPay flow is BUSSIN ⚡",
  "No cap, finding your friends in the Shadow Realm 🪄",
  "Aura levels rising during MagicPay resolution 🗿"
];

function getRandomSlang() {
  return SLANG_LOGS[Math.floor(Math.random() * SLANG_LOGS.length)];
}

/**
 * Extract Discord User ID (Snowflake) from message mentions.
 */
export function extractDiscordMentions(message) {
  const mentions = [];
  if (message.mentions?.users?.size > 0) {
    message.mentions.users.forEach((user) => {
      if (!user.bot) {
        mentions.push({
          platform: 'discord',
          platformUserId: user.id, // Raw Snowflake
          username: user.username,
          displayName: user.displayName || user.username,
        });
      }
    });
  }
  return mentions;
}

/**
 * Check if a Discord user has a linked MoniPay profile.
 */
export async function getProfileByDiscordUserId(discordId) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();
  return data;
}

/**
 * Create a MagicPay record via the edge function.
 * Includes sender social identity to display on the claim card.
 */
export async function createMagicPayRecord({
  senderProfileId,
  senderPayTag,
  senderSource,       // New: 'profile' | 'wallet_profile'
  senderHandle,       // New: Discord username (e.g. @jade)
  senderPlatformUserId, // New: Discord ID of the sender
  recipientUsername,
  platformUserId,
  amount,
  chain,
  token,
  tokenSymbol,
  txHash,
  iouId,
  expiry,
}) {
  try {
    const resp = await fetch(CREATE_MAGIC_PAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        ...getAgentHeaders(),
      },
      body: JSON.stringify({
        senderProfileId,
        senderPayTag,
        senderSource,
        senderHandle,        // Passed to Edge Function for the 'FROM' field
        senderPlatformUserId, // Records the sender's Discord ID
        recipientIdentifier: `discord:${recipientUsername || platformUserId}`,
        platform: 'discord',
        platformUserId,
        amount,
        chain,
        token,
        tokenSymbol,
        iouId,
        txHash,
        // Default to 180 days to match the IOURegistry smart contract expiry
        expiry: expiry || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('❌ MagicPay record creation failed:', data.error);
      return null;
    }
    console.log(`✅ [MagicPay] ${getRandomSlang()}`);
    return data.iou;
  } catch (e) {
    console.error('❌ MagicPay record creation error:', e.message);
    return null;
  }
}

/**
 * Resolve a recipient: first try MoniTag, then Discord mention.
 * Priority: Linked MoniTag profile > Discord Snowflake (MagicPay).
 */
export async function resolveRecipient(tag, message) {
  console.log(`[MagicPay] ${getRandomSlang()}`);

  // 1. Try to find if the tag itself is a Discord user mention or username
  const mentions = extractDiscordMentions(message);
  
  const mentioned = mentions.find(m => 
    m.username.toLowerCase() === tag.toLowerCase() ||
    m.displayName.toLowerCase() === tag.toLowerCase() ||
    tag.includes(m.platformUserId)
  );

  if (mentioned) {
    // Check if this Discord user is already linked
    const profile = await getProfileByDiscordUserId(mentioned.platformUserId);
    if (profile) {
      return { type: 'monitag', profile };
    }
    // Not linked -> MagicPay route
    return { type: 'magicpay', discordUser: mentioned };
  }

  return null;
}
