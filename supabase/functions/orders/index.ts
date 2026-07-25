// MoniPay Orders Edge Function
// Handles order lifecycle for gateway payments: create, get, list, process, webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  checkRateLimit, 
  getClientIP,
  rateLimitedResponse,
} from "../_shared/security.ts";
import { loadPrincipal, loadPrincipalByPayTag } from "../_shared/principals.ts";

// Payment URL base
const PAYMENT_URL_BASE = "https://monipay.xyz/pay";

// Rate limits
const RATE_LIMITS = {
  orderCreate: { windowMs: 60_000, maxRequests: 30, keyPrefix: "order_create" },
  orderRead: { windowMs: 60_000, maxRequests: 100, keyPrefix: "order_read" },
  webhook: { windowMs: 60_000, maxRequests: 50, keyPrefix: "order_webhook" },
};

// Generate unique order reference
function generateOrderRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return `ord_${Array.from(array, byte => chars[byte % chars.length]).join('')}`;
}

// Generate HMAC signature for webhook payload
async function generateWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Send webhook notification
async function sendWebhook(
  webhookUrl: string, 
  order: Record<string, any>,
  secretKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({
      event: order.status === 'completed' ? 'payment.completed' : `order.${order.status}`,
      order: {
        id: order.id,
        order_ref: order.order_ref,
        amount: order.amount,
        fee: order.fee,
        currency: order.currency,
        status: order.status,
        tx_hash: order.tx_hash,
        payer_pay_tag: order.payer_pay_tag,
        payer_wallet: order.payer_wallet,
        paid_at: order.paid_at,
        metadata: order.metadata,
      },
      timestamp: parseInt(timestamp),
    });

    const signature = await generateWebhookSignature(`${timestamp}.${payload}`, secretKey);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MoniPay-Signature': signature,
        'X-MoniPay-Timestamp': timestamp,
      },
      body: payload,
    });

    return { 
      success: response.ok, 
      statusCode: response.status 
    };
  } catch (error) {
    console.error("Webhook delivery failed:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const clientIP = getClientIP(req);
    const body = await req.json();
    const { 
      action, 
      profileId, 
      orderId,
      orderRef,
      paymentLinkCode,
      amount,
      source,
      callbackUrl,
      webhookUrl,
      metadata,
      // For processing
      payerProfileId,
      payerPayTag,
      payerWallet,
      txHash,
      fee,
    } = body;

    console.log(`orders action: ${action}, profileId: ${profileId?.slice(0, 8) || 'N/A'}...`);

    // === CREATE: Create new order from payment link or API ===
    if (action === "create") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.orderCreate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      let merchantProfileId = profileId;
      let orderAmount = amount;
      let orderSource = source || 'api';
      let paymentLinkId = null;

      // If merchantId (payTag) provided instead of profileId, resolve it
      // across both legacy profiles and wallet_profiles.
      const { merchantId } = body;
      if (!merchantProfileId && merchantId) {
        const merchantProfile = await loadPrincipalByPayTag(supabase, merchantId);
        if (merchantProfile) {
          merchantProfileId = merchantProfile.id;
        } else {
          return new Response(
            JSON.stringify({ error: "Merchant not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // If payment link code provided, get details from it
      if (paymentLinkCode) {
        const { data: link, error: linkError } = await supabase
          .from("payment_links")
          .select("*")
          .eq("link_code", paymentLinkCode)
          .eq("is_active", true)
          .maybeSingle();

        if (linkError || !link) {
          return new Response(
            JSON.stringify({ error: "Payment link not found or inactive" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate link hasn't expired or reached limit
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ error: "Payment link has expired" }),
            { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (link.usage_limit && link.usage_count >= link.usage_limit) {
          return new Response(
            JSON.stringify({ error: "Payment link has reached usage limit" }),
            { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        merchantProfileId = link.profile_id;
        orderAmount = link.amount;
        orderSource = 'payment_link';
        paymentLinkId = link.id;
      }

      if (!merchantProfileId || !orderAmount || orderAmount <= 0) {
        return new Response(
          JSON.stringify({ error: "Missing merchant profile or valid amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get merchant's webhook URL from API keys
      const { data: apiKey } = await supabase
        .from("api_keys")
        .select("webhook_url")
        .eq("profile_id", merchantProfileId)
        .eq("is_active", true)
        .maybeSingle();

      const newOrderRef = generateOrderRef();

      const { data: order, error: insertError } = await supabase
        .from("orders")
        .insert({
          order_ref: newOrderRef,
          merchant_profile_id: merchantProfileId,
          payment_link_id: paymentLinkId,
          amount: orderAmount,
          fee: 0,
          currency: 'USDC',
          status: 'pending',
          source: orderSource,
          callback_url: callbackUrl || null,
          webhook_url: webhookUrl || apiKey?.webhook_url || null,
          metadata: metadata || {},
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create order:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get merchant info for checkout (dual-lookup)
      const merchant = await loadPrincipal(supabase, merchantProfileId);

      console.log(`Created order ${newOrderRef} for merchant ${merchantProfileId}`);

      return new Response(
        JSON.stringify({
          success: true,
          order: order,
          merchant: {
            payTag: merchant?.pay_tag,
            walletAddress: merchant?.wallet_address,
          },
          checkoutUrl: `${PAYMENT_URL_BASE}?orderId=${order.id}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === GET: Get order by ID or reference ===
    if (action === "get") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.orderRead);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!orderId && !orderRef) {
        return new Response(
          JSON.stringify({ error: "Missing orderId or orderRef" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase
        .from("orders")
        .select("*, payment_links(name, description, products(name, icon))");

      if (orderId) {
        query = query.eq("id", orderId);
      } else {
        query = query.eq("order_ref", orderRef);
      }

      const { data: order, error } = await query.maybeSingle();

      if (error || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if order has expired
      if (order.status === 'pending' && order.expires_at && new Date(order.expires_at) < new Date()) {
        // Mark as expired
        await supabase
          .from("orders")
          .update({ status: 'expired' })
          .eq("id", order.id);
        order.status = 'expired';
      }

      // Get merchant info (dual-lookup)
      const merchant = await loadPrincipal(supabase, order.merchant_profile_id);

      return new Response(
        JSON.stringify({
          order: order,
          merchant: {
            payTag: merchant?.pay_tag,
            walletAddress: merchant?.wallet_address,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === LIST: Get merchant's orders ===
    if (action === "list") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.orderRead);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Missing profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { status: filterStatus, limit = 50, offset = 0 } = body;

      let query = supabase
        .from("orders")
        .select("*, payment_links(name)")
        .eq("merchant_profile_id", profileId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filterStatus) {
        query = query.eq("status", filterStatus);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error("Failed to fetch orders:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch orders" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get counts
      const { count: totalCount } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true })
        .eq("merchant_profile_id", profileId);

      const { count: completedCount } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true })
        .eq("merchant_profile_id", profileId)
        .eq("status", "completed");

      return new Response(
        JSON.stringify({
          orders: orders || [],
          pagination: {
            total: totalCount || 0,
            completed: completedCount || 0,
            limit,
            offset,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === COMPLETE: Mark order as completed after successful payment ===
    if (action === "complete") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.orderCreate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!orderId || !txHash) {
        return new Response(
          JSON.stringify({ error: "Missing orderId or txHash" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (order.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: `Order is already ${order.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const calculatedFee = fee || (order.amount * 0.01); // 1% fee

      // Update order to completed
      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({
          status: 'completed',
          tx_hash: txHash,
          payer_profile_id: payerProfileId || null,
          payer_pay_tag: payerPayTag || null,
          payer_wallet: payerWallet || null,
          fee: calculatedFee,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (updateError) {
        console.error("Failed to complete order:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to complete order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Increment payment link usage if applicable
      if (order.payment_link_id) {
        const { data: link } = await supabase
          .from("payment_links")
          .select("usage_count")
          .eq("id", order.payment_link_id)
          .single();

        if (link) {
          await supabase
            .from("payment_links")
            .update({ usage_count: (link.usage_count || 0) + 1 })
            .eq("id", order.payment_link_id);
        }
      }

      // Record transaction for merchant (received) — dual-lookup
      const merchant = await loadPrincipal(supabase, order.merchant_profile_id);

      // Extract items from order metadata for transaction records
      const orderItems = order.metadata?.items || null;
      const txItems = orderItems ? orderItems.map((i: any) => ({
        name: i.name,
        quantity: i.quantity || 1,
        price: i.price,
      })) : null;

      const txSource = order.source === 'payment_link' ? 'payment_link' : 'online_order';
      const txMetadata: Record<string, any> = {
        order_id: order.id,
        order_ref: order.order_ref,
      };
      if (order.metadata?.storefront) {
        txMetadata.storefront = true;
        txMetadata.store_pay_tag = order.metadata.storePayTag;
      }

      await supabase.from("transactions").insert({
        profile_id: order.merchant_profile_id,
        type: "received",
        amount: order.amount,
        fee: 0,
        counterparty: payerPayTag || payerWallet || "Online Customer",
        tx_hash: txHash,
        status: "completed",
        source: txSource,
        payer_pay_tag: payerPayTag || null,
        items: txItems,
        metadata: txMetadata,
      });

      // Record transaction for payer if they have a profile
      if (payerProfileId) {
        await supabase.from("transactions").insert({
          profile_id: payerProfileId,
          type: "sent",
          amount: order.amount,
          fee: calculatedFee,
          counterparty: merchant?.pay_tag || "Merchant",
          tx_hash: txHash,
          status: "completed",
          source: txSource,
          payer_pay_tag: payerPayTag || null,
          items: txItems,
          metadata: txMetadata,
        });
      }

      // Auto-create or update customer record for merchant
      if (payerPayTag || payerWallet) {
        try {
          // Check if customer already exists
          let customerQuery = supabase
            .from("customers")
            .select("id, total_orders, total_spent")
            .eq("profile_id", order.merchant_profile_id);
          
          if (payerPayTag) {
            customerQuery = customerQuery.eq("pay_tag", payerPayTag);
          } else if (payerWallet) {
            customerQuery = customerQuery.eq("wallet_address", payerWallet.toLowerCase());
          }

          const { data: existingCustomer } = await customerQuery.maybeSingle();

          if (existingCustomer) {
            // Update existing customer
            await supabase
              .from("customers")
              .update({
                total_orders: (existingCustomer.total_orders || 0) + 1,
                total_spent: (existingCustomer.total_spent || 0) + order.amount,
                last_purchase_at: new Date().toISOString(),
              })
              .eq("id", existingCustomer.id);
          } else {
            // Create new customer
            await supabase.from("customers").insert({
              profile_id: order.merchant_profile_id,
              pay_tag: payerPayTag || null,
              wallet_address: payerWallet?.toLowerCase() || null,
              total_orders: 1,
              total_spent: order.amount,
              last_purchase_at: new Date().toISOString(),
            });
          }
        } catch (custErr) {
          console.error("Customer tracking failed (non-fatal):", custErr);
        }
      }

      // Send webhook if configured
      if (updatedOrder.webhook_url) {
        // Get merchant's secret key for webhook signing
        const { data: apiKey } = await supabase
          .from("api_keys")
          .select("secret_key_hash")
          .eq("profile_id", order.merchant_profile_id)
          .eq("is_active", true)
          .maybeSingle();

        const webhookSecret = apiKey?.secret_key_hash?.slice(0, 32) || 'default_secret';
        
        const webhookResult = await sendWebhook(
          updatedOrder.webhook_url,
          updatedOrder,
          webhookSecret
        );

        if (webhookResult.success) {
          await supabase
            .from("orders")
            .update({ webhook_sent_at: new Date().toISOString() })
            .eq("id", orderId);
        } else {
          console.error(`Webhook failed for order ${orderId}:`, webhookResult.error);
        }
      }

      console.log(`Completed order ${order.order_ref} with tx ${txHash}`);

      return new Response(
        JSON.stringify({
          success: true,
          order: updatedOrder,
          callbackUrl: order.callback_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === FAIL: Mark order as failed ===
    if (action === "fail") {
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Missing orderId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: 'failed' })
        .eq("id", orderId)
        .eq("status", "pending");

      if (error) {
        console.error("Failed to mark order as failed:", error);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Orders error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
