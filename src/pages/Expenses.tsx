import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";
import { format } from "date-fns";

interface Expense {
  id: string; category: string; amount: number; expense_date: string;
  vendor: string | null; description: string | null; bill_url: string | null;
}

const CATEGORIES = ["salary", "inventory", "travel", "utilities", "rent", "misc"] as const;

export default function Expenses() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [catFilter, setCatFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    setRows((data || []) as Expense[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (catFilter !== "all" && r.category !== catFilter) return false;
    if (monthFilter !== "all" && r.expense_date.slice(0, 7) !== monthFilter) return false;
    return true;
  }), [rows, catFilter, monthFilter]);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.expense_date.slice(0, 7)))).sort().reverse(), [rows]);
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  const viewBill = async (path: string) => {
    const { data } = await supabase.storage.from("bills").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Categorized expense tracking with bill upload."
        actions={
          <>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => downloadCSV("expenses.csv", filtered as never)}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New expense</Button></DialogTrigger>
              <ExpDialog onDone={() => { setOpen(false); load(); }} />
            </Dialog>
          </>
        }
      />

      <Card className="mb-4"><CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All months" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All months</SelectItem>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <div className="sm:ml-auto rounded-md bg-primary/10 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Total: </span>
          <span className="font-semibold text-primary">₹{total.toLocaleString("en-IN")}</span>
        </div>
      </CardContent></Card>

      <Card>
        <div className="overflow-x-auto no-scrollbar w-full">
        <Table className="min-w-[560px]">
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Vendor</TableHead><TableHead>Amount</TableHead><TableHead>Description</TableHead><TableHead>Bill</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No expenses recorded.</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{format(new Date(r.expense_date), "dd MMM yyyy")}</TableCell>
                <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                <TableCell>{r.vendor || "—"}</TableCell>
                <TableCell className="font-medium">₹{Number(r.amount).toLocaleString("en-IN")}</TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{r.description || "—"}</TableCell>
                <TableCell>{r.bill_url ? <Button size="sm" variant="ghost" onClick={() => viewBill(r.bill_url!)}><FileText className="mr-1 h-3 w-3" /> View</Button> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}

function ExpDialog({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ category: "misc", amount: 0, expense_date: format(new Date(), "yyyy-MM-dd"), vendor: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    let bill_url: string | null = null;
    if (file) {
      const path = `${Date.now()}-${file.name}`;
      const { error: uErr } = await supabase.storage.from("bills").upload(path, file);
      if (uErr) { toast.error(uErr.message); setBusy(false); return; }
      bill_url = path;
    }
    const { error } = await supabase.from("expenses").insert({ ...form, category: form.category as never, bill_url });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); onDone(); }
  };
  return <DialogContent><DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Amount (₹) *</Label><Input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
        <div><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
      </div>
      <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Bill (image / PDF)</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </form>
  </DialogContent>;
}
