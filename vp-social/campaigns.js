/**
 * MoniBot VP-Social - Campaign Management v4.0
 * 
 * Logic:
 * - Network-aware templates (Base, BSC, Tempo).
 * - "Sigma / Gen Alpha" persona injected into all copy.
 * - Suffix/Round logic preserved to avoid Twitter duplicate flags.
 * - Link-free setup instructions.
 */

import { postTweet } from './twitter-oauth2.js';
import { getSupabase } from './database.js';
import { generateCampaignAnnouncement } from './gemini.js';

// ============ Sigma Campaign Templates (Network-Aware) ============
// Variables: {amount}, {count}, {token}, {round}, {id4}

const CAMPAIGN_TEMPLATES = [
  `W Aura Alert! 🗿 First {count} monitags in the replies get {amount} {token}. MoniPay account required. No cap.`,
  `Giving away {amount} {token} to {count} Sigmas right now. Drop your monitag and stop being an NPC. 🤫`,
  `{count} grants of {amount} {token} are locked in. 🔵 Reply with your tag. First come, first served.`,
  `Sigma Challenge: be one of the first {count} to drop a monitag and claim {amount} {token}. 📈`,
  `{amount} {token} waiting for {count} people. All you need is a MoniPay tag. W energy only. ⚡`,
  `Quick Sigma drop. {count} spots. {amount} {token} each. Monitag in the replies. 🤫🧏‍♂️`,
  `Looking for {count} goated monitags. Each gets {amount} {token} sent straight to their vault. 💰`,
  `Onchain rizz is real. {amount} {token} for the next {count} monitags I see. 🔵`,
  `This is not a drill. {count} Sigmas are about to get {amount} {token}. Drop the tag. 🗿`,
  `Round {round}: {amount} {token} x {count} recipients. Drop your MoniPay tag to claim. 🤫`,
  `Onchain generosity hour. First {count} tags receive {amount} {token} each. Certified Sigma. 📈`,
  `{count} slots open. {amount} {token} per slot. Your tag is your ticket. No NPCs allowed. 🤖`,
  `Campaign #{id4}: sending {amount} {token} to {count} tags. Be fast or be cooked. 💀`,
  `Who wants {amount} {token}? {count} grants available. Tag required. Simple as that. 🤫`,
  `The bot has budget and the bot must rizz. {amount} {token} for {count} tags. Reply now. 🚽`,
  `Another day, another Sigma drop. {amount} {token} each for the first {count} tags. 🧢`,
  `MoniPay users: {amount} {token} is yours if you're among the first {count} to reply. W Aura. 🗿`,
  `Distributing {amount} {token} to {count} Sigmas. No gimmicks. Just drop your tag. ⚡`,
  `Budget unlocked. {count} monitags get {amount} {token} each. Clock is ticking. ⏳`,
  `Social payments in action. {amount} {token} going to the next {count} monitag replies. 🤫`,
];

// Track which templates were recently used to avoid repetition
let recentTemplateIndices = [];

/**
 * Pick a unique template and fill in variables.
 * Appends a short unique suffix to guarantee Twitter doesn't flag as duplicate.
 */
function buildUniqueCampaignTweet(grantAmount, maxParticipants, network = 'base') {
  // Resolve token name from network
  const tokenMap = {
    ink: 'USDT0',
    celo: 'USDT',
    bsc: 'USDT',
    base: 'USDC',
    solana: 'USDC',
    tempo: 'aUSD'
  };
  const token = tokenMap[network.toLowerCase()] || 'USDC';

  // Filter out recently used templates
  let available = CAMPAIGN_TEMPLATES
    .map((t, i) => i)
    .filter(i => !recentTemplateIndices.includes(i));
  
  if (available.length === 0) {
    recentTemplateIndices = recentTemplateIndices.slice(-3);
    available = CAMPAIGN_TEMPLATES
      .map((t, i) => i)
      .filter(i => !recentTemplateIndices.includes(i));
  }

  const idx = available[Math.floor(Math.random() * available.length)];
  recentTemplateIndices.push(idx);

  if (recentTemplateIndices.length > 10) {
    recentTemplateIndices = recentTemplateIndices.slice(-7);
  }

  // Unique identifiers
  const now = new Date();
  const round = Math.floor(Math.random() * 900) + 100;
  const id4 = `${now.getMonth() + 1}${now.getDate()}${String(round).slice(-2)}`;

  let tweet = CAMPAIGN_TEMPLATES[idx]
    .replace(/\{amount\}/g, `$${grantAmount}`)
    .replace(/\{count\}/g, String(maxParticipants))
    .replace(/\{token\}/g, token)
    .replace(/\{round\}/g, String(round))
    .replace(/\{id4\}/g, id4);

  // micro-suffix for algorithmic safety
  const suffix = ` [${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}]`;
  tweet += suffix;

  return tweet;
}

/**
 * Generate a campaign tweet, preferring local templates over AI.
 */
export async function generateUniqueCampaignTweet({ budget, grantAmount, maxParticipants, network }) {
  try {
    return buildUniqueCampaignTweet(grantAmount, maxParticipants, network || 'base');
  } catch (err) {
    console.error('Template generation failed, falling back to AI:', err.message);
    return generateCampaignAnnouncement({ budget, grantAmount, maxParticipants });
  }
}

/**
 * Executes the logic to post a new campaign tweet and log it to the DB.
 */
export async function postCampaign(timeSlot, maxGrants, grantAmount, network = 'base') {
  try {
    console.log(`\n📢 Posting ${timeSlot} Sigma Campaign on ${network.toUpperCase()}...`);
    const supabase = getSupabase();

    const campaignText = buildUniqueCampaignTweet(grantAmount, maxGrants, network);
    const tweetId = await postTweet(campaignText);

    console.log(`  ✅ Campaign posted: ${tweetId} (network: ${network})`);

    // Log to DB - Handshake for the Worker Bot
    await supabase.from('campaigns').insert({
      tweet_id: tweetId,
      message: campaignText,
      type: 'grant',
      status: 'active',
      grant_amount: grantAmount,
      max_participants: maxGrants,
      budget_allocated: maxGrants * grantAmount,
      posted_at: new Date().toISOString(),
      network: network
    });
    
  } catch (error) {
    console.error('❌ Campaign posting error:', error.message);
  }
}
