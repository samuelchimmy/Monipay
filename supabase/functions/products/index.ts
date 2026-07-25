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
import { loadPrincipalByPayTag } from "../_shared/principals.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Read body once for signature verification
  const bodyText = await req.text();

  // Check if this is a public action (no signature required)
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed.action === "listPublic") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const clientIP = getClientIP(req);
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      const { payTag } = parsed;
      if (!payTag || typeof payTag !== "string") {
        return new Response(
          JSON.stringify({ error: "PayTag required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lookup merchant across both legacy profiles and wallet_profiles.
      const profile = await loadPrincipalByPayTag(supabase, payTag);
      if (!profile) {
        return new Response(
          JSON.stringify({ error: "Merchant not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch store settings
      const { data: storeSettings } = await supabase
        .from("store_settings")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();

      // Fetch public products for this merchant
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, category, icon, description, image_url, stock_quantity")
        .eq("profile_id", profile.id)
        .eq("visible_on_storefront", true)
        .order("pinned", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (productsError) {
        console.error("Public products fetch error:", productsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch products" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const mapped = (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price),
        category: p.category || "Other",
        icon: p.icon || "package",
        description: p.description || "",
        imageUrl: p.image_url || null,
        stockQuantity: p.stock_quantity, // null = unlimited
      }));

      return new Response(
        JSON.stringify({
          merchant: {
            payTag: profile.pay_tag,
            walletAddress: profile.wallet_address,
            preferredNetwork: profile.preferred_network,
          },
          products: mapped,
          storeSettings: storeSettings ? {
            tagline: storeSettings.tagline,
            accentColor: storeSettings.accent_color,
            bannerUrl: storeSettings.banner_url,
            logoUrl: storeSettings.logo_url,
            socialTwitter: storeSettings.social_twitter,
            socialInstagram: storeSettings.social_instagram,
            socialWebsite: storeSettings.social_website,
            socialTelegram: storeSettings.social_telegram,
            showBranding: storeSettings.show_branding,
          } : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (_) {
    // Not JSON or not listPublic, continue to signed flow
  }
  
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

    const { action, profileId, product, productId, pinned, sortOrder, reorderData, imageUrl, visibleOnStorefront, stockQuantity } = JSON.parse(bodyText);

    // Get client IP for rate limiting
    const clientIP = getClientIP(req);

    // Helper function to verify product ownership
    const verifyOwnership = async (prodId: string, profId: string): Promise<{ valid: boolean; error?: string }> => {
      if (!profId) {
        return { valid: false, error: "Profile ID required for this operation" };
      }
      
      const { data: existing, error } = await supabase
        .from("products")
        .select("profile_id")
        .eq("id", prodId)
        .maybeSingle();
      
      if (error) {
        console.error("Ownership check error:", error);
        return { valid: false, error: "Failed to verify ownership" };
      }
      
      if (!existing) {
        return { valid: false, error: "Product not found" };
      }
      
      if (existing.profile_id !== profId) {
        console.warn(`Ownership violation: profile ${profId} tried to modify product ${prodId} owned by ${existing.profile_id}`);
        return { valid: false, error: "You can only modify your own products" };
      }
      
      return { valid: true };
    };

    // List all products for a profile
    if (action === "list") {
      // Rate limit reads
      const rateLimit = await checkRateLimit(clientIP, RATE_LIMITS.general);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Profile ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("profile_id", profileId)
        .order("pinned", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("List products error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch products" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Map database fields to frontend format
      const products = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price),
        category: p.category || "Other",
        icon: p.icon || "package",
        description: p.description || "",
        pinned: p.pinned || false,
        sortOrder: p.sort_order || 0,
        imageUrl: p.image_url || null,
        visibleOnStorefront: p.visible_on_storefront !== false,
        stockQuantity: p.stock_quantity,
      }));

      return new Response(
        JSON.stringify({ products }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new product
    if (action === "create") {
      // Rate limit product mutations
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.productMutate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!profileId || !product) {
        return new Response(
          JSON.stringify({ error: "Profile ID and product required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate product data
      if (!product.name || typeof product.name !== 'string' || product.name.length > 100) {
        return new Response(
          JSON.stringify({ error: "Invalid product name. Max 100 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const price = parseFloat(product.price);
      if (isNaN(price) || price < 0 || price > 1000000) {
        return new Response(
          JSON.stringify({ error: "Invalid price. Must be between 0 and 1,000,000." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("products")
        .insert({
          profile_id: profileId,
          name: product.name.trim(),
          price: price,
          category: product.category || "Other",
          icon: product.icon || "package",
          description: product.description?.substring(0, 500) || null,
          image_url: product.imageUrl || null,
          pinned: false,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Create product error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to create product" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Product created:", data.id, "for profile:", profileId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          product: {
            id: data.id,
            name: data.name,
            price: parseFloat(data.price),
            category: data.category,
            icon: data.icon,
            description: data.description,
            imageUrl: data.image_url || null,
            pinned: data.pinned || false,
            sortOrder: data.sort_order || 0,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update an existing product
    if (action === "update") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.productMutate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!productId || !product) {
        return new Response(
          JSON.stringify({ error: "Product ID and product data required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Verify ownership before update
      const ownership = await verifyOwnership(productId, profileId);
      if (!ownership.valid) {
        return new Response(
          JSON.stringify({ error: ownership.error }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate product data
      if (product.name && (typeof product.name !== 'string' || product.name.length > 100)) {
        return new Response(
          JSON.stringify({ error: "Invalid product name. Max 100 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (product.price !== undefined) {
        const price = parseFloat(product.price);
        if (isNaN(price) || price < 0 || price > 1000000) {
          return new Response(
            JSON.stringify({ error: "Invalid price. Must be between 0 and 1,000,000." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const updatePayload: any = {
        name: product.name?.trim(),
        price: product.price,
        category: product.category || "Other",
        icon: product.icon || "package",
        description: product.description?.substring(0, 500) || null,
      };
      if (product.imageUrl !== undefined) {
        updatePayload.image_url = product.imageUrl || null;
      }

      const { data, error } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", productId)
        .select()
        .single();

      if (error) {
        console.error("Update product error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update product" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Product updated:", data.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          product: {
            id: data.id,
            name: data.name,
            price: parseFloat(data.price),
            category: data.category,
            icon: data.icon,
            description: data.description,
            pinned: data.pinned || false,
            sortOrder: data.sort_order || 0,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Toggle pin status
    if (action === "togglePin") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.productMutate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!productId || pinned === undefined) {
        return new Response(
          JSON.stringify({ error: "Product ID and pinned status required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Verify ownership before toggling pin
      const ownership = await verifyOwnership(productId, profileId);
      if (!ownership.valid) {
        return new Response(
          JSON.stringify({ error: ownership.error }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: any = { pinned };
      if (sortOrder !== undefined) {
        updateData.sort_order = sortOrder;
      }

      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", productId)
        .select()
        .single();

      if (error) {
        console.error("Toggle pin error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update product" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Product pin toggled:", data.id, "pinned:", pinned);
      return new Response(
        JSON.stringify({ 
          success: true, 
          product: {
            id: data.id,
            name: data.name,
            price: parseFloat(data.price),
            category: data.category,
            icon: data.icon,
            description: data.description,
            pinned: data.pinned,
            sortOrder: data.sort_order || 0,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reorder pinned products
    if (action === "reorder") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.productMutate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!reorderData || !Array.isArray(reorderData) || !profileId) {
        return new Response(
          JSON.stringify({ error: "Reorder data and profile ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Verify all products belong to this profile before reordering
      for (const item of reorderData) {
        const ownership = await verifyOwnership(item.id, profileId);
        if (!ownership.valid) {
          return new Response(
            JSON.stringify({ error: `Cannot reorder: ${ownership.error}` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update sort_order for each product
      for (const item of reorderData) {
        const { error } = await supabase
          .from("products")
          .update({ sort_order: item.sortOrder })
          .eq("id", item.id);

        if (error) {
          console.error("Reorder error for product:", item.id, error);
        }
      }

      console.log("Products reordered:", reorderData.length, "items for profile:", profileId);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Toggle storefront visibility
    if (action === "toggleStorefront") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.productMutate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!productId || visibleOnStorefront === undefined) {
        return new Response(
          JSON.stringify({ error: "Product ID and visibility status required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ownership = await verifyOwnership(productId, profileId);
      if (!ownership.valid) {
        return new Response(
          JSON.stringify({ error: ownership.error }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("products")
        .update({ visible_on_storefront: visibleOnStorefront })
        .eq("id", productId)
        .select()
        .single();

      if (error) {
        console.error("Toggle storefront error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update product" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, product: { id: data.id, visibleOnStorefront: data.visible_on_storefront } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Toggle stock status
    if (action === "updateStock") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.productMutate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!productId) {
        return new Response(
          JSON.stringify({ error: "Product ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ownership = await verifyOwnership(productId, profileId);
      if (!ownership.valid) {
        return new Response(
          JSON.stringify({ error: ownership.error }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // stockQuantity: null = unlimited, 0 = out of stock, >0 = specific qty
      const qty = stockQuantity === null || stockQuantity === undefined ? null : Math.max(0, Math.min(999999, parseInt(stockQuantity)));

      const { data, error } = await supabase
        .from("products")
        .update({ stock_quantity: qty })
        .eq("id", productId)
        .select()
        .single();

      if (error) {
        console.error("Update stock error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update stock" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, product: { id: data.id, stockQuantity: data.stock_quantity } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete a product
    if (action === "delete") {
      const rateLimit = await checkRateLimit(profileId || clientIP, RATE_LIMITS.productMutate);
      if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit);
      }

      if (!productId) {
        return new Response(
          JSON.stringify({ error: "Product ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Verify ownership before delete
      const ownership = await verifyOwnership(productId, profileId);
      if (!ownership.valid) {
        return new Response(
          JSON.stringify({ error: ownership.error }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) {
        console.error("Delete product error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to delete product" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Product deleted:", productId, "by profile:", profileId);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get store settings
    if (action === "getStoreSettings") {
      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Profile ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data } = await supabase
        .from("store_settings")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();

      return new Response(
        JSON.stringify({ settings: data ? {
          tagline: data.tagline,
          accentColor: data.accent_color,
          bannerUrl: data.banner_url,
          logoUrl: data.logo_url,
          socialTwitter: data.social_twitter,
          socialInstagram: data.social_instagram,
          socialWebsite: data.social_website,
          socialTelegram: data.social_telegram,
          showBranding: data.show_branding,
        } : null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save store settings (upsert)
    if (action === "saveStoreSettings") {
      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "Profile ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { storeSettings: settings } = JSON.parse(bodyText);
      if (!settings) {
        return new Response(
          JSON.stringify({ error: "Store settings required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const upsertData: any = {
        profile_id: profileId,
        tagline: settings.tagline?.substring(0, 200) || null,
        accent_color: settings.accentColor || '#0052FF',
        banner_url: settings.bannerUrl || null,
        logo_url: settings.logoUrl || null,
        social_twitter: settings.socialTwitter?.substring(0, 100) || null,
        social_instagram: settings.socialInstagram?.substring(0, 100) || null,
        social_website: settings.socialWebsite?.substring(0, 200) || null,
        social_telegram: settings.socialTelegram?.substring(0, 100) || null,
        show_branding: settings.showBranding !== false,
      };

      const { data, error } = await supabase
        .from("store_settings")
        .upsert(upsertData, { onConflict: "profile_id" })
        .select()
        .single();

      if (error) {
        console.error("Save store settings error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save settings" }),
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
    console.error("Products edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
