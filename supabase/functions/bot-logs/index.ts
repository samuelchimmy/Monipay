/**
 * Bot Logs Webhook - Receives logs from Railway log drain
 * 
 * Railway sends POST requests with log lines. This function
 * parses them and stores in the bot_logs table.
 * 
 * Also serves as an API for the MoniBot dashboard to read logs
 * (authenticated via wallet signature).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";

import { checkAdminOrigin, getAdminCorsHeaders, checkRateLimit, RATE_LIMITS, rateLimitedResponse } from "../_shared/security.ts";

const MONIBOT_WALLET_ADDRESS = "0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3";
const RAILWAY_WEBHOOK_TOKEN = Deno.env.get('RAILWAY_WEBHOOK_TOKEN') || '';

function parseLogLevel(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('❌') || lower.includes('error') || lower.includes('failed')) return 'error';
  if (lower.includes('⚠') || lower.includes('warn')) return 'warn';
  if (lower.includes('🔍') || lower.includes('debug')) return 'debug';
  return 'info';
}

function detectService(message: string, meta?: any): string {
  // Try metadata first
  if (meta?.service) return meta.service;
  if (meta?.deploymentId) {
    const id = String(meta.deploymentId).toLowerCase();
    if (id.includes('worker-bot-bsc')) return 'worker-bot-bsc';
    if (id.includes('worker-bot')) return 'worker-bot';
    if (id.includes('vp-social') || id.includes('reply')) return 'vp-social';
    if (id.includes('reply-bot-bsc')) return 'reply-bot-bsc';
  }
  // Fallback: detect from message content
  if (message.includes('[BSC]') || message.includes('BSC Reply')) return 'worker-bot-bsc';
  if (message.includes('[VP-Social]') || message.includes('vp-social')) return 'vp-social';
  if (message.includes('reply-bot-bsc')) return 'reply-bot-bsc';
  return 'worker-bot';
}

Deno.serve(async (req) => {
  const corsHeaders = getAdminCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Origin check for admin functions
  const originBlock = checkAdminOrigin(req);
  if (originBlock) return originBlock;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // POST = Railway webhook ingestion OR dashboard reading logs
    if (req.method === 'POST') {
      const body = await req.json();

      // If action field present, it's a dashboard request
      if (body.action) {
        return await handleDashboardRequest(req, body, supabase);
      }

      // Otherwise it's a Railway log drain webhook
      // Authenticate: accept x-railway-token, Bearer service-role-key, or body.token
      const headerToken = req.headers.get('x-railway-token');
      const authHeader = req.headers.get('authorization');
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

      const isAuthed =
        (headerToken && headerToken === RAILWAY_WEBHOOK_TOKEN) ||
        (bearerToken && bearerToken === serviceRoleKey) ||
        (body.token && body.token === RAILWAY_WEBHOOK_TOKEN);

      if (!isAuthed) {
        console.warn('[bot-logs] Unauthorized webhook attempt', {
          hasRailwayToken: !!headerToken,
          hasAuthHeader: !!authHeader,
          hasBearerToken: !!bearerToken,
          bearerLength: bearerToken?.length,
          serviceRoleLength: serviceRoleKey?.length,
          bearerPrefix: bearerToken?.substring(0, 10),
          serviceRolePrefix: serviceRoleKey?.substring(0, 10),
          bodyKeys: Object.keys(body || {}),
        });
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Railway log drain sends logs in various formats
      const logs = Array.isArray(body) ? body : (body.logs || [body]);
      
      const rows = logs.map((log: any) => {
        const message = typeof log === 'string' ? log : (log.message || log.line || log.text || JSON.stringify(log));
        return {
          service: detectService(message, log),
          level: parseLogLevel(message),
          message: String(message).substring(0, 4000),
          metadata: typeof log === 'object' ? { timestamp: log.timestamp, raw: log } : {},
        };
      }).filter((r: any) => r.message.trim().length > 0);

      if (rows.length > 0) {
        const { error } = await supabase.from('bot_logs').insert(rows);
        if (error) {
          console.error('Failed to insert logs:', error);
          return new Response(JSON.stringify({ error: 'Insert failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, count: rows.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[bot-logs] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleDashboardRequest(req: Request, body: any, supabase: any) {
  const corsHeaders = getAdminCorsHeaders(req);

  // Verify @monibot wallet signature
  const walletAddress = req.headers.get('x-wallet-address')?.toLowerCase();
  const walletSignature = req.headers.get('x-wallet-signature');

  if (!walletAddress || !walletSignature || walletAddress !== MONIBOT_WALLET_ADDRESS) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const signedMessage = `monibot-campaign:${body.action}:${body.timestamp || Date.now()}`;
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

  // Rate limit: use stricter limits for write operations
  const isWriteAction = ['delete-old-logs', 'delete-all-logs', 'admin-reply-feedback'].includes(body.action);
  const rateConfig = isWriteAction ? RATE_LIMITS.adminWrite : RATE_LIMITS.admin;
  const rateLimit = await checkRateLimit(walletAddress, rateConfig);
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  switch (body.action) {
    case 'get-logs': {
      const service = body.service || null;
      const level = body.level || null;
      const limit = Math.min(body.limit || 100, 500);
      const before = body.before || null;

      let query = supabase
        .from('bot_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (service) query = query.eq('service', service);
      if (level) query = query.eq('level', level);
      if (before) query = query.lt('created_at', before);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ logs: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'get-stats': {
      // Aggregate MoniBot social tx + campaign stats across ALL supported chains.
      // monibot_transactions.chain has mixed casing (BASE/base/CELO/celo/etc.) — group in code.
      const CHAINS = ['base', 'bsc', 'celo', 'ink', 'tempo', 'solana'];
      const empty = () => ({
        total_transactions: 0,
        p2p_count: 0,
        p2p_volume: 0,
        campaigns: 0,
        grants_issued: 0,
        grants_volume: 0,
      });
      const out: Record<string, ReturnType<typeof empty>> = {};
      for (const c of CHAINS) out[c] = empty();

      const [txRes, campRes] = await Promise.all([
        supabase.from('monibot_transactions').select('chain, type, amount, tx_hash').limit(50000),
        supabase.from('campaigns').select('network').limit(10000),
      ]);

      for (const r of (txRes.data || []) as any[]) {
        const k = String(r.chain || '').toLowerCase();
        if (!out[k]) continue;
        out[k].total_transactions += 1;
        const t = String(r.type || '').toLowerCase();
        const amt = Number(r.amount || 0);
        const hash = String(r.tx_hash || '');
        const onChain = hash && !hash.startsWith('ERROR') && !hash.startsWith('REJECTED');
        if (t === 'p2p_command' || t === 'p2p' || t === 'magicpay' || t === 'magicpay_command') {
          out[k].p2p_count += 1;
          out[k].p2p_volume += amt;
        }
        if (t === 'grant' && onChain) {
          out[k].grants_issued += 1;
          out[k].grants_volume += amt;
        }
      }
      for (const c of (campRes.data || []) as any[]) {
        const k = String(c.network || '').toLowerCase();
        if (out[k]) out[k].campaigns += 1;
      }

      // Back-compat: keep base/bsc at root, plus new `chains` map.
      return new Response(JSON.stringify({
        base: out.base,
        bsc: out.bsc,
        chains: out,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'admin-lookup': {
      const q = body.query || '';
      let profileData = null;
      let activationData = null;

      // Search profiles, then fall back to wallet_profiles (bot-only accounts).
      const cols = 'id, pay_tag, wallet_address, preferred_mode, preferred_network, created_at, x_username, x_user_id, x_verified, bot_allowance_amount, discord_id, discord_username, telegram_id, telegram_username, bluesky_id, bluesky_username, farcaster_fid, farcaster_username, google_email, tempo_address, solana_address, status';
      const isAddr = q.startsWith('0x');
      const value = q.toLowerCase().replace('@', '');

      let profileQ = supabase.from('profiles').select(cols);
      profileQ = isAddr ? profileQ.eq('wallet_address', value) : profileQ.eq('pay_tag', value);
      let { data: profile } = await profileQ.maybeSingle();

      if (!profile) {
        let wpQ = supabase.from('wallet_profiles')
          .select('id, pay_tag, wallet_address, preferred_network, created_at, x_username, x_user_id, x_verified, bot_allowance_amount, discord_id, discord_username, telegram_id, telegram_username, bluesky_id, bluesky_username, farcaster_fid, farcaster_username');
        wpQ = isAddr ? wpQ.eq('wallet_address', value) : wpQ.eq('pay_tag', value);
        const { data: wp } = await wpQ.maybeSingle();
        if (wp) {
          profile = {
            ...wp,
            preferred_mode: 'wallet-only',
            status: 'active',
          } as any;
        }
      }

      let socialTxs: any[] = [];
      let onchainTxs: any[] = [];
      let pendingMagicpay: any[] = [];
      if (profile) {
        profileData = profile;
        const { data: activations } = await supabase
          .from('activation_fundings')
          .select('chain, status, tx_hash')
          .eq('wallet_address', (profile as any).wallet_address);

        const CHAINS = ['base', 'bsc', 'celo', 'ink', 'tempo', 'solana'];
        const map: Record<string, { funded: boolean; tx_hash?: string }> = {};
        for (const c of CHAINS) map[c] = { funded: false };
        for (const a of activations || []) {
          const k = String((a as any).chain || '').toLowerCase();
          if (!map[k]) continue;
          map[k] = {
            funded: (a as any).status === 'funded',
            tx_hash: (a as any).tx_hash,
          };
        }
        activationData = map;

        // MoniBot social transaction history (sent OR received)
        const pid = (profile as any).id;
        const { data: stx } = await supabase
          .from('monibot_transactions')
          .select('id, chain, type, amount, fee, tx_hash, status, platform, payer_pay_tag, recipient_pay_tag, recipient_username, created_at, sender_id, receiver_id')
          .or(`sender_id.eq.${pid},receiver_id.eq.${pid}`)
          .order('created_at', { ascending: false })
          .limit(50);
        socialTxs = stx || [];

        // On-chain in-app transactions
        const { data: otx } = await supabase
          .from('transactions')
          .select('id, type, amount, fee, tx_hash, status, source, counterparty, payer_pay_tag, metadata, created_at')
          .eq('profile_id', pid)
          .order('created_at', { ascending: false })
          .limit(50);
        onchainTxs = otx || [];

        // Pending MagicPay (IOUs) addressed to this user's linked socials
        const { data: pious } = await supabase
          .from('ious')
          .select('id, iou_id, amount, token_symbol, chain, platform, platform_user_id, sender_handle, sender_pay_tag, created_at, expiry, status')
          .eq('status', 'pending')
          .or(`recipient_profile_id.eq.${pid}`)
          .limit(50);
        pendingMagicpay = pious || [];
      }

      return new Response(JSON.stringify({
        profile: profileData,
        activation: activationData,
        social_txs: socialTxs,
        onchain_txs: onchainTxs,
        pending_magicpay: pendingMagicpay,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'admin-feedbacks': {
      const status = body.status || null;
      let query = supabase
        .from('feedback')
        .select('id, type, message, status, admin_notes, pay_tag, email, profile_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ feedbacks: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'admin-reply-feedback': {
      const { feedbackId, adminNotes, newStatus } = body;
      if (!feedbackId || !adminNotes) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error } = await supabase
        .from('feedback')
        .update({ admin_notes: adminNotes, status: newStatus || 'reviewed', updated_at: new Date().toISOString() })
        .eq('id', feedbackId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'delete-old-logs': {
      const hours = body.hours || 24;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('bot_logs')
        .delete()
        .lt('created_at', cutoff)
        .select('id');
      if (error) throw error;
      return new Response(JSON.stringify({ deleted: data?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'delete-all-logs': {
      const { data, error } = await supabase
        .from('bot_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id');
      if (error) throw error;
      return new Response(JSON.stringify({ deleted: data?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'admin-system-stats': {
      const tables = [
        'profiles',
        'wallet_profiles',
        'transactions',
        'monibot_transactions',
        'orders',
        'products',
        'invoices',
        'feedback',
        'support_tickets',
        'api_keys',
        'campaigns',
        'bot_logs',
        'payment_links',
        'ious',
        'merchant_subscriptions',
        'store_settings',
        'activation_fundings',
        'customers',
        'infra_subscriptions',
        'arc_waitlist',
      ];
      const counts = await Promise.all(
        tables.map(async (table) => {
          const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
          return { table, count: count || 0 };
        })
      );

      const result: any = {};
      for (const { table, count } of counts) {
        result[`total_${table}`] = count;
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'admin-magicpay-stats': {
      // Aggregate MoniBot social transactions per chain.
      // monibot_transactions.chain values are upper/lowercase mix in the DB.
      const { data: rows, error } = await supabase
        .from('monibot_transactions')
        .select('chain, amount, fee')
        .eq('status', 'completed')
        .ilike('tx_hash', '0x%')
        .limit(50000);
      if (error) throw error;

      const out: Record<string, { count: number; volume: number; fees: number }> = {
        base: { count: 0, volume: 0, fees: 0 },
        bsc:  { count: 0, volume: 0, fees: 0 },
        celo: { count: 0, volume: 0, fees: 0 },
        ink:  { count: 0, volume: 0, fees: 0 },
        tempo:{ count: 0, volume: 0, fees: 0 },
        solana:{count: 0, volume: 0, fees: 0 },
      };
      for (const r of rows || []) {
        const k = String(r.chain || '').toLowerCase();
        if (!out[k]) continue;
        out[k].count += 1;
        out[k].volume += Number(r.amount || 0);
        out[k].fees += Number(r.fee || 0);
      }
      // Also include solana by tx_hash that's not 0x
      const { data: sol } = await supabase
        .from('monibot_transactions')
        .select('amount, fee')
        .eq('chain', 'solana')
        .eq('status', 'completed')
        .limit(50000);
      for (const r of sol || []) {
        out.solana.count += 1;
        out.solana.volume += Number(r.amount || 0);
        out.solana.fees += Number(r.fee || 0);
      }
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    case 'admin-magicpay-list': {
      // List MagicPay (IOU) entries filtered by status. Used for outreach to unclaimed recipients.
      const status = body.status || 'pending'; // pending | claimed | refunded | expired
      const platform = body.platform || null;  // discord | telegram | twitter
      const chain = body.chain || null;
      const limit = Math.min(Number(body.limit) || 200, 1000);
      const nowIso = new Date().toISOString();

      // status='expired' is derived: pending rows with expiry < now.
      // status='pending' returns only un-expired rows (expiry >= now or null).
      const dbStatus = status === 'expired' ? 'pending' : status;
      let q = supabase
        .from('ious')
        .select('id, iou_id, amount, token_symbol, chain, platform, platform_user_id, recipient_identifier, sender_handle, sender_pay_tag, sender_profile_id, recipient_profile_id, created_at, expiry, claimed_at, status, tx_hash_create, tx_hash_claim')
        .eq('status', dbStatus)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status === 'expired') q = q.lt('expiry', nowIso);
      if (status === 'pending') q = q.or(`expiry.gte.${nowIso},expiry.is.null`);
      if (platform) q = q.eq('platform', platform);
      if (chain) q = q.eq('chain', chain);
      const { data, error } = await q;
      if (error) throw error;

      // For outreach aggregation, pull ALL items matching the current status filter
      // (not just the page-limited `data`) so totals per recipient reflect reality.
      let agg = supabase
        .from('ious')
        .select('platform, platform_user_id, recipient_identifier, recipient_profile_id, amount, chain, created_at, expiry, status')
        .eq('status', dbStatus)
        .limit(50000);
      if (status === 'expired') agg = agg.lt('expiry', nowIso);
      if (status === 'pending') agg = agg.or(`expiry.gte.${nowIso},expiry.is.null`);
      if (platform) agg = agg.eq('platform', platform);
      if (chain) agg = agg.eq('chain', chain);
      const { data: aggRows } = await agg;

      // Aggregate per-recipient (platform + platform_user_id) for outreach view
      const grouped: Record<string, {
        platform: string;
        platform_user_id: string;
        recipient_identifier: string | null;
        count: number;
        total_amount: number;
        chains: Set<string>;
        oldest: string;
        newest: string;
        already_linked: boolean;
      }> = {};
      for (const r of aggRows || []) {
        const key = `${(r as any).platform || 'unknown'}:${(r as any).platform_user_id || ''}`;
        if (!grouped[key]) {
          grouped[key] = {
            platform: (r as any).platform || 'unknown',
            platform_user_id: (r as any).platform_user_id || '',
            recipient_identifier: (r as any).recipient_identifier || null,
            count: 0,
            total_amount: 0,
            chains: new Set(),
            oldest: (r as any).created_at,
            newest: (r as any).created_at,
            already_linked: !!(r as any).recipient_profile_id,
          };
        }
        const g = grouped[key];
        g.count += 1;
        g.total_amount += Number((r as any).amount || 0);
        g.chains.add(String((r as any).chain || '').toLowerCase());
        if ((r as any).created_at < g.oldest) g.oldest = (r as any).created_at;
        if ((r as any).created_at > g.newest) g.newest = (r as any).created_at;
        if ((r as any).recipient_profile_id) g.already_linked = true;
      }
      const recipients = Object.values(grouped)
        .map((g) => ({ ...g, chains: Array.from(g.chains) }))
        .sort((a, b) => b.total_amount - a.total_amount);

      // Aggregate totals by status (all-time, lightweight)
      const { data: counts } = await supabase
        .from('ious')
        .select('status, amount, chain, expiry')
        .limit(50000);
      const summary: Record<string, { count: number; volume: number }> = {
        pending: { count: 0, volume: 0 },
        claimed: { count: 0, volume: 0 },
        refunded: { count: 0, volume: 0 },
        expired: { count: 0, volume: 0 },
      };
      const byChain: Record<string, { count: number; volume: number }> = {};
      for (const r of counts || []) {
        let s = String((r as any).status || '').toLowerCase();
        const exp = (r as any).expiry ? new Date((r as any).expiry).getTime() : null;
        // Derive "expired" from pending rows whose expiry has elapsed.
        if (s === 'pending' && exp !== null && exp < Date.now()) s = 'expired';
        if (summary[s]) {
          summary[s].count += 1;
          summary[s].volume += Number((r as any).amount || 0);
        }
        const c = String((r as any).chain || '').toLowerCase();
        if (!byChain[c]) byChain[c] = { count: 0, volume: 0 };
        byChain[c].count += 1;
        byChain[c].volume += Number((r as any).amount || 0);
      }

      return new Response(JSON.stringify({
        items: data || [],
        recipients,
        summary,
        by_chain: byChain,
        derived_at: nowIso,
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
}
