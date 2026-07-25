/**
 * MoniBot Campaign - Admin Edge Function
 * 
 * Secured by wallet signature verification (no Supabase Auth required).
 * Only the @monibot wallet can trigger campaign actions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";
import { checkAdminOrigin, getAdminCorsHeaders } from "../_shared/security.ts";

// @monibot profile ID and wallet address (admin)
const MONIBOT_PROFILE_ID = "0cb9ca32-7ef2-4ced-8389-9dbca5156c94";
const MONIBOT_WALLET_ADDRESS = "0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3"; // lowercase for comparison
// Treasury wallet: 0xfa2B8eD012f756E22E780B772d604af4575d5fcf

interface CampaignPayload {
  message?: string;
  grant_amount?: number;
  max_participants?: number;
  scheduled_at?: string;
  network?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getAdminCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Origin check
  const originBlock = checkAdminOrigin(req);
  if (originBlock) return originBlock;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse body
    const body = await req.json();
    const { action, signature, timestamp, nonce } = body;

    // Verify wallet signature (required for all actions)
    const walletAddress = req.headers.get('x-wallet-address')?.toLowerCase();
    const walletSignature = req.headers.get('x-wallet-signature');

    if (!walletAddress || !walletSignature) {
      console.error('[monibot-campaign] Missing wallet auth headers');
      return new Response(JSON.stringify({ error: 'Wallet authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if wallet is @monibot
    if (walletAddress !== MONIBOT_WALLET_ADDRESS) {
      console.error('[monibot-campaign] Unauthorized wallet:', walletAddress);
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the signature
    const signedMessage = `monibot-campaign:${action}:${timestamp || Date.now()}`;
    
    try {
      const isValidSignature = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message: signedMessage,
        signature: walletSignature as `0x${string}`,
      });

      if (!isValidSignature) {
        console.error('[monibot-campaign] Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (sigError) {
      console.error('[monibot-campaign] Signature verification error:', sigError);
      return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check timestamp freshness (5 minute window)
    const requestTime = parseInt(timestamp || '0', 10);
    const now = Date.now();
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      console.error('[monibot-campaign] Request expired:', { requestTime, now });
      return new Response(JSON.stringify({ error: 'Request expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[monibot-campaign] Authenticated request:', { action, walletAddress });

    if (!action) {
      return new Response(JSON.stringify({ error: 'action required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'trigger-campaign': {
        const payload: CampaignPayload = body.payload || {};
        const grantAmount = payload.grant_amount || 1.00;
        const maxParticipants = payload.max_participants || 5;
        const budget = maxParticipants * grantAmount;
        const network = payload.network || 'base';

        // Schedule immediately (VP-Social will pick it up)
        const { data: job, error: insertError } = await supabase
          .from('scheduled_jobs')
          .insert({
            type: 'campaign_post',
            status: 'completed',
            scheduled_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            payload: {
              message: payload.message || null,
              grant_amount: grantAmount,
              max_participants: maxParticipants,
              budget,
              network
            },
            result: {
              ready_for_social: true,
              triggered_by: 'manual',
              triggered_at: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (insertError) throw insertError;

        console.log('[monibot-campaign] Campaign triggered manually:', { job_id: job.id, network });

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Campaign triggered on ${network.toUpperCase()}! VP-Social will post within 15 seconds.`,
          job_id: job.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'schedule-campaigns': {
        // AI-decided scheduling - create 3 scheduled posts for today
        const now = new Date();
        const today = new Date(now.toISOString().split('T')[0]);
        
        // Get current hour in EST
        const estOffset = -5; // EST is UTC-5
        const utcHours = now.getUTCHours();
        const estHours = (utcHours + estOffset + 24) % 24;
        
        // AI-decided times: morning (9-11am), afternoon (1-3pm), evening (6-8pm) EST
        const scheduleTimes = [
          { hour: 10, label: 'morning' },
          { hour: 14, label: 'afternoon' },
          { hour: 19, label: 'evening' }
        ].filter(t => t.hour > estHours); // Only schedule future times

        const grantAmount = body.grant_amount || 1.00;
        const maxParticipants = body.max_participants || 5;

        const scheduledJobs = [];

        for (const time of scheduleTimes) {
          const scheduledAt = new Date(today);
          scheduledAt.setUTCHours(time.hour - estOffset, 0, 0, 0);

          const { data: job, error } = await supabase
            .from('scheduled_jobs')
            .insert({
              type: 'campaign_post',
              status: 'pending',
              scheduled_at: scheduledAt.toISOString(),
              payload: {
                message: null, // AI will generate
                grant_amount: grantAmount,
                max_participants: maxParticipants,
                budget: maxParticipants * grantAmount,
                time_slot: time.label
              }
            })
            .select()
            .single();

          if (!error && job) {
            scheduledJobs.push({
              id: job.id,
              scheduled_at: scheduledAt.toISOString(),
              time_slot: time.label
            });
          }
        }

        return new Response(JSON.stringify({ 
          success: true,
          scheduled: scheduledJobs,
          message: `Scheduled ${scheduledJobs.length} campaigns for today`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-schedule': {
        // Get today's scheduled campaigns
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: jobs, error } = await supabase
          .from('scheduled_jobs')
          .select('*')
          .eq('type', 'campaign_post')
          .gte('scheduled_at', today.toISOString())
          .lt('scheduled_at', tomorrow.toISOString())
          .order('scheduled_at', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true,
          schedule: jobs || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-activity': {
        // Get recent bot activity (transactions, campaigns)
        const limit = body.limit || 20;

        const [transactionsResult, campaignsResult] = await Promise.all([
          supabase
            .from('monibot_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit),
          supabase
            .from('campaigns')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)
        ]);

        return new Response(JSON.stringify({ 
          success: true,
          transactions: transactionsResult.data || [],
          campaigns: campaignsResult.data || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'mark-replied': {
        // Mark a transaction as replied (skip for 403 errors)
        const { transaction_id, skip_reason } = body;
        
        if (!transaction_id) {
          return new Response(JSON.stringify({ error: 'transaction_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('monibot_transactions')
          .update({ replied: true })
          .eq('id', transaction_id);

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true,
          message: `Transaction ${transaction_id} marked as replied (skip reason: ${skip_reason})`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'cancel-schedule': {
        const { job_id } = body;
        
        if (!job_id) {
          return new Response(JSON.stringify({ error: 'job_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('scheduled_jobs')
          .update({ status: 'cancelled' })
          .eq('id', job_id)
          .eq('status', 'pending');

        if (error) throw error;

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Campaign cancelled'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete-job': {
        const { job_id } = body;
        
        if (!job_id) {
          return new Response(JSON.stringify({ error: 'job_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('scheduled_jobs')
          .delete()
          .eq('id', job_id);

        if (error) throw error;

        console.log('[monibot-campaign] Job deleted:', job_id);

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Job deleted'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete-campaign': {
        const { campaign_id } = body;
        
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('campaigns')
          .delete()
          .eq('id', campaign_id);

        if (error) throw error;

        console.log('[monibot-campaign] Campaign deleted:', campaign_id);

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Campaign deleted'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'mark-campaign-done': {
        const { campaign_id } = body;
        
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('campaigns')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', campaign_id);

        if (error) throw error;

        console.log('[monibot-campaign] Campaign marked done:', campaign_id);

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Campaign marked as done'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error: any) {
    console.error('[monibot-campaign] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
