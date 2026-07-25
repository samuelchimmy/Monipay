// MoniBot Mission Stats - Public endpoint to fetch campaign progress
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAdminOrigin, getAdminCorsHeaders } from "../_shared/security.ts";

interface MissionStats {
  total_budget: number;
  spent_budget: number;
  current_users: number;
  target_users: number;
  is_onboarded: boolean;
  last_tweet_at: string | null;
}

Deno.serve(async (req) => {
  const corsHeaders = getAdminCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Origin check
  const originBlock = checkAdminOrigin(req);
  if (originBlock) return originBlock;

  try {
    // Only allow GET requests
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for reading mission stats
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch mission stats (should only be one row with id=1)
    const { data, error } = await supabase
      .from("monibot_mission_stats")
      .select("*")
      .eq("id", 1)
      .single();

    // Count actual grants from campaign_grants table (unique users who received grants)
    const { count: grantCount, error: countError } = await supabase
      .from("campaign_grants")
      .select("profile_id", { count: "exact", head: true });

    if (countError) {
      console.error("Error counting grants:", countError);
    }

    const actualUserCount = grantCount ?? 0;

    if (error) {
      console.error("Error fetching mission stats:", error);
      
      // If no row exists, return default values with actual grant count
      if (error.code === "PGRST116") {
        const defaultStats: MissionStats = {
          total_budget: 50,
          spent_budget: 0,
          current_users: actualUserCount,
          target_users: 5000,
          is_onboarded: actualUserCount > 0,
          last_tweet_at: null,
        };
        return new Response(
          JSON.stringify(defaultStats),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to fetch mission stats" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use actual grant count instead of stale current_users value
    const stats: MissionStats = {
      total_budget: data.total_budget ?? 50,
      spent_budget: data.spent_budget ?? 0,
      current_users: actualUserCount,
      target_users: data.target_users ?? 5000,
      is_onboarded: actualUserCount > 0 || (data.is_onboarded ?? false),
      last_tweet_at: data.last_tweet_at,
    };

    console.log("Returning mission stats:", stats);

    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
