import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Factory as FactoryIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Factory {
  id: string; name: string; location: string | null; manager_name: string | null; active: boolean;
}
interface Log {
  id: string; factory_id: string; log_date: string; units_produced: number; notes: string | null;
}

export default function Factories() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [openF, setOpenF] = useState(false);
  const [openL, setOpenL] = useState(false);

  const load = async () => {
    const [{ data: f }, { data: l }] = await Promise.all([
      supabase.from("factories").select("*").order("name"),
      supabase.from("production_logs").select("*").order("log_date", { ascending: false }).limit(100),
    ]);
    setFactories((f || []) as Factory[]); setLogs((l || []) as Log[]);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader
        title="Factories"
        description="Manage multiple factories and production logs."
        actions={
          <>
            <Dialog open={openL} onOpenChange={setOpenL}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" /> Log production</Button></DialogTrigger>
              <LogDialog factories={factories} onDone={() => { setOpenL(false); load(); }} />
            </Dialog>
            <Dialog open={openF} onOpenChange={setOpenF}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add factory</Button></DialogTrigger>
              <FactoryDialog onDone={() => { setOpenF(false); load(); }} />
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {factories.map((f) => {
          const fLogs = logs.filter((l) => l.factory_id === f.id);
          const total = fLogs.reduce((s, l) => s + l.units_produced, 0);
          return (
            <Card key={f.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><FactoryIcon className="h-4 w-4 text-primary" /> {f.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{f.location || "No location"}</p>
                </div>
                <Switch checked={f.active} onCheckedChange={async (v) => { await supabase.from("factories").update({ active: v }).eq("id", f.id); load(); }} />
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">Manager: {f.manager_name || "—"}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold">{total}</div>
                  <div className="text-xs text-muted-foreground">units (recent)</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Recent production</h2>
      <Card>
        <div className="overflow-x-auto no-scrollbar w-full">
        <Table className="min-w-[520px]">
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Factory</TableHead><TableHead>Units</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">No production logs yet.</TableCell></TableRow>}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{format(new Date(l.log_date), "dd MMM yyyy")}</TableCell>
                <TableCell>{factories.find((f) => f.id === l.factory_id)?.name || "—"}</TableCell>
                <TableCell className="font-medium">{l.units_produced}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.notes || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}

function FactoryDialog({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: "", location: "", manager_name: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("factories").insert(form);
    if (error) toast.error(error.message); else { toast.success("Factory added"); onDone(); }
  };
  return <DialogContent><DialogHeader><DialogTitle>New factory</DialogTitle></DialogHeader>
    <form onSubmit={submit} className="grid gap-3">
      <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
      <div><Label>Manager</Label><Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></div>
      <Button type="submit">Create</Button>
    </form>
  </DialogContent>;
}

function LogDialog({ factories, onDone }: { factories: Factory[]; onDone: () => void }) {
  const [form, setForm] = useState({ factory_id: "", units_produced: 0, notes: "", log_date: format(new Date(), "yyyy-MM-dd") });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.factory_id) return toast.error("Select a factory");
    const { error } = await supabase.from("production_logs").insert(form);
    if (error) toast.error(error.message); else { toast.success("Logged"); onDone(); }
  };
  return <DialogContent><DialogHeader><DialogTitle>Log production</DialogTitle></DialogHeader>
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <Label>Factory</Label>
        <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={form.factory_id} onChange={(e) => setForm({ ...form, factory_id: e.target.value })}>
          <option value="">Select…</option>
          {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label>Date</Label><Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></div>
        <div><Label>Units produced</Label><Input type="number" value={form.units_produced} onChange={(e) => setForm({ ...form, units_produced: Number(e.target.value) })} /></div>
      </div>
      <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      <Button type="submit">Save</Button>
    </form>
  </DialogContent>;
}
