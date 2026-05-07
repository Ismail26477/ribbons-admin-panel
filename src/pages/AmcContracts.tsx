import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, RefreshCw, Calendar, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type Frequency = "monthly" | "quarterly" | "half_yearly" | "yearly";
interface Amc {
  id: string; customer_name: string; customer_phone: string; customer_address: string | null;
  service_type: string | null; frequency: Frequency; start_date: string; end_date: string | null;
  next_service_date: string; amount: number; notes: string | null; active: boolean;
}

const FREQ_LABEL: Record<Frequency, string> = { monthly: "Monthly", quarterly: "Quarterly", half_yearly: "Half-yearly", yearly: "Yearly" };

const blank = {
  customer_name: "", customer_phone: "", customer_address: "", service_type: "",
  frequency: "monthly" as Frequency,
  start_date: format(new Date(), "yyyy-MM-dd"),
  end_date: "",
  next_service_date: format(new Date(), "yyyy-MM-dd"),
  amount: 0, notes: "", active: true,
};

export default function AmcContracts() {
  const [rows, setRows] = useState<Amc[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Amc | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("amc_contracts" as never).select("*").order("next_service_date");
    setRows((data || []) as unknown as Amc[]);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = rows.filter((r) => r.active && new Date(r.next_service_date) <= today).length;
    const total = rows.filter((r) => r.active).length;
    const revenue = rows.filter((r) => r.active).reduce((s, r) => s + Number(r.amount), 0);
    return { total, due, revenue };
  }, [rows]);

  const remove = async (id: string) => {
    if (!confirm("Delete this contract?")) return;
    const { error } = await supabase.from("amc_contracts" as never).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const runNow = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("process_amc_due" as never);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Due AMCs processed"); load(); }
  };

  return (
    <div>
      <PageHeader
        title="AMC Contracts"
        description="Annual maintenance contracts with auto-generated recurring complaints."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={runNow} disabled={busy}>
              <RefreshCw className={busy ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Run due now
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> New AMC</Button></DialogTrigger>
              <AmcDialog onDone={() => { setOpen(false); load(); }} />
            </Dialog>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active contracts</div><div className="mt-1 text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Due / overdue</div><div className="mt-1 text-2xl font-bold text-warning">{stats.due}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Recurring revenue</div><div className="mt-1 text-2xl font-bold">₹{stats.revenue.toLocaleString("en-IN")}</div></CardContent></Card>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {rows.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No contracts yet.</CardContent></Card>}
        {rows.map((r) => (
          <Card key={r.id}><CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{r.customer_name}</div>
              <Badge variant={r.active ? "default" : "outline"}>{r.active ? "Active" : "Paused"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">{r.customer_phone} · {r.service_type || "Service"}</div>
            <div className="flex items-center justify-between text-xs">
              <span><Calendar className="mr-1 inline h-3 w-3" />Next: {format(parseISO(r.next_service_date), "dd MMM yyyy")}</span>
              <span className="font-semibold">₹{Number(r.amount).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader><TableRow>
              <TableHead>Customer</TableHead><TableHead>Service</TableHead>
              <TableHead>Frequency</TableHead><TableHead>Next due</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No contracts yet.</TableCell></TableRow>}
              {rows.map((r) => {
                const overdue = new Date(r.next_service_date) <= new Date() && r.active;
                return (
                  <TableRow key={r.id}>
                    <TableCell><div className="font-medium">{r.customer_name}</div><div className="text-xs text-muted-foreground">{r.customer_phone}</div></TableCell>
                    <TableCell>{r.service_type || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{FREQ_LABEL[r.frequency]}</Badge></TableCell>
                    <TableCell className={overdue ? "text-warning font-semibold" : ""}>{format(parseISO(r.next_service_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right">₹{Number(r.amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell><Badge variant={r.active ? "default" : "outline"}>{r.active ? "Active" : "Paused"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {edit && <AmcDialog amc={edit} onDone={() => { setEdit(null); load(); }} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AmcDialog({ amc, onDone, onClose }: { amc?: Amc; onDone: () => void; onClose?: () => void }) {
  const [form, setForm] = useState(amc ? {
    customer_name: amc.customer_name, customer_phone: amc.customer_phone,
    customer_address: amc.customer_address || "", service_type: amc.service_type || "",
    frequency: amc.frequency, start_date: amc.start_date, end_date: amc.end_date || "",
    next_service_date: amc.next_service_date, amount: Number(amc.amount), notes: amc.notes || "",
    active: amc.active,
  } : blank);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name || !form.customer_phone) return toast.error("Name and phone required");
    setBusy(true);
    const payload = { ...form, end_date: form.end_date || null };
    const q = amc
      ? supabase.from("amc_contracts" as never).update(payload as never).eq("id", amc.id)
      : supabase.from("amc_contracts" as never).insert(payload as never);
    const { error } = await q;
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(amc ? "Updated" : "Created"); onDone(); }
  };

  const Wrapper = amc ? Dialog : (({ children }: { children: React.ReactNode }) => <>{children}</>);
  const wrapperProps = amc ? { open: true, onOpenChange: onClose } : {};

  return (
    <Wrapper {...wrapperProps}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{amc ? "Edit AMC" : "New AMC contract"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Customer name *</Label><Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>Phone *</Label><Input required value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Service type</Label><Input placeholder="e.g. AC servicing" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} /></div>
            <div>
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as Frequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Next service</Label><Input type="date" value={form.next_service_date} onChange={(e) => setForm({ ...form, next_service_date: e.target.value })} /></div>
            <div><Label>End (optional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="number" className="pl-8" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.active ? "1" : "0"} onValueChange={(v) => setForm({ ...form, active: v === "1" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">Active</SelectItem><SelectItem value="0">Paused</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            {amc && <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>}
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Wrapper>
  );
}
