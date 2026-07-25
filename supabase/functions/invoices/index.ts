import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  checkRateLimit, 
  RATE_LIMITS, 
  verifyRequestSignature,
  rateLimitedResponse,
  unauthorizedResponse,
  getClientIP,
} from "../_shared/security.ts";
import { loadPrincipal, loadPrincipalByPayTag } from "../_shared/principals.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Read body once for signature verification
  const bodyText = await req.text();
  
  // Verify request signature
  const signatureResult = await verifyRequestSignature(req, bodyText);
  if (!signatureResult.valid) {
    console.error("Signature verification failed:", signatureResult.error);
    return unauthorizedResponse(signatureResult.error);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = JSON.parse(bodyText);
    const { action } = body;

    // Get client IP for rate limiting
    const clientIP = getClientIP(req);

    // ========== CREATE INVOICE ==========
    if (action === "create") {
      const { senderProfileId, recipientPayTag, amount, items, memo, expiresInHours = 24 } = body;

      // Rate limit invoice creation
      const rateLimit = await checkRateLimit(senderProfileId || clientIP, RATE_LIMITS.invoiceCreate);
      if (!rateLimit.allowed) {
        console.warn(`Invoice creation rate limit exceeded for: ${senderProfileId || clientIP}`);
        return rateLimitedResponse(rateLimit);
      }

      if (!senderProfileId || !recipientPayTag || !amount) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: senderProfileId, recipientPayTag, amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate amount (positive, reasonable range)
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0 || numAmount > 1000000) {
        return new Response(
          JSON.stringify({ error: "Invalid amount. Must be between 0 and 1,000,000" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize payTag (remove @ if present, lowercase)
      const normalizedPayTag = recipientPayTag.replace(/^@/, "").toLowerCase();

      // Look up recipient across legacy profiles and wallet_profiles
      const recipientProfile = await loadPrincipalByPayTag(supabase, normalizedPayTag);
      if (!recipientProfile) {
        return new Response(
          JSON.stringify({ error: `PayTag @${normalizedPayTag} not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get sender info
      const senderPrincipal = await loadPrincipal(supabase, senderProfileId);

      if (!senderPrincipal) {
        return new Response(
          JSON.stringify({ error: "Sender profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate expiry
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

      // Create the invoice
      const { data: invoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          sender_profile_id: senderProfileId,
          recipient_pay_tag: normalizedPayTag,
          recipient_profile_id: recipientProfile.id,
          amount: amount,
          items: items || null,
          memo: memo || null,
          expires_at: expiresAt,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create invoice:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create invoice" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Invoice created: ${invoice.id} from @${senderPrincipal.pay_tag} to @${normalizedPayTag} for $${amount}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          invoice: {
            ...invoice,
            senderPayTag: senderPrincipal.pay_tag,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== LIST INVOICES ==========
    if (action === "list") {
      const { profileId, type = "received", status: filterStatus } = body;

      // Rate limit reads
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Missing profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get profile's payTag for received invoices (dual-lookup)
      const profile = await loadPrincipal(supabase, profileId);

      let query = supabase.from("invoices").select("*");

      if (type === "received") {
        query = query.eq("recipient_profile_id", profileId);
      } else if (type === "sent") {
        query = query.eq("sender_profile_id", profileId);
      }

      if (filterStatus) {
        query = query.eq("status", filterStatus);
      }

      query = query.order("created_at", { ascending: false });

      const { data: invoices, error } = await query;

      if (error) {
        console.error("Failed to list invoices:", error);
        return new Response(
          JSON.stringify({ error: "Failed to list invoices" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Enrich with sender payTags
      const enrichedInvoices = await Promise.all(
        invoices.map(async (invoice) => {
          const sender = await loadPrincipal(supabase, invoice.sender_profile_id);

          return {
            ...invoice,
            senderPayTag: sender?.pay_tag || "Unknown",
          };
        })
      );

      return new Response(
        JSON.stringify({ invoices: enrichedInvoices }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET SINGLE INVOICE ==========
    if (action === "get") {
      const { invoiceId, network } = body;

      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!invoiceId) {
        return new Response(
          JSON.stringify({ error: "Missing invoiceId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();

      if (error || !invoice) {
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get sender info
      const sender = await loadPrincipal(supabase, invoice.sender_profile_id);

      const normalizedNetwork = typeof network === 'string'
        ? network.toLowerCase()
        : (sender?.preferred_network || 'base');
      const senderWalletAddress = normalizedNetwork === 'solana'
        ? sender?.solana_address
        : sender?.wallet_address;

      return new Response(
        JSON.stringify({ 
          invoice: {
            ...invoice,
            senderPayTag: sender?.pay_tag,
            senderWalletAddress,
            senderPreferredNetwork: sender?.preferred_network,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== PAY INVOICE ==========
    if (action === "pay") {
      const { 
        invoiceId, 
        payerProfileId, 
        signature, 
        message, 
        network, 
        txHash: solanaTxHash,
        tokenAddress,
        routerAddress,
        decimals,
        tokenSymbol
      } = body;

      // Rate limit payments (same as relay)
      const rateLimit = await checkRateLimit(payerProfileId || clientIP, RATE_LIMITS.relay);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      const normalizedNet = typeof network === 'string' ? network.toLowerCase() : 'base';
      const isSolana = normalizedNet === 'solana';

      // For Solana: txHash is passed directly (already relayed). For EVM: signature+message required.
      if (!invoiceId || !payerProfileId) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for payment" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!isSolana && (!signature || !message)) {
        return new Response(
          JSON.stringify({ error: "Missing signature/message for EVM payment" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError || !invoice) {
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate invoice status
      if (invoice.status !== "pending") {
        return new Response(
          JSON.stringify({ error: `Invoice is ${invoice.status}, cannot pay` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if invoice expired
      if (invoice.expires_at && new Date(invoice.expires_at) < new Date()) {
        await supabase
          .from("invoices")
          .update({ status: "expired" })
          .eq("id", invoiceId);

        return new Response(
          JSON.stringify({ error: "Invoice has expired" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify payer is the recipient
      if (invoice.recipient_profile_id !== payerProfileId) {
        return new Response(
          JSON.stringify({ error: "Only the invoice recipient can pay this invoice" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get sender (merchant) info for the payment
      const sender = await loadPrincipal(supabase, invoice.sender_profile_id);

      if (!sender) {
        return new Response(
          JSON.stringify({ error: "Sender profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let finalTxHash: string;

      if (isSolana && solanaTxHash) {
        // ─── Solana: payment already relayed, just record the txHash ───
        finalTxHash = solanaTxHash;
        console.log(`Invoice ${invoiceId} paid via Solana relay: ${finalTxHash}`);
      } else {
        // ─── EVM: relay via relay-payment / relay-payment-celo ───
        const payer = await loadPrincipal(supabase, payerProfileId);

        const effectiveNetwork = normalizedNet !== 'base' ? normalizedNet : (payer?.preferred_network || 'base');
        const relayFunctionName =
          effectiveNetwork === 'celo' ? 'relay-payment-celo'
          : effectiveNetwork === 'ink' ? 'relay-payment-ink'
          : 'relay-payment';

        const relayResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/${relayFunctionName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              action: "relay",
              signature,
              message,
              senderProfileId: payerProfileId,
              recipientPayTag: sender.pay_tag,
              recipientAddress: sender.wallet_address,
              items: invoice.items,
              invoiceId: invoiceId,
              tokenAddress,
              routerAddress,
              decimals,
              tokenSymbol,
            }),
          }
        );

        const relayResult = await relayResponse.json();

        if (!relayResponse.ok || !relayResult.success) {
          console.error("Payment relay failed:", relayResult);
          return new Response(
            JSON.stringify({ error: relayResult.error || "Payment failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        finalTxHash = relayResult.txHash;
      }

      // Update invoice status to paid
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          tx_hash: finalTxHash,
        })
        .eq("id", invoiceId);

      if (updateError) {
        console.error("Failed to update invoice status:", updateError);
      }

      console.log(`Invoice ${invoiceId} paid successfully: ${finalTxHash}`);

      return new Response(
        JSON.stringify({
          success: true,
          txHash: finalTxHash,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CANCEL INVOICE ==========
    if (action === "cancel") {
      const { invoiceId, profileId } = body;

      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!invoiceId || !profileId) {
        return new Response(
          JSON.stringify({ error: "Missing invoiceId or profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the invoice
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();

      if (!invoice) {
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Only sender can cancel
      if (invoice.sender_profile_id !== profileId) {
        return new Response(
          JSON.stringify({ error: "Only the sender can cancel this invoice" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Can only cancel pending invoices
      if (invoice.status !== "pending") {
        return new Response(
          JSON.stringify({ error: `Cannot cancel invoice with status: ${invoice.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update status
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "cancelled" })
        .eq("id", invoiceId);

      if (updateError) {
        console.error("Failed to cancel invoice:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to cancel invoice" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Invoice ${invoiceId} cancelled`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== COUNT PENDING INVOICES ==========
    if (action === "countPending") {
      const { profileId } = body;

      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Missing profileId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { count, error } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("recipient_profile_id", profileId)
        .eq("status", "pending");

      if (error) {
        console.error("Failed to count invoices:", error);
        return new Response(
          JSON.stringify({ error: "Failed to count invoices" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ count: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Invoice function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
