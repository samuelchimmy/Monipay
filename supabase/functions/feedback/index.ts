import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  verifyRequestSignature, 
  checkRateLimit, 
  corsHeaders, 
  rateLimitedResponse, 
  unauthorizedResponse 
} from '../_shared/security.ts';

// Rate limit config: 5 requests per minute per payTag
const RATE_LIMIT_CONFIG = { windowMs: 60_000, maxRequests: 5, keyPrefix: 'feedback' };

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read body for signature verification
    const bodyText = await req.text();
    
    // Verify request signature (HMAC-SHA256)
    const signatureResult = await verifyRequestSignature(req, bodyText);
    if (!signatureResult.valid) {
      console.warn('Feedback: Signature verification failed:', signatureResult.error);
      return unauthorizedResponse(signatureResult.error || 'Invalid signature');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = JSON.parse(bodyText);
    const { action, payTag, profileId } = body;

    // Validate required fields based on action
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check
    const rateLimitKey = payTag || profileId || 'anonymous';
    const rateLimitResult = await checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.allowed) {
      console.warn(`Feedback: Rate limit exceeded for ${rateLimitKey}`);
      return rateLimitedResponse(rateLimitResult);
    }

    switch (action) {
      case 'list': {
        // List feedback for a specific user (by payTag or profileId)
        if (!payTag && !profileId) {
          return new Response(
            JSON.stringify({ error: 'Either payTag or profileId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabase
          .from('feedback')
          .select('id, type, message, status, admin_notes, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (profileId) {
          query = query.eq('profile_id', profileId);
        } else if (payTag) {
          query = query.eq('pay_tag', payTag.toLowerCase());
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching feedback:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch feedback' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ feedback: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get': {
        // Get a specific feedback item
        const { feedbackId } = body;
        
        if (!feedbackId) {
          return new Response(
            JSON.stringify({ error: 'feedbackId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify ownership
        if (!payTag && !profileId) {
          return new Response(
            JSON.stringify({ error: 'Either payTag or profileId is required for verification' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabase
          .from('feedback')
          .select('id, type, message, status, admin_notes, created_at, updated_at')
          .eq('id', feedbackId);

        if (profileId) {
          query = query.eq('profile_id', profileId);
        } else if (payTag) {
          query = query.eq('pay_tag', payTag.toLowerCase());
        }

        const { data, error } = await query.single();

        if (error || !data) {
          return new Response(
            JSON.stringify({ error: 'Feedback not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ feedback: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Feedback function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
