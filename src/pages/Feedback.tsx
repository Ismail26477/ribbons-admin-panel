import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Download, MessageSquare, TrendingUp, ThumbsUp, ThumbsDown, Quote, Smile, Meh, Frown, Sparkles, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadCSV } from "@/lib/csv";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Feedback {
  id: string;
  complaint_id: string;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  created_at: string;
  complaints?: { ticket_no: string; customer_phone: string; issue_type: string | null; technician_id: string | null } | null;
}

interface Tech { id: string; name: string }

export default function Feedback() {
  const [rows, setRows] = useState<Feedback[]>([]);
  const [techs, setTechs] = useState<Record<string, string>>({});
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data }, { data: t }] = await Promise.all([
        supabase
          .from("customer_feedback")
          .select("*, complaints(ticket_no, customer_phone, issue_type, technician_id)")
          .order("created_at", { ascending: false }),
        supabase.from("technicians").select("id,name"),
      ]);
      setRows((data || []) as never);
      const tMap: Record<string, string> = {};
      (t as Tech[] || []).forEach((x) => { tMap[x.id] = x.name; });
      setTechs(tMap);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (ratingFilter !== "all") {
      if (ratingFilter === "positive" && r.rating < 4) return false;
      if (ratingFilter === "neutral" && r.rating !== 3) return false;
      if (ratingFilter === "negative" && r.rating > 2) return false;
      if (["1","2","3","4","5"].includes(ratingFilter) && r.rating !== Number(ratingFilter)) return false;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      const hay = `${r.customer_name || ""} ${r.comment || ""} ${r.complaints?.ticket_no || ""} ${r.complaints?.issue_type || ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [rows, ratingFilter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const avg = total ? rows.reduce((s, r) => s + r.rating, 0) / total : 0;
    const positive = rows.filter((r) => r.rating >= 4).length;
    const negative = rows.filter((r) => r.rating <= 2).length;
    const neutral = rows.filter((r) => r.rating === 3).length;
    const dist = [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: rows.filter((r) => r.rating === s).length }));
    const last30 = rows.filter((r) => new Date(r.created_at) >= subDays(new Date(), 30));
    const prev30 = rows.filter((r) => {
      const d = new Date(r.created_at);
      return d >= subDays(new Date(), 60) && d < subDays(new Date(), 30);
    });
    const trend = prev30.length ? ((last30.length - prev30.length) / prev30.length) * 100 : 0;
    const nps = total ? Math.round(((positive - negative) / total) * 100) : 0;
    const withComments = rows.filter((r) => r.comment && r.comment.trim().length > 0).length;
    return { total, avg, positive, negative, neutral, dist, trend, nps, withComments };
  }, [rows]);

  const featured = useMemo(() => filtered.filter((r) => r.comment && r.comment.trim().length > 10).slice(0, 6), [filtered]);
  const recent = useMemo(() => filtered.slice(0, 12), [filtered]);

  return (
    <div>
      <PageHeader
        title="Customer Reviews & Feedback"
        description="What your customers are saying — ratings, comments, and sentiment insights."
        actions={
          <Button variant="outline" size="sm" onClick={() => downloadCSV("feedback.csv", filtered as never)}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        }
      />

      {/* Hero rating summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 overflow-hidden border-border/60">
          <div className="gradient-hero p-6 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
              <Sparkles className="h-3.5 w-3.5" /> Overall rating
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-5xl font-bold">{stats.avg.toFixed(1)}</span>
              <span className="mb-1 text-sm opacity-80">/ 5.0</span>
            </div>
            <div className="mt-2 flex items-center gap-0.5">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className={cn("h-5 w-5", s <= Math.round(stats.avg) ? "fill-white text-white" : "text-white/30")} />
              ))}
            </div>
            <p className="mt-2 text-sm opacity-90">Based on {stats.total} customer review{stats.total !== 1 ? "s" : ""}</p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Rating distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {stats.dist.map((d) => {
              const pct = stats.total ? (d.count / stats.total) * 100 : 0;
              return (
                <button
                  key={d.stars}
                  onClick={() => setRatingFilter(String(d.stars))}
                  className="group flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex w-14 shrink-0 items-center gap-0.5 text-sm font-medium">
                    {d.stars} <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        d.stars >= 4 ? "bg-success" : d.stars === 3 ? "bg-warning" : "bg-destructive"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-sm">
                    <span className="font-semibold">{d.count}</span>
                    <span className="ml-1 text-xs text-muted-foreground">({pct.toFixed(0)}%)</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Insight strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InsightCard icon={ThumbsUp} label="Promoters" value={stats.positive} sub="4–5 stars" tone="success" />
        <InsightCard icon={Meh} label="Passives" value={stats.neutral} sub="3 stars" tone="warning" />
        <InsightCard icon={ThumbsDown} label="Detractors" value={stats.negative} sub="1–2 stars" tone="danger" />
        <InsightCard icon={TrendingUp} label="NPS Score" value={stats.nps} sub={`${stats.trend >= 0 ? "+" : ""}${stats.trend.toFixed(0)}% vs prev 30d`} tone={stats.nps >= 50 ? "success" : stats.nps >= 0 ? "warning" : "danger"} />
      </div>

      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="reviews">Customer Reviews</TabsTrigger>
          <TabsTrigger value="all">All Feedback</TabsTrigger>
        </TabsList>

        {/* Reviews showcase */}
        <TabsContent value="reviews" className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reviews, customer name, ticket…" className="pl-9" />
              </div>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ratings</SelectItem>
                  <SelectItem value="positive">😊 Positive (4–5★)</SelectItem>
                  <SelectItem value="neutral">😐 Neutral (3★)</SelectItem>
                  <SelectItem value="negative">😞 Negative (1–2★)</SelectItem>
                  <SelectItem value="5">5 stars</SelectItem>
                  <SelectItem value="4">4 stars</SelectItem>
                  <SelectItem value="3">3 stars</SelectItem>
                  <SelectItem value="2">2 stars</SelectItem>
                  <SelectItem value="1">1 star</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Featured reviews with comments */}
          {featured.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Quote className="h-3.5 w-3.5" /> Featured reviews
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {featured.map((r) => (
                  <ReviewCard key={r.id} feedback={r} techName={r.complaints?.technician_id ? techs[r.complaints.technician_id] : null} />
                ))}
              </div>
            </div>
          )}

          {/* All recent */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> Latest reviews ({filtered.length})
            </h3>
            {recent.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No reviews match your filter.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recent.map((r) => (
                  <ReviewCard key={r.id} feedback={r} techName={r.complaints?.technician_id ? techs[r.complaints.technician_id] : null} compact />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Table view */}
        <TabsContent value="all">
          <Card>
            <div className="overflow-x-auto no-scrollbar w-full">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Ticket</TableHead><TableHead>Customer</TableHead>
                    <TableHead>Issue</TableHead><TableHead>Rating</TableHead><TableHead>Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No feedback collected yet.</TableCell></TableRow>}
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd MMM, HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{r.complaints?.ticket_no || "—"}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customer_name || "Anonymous"}</div>
                        {r.complaints?.customer_phone && <div className="text-xs text-muted-foreground">{r.complaints.customer_phone}</div>}
                      </TableCell>
                      <TableCell>{r.complaints?.issue_type ? <Badge variant="outline">{r.complaints.issue_type}</Badge> : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted"}`} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {r.comment ? (
                          <div className="flex items-start gap-1 text-sm">
                            <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            <span>{r.comment}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub: string; tone: "success" | "warning" | "danger" }) {
  const toneMap = {
    success: "text-success bg-success/10 ring-success/20",
    warning: "text-warning bg-warning/10 ring-warning/20",
    danger: "text-destructive bg-destructive/10 ring-destructive/20",
  }[tone];
  return (
    <Card className="card-hover">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", toneMap)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-lg sm:text-2xl font-bold leading-tight">{value}</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function ReviewCard({ feedback, techName, compact }: { feedback: Feedback; techName?: string | null; compact?: boolean }) {
  const initials = (feedback.customer_name || "A").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const sentiment = feedback.rating >= 4 ? "positive" : feedback.rating === 3 ? "neutral" : "negative";
  const SentimentIcon = sentiment === "positive" ? Smile : sentiment === "neutral" ? Meh : Frown;
  const sentimentClass = sentiment === "positive" ? "text-success bg-success/10" : sentiment === "neutral" ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10";
  const avatarTone = sentiment === "positive" ? "gradient-success" : sentiment === "neutral" ? "gradient-warning" : "bg-destructive";

  return (
    <Card className={cn("card-hover relative overflow-hidden", !compact && "h-full")}>
      {!compact && <Quote className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 text-muted/20" />}
      <CardContent className={cn("relative", compact ? "p-4" : "p-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={cn("text-xs font-bold text-white", avatarTone)}>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{feedback.customer_name || "Anonymous"}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}</span>
                {feedback.complaints?.ticket_no && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{feedback.complaints.ticket_no}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", sentimentClass)}>
            <SentimentIcon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={cn("h-4 w-4", s <= feedback.rating ? "fill-warning text-warning" : "text-muted")} />
          ))}
        </div>

        {feedback.comment && (
          <p className={cn("mt-3 text-sm leading-relaxed text-foreground/90", compact && "line-clamp-3")}>
            "{feedback.comment}"
          </p>
        )}

        {(feedback.complaints?.issue_type || techName) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
            {feedback.complaints?.issue_type && (
              <Badge variant="outline" className="text-[10px]">{feedback.complaints.issue_type}</Badge>
            )}
            {techName && (
              <Badge variant="secondary" className="text-[10px]">👨‍🔧 {techName}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
