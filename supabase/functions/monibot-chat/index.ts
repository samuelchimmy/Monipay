/**
 * MoniBot AI Chat - Intelligent admin assistant
 * 
 * Hybrid control: auto-executes read-only ops (stats, logs, analysis),
 * requires confirmation for high-risk ops (campaigns, spending).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";
import { checkAdminOrigin, getAdminCorsHeaders, checkRateLimit, RATE_LIMITS, rateLimitedResponse } from "../_shared/security.ts";

const MONIBOT_WALLET_ADDRESS = "0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3";

Deno.serve(async (req) => {
  const corsHeaders = getAdminCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Origin check
  const originBlock = checkAdminOrigin(req);
  if (originBlock) return originBlock;

  try {
    // Verify @monibot wallet signature
    const walletAddress = req.headers.get('x-wallet-address')?.toLowerCase();
    const walletSignature = req.headers.get('x-wallet-signature');

    if (!walletAddress || !walletSignature || walletAddress !== MONIBOT_WALLET_ADDRESS) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const signedMessage = `monibot-campaign:chat:${body.timestamp || Date.now()}`;
    
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message: signedMessage,
        signature: walletSignature as `0x${string}`,
      });
      if (!isValid) throw new Error('Invalid signature');
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limit admin chat requests
    const chatRateLimit = await checkRateLimit(walletAddress!, RATE_LIMITS.admin);
    if (!chatRateLimit.allowed) {
      return rateLimitedResponse(chatRateLimit);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Gather real-time context for the AI
    const [txResult, campaignResult, scheduleResult, logsResult] = await Promise.all([
      supabase.from('monibot_transactions').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('scheduled_jobs').select('*').eq('type', 'campaign_post').eq('status', 'pending').order('scheduled_at', { ascending: true }).limit(5),
      supabase.from('bot_logs').select('*').order('created_at', { ascending: false }).limit(15),
    ]);

    // Build system context
    const recentTxs = txResult.data || [];
    const campaigns = campaignResult.data || [];
    const pendingJobs = scheduleResult.data || [];
    const recentLogs = logsResult.data || [];

    const baseTxs = recentTxs.filter((t: any) => t.chain === 'BASE');
    const bscTxs = recentTxs.filter((t: any) => t.chain === 'BSC');
    const successTxs = recentTxs.filter((t: any) => t.tx_hash?.startsWith('0x'));
    const errorTxs = recentTxs.filter((t: any) => t.tx_hash?.includes('ERROR') || t.tx_hash?.includes('SKIP'));
    const unreplied = recentTxs.filter((t: any) => !t.replied);

    const systemPrompt = `You are MoniBot AI, the intelligent command center for the MoniPay autonomous social commerce agent.

## Your Role
You help the @monibot admin understand bot operations, analyze performance, and make decisions about campaigns. You have HYBRID control:
- **Auto-execute**: Stats queries, log analysis, performance reports, recommendations
- **Require confirmation**: Campaign creation, budget changes, network switches, anything that spends money

## Current State (Real-Time)
- **Recent transactions**: ${recentTxs.length} total (${baseTxs.length} Base, ${bscTxs.length} BSC)
- **Success rate**: ${successTxs.length}/${recentTxs.length} successful
- **Errors**: ${errorTxs.length} failed (${errorTxs.map((t: any) => t.tx_hash?.split('_')[0] || t.error_reason || 'unknown').join(', ') || 'none'})
- **Unreplied**: ${unreplied.length} awaiting social feedback
- **Active campaigns**: ${campaigns.filter((c: any) => c.status === 'active').length}
- **Pending scheduled**: ${pendingJobs.length} jobs queued
- **Recent logs**: ${recentLogs.length} entries (${recentLogs.filter((l: any) => l.level === 'error').length} errors)

## Active Campaigns
${campaigns.slice(0, 5).map((c: any) => `- [${c.network?.toUpperCase()}] ${c.status}: $${c.grant_amount}×${c.max_participants || '?'} (${c.current_participants || 0} claimed) - ${c.message?.substring(0, 50) || 'No message'}`).join('\n') || 'None'}

## Pending Schedule
${pendingJobs.map((j: any) => `- ${j.scheduled_at}: $${j.payload?.grant_amount}×${j.payload?.max_participants}`).join('\n') || 'None scheduled'}

## Recent Errors
${errorTxs.slice(0, 5).map((t: any) => `- ${t.chain} | ${t.tx_hash || t.error_reason} | ${t.recipient_pay_tag || 'unknown'}`).join('\n') || 'No errors'}

## Recent Logs
${recentLogs.slice(0, 5).map((l: any) => `[${l.service}] ${l.level}: ${l.message?.substring(0, 80)}`).join('\n') || 'No recent logs'}

## Guidelines
- Be concise and data-driven. Use numbers.
- When recommending campaigns, consider: time of day (EST), budget levels, recent engagement.
- For high-risk actions, explain what you intend to do and ask for confirmation.
- Use ✅ ❌ ⚠️ 📊 🤖 emojis for visual clarity.
- Always mention which network (Base/BSC) when discussing transactions or campaigns.
- If asked about logs, provide the most relevant recent entries.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...body.messages,
    ];

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited. Try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errText = await aiResponse.text();
      console.error('[monibot-chat] AI error:', status, errText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error: any) {
    console.error('[monibot-chat] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
