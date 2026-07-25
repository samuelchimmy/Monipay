/**
 * Tempo Reply Bot Twitter Module
 * Uses OAuth 2.0 with refresh token stored in DB.
 */

import { TwitterApi } from 'twitter-api-v2';
import { supabase } from './database.js';

let twitterClient = null;
const BOT_SETTINGS_KEY = 'twitter_refresh_token_tempo';

export async function initTwitterOAuth2() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET');
    process.exit(1);
  }

  try {
    // Try to get refresh token from DB
    const { data: setting } = await supabase
      .from('bot_settings')
      .select('value')
      .eq('key', BOT_SETTINGS_KEY)
      .single();

    if (setting?.value) {
      const client = new TwitterApi({
        clientId,
        clientSecret,
      });

      const { client: refreshedClient, refreshToken } = await client.refreshOAuth2Token(setting.value);
      twitterClient = refreshedClient;

      // Store new refresh token
      await supabase
        .from('bot_settings')
        .upsert({ key: BOT_SETTINGS_KEY, value: refreshToken });

      console.log('✅ Twitter OAuth 2.0 initialized (refreshed token)');
    } else {
      console.warn('⚠️ No OAuth 2.0 refresh token found in DB');
      console.warn('   Run the OAuth flow to get a refresh token first');
    }
  } catch (error) {
    console.error('❌ Twitter OAuth 2.0 init failed:', error.message);
  }
}

export async function postReply(tweetId, text) {
  if (!twitterClient) {
    console.warn('⚠️ Twitter client not initialized, skipping reply');
    return false;
  }

  try {
    await twitterClient.v2.reply(text, tweetId);
    return true;
  } catch (error) {
    if (error.code === 403) {
      console.error(`❌ 403 Forbidden replying to ${tweetId}: ${error.message}`);
    } else if (error.code === 429) {
      console.error(`⏳ Rate limited, will retry next cycle`);
    } else {
      console.error(`❌ Reply failed: ${error.message}`);
    }
    return false;
  }
}
