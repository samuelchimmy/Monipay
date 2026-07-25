import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

/**
 * MoniBot Transaction Sync Edge Function
 * 
 * This function mirrors MoniBot transactions (from monibot_transactions table) to the 
 * main transactions table so they appear in users' normal transaction history.
 * 
 * The Worker Bot on Railway writes directly to monibot_transactions using the service role key.
 * This function can be called to sync those transactions to the main ledger.
 * 
 * Actions:
 * - logTransaction: Log a MoniBot transaction (P2P or Grant) for both sender and receiver
 * - batchLog: Log multiple transactions at once
 * - lookupPayTag: Resolve wallet address to pay_tag
 * 
 * Authentication: Uses Supabase service role (internal use only)
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    console.log("monibot-sync action:", action);

    // Log a single MoniBot transaction for both sender and receiver
    if (action === "logTransaction") {
      const {
        senderWalletAddress,
        receiverWalletAddress,
        senderPayTag,
        receiverPayTag,
        amount,
        fee,
        txHash,
        monibotType, // 'p2p' or 'grant'
        tweetId,
        campaignId,
        campaignName,
        network, // 'base' | 'bsc' (optional)
      } = body;

      // Validate required fields
      if (!senderWalletAddress || !receiverWalletAddress || !amount || !txHash || !monibotType) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine source based on monibot type
      const source = monibotType === 'grant' ? 'monibot_grant' : 'monibot_p2p';

      // Build metadata with clear MoniBot labeling
      const metadata: Record<string, any> = {
        monibot_type: monibotType,
        is_monibot_transaction: true,
        sender_label: monibotType === 'grant' ? 'MoniBot Grant' : senderPayTag,
        receiver_label: receiverPayTag,
        network: (network === 'bsc' ? 'bsc' : 'base'),
      };
      if (tweetId) metadata.tweet_id = tweetId;
      if (campaignId) metadata.campaign_id = campaignId;
      if (campaignName) metadata.campaign_name = campaignName;

      // Look up sender profile (case-insensitive match)
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("id, pay_tag")
        .ilike("wallet_address", senderWalletAddress)
        .maybeSingle();

      // Look up receiver profile (case-insensitive match)
      const { data: receiverProfile } = await supabase
        .from("profiles")
        .select("id, pay_tag")
        .ilike("wallet_address", receiverWalletAddress)
        .maybeSingle();

      const results = { sender: null as any, receiver: null as any };

      // For MoniBot grants, the "sender" is MoniBot itself (not a user profile)
      // We only need to log the receiver's transaction in most cases
      // But if we have a senderProfile (for P2P), log their side too
      
      // Log sender's transaction (sent) - only for P2P where sender is a real user
      if (senderProfile && monibotType === 'p2p') {
        const senderCounterparty = receiverPayTag || receiverProfile?.pay_tag || receiverWalletAddress;
        
        const { data, error } = await supabase
          .from("transactions")
          .insert({
            profile_id: senderProfile.id,
            type: "sent",
            amount: parseFloat(amount),
            fee: parseFloat(fee || 0),
            counterparty: senderCounterparty,
            tx_hash: txHash,
            status: "completed",
            source,
            metadata,
            payer_pay_tag: senderPayTag || senderProfile.pay_tag,
          })
          .select()
          .single();

        if (error) {
          console.error("Failed to log sender transaction:", error);
          results.sender = { error: error.message };
        } else {
          console.log("Sender transaction logged:", data.id);
          results.sender = { success: true, id: data.id };
        }
      } else if (monibotType === 'grant') {
        // For grants, sender is MoniBot - we just log that we skipped the sender side
        console.log("Grant transaction - sender is MoniBot, skipping sender log");
        results.sender = { skipped: "monibot_grant_sender" };
      } else {
        console.log("Sender profile not found for:", senderWalletAddress);
        results.sender = { skipped: "profile_not_found" };
      }

      // Log receiver's transaction (received)
      if (receiverProfile) {
        // For grants, counterparty should show "MoniBot" or "MoniBot Grant"
        // For P2P, counterparty shows the sender's pay_tag
        const receiverCounterparty = monibotType === 'grant' 
          ? 'MoniBot' 
          : (senderPayTag || senderProfile?.pay_tag || senderWalletAddress);
        
        const { data, error } = await supabase
          .from("transactions")
          .insert({
            profile_id: receiverProfile.id,
            type: "received",
            amount: parseFloat(amount),
            fee: 0, // Receiver doesn't pay fee
            counterparty: receiverCounterparty,
            tx_hash: txHash,
            status: "completed",
            source,
            metadata,
            // For grants, payer_pay_tag should be "MoniBot" not a wallet address
            payer_pay_tag: monibotType === 'grant' ? 'MoniBot' : (senderPayTag || senderProfile?.pay_tag),
          })
          .select()
          .single();

        if (error) {
          console.error("Failed to log receiver transaction:", error);
          results.receiver = { error: error.message };
        } else {
          console.log("Receiver transaction logged:", data.id);
          results.receiver = { success: true, id: data.id };
        }
      } else {
        console.log("Receiver profile not found for:", receiverWalletAddress);
        results.receiver = { skipped: "profile_not_found" };
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch log multiple transactions
    if (action === "batchLog") {
      const { transactions } = body;

      if (!Array.isArray(transactions) || transactions.length === 0) {
        return new Response(
          JSON.stringify({ error: "transactions array required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      
      for (const tx of transactions) {
        const {
          senderWalletAddress,
          receiverWalletAddress,
          senderPayTag,
          receiverPayTag,
          amount,
          fee,
          txHash,
          monibotType,
          tweetId,
          campaignId,
          campaignName,
          network,
        } = tx;

        const source = monibotType === 'grant' ? 'monibot_grant' : 'monibot_p2p';
        const metadata: Record<string, any> = {
          monibot_type: monibotType,
          network: (network === 'bsc' ? 'bsc' : 'base'),
        };
        if (tweetId) metadata.tweet_id = tweetId;
        if (campaignId) metadata.campaign_id = campaignId;
        if (campaignName) metadata.campaign_name = campaignName;

        // Look up profiles (case-insensitive match)
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("id, pay_tag")
          .ilike("wallet_address", senderWalletAddress)
          .maybeSingle();

        const { data: receiverProfile } = await supabase
          .from("profiles")
          .select("id, pay_tag")
          .ilike("wallet_address", receiverWalletAddress)
          .maybeSingle();

        const txResults = { txHash, sender: null as any, receiver: null as any };

        // Log for sender
        if (senderProfile) {
          const { error } = await supabase.from("transactions").insert({
            profile_id: senderProfile.id,
            type: "sent",
            amount: parseFloat(amount),
            fee: parseFloat(fee || 0),
            counterparty: receiverPayTag || receiverProfile?.pay_tag || receiverWalletAddress,
            tx_hash: txHash,
            status: "completed",
            source,
            metadata,
            payer_pay_tag: senderPayTag || senderProfile.pay_tag,
          });
          txResults.sender = error ? { error: error.message } : { success: true };
        }

        // Log for receiver
        if (receiverProfile) {
          const { error } = await supabase.from("transactions").insert({
            profile_id: receiverProfile.id,
            type: "received",
            amount: parseFloat(amount),
            fee: 0,
            counterparty: senderPayTag || senderProfile?.pay_tag || senderWalletAddress,
            tx_hash: txHash,
            status: "completed",
            source,
            metadata,
            payer_pay_tag: senderPayTag || senderProfile?.pay_tag,
          });
          txResults.receiver = error ? { error: error.message } : { success: true };
        }

        results.push(txResults);
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up pay_tag from wallet address (for UI display)
    if (action === "lookupPayTag") {
      const { walletAddress } = body;
      
      if (!walletAddress) {
        return new Response(
          JSON.stringify({ error: "walletAddress required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("pay_tag")
        .eq("wallet_address", walletAddress.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error("Lookup error:", error);
        return new Response(
          JSON.stringify({ error: "Lookup failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ payTag: data?.pay_tag || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("monibot-sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
