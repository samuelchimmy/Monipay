/**
 * Tempo Reply Bot Database Module
 * 
 * Polls unreplied Tempo transactions and generates AI replies.
 */

import { createClient } from '@supabase/supabase-js';
import { generateReply } from './replyGenerator.js';
import { postReply } from './twitter.js';

let supabase = null;

export function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  supabase = createClient(url, key);
  console.log('✅ Supabase initialized');
}

export async function processSocialQueue() {
  let processed = 0;

  try {
    console.log('📬 [Tempo Reply] Checking for unreplied transactions...');
    // Get unreplied Tempo transactions
    const { data: transactions, error } = await supabase
      .from('monibot_transactions')
      .select('*')
      .eq('chain', 'tempo')
      .eq('replied', false)
      .eq('status', 'completed')
      .not('tweet_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) throw error;
    if (!transactions?.length) {
      console.log('   No unreplied Tempo transactions.');
      return 0;
    }

    console.log(`📬 Found ${transactions.length} unreplied Tempo transactions`);

    for (const tx of transactions) {
      try {
        const reply = await generateReply(tx);
        if (!reply) {
          console.warn(`⚠️ No reply generated for ${tx.id}`);
          continue;
        }

        const success = await postReply(tx.tweet_id, reply);

        if (success) {
          await supabase
            .from('monibot_transactions')
            .update({ replied: true })
            .eq('id', tx.id);
          processed++;
          console.log(`✅ Replied to tweet ${tx.tweet_id}`);
        } else {
          // Increment retry count
          await supabase
            .from('monibot_transactions')
            .update({ retry_count: (tx.retry_count || 0) + 1 })
            .eq('id', tx.id);
        }
      } catch (replyError) {
        console.error(`❌ Reply error for ${tx.id}:`, replyError.message);
        await supabase
          .from('monibot_transactions')
          .update({
            retry_count: (tx.retry_count || 0) + 1,
            error_reason: replyError.message,
          })
          .eq('id', tx.id);
      }
    }
  } catch (err) {
    console.error('❌ Social queue error:', err.message);
  }

  return processed;
}

export { supabase };
