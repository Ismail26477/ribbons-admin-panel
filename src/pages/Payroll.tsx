import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Wallet, Users, TrendingUp } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface Tech {
  id: string;
  name: string;
  type: string;
  base_salary: number;
  total_points: number;
  active: boolean;
}

interface PE {
  technician_id: string;
  points: number;
  created_at: string;
}

export default function Payroll() {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [events, setEvents] = useState<PE[]>([]);
  const [pointValue, setPointValue] = useState(10);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    (async () => {
      const [t, s] = await Promise.all([
        supabase.from("technicians").select("id,name,type,base_salary,total_points,active").eq("active", true).order("name"),
        supabase.from("app_settings").select("point_value_inr").eq("id", 1).maybeSingle(),
      ]);
      setTechs((t.data || []) as Tech[]);
      if (s.data) setPointValue(Number(s.data.point_value_inr) || 10);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const start = startOfMonth(new Date(month + "-01")).toISOString();
      const end = endOfMonth(new Date(month + "-01")).toISOString();
      const { data } = await supabase
        .from("point_events")
        .select("technician_id,points,created_at")
        .gte("created_at", start)
        .lte("created_at", end);
      setEvents((data || []) as PE[]);
    })();
  }, [month]);

  const months = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(format(d, "yyyy-MM"));
    }
    return arr;
  }, []);

  const rows = useMemo(() => {
    return techs.map((t) => {
      const pts = events.filter((e) => e.technician_id === t.id).reduce((s, e) => s + e.points, 0);
      const incentive = pts * pointValue;
      const base = t.type === "full_time" ? Number(t.base_salary || 0) : 0;
      const total = base + incentive;
      return { ...t, period_points: pts, incentive, base, total };
    });
  }, [techs, events, pointValue]);

  const totalPayout = rows.reduce((s, r) => s + r.total, 0);
  const totalIncentive = rows.reduce((s, r) => s + r.incentive, 0);
  const totalPoints = rows.reduce((s, r) => s + r.period_points, 0);

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={`Auto-calculated from points × ₹${pointValue}/point + base salary.`}
        actions={
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => downloadCSV(`payroll-${month}.csv`, rows as never)}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-4">
          <div><div className="text-xs text-muted-foreground">Total payout</div><div className="text-lg sm:text-2xl font-bold">₹{totalPayout.toLocaleString("en-IN")}</div></div>
          <Wallet className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
        </CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4">
          <div><div className="text-xs text-muted-foreground">Incentives</div><div className="text-lg sm:text-2xl font-bold">₹{totalIncentive.toLocaleString("en-IN")}</div></div>
          <TrendingUp className="h-7 w-7 sm:h-8 sm:w-8 text-success" />
        </CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4">
          <div><div className="text-xs text-muted-foreground">Points earned</div><div className="text-lg sm:text-2xl font-bold">{totalPoints}</div></div>
          <Users className="h-7 w-7 sm:h-8 sm:w-8 text-warning" />
        </CardContent></Card>
      </div>

      <Card className="mb-4"><CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-sm text-muted-foreground">Month:</span>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{format(new Date(m + "-01"), "MMMM yyyy")}</SelectItem>)}</SelectContent>
        </Select>
      </CardContent></Card>

      <Card>
        <div className="overflow-x-auto no-scrollbar w-full">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>Technician</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Base salary</TableHead>
              <TableHead className="text-right">Incentive</TableHead>
              <TableHead className="text-right">Total payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No active technicians.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.type.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-right">{r.period_points}</TableCell>
                <TableCell className="text-right">₹{r.base.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right text-success">₹{r.incentive.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold">₹{r.total.toLocaleString("en-IN")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}
