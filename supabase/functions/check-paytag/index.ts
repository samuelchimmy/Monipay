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

// ===== RESERVED MONITAG BLOCKLIST =====
// Case-insensitive exact match only. Strip @ prefix before checking.
const RESERVED_TAGS: string[] = [
  // Platform & System
  "admin", "monipay", "monibot", "monitag", "support", "help", "official", "team", "founder",
  "security", "wallet", "system", "root", "superuser", "mod", "moderator", "staff", "operator",
  "dev", "developer", "api", "webhook", "null", "undefined", "test", "demo", "guest", "bot",
  "agent", "verify", "verified", "trust", "safe", "alert", "notice", "info", "contact",
  "hello", "hi", "hey", "yo",

  // Blockchain & Networks
  "base", "bsc", "solana", "ethereum", "bitcoin", "bnb", "matic", "polygon", "avalanche",
  "arbitrum", "optimism", "cosmos", "polkadot", "cardano", "tron", "litecoin", "dogecoin",
  "shiba", "xrp", "ripple", "usdc", "usdt", "dai", "busd", "wbtc", "eth", "btc", "sol",
  "bnbchain", "basechain", "web3", "defi", "nft", "dao", "dex", "cex", "swap", "bridge",
  "staking", "yield", "airdrop", "whitelist", "presale", "ico", "ido", "igo",

  // Crypto Celebrities & Founders
  "elon", "elonmusk", "vitalik", "vitalikbuterin", "satoshi", "nakamoto", "cz", "changpeng",
  "saylor", "michaelsaylor", "pomp", "pompliano", "balaji", "srinivasan", "justinsun",
  "rogerver", "aantonop", "andreas", "gavinwood", "charlesho", "hoskinson", "sbf",
  "sambanckmanfried", "do", "dokwon", "binance", "coinbase", "kraken", "gemini", "ftx",
  "opensea", "uniswap", "aave", "compound", "makerdao", "chainlink", "sushiswap", "curve",
  "synthetix",

  // Base / Coinbase Ecosystem
  "brianarmstrong", "jessepollak", "coinbasewallet", "basenames", "baseorg", "onchainkit",
  "brian", "jesse", "baseprotocol", "basefoundation",

  // Solana Ecosystem
  "anatoly", "anatolyyakovenko", "rajgokal", "toly", "superteamsol", "solananfts",
  "phantom", "backpack", "jupiter", "jito", "marinade", "raydium", "orca", "tensor",
  "metaplex", "helius", "drip", "solflare", "magiceden",

  // Binance / BSC Ecosystem
  "richardteng", "yihe", "binancechain", "trustwallet", "pancakeswap", "bnbchain", "safu",

  // Tempo Ecosystem
  "tempo", "tempochain", "temponetwork", "moderato", "alphausd", "canteen",

  // Nigerian & African Crypto Figures
  "binancenigeria", "superteam", "superteamng", "patricelogo", "vibegod",

  // Monipay Brand
  "monipayxyz", "monipayapp", "monipayofficial", "monipaysupport", "monipayteam",
  "monitagofficial", "monitagsupport", "ngn", "ngnmonipay", "monipayngn",

  // Common Impersonation Patterns
  "thereal", "real", "original", "legit", "authentic", "genuine", "true", "actual",

  // Common Scam Patterns
  "free", "giveaway", "winner", "prize", "claim", "reward",
];

