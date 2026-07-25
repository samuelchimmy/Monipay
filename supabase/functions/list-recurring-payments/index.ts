/**
 * list-recurring-payments
 *
 * Returns recurring payment series for the current user (sender OR
 * recipient), grouped by `payload->>seriesId`. Used by the Transaction
 * History surfaces on both MoniPay and MiniPay so users can see (and cancel)
 * any series that the bots have pre-created on their behalf.
 *
 * Actions:
 *  - { action: "list",    profileId, payTag, filter?, limit?, offset? }
 *       filter: "active" (default — pending>0) | "past" (pending=0) | "all"
 *       returns { series[], total, hasMore, nextUpcoming }
 *  - { action: "details", profileId, payTag, seriesId } → full run list
 *  - { action: "cancel",  profileId, seriesId }         → cancels pending jobs
 *      (sender-only — only the originator can cancel)
 *
 * `scheduled_jobs` has deny-all RLS, so all access flows through this
 * function using the service role key.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RecurringSeries {
  seriesId: string;
  direction: "sent" | "received" | "both";
  platform: string | null;
  chain: string | null;
  amountPerRun: number | null;
  recipients: string[];
  senderPayTag: string | null;
  senderWallet: string | null;
  senderId: string | null;
  originalText: string | null;
  intervalMs: number | null;
  intervalLabel: string | null;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string | null;
  canCancel: boolean;
  status: "active" | "completed" | "cancelled" | "mixed";
}

function humanInterval(ms: number | null, fallback: string | null): string | null {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return fallback;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
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

    const body = await req.json().catch(() => ({}));
    const action = (body?.action || "list") as string;

    const profileIdAny = String(body?.profileId || "").trim();
    const payTagAny = String(body?.payTag || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");

    // ── Details (single series, full job list) ────────────────────────────
    if (action === "details") {
      const seriesId = String(body?.seriesId || "").trim();
      if (!seriesId) {
        return new Response(
          JSON.stringify({ error: "seriesId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: runs, error } = await supabase
        .from("scheduled_jobs")
        .select("id, status, scheduled_at, completed_at, created_at, error_message, payload, result")
        .filter("payload->>seriesId", "eq", seriesId)
        .order("scheduled_at", { ascending: true })
        .limit(500);
      if (error) throw error;

      // Optional authorization: caller must be sender or a recipient.
      let authorized = false;
      const sample = runs?.[0]?.payload as any;
      if (sample) {
        if (profileIdAny && sample.senderId === profileIdAny) authorized = true;
        const recips = Array.isArray(sample?.command?.recipients)
          ? sample.command.recipients.map((r: any) => String(r).toLowerCase())
          : [];
        if (payTagAny && recips.includes(payTagAny)) authorized = true;
      }
      if (!authorized) {
        return new Response(JSON.stringify({ error: "not authorized for this series" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const items = (runs || []).map((r) => {
        const p = (r.payload as any) || {};
        const res = (r.result as any) || {};
        return {
          id: r.id,
          status: r.status,
          scheduledAt: r.scheduled_at,
          completedAt: r.completed_at,
          createdAt: r.created_at,
          amount: p?.command?.amount != null ? Number(p.command.amount) : null,
          chain: p?.command?.chain ?? null,
          recipients: Array.isArray(p?.command?.recipients) ? p.command.recipients : [],
          txHash: res?.txHash || res?.hash || null,
          error: r.error_message || res?.error || null,
          runIndex: p?.seriesRunIndex ?? null,
        };
      });

      return new Response(JSON.stringify({ runs: items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Cancel ────────────────────────────────────────────────────────────
    if (action === "cancel") {
      const profileId = String(body?.profileId || "").trim();
      const seriesId = String(body?.seriesId || "").trim();
      if (!profileId || !seriesId) {
        return new Response(
          JSON.stringify({ error: "profileId and seriesId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Only the originator can cancel; verify against payload.senderId.
      const { data: sample, error: sErr } = await supabase
        .from("scheduled_jobs")
        .select("payload")
        .filter("payload->>seriesId", "eq", seriesId)
        .limit(1)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!sample) {
        return new Response(JSON.stringify({ error: "series not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const senderId = (sample.payload as any)?.senderId;
      if (senderId !== profileId) {
        return new Response(JSON.stringify({ error: "only the sender can cancel this series" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated, error: uErr } = await supabase
        .from("scheduled_jobs")
        .update({
          status: "failed",
          error_message: "Cancelled by user",
          completed_at: new Date().toISOString(),
        })
        .eq("status", "pending")
        .filter("payload->>seriesId", "eq", seriesId)
        .select("id");
      if (uErr) throw uErr;

      return new Response(
        JSON.stringify({ ok: true, cancelled: updated?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── List ──────────────────────────────────────────────────────────────
    const profileId = profileIdAny;
    const payTag = payTagAny;
    const filter = ((body?.filter as string) || "active").toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(body?.limit ?? 20)));
    const offset = Math.max(0, Number(body?.offset ?? 0));

    if (!profileId && !payTag) {
      return new Response(
        JSON.stringify({ error: "profileId or payTag required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pull all jobs that belong to any seriesId where this user is either
    // the sender (senderId match) or a recipient (payTag in recipients[]).
    // We do it in two steps: first find candidate seriesIds, then fetch all
    // jobs in those series. Keeps the query simple under JSONB.
    const seriesIds = new Set<string>();

    // (a) series where I'm the sender
    if (profileId) {
      const { data, error } = await supabase
        .from("scheduled_jobs")
        .select("payload")
        .filter("payload->>senderId", "eq", profileId)
        .not("payload->>seriesId", "is", null)
        .limit(2000);
      if (error) throw error;
      for (const row of data || []) {
        const sid = (row.payload as any)?.seriesId;
        if (sid) seriesIds.add(String(sid));
      }
    }

    // (b) series where I'm a recipient (paytag match in command.recipients[])
    if (payTag) {
      const { data, error } = await supabase
        .from("scheduled_jobs")
        .select("payload")
        .contains("payload", { command: { recipients: [payTag] } })
        .not("payload->>seriesId", "is", null)
        .limit(2000);
      if (error) {
        // Non-fatal — recipients lookup is best-effort.
        console.warn("[list-recurring-payments] recipient query failed", error);
      } else {
        for (const row of data || []) {
          const sid = (row.payload as any)?.seriesId;
          if (sid) seriesIds.add(String(sid));
        }
      }
    }

    if (seriesIds.size === 0) {
      return new Response(JSON.stringify({ series: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sidArray = Array.from(seriesIds);

    // Fetch all jobs across those series (cap to a sane upper bound).
    const { data: jobs, error: jErr } = await supabase
      .from("scheduled_jobs")
      .select("id, status, scheduled_at, completed_at, created_at, payload")
      .filter("payload->>seriesId", "in", `(${sidArray.map((s) => `"${s}"`).join(",")})`)
      .limit(5000);
    if (jErr) throw jErr;

    // Group + aggregate.
    const grouped = new Map<string, RecurringSeries>();
    const now = Date.now();

    for (const job of jobs || []) {
      const p = (job.payload as any) || {};
      const sid = String(p.seriesId);
      if (!sid) continue;

      let s = grouped.get(sid);
      if (!s) {
        const recipientsRaw = p?.command?.recipients;
        const recipients = Array.isArray(recipientsRaw)
          ? recipientsRaw.map((r: any) => String(r).toLowerCase())
          : [];

        const isSender = profileId && p.senderId === profileId;
        const isReceiver = payTag && recipients.includes(payTag);
        const direction: RecurringSeries["direction"] =
          isSender && isReceiver ? "both" : isSender ? "sent" : "received";

        s = {
          seriesId: sid,
          direction,
          platform: p.platform ?? null,
          chain: p?.command?.chain ?? null,
          amountPerRun:
            p?.command?.amount != null ? Number(p.command.amount) : null,
          recipients,
          senderPayTag: p.senderPayTag ?? null,
          senderWallet: p.senderWallet ?? null,
          senderId: p.senderId ?? null,
          originalText: p.originalText ?? null,
          intervalMs: p.seriesIntervalMs ?? null,
          intervalLabel: humanInterval(
            p.seriesIntervalMs ?? null,
            p.seriesInterval ?? null
          ),
          totalCount: Number(p.seriesTotalCount ?? 0),
          completedCount: 0,
          pendingCount: 0,
          failedCount: 0,
          nextRunAt: null,
          lastRunAt: null,
          createdAt: null,
          canCancel: !!isSender,
          status: "active",
        };
        grouped.set(sid, s);
      }

      // Always honour seriesTotalCount in the payload (the canonical series
      // length), but make sure we never under-count.
      const totalFromPayload = Number(p.seriesTotalCount ?? 0);
      if (totalFromPayload > s.totalCount) s.totalCount = totalFromPayload;

      switch (job.status) {
        case "completed":
          s.completedCount++;
          if (job.completed_at) {
            if (!s.lastRunAt || job.completed_at > s.lastRunAt) {
              s.lastRunAt = job.completed_at;
            }
          }
          break;
        case "pending":
          s.pendingCount++;
          if (job.scheduled_at) {
            const ts = new Date(job.scheduled_at).getTime();
            if (ts >= now - 60_000) {
              if (!s.nextRunAt || job.scheduled_at < s.nextRunAt) {
                s.nextRunAt = job.scheduled_at;
              }
            }
          }
          break;
        case "failed":
          s.failedCount++;
          break;
      }

      if (job.created_at) {
        if (!s.createdAt || job.created_at < s.createdAt) {
          s.createdAt = job.created_at;
        }
      }
    }

    // Tag each series with a coarse status.
    for (const s of grouped.values()) {
      if (s.pendingCount > 0) {
        s.status = "active";
      } else if (s.failedCount > 0 && s.completedCount === 0) {
        s.status = "cancelled";
      } else if (s.failedCount > 0 && s.completedCount > 0) {
        s.status = "mixed";
      } else {
        s.status = "completed";
      }
    }

    let all = Array.from(grouped.values());
    if (filter === "active") {
      all = all.filter((s) => s.pendingCount > 0);
    } else if (filter === "past") {
      all = all.filter((s) => s.pendingCount === 0);
    } // "all" → no filtering

    // Sort: active by soonest next run; past by most-recent completed.
    all.sort((a, b) => {
      if (filter === "past") {
        const al = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
        const bl = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
        return bl - al;
      }
      const an = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Infinity;
      const bn = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Infinity;
      return an - bn;
    });

    const total = all.length;
    const page = all.slice(offset, offset + limit);
    const hasMore = offset + page.length < total;

    // Soonest upcoming across ALL active series (for toast).
    const nextUpcoming = Array.from(grouped.values())
      .filter((s) => s.pendingCount > 0 && s.nextRunAt)
      .map((s) => ({ seriesId: s.seriesId, nextRunAt: s.nextRunAt, amount: s.amountPerRun, chain: s.chain, recipients: s.recipients, direction: s.direction }))
      .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime())[0] || null;

    return new Response(
      JSON.stringify({ series: page, total, hasMore, nextUpcoming }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[list-recurring-payments] error", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});