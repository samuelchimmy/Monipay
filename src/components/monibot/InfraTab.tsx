import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield, RefreshCw, Loader2, Plus, Trash2, Edit2, Save, X,
  Calendar, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Server, Cloud, Cpu, Globe, MessageSquare, Zap, ChevronDown, ChevronUp, Flame,
} from "lucide-react";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { formatDistanceToNow, format, differenceInDays, parseISO } from "date-fns";
import type { WalletOptions } from "./types";

interface InfraSub {
  id: string;
  name: string;
  provider: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_due_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface AppFinancial {
  id: string;
  month: string;
  revenue: number;
  overhead: number;
  notes: string | null;
}

type RangeKey = "7d" | "30d" | "90d" | "all";

interface RevenueSummary {
  range: RangeKey;
  revenue_usd: number;
  ledger_fees_usd: number;
  router_fees_usd: number;
  infra_cost_usd: number;
  gas_cost_usd: number;
  cost_usd: number;
  profit_usd: number;
  per_chain: Record<string, { revenue: number; gas_native: number }>;
}

interface Props {
  walletOptions?: WalletOptions;
  isUnlocked: boolean;
}

const PROVIDER_ICONS: Record<string, typeof Server> = {
  railway: Server,
  lovable: Cloud,
  gemini: Zap,
  supabase: Cpu,
  x_api: MessageSquare,
  vercel: Globe,
  other: Server,
};

const PROVIDER_COLORS: Record<string, string> = {
  railway: "text-purple-500",
  lovable: "text-pink-500",
  gemini: "text-blue-500",
  supabase: "text-green-500",
  x_api: "text-foreground",
  vercel: "text-foreground",
  other: "text-muted-foreground",
};

const PROVIDERS = [
  { value: "railway", label: "Railway" },
  { value: "lovable", label: "Lovable" },
  { value: "gemini", label: "Gemini" },
  { value: "supabase", label: "Supabase" },
  { value: "x_api", label: "X API" },
  { value: "vercel", label: "Vercel" },
  { value: "other", label: "Other" },
];

export function MoniBotInfraTab({ walletOptions, isUnlocked }: Props) {
  const [subs, setSubs] = useState<InfraSub[]>([]);
  const [financials, setFinancials] = useState<AppFinancial[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [autoRange, setAutoRange] = useState<RangeKey>("30d");
  const [autoSummary, setAutoSummary] = useState<RevenueSummary | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState("other");
  const [formAmount, setFormAmount] = useState("");
  const [formCycle, setFormCycle] = useState("monthly");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Financial form
  const [finMonth, setFinMonth] = useState(format(new Date(), "yyyy-MM"));
  const [finRevenue, setFinRevenue] = useState("");
  const [finOverhead, setFinOverhead] = useState("");
  const [finNotes, setFinNotes] = useState("");

  const apiCall = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    if (!walletOptions) throw new Error("Not unlocked");
    const timestamp = Date.now().toString();
    const signature = await walletOptions.signMessage(`monibot-campaign:${action}:${timestamp}`);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/infra-subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": walletOptions.walletAddress,
        "x-wallet-signature": signature,
      },
      body: JSON.stringify({ action, timestamp, ...params }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  }, [walletOptions]);

