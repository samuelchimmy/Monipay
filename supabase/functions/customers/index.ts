import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, profileId, ...data } = await req.json();

    if (!profileId) {
      throw new Error('profileId is required');
    }

    switch (action) {
      case 'list': {
        // Fetch customers for this merchant
        const { data: customers, error } = await supabase
          .from('customers')
          .select('*')
          .eq('profile_id', profileId)
          .order('total_spent', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ customers: customers || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get': {
        const { customerId } = data;
        if (!customerId) throw new Error('customerId is required');

        const { data: customer, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .eq('profile_id', profileId)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ customer }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'upsert': {
        const { payTag, walletAddress, name, email, phone, notes, tags } = data;

        // Try to find existing customer by payTag or walletAddress
        let existingCustomer = null;
        
        if (payTag) {
          const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('profile_id', profileId)
            .eq('pay_tag', payTag)
            .maybeSingle();
          existingCustomer = data;
        }
        
        if (!existingCustomer && walletAddress) {
          const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('profile_id', profileId)
            .eq('wallet_address', walletAddress)
            .maybeSingle();
          existingCustomer = data;
        }

        if (existingCustomer) {
          // Update existing
          const { data: customer, error } = await supabase
            .from('customers')
            .update({
              name: name ?? existingCustomer.name,
              email: email ?? existingCustomer.email,
              phone: phone ?? existingCustomer.phone,
              notes: notes ?? existingCustomer.notes,
              tags: tags ?? existingCustomer.tags,
              pay_tag: payTag ?? existingCustomer.pay_tag,
              wallet_address: walletAddress ?? existingCustomer.wallet_address,
            })
            .eq('id', existingCustomer.id)
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify({ customer, isNew: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Insert new
          const { data: customer, error } = await supabase
            .from('customers')
            .insert({
              profile_id: profileId,
              pay_tag: payTag || null,
              wallet_address: walletAddress || null,
              name: name || null,
              email: email || null,
              phone: phone || null,
              notes: notes || null,
              tags: tags || [],
            })
            .select()
            .single();

          if (error) throw error;
          return new Response(JSON.stringify({ customer, isNew: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'update': {
        const { customerId, name, email, phone, notes, tags } = data;
        if (!customerId) throw new Error('customerId is required');

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (notes !== undefined) updateData.notes = notes;
        if (tags !== undefined) updateData.tags = tags;

        const { data: customer, error } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customerId)
          .eq('profile_id', profileId)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ customer }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        const { customerId } = data;
        if (!customerId) throw new Error('customerId is required');

        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', customerId)
          .eq('profile_id', profileId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'syncFromTransactions': {
        // Aggregate customer data from transactions
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('counterparty, payer_pay_tag, amount, fee, created_at')
          .eq('profile_id', profileId)
          .eq('type', 'received');

        if (txError) throw txError;

        // Group by counterparty
        const customerMap = new Map<string, {
          payTag: string | null;
          walletAddress: string | null;
          totalSpent: number;
          totalOrders: number;
          lastPurchase: string;
        }>();

        for (const tx of transactions || []) {
          const key = tx.payer_pay_tag || tx.counterparty;
          const isWallet = tx.counterparty.startsWith('0x');
          
          const existing = customerMap.get(key) || {
            payTag: isWallet ? null : tx.payer_pay_tag || tx.counterparty,
            walletAddress: isWallet ? tx.counterparty : null,
            totalSpent: 0,
            totalOrders: 0,
            lastPurchase: tx.created_at,
          };

          existing.totalSpent += Number(tx.amount) - Number(tx.fee || 0);
          existing.totalOrders += 1;
          if (new Date(tx.created_at) > new Date(existing.lastPurchase)) {
            existing.lastPurchase = tx.created_at;
          }

          customerMap.set(key, existing);
        }

        // Upsert all customers
        let synced = 0;
        for (const [_, customerData] of customerMap) {
          const lookupField = customerData.payTag ? 'pay_tag' : 'wallet_address';
          const lookupValue = customerData.payTag || customerData.walletAddress;

          // Check if exists
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('profile_id', profileId)
            .eq(lookupField, lookupValue)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('customers')
              .update({
                total_spent: customerData.totalSpent,
                total_orders: customerData.totalOrders,
                last_purchase_at: customerData.lastPurchase,
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('customers').insert({
              profile_id: profileId,
              pay_tag: customerData.payTag,
              wallet_address: customerData.walletAddress,
              total_spent: customerData.totalSpent,
              total_orders: customerData.totalOrders,
              last_purchase_at: customerData.lastPurchase,
            });
          }
          synced++;
        }

        return new Response(JSON.stringify({ synced, total: customerMap.size }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'getStats': {
        // Get aggregated customer stats
        const { data: customers, error } = await supabase
          .from('customers')
          .select('total_spent, total_orders, last_purchase_at')
          .eq('profile_id', profileId);

        if (error) throw error;

        const totalCustomers = customers?.length || 0;
        const totalRevenue = customers?.reduce((sum, c) => sum + Number(c.total_spent), 0) || 0;
        const totalOrders = customers?.reduce((sum, c) => sum + c.total_orders, 0) || 0;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Repeat customers (more than 1 order)
        const repeatCustomers = customers?.filter(c => c.total_orders > 1).length || 0;
        const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

        return new Response(JSON.stringify({
          totalCustomers,
          totalRevenue,
          totalOrders,
          avgOrderValue,
          repeatCustomers,
          repeatRate,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Customers function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
