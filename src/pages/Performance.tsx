import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Clock, Trophy, TrendingUp, Route as RouteIcon, CheckCircle2 } from "lucide-react";
import { differenceInMinutes, subDays } from "date-fns";

interface Tech { id: string; name: string; avatar_url: string | null; total_points: number; active: boolean; }
interface Comp { id: string; technician_id: string | null; status: string; rating: number | null; created_at: string; completed_at: string | null; }
interface Loc { technician_id: string; lat: number; lng: number; created_at: string; }

const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat/2) ** 2 + Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

export default function Performance() {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [comps, setComps] = useState<Comp[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      const since = subDays(new Date(), days).toISOString();
      const [t, c, l] = await Promise.all([
        supabase.from("technicians").select("id,name,avatar_url,total_points,active").eq("active", true),
        supabase.from("complaints").select("id,technician_id,status,rating,created_at,completed_at").gte("created_at", since),
        supabase.from("technician_locations" as never).select("technician_id,lat,lng,created_at").gte("created_at", since).order("created_at", { ascending: true }),
      ]);
      setTechs((t.data || []) as Tech[]);
      setComps((c.data || []) as Comp[]);
      setLocs((l.data || []) as unknown as Loc[]);
    })();
  }, [days]);

  const scorecards = useMemo(() => {
    return techs.map((t) => {
      const my = comps.filter((c) => c.technician_id === t.id);
      const completed = my.filter((c) => c.status === "completed");
      const avgMins = completed
        .filter((c) => c.completed_at)
        .map((c) => differenceInMinutes(new Date(c.completed_at!), new Date(c.created_at)));
      const avgResMins = avgMins.length ? Math.round(avgMins.reduce((a, b) => a + b, 0) / avgMins.length) : 0;
      const ratings = completed.map((c) => c.rating).filter((r): r is number => !!r);
      const csat = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
      const myLocs = locs.filter((l) => l.technician_id === t.id);
      let dist = 0;
      for (let i = 1; i < myLocs.length; i++) {
        dist += haversine([myLocs[i-1].lat, myLocs[i-1].lng], [myLocs[i].lat, myLocs[i].lng]);
      }
      const jobsPerDay = completed.length / Math.max(days, 1);
      return {
        ...t, jobs: completed.length, avgResMins, csat, dist: Math.round(dist), jobsPerDay,
      };
    }).sort((a, b) => b.jobs - a.jobs);
  }, [techs, comps, locs, days]);

  const fmtH = (m: number) => m < 60 ? `${m}m` : `${(m/60).toFixed(1)}h`;

  return (
    <div>
      <PageHeader
        title="Technician Performance"
        description="Jobs, CSAT, resolution time, distance and points per technician."
        actions={
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scorecards.length === 0 && <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="py-10 text-center text-sm text-muted-foreground">No data.</CardContent></Card>}
        {scorecards.map((s, idx) => (
          <Card key={s.id} className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={s.avatar_url || undefined} />
                  <AvatarFallback>{s.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate">{s.name}</div>
                    {idx < 3 && <Trophy className={
                      idx === 0 ? "h-4 w-4 text-warning" : idx === 1 ? "h-4 w-4 text-muted-foreground" : "h-4 w-4 text-amber-700"
                    } />}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.total_points} lifetime points</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Metric icon={CheckCircle2} label="Jobs done" value={String(s.jobs)} />
                <Metric icon={TrendingUp} label="Jobs / day" value={s.jobsPerDay.toFixed(2)} />
                <Metric icon={Clock} label="Avg resolution" value={s.avgResMins ? fmtH(s.avgResMins) : "—"} />
                <Metric icon={Star} label="CSAT" value={s.csat ? `${s.csat.toFixed(1)} / 5` : "—"} />
                <Metric icon={RouteIcon} label="Distance" value={`${s.dist} km`} />
                <Metric icon={Trophy} label="Points (period)" value={String(s.jobs * 10)} />
              </div>

              {s.csat > 0 && (
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((r) => (
                    <Star key={r} className={`h-3.5 w-3.5 ${r <= Math.round(s.csat) ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                  ))}
                  <Badge variant="outline" className="ml-auto text-[10px]">{s.csat.toFixed(1)}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