function isReservedTag(tag: string): boolean {
  const normalized = tag.replace(/^@/, "").trim().toLowerCase();
  if (!normalized) return false;
  return RESERVED_TAGS.includes(normalized);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const { action, payTag, walletAddress, encryptedPrivateKey, encryptedSolanaKey, preferredMode, preferredNetwork, profileId, solanaAddress, googleEmail, googlePicture } = JSON.parse(bodyText);

    // Get client IP for rate limiting
    const clientIP = getClientIP(req);

    if (action === "check") {
      // Rate limit PayTag availability checks
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.check);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      // Check reserved list first
      if (isReservedTag(payTag)) {
        return new Response(
          JSON.stringify({ available: false, reserved: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if PayTag is available
      const { data, error } = await supabase
        .from("profiles")
        .select("id, status")
        .eq("pay_tag", payTag.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error("Check PayTag error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to check PayTag" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If profile exists but is deactivated, return unavailable + deactivated flag
      if (data && data.status === 'deactivated') {
        return new Response(
          JSON.stringify({ available: false, reserved: false, deactivated: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also block tags already claimed by MiniPay / wallet-only sessions.
      if (!data) {
        const { data: wp } = await supabase
          .from("wallet_profiles")
          .select("id")
          .eq("pay_tag", payTag.toLowerCase())
          .maybeSingle();
        if (wp) {
          return new Response(
            JSON.stringify({ available: false, reserved: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ available: !data, reserved: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "register") {
      // Strict rate limit for registration (prevent spam accounts)
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.register);
      if (!rateLimit.allowed) {
        console.warn(`Registration rate limit exceeded for IP: ${clientIP}`);
        return rateLimitedResponse(rateLimit);
      }

      // Register new PayTag with profile
      if (!payTag || !walletAddress || !encryptedPrivateKey) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate PayTag format
      const payTagRegex = /^[a-z0-9_]{3,20}$/;
      if (!payTagRegex.test(payTag.toLowerCase())) {
        return new Response(
          JSON.stringify({ error: "Invalid PayTag format. Use 3-20 lowercase letters, numbers, or underscores." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check reserved list
      if (isReservedTag(payTag)) {
        return new Response(
          JSON.stringify({ error: "reserved", reservedTag: true }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atomic safeguard: reject Solana address without encrypted key
      if (solanaAddress && !encryptedSolanaKey) {
        return new Response(
          JSON.stringify({ error: "Solana address provided without encrypted key. Both must be supplied atomically." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const insertData: Record<string, unknown> = {
          pay_tag: payTag.toLowerCase(),
          wallet_address: walletAddress.toLowerCase(),
          encrypted_private_key: encryptedPrivateKey,
          preferred_mode: preferredMode || "merchant",
          preferred_network: preferredNetwork || "base",
        };

      // Include Solana wallet atomically (both address + key)
      if (solanaAddress && encryptedSolanaKey) {
        insertData.solana_address = solanaAddress;
        insertData.encrypted_solana_key = encryptedSolanaKey;
      }

      const { data, error } = await supabase
        .from("profiles")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Register PayTag error:", error);
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "PayTag already taken" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Failed to register PayTag" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Profile registered:", data.id, "IP:", clientIP);
      return new Response(
        JSON.stringify({ success: true, profileId: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "lookup") {
      // General rate limit for reads
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      // Lookup profile by PayTag or wallet address
      let query = supabase.from("profiles").select("id, pay_tag, wallet_address, preferred_mode, preferred_network, solana_address");
      
      if (payTag) {
        query = query.eq("pay_tag", payTag.toLowerCase());
      } else if (walletAddress) {
        query = query.eq("wallet_address", walletAddress.toLowerCase());
      } else {
        return new Response(
          JSON.stringify({ error: "PayTag or wallet address required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error("Lookup error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to lookup profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback: MiniPay / wallet-only sessions live in `wallet_profiles`,
      // not `profiles`. If the legacy table didn't match, look there so that
      // monipay accounts can resolve and pay MiniPay-issued moniTags.
      if (!data) {
        let wpQuery = supabase
          .from("wallet_profiles")
          .select("id, pay_tag, wallet_address, preferred_network");
        if (payTag) {
          wpQuery = wpQuery.eq("pay_tag", payTag.toLowerCase());
        } else if (walletAddress) {
          wpQuery = wpQuery.eq("wallet_address", walletAddress.toLowerCase());
        }
        const { data: wp, error: wpErr } = await wpQuery.maybeSingle();
        if (wpErr) {
          console.error("Wallet-profile lookup error:", wpErr);
        }
        if (wp) {
          return new Response(
            JSON.stringify({
              profile: {
                id: wp.id,
                pay_tag: wp.pay_tag,
                wallet_address: wp.wallet_address,
                preferred_mode: "user",
                preferred_network: wp.preferred_network ?? "celo",
                solana_address: null,
                source: "wallet_profiles",
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ profile: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "import") {
      // Rate limit import attempts
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      // Import wallet by private key - lookup by derived address
      if (!walletAddress) {
        return new Response(
          JSON.stringify({ error: "Wallet address required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, pay_tag, wallet_address, encrypted_private_key, encrypted_solana_key, preferred_mode, preferred_network, solana_address, status")
        .eq("wallet_address", walletAddress.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error("Import lookup error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to lookup wallet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: "No account found for this wallet" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Block import of deactivated accounts
      if (data.status === 'deactivated') {
        return new Response(
          JSON.stringify({ error: "This account has been deactivated." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          profile: {
            id: data.id,
            payTag: data.pay_tag,
            walletAddress: data.wallet_address,
            encryptedPrivateKey: data.encrypted_private_key,
            encryptedSolanaKey: data.encrypted_solana_key,
            preferredMode: data.preferred_mode,
            preferredNetwork: data.preferred_network,
            solanaAddress: data.solana_address || null,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "updatePreferredMode") {
      // (linkGoogle handled below — leaving updatePreferredMode in place)
    }

    if (action === "linkGoogle") {
      // Persist the Google identity (email/picture) that just unlocked this wallet
      // via Drive restore. Ownership: requires walletAddress matching the profile.
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

      if (!profileId || !walletAddress) {
        return new Response(
          JSON.stringify({ error: "profileId and walletAddress required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", profileId)
        .single();

      if (ownerError || !ownerProfile || ownerProfile.wallet_address.toLowerCase() !== String(walletAddress).toLowerCase()) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: wallet address mismatch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: Record<string, string | null> = {};
      if (typeof googleEmail === "string" && googleEmail.length <= 320) {
        updates.google_email = googleEmail.toLowerCase().trim();
      }
      if (typeof googlePicture === "string" && googlePicture.startsWith("https://") && googlePicture.length <= 1024) {
        updates.google_picture = googlePicture;
      }

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: linkError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profileId);

      if (linkError) {
        console.error("linkGoogle update error:", linkError);
        return new Response(
          JSON.stringify({ error: "Failed to link Google identity" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "updatePreferredMode") {
      // Rate limit updates
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      // Update preferred mode for a profile
      if (!profileId || !preferredMode || !walletAddress) {
        return new Response(
          JSON.stringify({ error: "Profile ID, preferred mode, and wallet address required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ownership verification: confirm walletAddress matches the profile
      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", profileId)
        .single();

      if (ownerError || !ownerProfile || ownerProfile.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn(`Ownership check failed for profileId=${profileId}, provided wallet=${walletAddress}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized: wallet address mismatch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("profiles")
        .update({ preferred_mode: preferredMode })
        .eq("id", profileId);

      if (error) {
        console.error("Update preferred mode error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update preferred mode" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "updatePreferredNetwork") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId || !preferredNetwork || !walletAddress) {
        return new Response(
          JSON.stringify({ error: "Profile ID, preferred network, and wallet address required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalized = String(preferredNetwork).toLowerCase();
      const VALID_NETWORKS = ['base', 'bsc', 'tempo', 'solana', 'celo', 'ink'];
      if (!VALID_NETWORKS.includes(normalized)) {
        return new Response(
          JSON.stringify({ error: "Invalid preferred network" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ownership verification: confirm walletAddress matches the profile
      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", profileId)
        .single();

      if (ownerError || !ownerProfile || ownerProfile.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn(`Ownership check failed for profileId=${profileId}, provided wallet=${walletAddress}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized: wallet address mismatch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from('profiles')
        .update({ preferred_network: normalized })
        .eq('id', profileId);

      if (error) {
        console.error('Update preferred network error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update preferred network' }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deactivate") {
      // Rate limit deactivation
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!payTag || !walletAddress) {
        return new Response(
          JSON.stringify({ error: "payTag and walletAddress required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ownership verification: confirm walletAddress matches the profile
      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("id, wallet_address")
        .eq("pay_tag", payTag.toLowerCase())
        .single();

      if (ownerError || !ownerProfile || ownerProfile.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn(`Deactivation ownership check failed for payTag=${payTag}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized: wallet address mismatch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("profiles")
        .update({ status: 'deactivated', deactivated_at: new Date().toISOString() })
        .eq("id", ownerProfile.id);

      if (error) {
        console.error("Deactivate account error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to deactivate account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Account deactivated:", ownerProfile.id, "PayTag:", payTag);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-solana") {
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!payTag || !solanaAddress) {
        return new Response(
          JSON.stringify({ error: "payTag and solanaAddress required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atomic safeguard: never store a Solana address without its encrypted key
      if (!encryptedSolanaKey) {
        return new Response(
          JSON.stringify({ error: "encryptedSolanaKey is required. Cannot store Solana address without signing key." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: Record<string, string> = {
        solana_address: solanaAddress,
        encrypted_solana_key: encryptedSolanaKey,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("pay_tag", payTag.toLowerCase());

      if (error) {
        console.error("Update solana address error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update Solana address" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
