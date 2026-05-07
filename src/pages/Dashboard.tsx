import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import {
  CheckCircle2, Wrench, Phone, IndianRupee, Package, AlertCircle, Clock, Users,
  TrendingUp, TrendingDown, Activity, Star, Zap, FileText, Receipt, Building2,
  ArrowUpRight, Timer, Target, Sparkles,
} from "lucide-react";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface KPI {
  total: number; pending: number; inProgress: number; completed: number; ivrs: number;
}

interface ActivityItem {
  id: string;
  ticket_no: string;
  status: string;
  priority: string;
  customer_name: string | null;
  issue_type: string | null;
  created_at: string;
}

export default function Dashboard() {
  const { hasRole } = useAuth();
  const [kpi, setKpi] = useState<KPI>({ total: 0, pending: 0, inProgress: 0, completed: 0, ivrs: 0 });
  const [trend, setTrend] = useState<{ date: string; new: number; completed: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [sourceData, setSourceData] = useState<{ name: string; value: number }[]>([]);
  const [revExp, setRevExp] = useState<{ month: string; revenue: number; expenses: number }[]>([]);
  const [topTechs, setTopTechs] = useState<{ name: string; points: number }[]>([]);
  const [issueTypes, setIssueTypes] = useState<{ name: string; value: number }[]>([]);
  const [priorityData, setPriorityData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string | null; customer_name: string | null; created_at: string; ticket_no?: string | null }[]>([]);
  const [lowStock, setLowStock] = useState(0);
  const [techCount, setTechCount] = useState(0);
  const [factoryCount, setFactoryCount] = useState(0);
  const [invStats, setInvStats] = useState({ totalRevenue: 0, pendingInvoices: 0, totalExpenses: 0, avgRating: 0, feedbackCount: 0 });
  const [avgResolution, setAvgResolution] = useState<number>(0);
  const [period, setPeriod] = useState<14 | 30 | 90>(14);

  useEffect(() => {
    (async () => {
      const since = subDays(new Date(), period).toISOString();
      const [
        { data: complaints },
        { data: techs },
        { data: items },
        { data: invs },
        { data: exps },
        { data: recent },
        { data: feedback },
        { data: recentReviews },
      ] = await Promise.all([
        supabase.from("complaints").select("status,priority,source,issue_type,created_at,completed_at").gte("created_at", since),
        supabase.from("technicians").select("name,total_points").order("total_points", { ascending: false }).limit(5),
        supabase.from("inventory_items").select("quantity,low_stock_threshold"),
        hasRole("admin", "accountant") ? supabase.from("invoices").select("total,status,issued_date").gte("issued_date", subDays(new Date(), 180).toISOString().slice(0, 10)) : Promise.resolve({ data: [] as never }),
        hasRole("admin", "accountant") ? supabase.from("expenses").select("amount,expense_date").gte("expense_date", subDays(new Date(), 180).toISOString().slice(0, 10)) : Promise.resolve({ data: [] as never }),
        supabase.from("complaints").select("id,ticket_no,status,priority,customer_name,issue_type,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("customer_feedback").select("rating"),
        supabase.from("customer_feedback").select("id,rating,comment,customer_name,created_at,complaints(ticket_no)").order("created_at", { ascending: false }).limit(6),
      ]);

      const c = complaints || [];
      setKpi({
        total: c.length,
        pending: c.filter((x) => x.status === "pending").length,
        inProgress: c.filter((x) => x.status === "in_progress" || x.status === "assigned").length,
        completed: c.filter((x) => x.status === "completed").length,
        ivrs: c.filter((x) => x.source === "ivrs").length,
      });

      // Avg resolution (hours)
      const completedWithTime = c.filter((x) => x.completed_at && x.created_at);
      if (completedWithTime.length) {
        const totalHrs = completedWithTime.reduce((s, x) => s + (new Date(x.completed_at!).getTime() - new Date(x.created_at).getTime()) / 3600000, 0);
        setAvgResolution(totalHrs / completedWithTime.length);
      } else setAvgResolution(0);

      // Trend
      const days: { date: string; new: number; completed: number }[] = [];
      for (let i = period - 1; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, "MMM dd");
        const dayStr = format(d, "yyyy-MM-dd");
        days.push({
          date: key,
          new: c.filter((x) => x.created_at.slice(0, 10) === dayStr).length,
          completed: c.filter((x) => x.completed_at && x.completed_at.slice(0, 10) === dayStr).length,
        });
      }
      setTrend(days);

      setStatusData([
        { name: "Pending", value: c.filter((x) => x.status === "pending").length },
        { name: "Assigned", value: c.filter((x) => x.status === "assigned").length },
        { name: "In Progress", value: c.filter((x) => x.status === "in_progress").length },
        { name: "Completed", value: c.filter((x) => x.status === "completed").length },
      ]);

      setSourceData([
        { name: "IVRS", value: c.filter((x) => x.source === "ivrs").length },
        { name: "Manual", value: c.filter((x) => x.source === "manual").length },
        { name: "Web", value: c.filter((x) => x.source === "web").length },
      ]);

      setPriorityData([
        { name: "Urgent", value: c.filter((x) => x.priority === "urgent").length, color: "hsl(var(--destructive))" },
        { name: "High", value: c.filter((x) => x.priority === "high").length, color: "hsl(var(--warning))" },
        { name: "Normal", value: c.filter((x) => x.priority === "normal").length, color: "hsl(var(--info))" },
        { name: "Low", value: c.filter((x) => x.priority === "low").length, color: "hsl(var(--muted-foreground))" },
      ]);

      // Top issue types
      const issueMap: Record<string, number> = {};
      c.forEach((x) => {
        const k = x.issue_type || "Other";
        issueMap[k] = (issueMap[k] || 0) + 1;
      });
      setIssueTypes(Object.entries(issueMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6));

      setTopTechs((techs || []).map((t) => ({ name: t.name, points: t.total_points })));

      // Revenue vs expenses by month (last 6)
      const months: { month: string; revenue: number; expenses: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subDays(new Date(), i * 30);
        const key = format(d, "MMM");
        const ym = format(d, "yyyy-MM");
        months.push({
          month: key,
          revenue: ((invs as { total: number; status: string; issued_date: string }[]) || []).filter((x) => x.issued_date.slice(0, 7) === ym && x.status === "paid").reduce((s, x) => s + Number(x.total), 0),
          expenses: ((exps as { amount: number; expense_date: string }[]) || []).filter((x) => x.expense_date.slice(0, 7) === ym).reduce((s, x) => s + Number(x.amount), 0),
        });
      }
      setRevExp(months);

      const invList = (invs as { total: number; status: string }[]) || [];
      const expList = (exps as { amount: number }[]) || [];
      const fbList = (feedback as { rating: number }[]) || [];
      setInvStats({
        totalRevenue: invList.filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.total), 0),
        pendingInvoices: invList.filter((x) => x.status !== "paid").reduce((s, x) => s + Number(x.total), 0),
        totalExpenses: expList.reduce((s, x) => s + Number(x.amount), 0),
        avgRating: fbList.length ? fbList.reduce((s, x) => s + x.rating, 0) / fbList.length : 0,
        feedbackCount: fbList.length,
      });

      setLowStock((items || []).filter((i) => i.quantity <= i.low_stock_threshold).length);
      setActivity((recent || []) as ActivityItem[]);
      setReviews(((recentReviews as { id: string; rating: number; comment: string | null; customer_name: string | null; created_at: string; complaints: { ticket_no: string } | null }[]) || []).map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment, customer_name: r.customer_name, created_at: r.created_at, ticket_no: r.complaints?.ticket_no ?? null,
      })));

      const [{ count: tCount }, { count: fCount }] = await Promise.all([
        supabase.from("technicians").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("factories").select("*", { count: "exact", head: true }).eq("active", true),
      ]);
      setTechCount(tCount ?? 0);
      setFactoryCount(fCount ?? 0);
    })();
  }, [period, hasRole]);

  const STATUS_COLORS = ["hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--primary))", "hsl(var(--success))"];
  const SOURCE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent-foreground))", "hsl(var(--info))"];
  const completionRate = kpi.total > 0 ? Math.round((kpi.completed / kpi.total) * 100) : 0;
  const netProfit = invStats.totalRevenue - invStats.totalExpenses;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Operational overview of complaints, technicians and finances."
      />

      {/* Hero summary */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 gradient-hero p-5 sm:p-7 text-white shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
              <Sparkles className="h-3.5 w-3.5" /> Ribbons Operations Hub
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold">Welcome back 👋</h2>
            <p className="mt-1 text-sm opacity-90">Here's what's happening across your service operations today.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-5 sm:text-right">
            <div>
              <div className="text-xs uppercase opacity-80">Completion</div>
              <div className="text-2xl font-bold">{completionRate}%</div>
            </div>
            <div>
              <div className="text-xs uppercase opacity-80">Avg Resolve</div>
              <div className="text-2xl font-bold">{avgResolution > 0 ? `${avgResolution.toFixed(1)}h` : "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase opacity-80">Rating</div>
              <div className="flex items-center gap-1 text-2xl font-bold sm:justify-end">
                {invStats.avgRating ? invStats.avgRating.toFixed(1) : "—"}
                <Star className="h-4 w-4 fill-current" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Pending" value={kpi.pending} sub="Awaiting assignment" icon={AlertCircle} tone="warning" />
        <KpiCard label="In Progress" value={kpi.inProgress} sub="Active jobs" icon={Clock} tone="info" />
        <KpiCard label="Completed" value={kpi.completed} sub="All-time" icon={CheckCircle2} tone="success" />
        <KpiCard label="IVRS Calls" value={kpi.ivrs} sub="Auto-created" icon={Phone} tone="primary" />
        <KpiCard label="Technicians" value={techCount} sub="Active" icon={Users} tone="pink" />
      </div>

      {/* Finance & ops strip (admin/accountant) */}
      {hasRole("admin", "accountant") && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Revenue" value={`₹${invStats.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} tone="success" trend="up" />
          <MiniStat label="Pending Invoices" value={`₹${invStats.pendingInvoices.toLocaleString("en-IN")}`} icon={Receipt} tone="warning" />
          <MiniStat label="Expenses" value={`₹${invStats.totalExpenses.toLocaleString("en-IN")}`} icon={TrendingDown} tone="danger" />
          <MiniStat label="Net Profit" value={`₹${netProfit.toLocaleString("en-IN")}`} icon={netProfit >= 0 ? TrendingUp : TrendingDown} tone={netProfit >= 0 ? "success" : "danger"} />
        </div>
      )}

      {/* Performance band */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Completion rate
              </div>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">{completionRate}%</span>
            </div>
            <div className="mt-3 text-2xl font-bold">{kpi.completed}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {kpi.total}</span></div>
            <Progress value={completionRate} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> Avg resolution
              </div>
              <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">{period}d</span>
            </div>
            <div className="mt-3 text-2xl font-bold">{avgResolution > 0 ? `${avgResolution.toFixed(1)} hrs` : "No data"}</div>
            <p className="mt-2 text-xs text-muted-foreground">Time from complaint creation to completion</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Star className="h-3.5 w-3.5" /> Customer rating
              </div>
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">{invStats.feedbackCount} reviews</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1 text-2xl font-bold">
              {invStats.avgRating ? invStats.avgRating.toFixed(2) : "—"}
              <span className="text-sm font-normal text-muted-foreground">/ 5.0</span>
            </div>
            <div className="mt-2 flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={cn("h-4 w-4", s <= Math.round(invStats.avgRating) ? "fill-warning text-warning" : "text-muted")} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" /> Quick actions
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickAction to="/complaints" icon={Wrench} label="Complaints" tone="primary" />
        <QuickAction to="/technicians" icon={Users} label="Technicians" tone="pink" />
        <QuickAction to="/inventory" icon={Package} label="Inventory" tone="info" />
        <QuickAction to="/invoices" icon={FileText} label="Invoices" tone="success" />
        <QuickAction to="/factories" icon={Building2} label="Factories" tone="warning" />
        <QuickAction to="/feedback" icon={Star} label="Feedback" tone="primary" />
      </div>

      <div className="mt-8 mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-3.5 w-3.5" /> Analytics
        </h2>
        <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as 14 | 30 | 90)}>
          <SelectTrigger className="h-9 w-[160px] rounded-lg bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Complaints — last {period} days</CardTitle>
          </CardHeader>
          <CardContent className="h-52 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="new" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gNew)" name="New" />
                <Area type="monotone" dataKey="completed" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gDone)" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status breakdown</CardTitle></CardHeader>
          <CardContent className="h-52 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Priority + Issue types */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Priority distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {priorityData.map((p) => {
              const pct = kpi.total ? Math.round((p.value / kpi.total) * 100) : 0;
              return (
                <div key={p.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </span>
                    <span className="font-medium text-muted-foreground">{p.value} · {pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                </div>
              );
            })}
            {priorityData.every((p) => p.value === 0) && <p className="text-sm text-muted-foreground">No complaints in this period.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top issue types</CardTitle></CardHeader>
          <CardContent>
            {issueTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available.</p>
            ) : (
              <ul className="space-y-2">
                {issueTypes.map((it, idx) => {
                  const max = issueTypes[0].value;
                  const pct = Math.round((it.value / max) * 100);
                  return (
                    <li key={it.name} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md gradient-primary text-xs font-bold text-white">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{it.name}</span>
                          <span className="text-xs text-muted-foreground">{it.value}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {hasRole("admin", "accountant") && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><IndianRupee className="h-4 w-4" /> Revenue vs Expenses (6 months)</CardTitle>
            </CardHeader>
            <CardContent className="h-52 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revExp}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className={hasRole("admin", "accountant") ? "" : "lg:col-span-2"}>
          <CardHeader><CardTitle className="text-base">Source distribution</CardTitle></CardHeader>
          <CardContent className="h-52 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" outerRadius={80} paddingAngle={2}>
                  {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity + Top techs + low stock */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <Link to="/complaints">View all <ArrowUpRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusDot status={a.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-muted-foreground">{a.ticket_no}</span>
                          <PriorityBadge priority={a.priority} />
                        </div>
                        <p className="truncate text-sm">
                          <span className="font-medium">{a.customer_name || "Customer"}</span>
                          {a.issue_type && <span className="text-muted-foreground"> · {a.issue_type}</span>}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top technicians</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topTechs.length === 0 && <li className="text-sm text-muted-foreground">No data</li>}
              {topTechs.map((t, idx) => (
                <li key={t.name} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      idx === 0 ? "gradient-warning" : idx === 1 ? "gradient-info" : idx === 2 ? "gradient-pink" : "gradient-primary"
                    )}>{idx + 1}</span>
                    <span className="truncate text-sm font-medium">{t.name}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t.points} pts</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Customer reviews */}
      <div className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 fill-warning text-warning" /> Latest customer reviews
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <Link to="/feedback">View all <ArrowUpRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No customer reviews yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {reviews.map((r) => {
                  const initials = (r.customer_name || "A").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
                  const tone = r.rating >= 4 ? "gradient-success" : r.rating === 3 ? "gradient-warning" : "bg-destructive";
                  return (
                    <div key={r.id} className="group relative rounded-xl border border-border/60 bg-card/50 p-4 transition-all hover:border-primary/30 hover:shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", tone)}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{r.customer_name || "Anonymous"}</div>
                            <div className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map((s) => (
                            <Star key={s} className={cn("h-3.5 w-3.5", s <= r.rating ? "fill-warning text-warning" : "text-muted")} />
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-foreground/80">"{r.comment}"</p>}
                      {r.ticket_no && <div className="mt-2 font-mono text-[10px] text-muted-foreground">{r.ticket_no}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System health footer */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="card-hover">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-warning text-white shadow-soft">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Low stock items</div>
              <div className="text-2xl font-bold">{lowStock}</div>
              <Link to="/inventory" className="text-xs text-primary hover:underline">Review inventory →</Link>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info text-white shadow-soft">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active factories</div>
              <div className="text-2xl font-bold">{factoryCount}</div>
              <Link to="/factories" className="text-xs text-primary hover:underline">Manage factories →</Link>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-success text-white shadow-soft">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System status</div>
              <div className="text-2xl font-bold text-success">Healthy</div>
              <div className="text-xs text-muted-foreground">All services operational</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, tone }: { label: string; value: number; sub?: string; icon: React.ComponentType<{ className?: string }>; tone: "primary" | "warning" | "info" | "success" | "pink" }) {
  const gradientClass = {
    primary: "gradient-primary",
    warning: "gradient-warning",
    info: "gradient-info",
    success: "gradient-success",
    pink: "gradient-pink",
  }[tone];
  const ringClass = {
    primary: "ring-primary/20",
    warning: "ring-warning/20",
    info: "ring-info/20",
    success: "ring-success/20",
    pink: "ring-pink/20",
  }[tone];
  return (
    <Card className={cn("group relative overflow-hidden border-border/60 card-hover ring-1", ringClass)}>
      <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl", gradientClass)} />
      <CardContent className="relative p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={cn("flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-white shadow-soft transition-transform group-hover:scale-110 group-hover:rotate-3", gradientClass)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3 text-xl sm:text-3xl font-bold tracking-tight">{value}</div>
        {sub && <div className="mt-1 hidden sm:block text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon, tone, trend }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: "success" | "warning" | "danger" | "info"; trend?: "up" | "down" }) {
  const toneMap = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    danger: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  }[tone];
  return (
    <Card className="card-hover">
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneMap)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="truncate text-sm sm:text-lg font-bold">{value}</div>
        </div>
        {trend && <ArrowUpRight className={cn("h-4 w-4 shrink-0", trend === "up" ? "text-success" : "text-destructive rotate-90")} />}
      </CardContent>
    </Card>
  );
}

function QuickAction({ to, icon: Icon, label, tone }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; tone: "primary" | "warning" | "info" | "success" | "pink" }) {
  const gradientClass = {
    primary: "gradient-primary",
    warning: "gradient-warning",
    info: "gradient-info",
    success: "gradient-success",
    pink: "gradient-pink",
  }[tone];
  return (
    <Link to={to} className="group">
      <Card className="card-hover h-full">
        <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-soft transition-transform group-hover:scale-110 group-hover:-rotate-3", gradientClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs sm:text-sm font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning",
    assigned: "bg-info",
    in_progress: "bg-primary",
    completed: "bg-success",
    cancelled: "bg-muted-foreground",
  };
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background", map[status] || "bg-muted-foreground")} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: "bg-destructive/10 text-destructive border-destructive/20",
    high: "bg-warning/10 text-warning border-warning/20",
    normal: "bg-info/10 text-info border-info/20",
    low: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={cn("h-4 px-1.5 text-[10px] font-medium", map[priority] || map.normal)}>{priority}</Badge>;
}