  const fetchData = useCallback(async () => {
    if (!walletOptions) return;
    setLoading(true);
    try {
      const [subsData, finData] = await Promise.all([
        apiCall("list-subscriptions"),
        apiCall("list-financials"),
      ]);
      setSubs(subsData);
      setFinancials(finData);
    } catch (err: any) {
      console.error("Fetch infra data failed:", err);
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [walletOptions, apiCall]);

  const fetchAutoSummary = useCallback(async (range: RangeKey) => {
    if (!walletOptions) return;
    setAutoLoading(true);
    try {
      const data = await apiCall("admin-revenue-summary", { range });
      setAutoSummary(data as RevenueSummary);
    } catch (err) {
      console.error("Revenue summary failed:", err);
    } finally {
      setAutoLoading(false);
    }
  }, [walletOptions, apiCall]);

  useEffect(() => {
    if (walletOptions && isUnlocked) fetchData();
  }, [walletOptions, isUnlocked, fetchData]);

  useEffect(() => {
    if (walletOptions && isUnlocked) fetchAutoSummary(autoRange);
  }, [walletOptions, isUnlocked, autoRange, fetchAutoSummary]);

  const resetForm = () => {
    setFormName("");
    setFormProvider("other");
    setFormAmount("");
    setFormCycle("monthly");
    setFormDueDate("");
    setFormNotes("");
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleEdit = (sub: InfraSub) => {
    setEditingId(sub.id);
    setFormName(sub.name);
    setFormProvider(sub.provider);
    setFormAmount(sub.amount.toString());
    setFormCycle(sub.billing_cycle);
    setFormDueDate(sub.next_due_date ? format(parseISO(sub.next_due_date), "yyyy-MM-dd") : "");
    setFormNotes(sub.notes || "");
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formProvider) {
      toast.error("Name and provider required");
      return;
    }
    try {
      await apiCall("upsert-subscription", {
        id: editingId || undefined,
        name: formName.trim(),
        provider: formProvider,
        amount: parseFloat(formAmount) || 0,
        billing_cycle: formCycle,
        next_due_date: formDueDate || null,
        notes: formNotes.trim() || null,
      });
      toast.success(editingId ? "Subscription updated" : "Subscription added");
      feedback("success");
      resetForm();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
      feedback("error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subscription?")) return;
    try {
      await apiCall("delete-subscription", { id });
      toast.success("Deleted");
      feedback("success");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
      feedback("error");
    }
  };

  const handleSaveFinancial = async () => {
    if (!finMonth) {
      toast.error("Month required");
      return;
    }
    try {
      await apiCall("upsert-financial", {
        month: finMonth,
        revenue: parseFloat(finRevenue) || 0,
        overhead: parseFloat(finOverhead) || 0,
        notes: finNotes.trim() || null,
      });
      toast.success("Financial record saved");
      feedback("success");
      setFinRevenue("");
      setFinOverhead("");
      setFinNotes("");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
      feedback("error");
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-bold text-muted-foreground">Unlock dashboard to manage subscriptions</p>
      </div>
    );
  }

  // Calculate totals
  const activeSubs = subs.filter(s => s.is_active);
  const monthlyTotal = activeSubs.reduce((sum, s) => {
    if (s.billing_cycle === "yearly") return sum + s.amount / 12;
    if (s.billing_cycle === "one-time") return sum;
    return sum + s.amount;
  }, 0);

  const yearlyTotal = activeSubs.reduce((sum, s) => {
    if (s.billing_cycle === "yearly") return sum + s.amount;
    if (s.billing_cycle === "one-time") return sum + s.amount;
    return sum + s.amount * 12;
  }, 0);

  const dueSoon = activeSubs.filter(s => {
    if (!s.next_due_date) return false;
    const days = differenceInDays(parseISO(s.next_due_date), new Date());
    return days >= 0 && days <= 7;
  });

  const overdue = activeSubs.filter(s => {
    if (!s.next_due_date) return false;
    return differenceInDays(parseISO(s.next_due_date), new Date()) < 0;
  });

  const latestFinancial = financials[0];
  const profit = latestFinancial ? latestFinancial.revenue - latestFinancial.overhead : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider">Infrastructure</h3>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="h-8 w-8">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && subs.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Auto Revenue & Cost (on-chain + ledger + gas + infra) */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Revenue & Cost (auto)
                </CardTitle>
                <div className="flex items-center gap-1">
                  {(["7d","30d","90d","all"] as RangeKey[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setAutoRange(r)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        autoRange === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchAutoSummary(autoRange)} disabled={autoLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${autoLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!autoSummary ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Revenue</p>
                      <p className="text-lg font-extrabold font-mono text-green-500 mt-0.5">${autoSummary.revenue_usd.toFixed(2)}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">router ${autoSummary.router_fees_usd.toFixed(2)} · ledger ${autoSummary.ledger_fees_usd.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cost</p>
                      <p className="text-lg font-extrabold font-mono text-red-500 mt-0.5">${autoSummary.cost_usd.toFixed(2)}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">infra ${autoSummary.infra_cost_usd.toFixed(2)} · gas ${autoSummary.gas_cost_usd.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Profit</p>
                      <p className={`text-lg font-extrabold font-mono mt-0.5 ${autoSummary.profit_usd >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {autoSummary.profit_usd >= 0 ? "+" : "−"}${Math.abs(autoSummary.profit_usd).toFixed(2)}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{autoRange.toUpperCase()} window</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Margin</p>
                      <p className="text-lg font-extrabold font-mono text-foreground mt-0.5">
                        {autoSummary.revenue_usd > 0 ? `${((autoSummary.profit_usd / autoSummary.revenue_usd) * 100).toFixed(0)}%` : "—"}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">profit / revenue</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                    {Object.entries(autoSummary.per_chain).map(([chain, v]) => (
                      <div key={chain} className="rounded bg-muted/40 p-2 text-center">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{chain}</p>
                        <p className="text-xs font-extrabold font-mono text-foreground mt-0.5">${v.revenue.toFixed(2)}</p>
                        <p className="text-[9px] text-muted-foreground font-mono flex items-center justify-center gap-0.5">
                          <Flame className="w-2.5 h-2.5" />{v.gas_native.toFixed(4)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <p className="text-xl font-extrabold font-mono text-foreground">${monthlyTotal.toFixed(0)}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Monthly</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                <Calendar className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <p className="text-xl font-extrabold font-mono text-foreground">${yearlyTotal.toFixed(0)}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Yearly</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 text-center">
                {profit >= 0 ? (
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 mx-auto mb-1 text-red-500" />
                )}
                <p className={`text-xl font-extrabold font-mono ${profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  ${Math.abs(profit).toFixed(0)}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {latestFinancial ? latestFinancial.month : "N/A"} P/L
                </p>
              </CardContent>
            </Card>
            <Card className={`border-border ${(overdue.length > 0 || dueSoon.length > 0) ? "border-amber-500/30" : ""}`}>
              <CardContent className="pt-4 pb-4 text-center">
                <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${overdue.length > 0 ? "text-red-500" : dueSoon.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                <p className="text-xl font-extrabold font-mono text-foreground">{overdue.length + dueSoon.length}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Soon</p>
              </CardContent>
            </Card>
          </div>

          {/* Overdue / Due Soon Alerts */}
          {overdue.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs font-bold text-red-500 mb-1">⚠️ Overdue</p>
              {overdue.map(s => (
                <p key={s.id} className="text-xs text-red-400">
                  {s.name} — was due {formatDistanceToNow(parseISO(s.next_due_date!), { addSuffix: true })}
                </p>
              ))}
            </div>
          )}

          {dueSoon.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs font-bold text-amber-500 mb-1">🔔 Due Soon</p>
              {dueSoon.map(s => (
                <p key={s.id} className="text-xs text-amber-400">
                  {s.name} — due {formatDistanceToNow(parseISO(s.next_due_date!), { addSuffix: true })} (${s.amount})
                </p>
              ))}
            </div>
          )}

          {/* Subscriptions List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  Subscriptions
                  <Badge variant="secondary" className="text-[10px]">{activeSubs.length}</Badge>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { resetForm(); setShowAddForm(true); }}
                  className="h-8 text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Add/Edit Form */}
              {showAddForm && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2 border border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Service name"
                      className="h-9 text-sm"
                      maxLength={100}
                    />
                    <select
                      value={formProvider}
                      onChange={e => setFormProvider(e.target.value)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    >
                      {PROVIDERS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      placeholder="Amount ($)"
                      className="h-9 text-sm"
                      min="0"
                      step="0.01"
                    />
                    <select
                      value={formCycle}
                      onChange={e => setFormCycle(e.target.value)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="one-time">One-time</option>
                    </select>
                    <Input
                      type="date"
                      value={formDueDate}
                      onChange={e => setFormDueDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <Input
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="h-9 text-sm"
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm" className="h-8 text-xs font-bold flex-1">
                      <Save className="w-3.5 h-3.5 mr-1" />{editingId ? "Update" : "Save"}
                    </Button>
                    <Button onClick={resetForm} variant="outline" size="sm" className="h-8 text-xs">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {subs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No subscriptions yet. Add your first one above.</p>
              ) : (
                subs.map(sub => {
                  const Icon = PROVIDER_ICONS[sub.provider] || Server;
                  const color = PROVIDER_COLORS[sub.provider] || "text-muted-foreground";
                  const daysUntilDue = sub.next_due_date ? differenceInDays(parseISO(sub.next_due_date), new Date()) : null;
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;

                  return (
                    <div
                      key={sub.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isOverdue ? "bg-red-500/5 border border-red-500/20" :
                        isDueSoon ? "bg-amber-500/5 border border-amber-500/20" :
                        "bg-muted/50"
                      } ${!sub.is_active ? "opacity-50" : ""}`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold truncate">{sub.name}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {sub.billing_cycle}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ${sub.amount.toFixed(2)}/{sub.billing_cycle === "yearly" ? "yr" : sub.billing_cycle === "one-time" ? "once" : "mo"}
                          {sub.next_due_date && (
                            <span className={isOverdue ? " text-red-500 font-bold" : isDueSoon ? " text-amber-500 font-bold" : ""}>
                              {" · "}
                              {isOverdue ? "Overdue " : "Due "}
                              {formatDistanceToNow(parseISO(sub.next_due_date), { addSuffix: true })}
                            </span>
                          )}
                        </p>
                        {sub.notes && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(sub)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDelete(sub.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* App Financials */}
          <Card>
            <CardHeader className="pb-2">
              <button
                onClick={() => setShowFinancials(!showFinancials)}
                className="flex items-center justify-between w-full"
              >
                <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Revenue & Costs
                </CardTitle>
                {showFinancials ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {showFinancials && (
              <CardContent className="space-y-3">
                {/* Add financial record */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2 border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Log Monthly Record</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="month"
                      value={finMonth}
                      onChange={e => setFinMonth(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Input
                      type="number"
                      value={finRevenue}
                      onChange={e => setFinRevenue(e.target.value)}
                      placeholder="Revenue ($)"
                      className="h-9 text-sm"
                      min="0"
                      step="0.01"
                    />
                    <Input
                      type="number"
                      value={finOverhead}
                      onChange={e => setFinOverhead(e.target.value)}
                      placeholder="Overhead ($)"
                      className="h-9 text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={finNotes}
                      onChange={e => setFinNotes(e.target.value)}
                      placeholder="Notes"
                      className="h-9 text-sm flex-1"
                      maxLength={500}
                    />
                    <Button onClick={handleSaveFinancial} size="sm" className="h-9 text-xs font-bold px-4">
                      <Save className="w-3.5 h-3.5 mr-1" />Save
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Financial history */}
                {financials.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No records yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {financials.map(f => {
                      const pl = f.revenue - f.overhead;
                      return (
                        <div key={f.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                          <div>
                            <p className="text-sm font-bold">{f.month}</p>
                            {f.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{f.notes}</p>}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-green-500">+${f.revenue.toFixed(0)}</span>
                              <span className="text-red-500">-${f.overhead.toFixed(0)}</span>
                              <span className={`font-bold ${pl >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {pl >= 0 ? "+" : ""}${pl.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
