import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.21.0";
import {
  checkAdminOrigin,
  getAdminCorsHeaders,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitedResponse,
} from "../_shared/security.ts";

const MONIBOT_WALLET_ADDRESS = "0xdfa5fe220ce7c4bcbb1180686666b803dfae8ed3";

Deno.serve(async (req) => {
  const corsHeaders = getAdminCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const originBlock = checkAdminOrigin(req);
  if (originBlock) return originBlock;

  try {
    const walletAddress = req.headers.get("x-wallet-address")?.toLowerCase();
    const walletSignature = req.headers.get("x-wallet-signature");

    if (!walletAddress || !walletSignature || walletAddress !== MONIBOT_WALLET_ADDRESS) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, timestamp, ...params } = body;

    const signedMessage = `monibot-campaign:${action}:${timestamp}`;
    const valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message: signedMessage,
      signature: walletSignature as `0x${string}`,
    }).catch(() => false);

    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rl = await checkRateLimit(walletAddress, RATE_LIMITS.admin);
    if (!rl.allowed) return rateLimitedResponse(rl);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // === INFRA SUBSCRIPTIONS ===
    if (action === "list-subscriptions") {
      const { data, error } = await supabase
        .from("infra_subscriptions")
        .select("*")
        .order("next_due_date", { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert-subscription") {
      const { id, name, provider, amount, currency, billing_cycle, next_due_date, notes, is_active } = params;

      if (!name || !provider) {
        return new Response(JSON.stringify({ error: "Name and provider required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const row = {
        name,
        provider,
        amount: amount || 0,
        currency: currency || "USD",
        billing_cycle: billing_cycle || "monthly",
        next_due_date: next_due_date || null,
        notes: notes || null,
        is_active: is_active !== false,
      };

      let result;
      if (id) {
        const { data, error } = await supabase
          .from("infra_subscriptions")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("infra_subscriptions")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-subscription") {
      const { id } = params;
      if (!id) {
        return new Response(JSON.stringify({ error: "ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("infra_subscriptions").delete().eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === APP FINANCIALS ===
    if (action === "list-financials") {
      const { data, error } = await supabase
        .from("app_financials")
        .select("*")
        .order("month", { ascending: false })
        .limit(12);

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert-financial") {
      const { month, revenue, overhead, notes } = params;
      if (!month) {
        return new Response(JSON.stringify({ error: "Month required (YYYY-MM)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("app_financials")
        .upsert(
          { month, revenue: revenue || 0, overhead: overhead || 0, notes: notes || null },
          { onConflict: "month" }
        )
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === AUTO REVENUE & COST SUMMARY ===
    // Revenue = Σ on-chain router/social tx fees (monibot_transactions) + Σ ledger transactions.fee
    // Cost   = pro-rated infra subscriptions for window + native gas spent (snapshots delta)
    if (action === "admin-revenue-summary") {
      const range = (params.range as string) || "30d";
      const now = Date.now();
      let windowDays: number;
      let sinceIso: string | null;
      if (range === "all") { windowDays = 3650; sinceIso = null; }
      else {
        windowDays = range === "7d" ? 7 : range === "90d" ? 90 : 30;
        sinceIso = new Date(now - windowDays * 86400_000).toISOString();
      }

      const CHAINS = ["base","bsc","celo","ink","tempo","solana","arc"];
      const perChain: Record<string, { revenue: number; gas_native: number }> = {};
      for (const c of CHAINS) perChain[c] = { revenue: 0, gas_native: 0 };

      // 1. MoniBot social tx fees (monibot_transactions.fee), per chain
      let mbQ = supabase.from("monibot_transactions").select("chain, fee").eq("status", "completed");
      if (sinceIso) mbQ = mbQ.gte("created_at", sinceIso);
      const { data: mbRows } = await mbQ.limit(50000);
      let routerFees = 0;
      for (const r of mbRows || []) {
        const k = String((r as any).chain || "").toLowerCase();
        const f = Number((r as any).fee || 0);
        if (perChain[k]) perChain[k].revenue += f;
        routerFees += f;
      }

      // 2. Ledger transactions.fee (P2P / orders / etc.)
      let lgQ = supabase.from("transactions").select("fee").eq("status", "completed");
      if (sinceIso) lgQ = lgQ.gte("created_at", sinceIso);
      const { data: lgRows } = await lgQ.limit(50000);
      let ledgerFees = 0;
      for (const r of lgRows || []) ledgerFees += Number((r as any).fee || 0);

      const revenueUsd = routerFees + ledgerFees;

      // 3. Infrastructure cost (pro-rated to the window)
      const { data: subs } = await supabase
        .from("infra_subscriptions")
        .select("amount, billing_cycle, is_active")
        .eq("is_active", true);
      let infraMonthly = 0;
      for (const s of subs || []) {
        const amt = Number((s as any).amount || 0);
        const cycle = (s as any).billing_cycle || "monthly";
        if (cycle === "yearly") infraMonthly += amt / 12;
        else if (cycle === "one-time") {} // ignored in pro-rated cost
        else infraMonthly += amt;
      }
      const infraCost = (infraMonthly * 12) * (windowDays / 365);

      // 4. Gas spend per chain — diff oldest snapshot in window vs newest snapshot
      let gasUsd = 0;
      for (const role of ["funder","relayer"]) {
        for (const chain of ["base","bsc","celo","ink","tempo","arc"]) {
          let snapQ = supabase
            .from("gas_spend_snapshots")
            .select("balance_wei, taken_at")
            .eq("wallet_role", role).eq("chain", chain)
            .order("taken_at", { ascending: true });
          if (sinceIso) snapQ = snapQ.gte("taken_at", sinceIso);
          const { data: snaps } = await snapQ.limit(2000);
          if (!snaps || snaps.length < 2) continue;
          const first = BigInt((snaps[0] as any).balance_wei || "0");
          const last  = BigInt((snaps[snaps.length - 1] as any).balance_wei || "0");
          // spend = max(first - last, 0); refills aren't perfectly handled but this is acceptable
          const spendWei = first > last ? first - last : 0n;
          // convert to native — base/bsc/celo/ink: 18 decimals, tempo: 6 (aUSD)
          const decimals = chain === "tempo" ? 6 : 18;
          const native = Number(spendWei) / Math.pow(10, decimals);
          perChain[chain].gas_native += native;
        }
      }
      // Naive USD value: tempo aUSD ≈ $1; native gas tokens valued at 0 here (admin can adjust manually).
      // The `gas_cost_usd` only counts tempo (stablecoin) at face value; native EVM gas is shown per-chain
      // but not converted to USD until a price feed is wired in. This avoids hallucinated FX.
      gasUsd += perChain["tempo"].gas_native;

      const costUsd = infraCost + gasUsd;
      const profitUsd = revenueUsd - costUsd;

      return new Response(JSON.stringify({
        range,
        revenue_usd: revenueUsd,
        ledger_fees_usd: ledgerFees,
        router_fees_usd: routerFees,
        infra_cost_usd: infraCost,
        gas_cost_usd: gasUsd,
        cost_usd: costUsd,
        profit_usd: profitUsd,
        per_chain: perChain,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Infra subscriptions error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
