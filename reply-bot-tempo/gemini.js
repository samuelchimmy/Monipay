/**
 * Tempo Reply Bot Gemini Module
 * Uses monibot-ai Edge Function for AI replies.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export function initGemini() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    console.log('✅ AI (monibot-ai Edge Function) ready');
  } else {
    console.warn('⚠️ AI not configured - using template replies only');
  }
}

export async function generateAIReply(prompt) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/monibot-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'generate-reply',
        prompt,
        context: 'tempo',
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.reply || null;
  } catch {
    return null;
  }
}
