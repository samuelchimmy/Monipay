import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  verifyRequestSignature, 
  checkRateLimit, 
  corsHeaders, 
  rateLimitedResponse, 
  unauthorizedResponse 
} from '../_shared/security.ts';

// Rate limit config: 5 requests per minute per payTag
const RATE_LIMIT_CONFIG = { windowMs: 60_000, maxRequests: 5, keyPrefix: 'support' };

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
      console.warn('Support: Signature verification failed:', signatureResult.error);
      return unauthorizedResponse(signatureResult.error || 'Invalid signature');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = JSON.parse(bodyText);
    const { action, payTag, profileId } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ownership credentials
    if (!payTag && !profileId) {
      return new Response(
        JSON.stringify({ error: 'Either payTag or profileId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check
    const rateLimitKey = payTag || profileId || 'anonymous';
    const rateLimitResult = await checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.allowed) {
      console.warn(`Support: Rate limit exceeded for ${rateLimitKey}`);
      return rateLimitedResponse(rateLimitResult);
    }

    switch (action) {
      case 'listTickets': {
        // List all tickets for a user
        let query = supabase
          .from('support_tickets')
          .select('id, subject, status, priority, created_at, updated_at')
          .order('updated_at', { ascending: false });

        if (profileId) {
          query = query.eq('profile_id', profileId);
        } else if (payTag) {
          query = query.eq('pay_tag', payTag.toLowerCase());
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching tickets:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch tickets' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ tickets: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getTicket': {
        // Get a specific ticket with its messages
        const { ticketId } = body;
        
        if (!ticketId) {
          return new Response(
            JSON.stringify({ error: 'ticketId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify ownership - fetch ticket and check it belongs to this user
        let ticketQuery = supabase
          .from('support_tickets')
          .select('id, subject, status, priority, created_at, updated_at')
          .eq('id', ticketId);

        if (profileId) {
          ticketQuery = ticketQuery.eq('profile_id', profileId);
        } else if (payTag) {
          ticketQuery = ticketQuery.eq('pay_tag', payTag.toLowerCase());
        }

        const { data: ticket, error: ticketError } = await ticketQuery.single();

        if (ticketError || !ticket) {
          return new Response(
            JSON.stringify({ error: 'Ticket not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch messages for this ticket
        const { data: messages, error: messagesError } = await supabase
          .from('support_messages')
          .select('id, sender_type, message, created_at')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch messages' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ ticket, messages }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getMessages': {
        // Get messages for a ticket (after verifying ownership)
        const { ticketId } = body;
        
        if (!ticketId) {
          return new Response(
            JSON.stringify({ error: 'ticketId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // First verify this ticket belongs to the user
        let ownershipQuery = supabase
          .from('support_tickets')
          .select('id')
          .eq('id', ticketId);

        if (profileId) {
          ownershipQuery = ownershipQuery.eq('profile_id', profileId);
        } else if (payTag) {
          ownershipQuery = ownershipQuery.eq('pay_tag', payTag.toLowerCase());
        }

        const { data: ticketCheck, error: ownershipError } = await ownershipQuery.single();

        if (ownershipError || !ticketCheck) {
          return new Response(
            JSON.stringify({ error: 'Ticket not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch messages
        const { data: messages, error: messagesError } = await supabase
          .from('support_messages')
          .select('id, sender_type, message, created_at')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch messages' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ messages }),
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
    console.error('Support function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
