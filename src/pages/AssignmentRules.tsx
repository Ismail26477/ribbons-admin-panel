import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ListChecks, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Rule {
  id: string;
  issue_type: string | null;
  priority: string | null;
  technician_id: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface TechMini { id: string; name: string }

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export default function AssignmentRules() {
  const [rows, setRows] = useState<Rule[]>([]);
  const [techs, setTechs] = useState<TechMini[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Rule | null>(null);

  const load = async () => {
    const [{ data: rules }, { data: t }] = await Promise.all([
      supabase.from("assignment_rules").select("*").order("sort_order").order("created_at"),
      supabase.from("technicians").select("id,name").eq("active", true).order("name"),
    ]);
    setRows((rules || []) as Rule[]);
    setTechs((t || []) as TechMini[]);
  };
  useEffect(() => { load(); }, []);

  const techName = (id: string) => techs.find((t) => t.id === id)?.name ?? "—";

  const toggleActive = async (r: Rule) => {
    await supabase.from("assignment_rules").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await supabase.from("assignment_rules").delete().eq("id", id);
    toast.success("Rule deleted");
    load();
  };

  return (
    <div>
      <PageHeader
        title="Assignment Rules"
        description="Auto-assign incoming complaints to technicians based on issue type and priority. The most specific match wins."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add rule</Button>
            </DialogTrigger>
            <RuleDialog rule={edit} techs={techs} onDone={() => { setOpen(false); setEdit(null); load(); }} />
          </Dialog>
        }
      />

      <Card className="mb-4 border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Matching priority:</span> Issue + Priority &gt; Issue only &gt; Priority only &gt; Catch-all (no filters). Lower sort order wins ties.
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto no-scrollbar w-full">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Issue type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assign to</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No rules yet. Add one to start auto-assigning incoming complaints.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">{r.sort_order}</TableCell>
                <TableCell>{r.issue_type ? <Badge variant="outline">{r.issue_type}</Badge> : <span className="text-muted-foreground">any</span>}</TableCell>
                <TableCell>{r.priority ? <Badge variant="secondary" className="capitalize">{r.priority}</Badge> : <span className="text-muted-foreground">any</span>}</TableCell>
                <TableCell className="font-medium">{techName(r.technician_id)}</TableCell>
                <TableCell>
                  <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit(r); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}

function RuleDialog({ rule, techs, onDone }: { rule: Rule | null; techs: TechMini[]; onDone: () => void }) {
  const [issueType, setIssueType] = useState(rule?.issue_type ?? "");
  const [priority, setPriority] = useState<string>(rule?.priority ?? "any");
  const [technicianId, setTechnicianId] = useState(rule?.technician_id ?? "");
  const [sortOrder, setSortOrder] = useState<number>(rule?.sort_order ?? 0);
  const [active, setActive] = useState(rule?.active ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIssueType(rule?.issue_type ?? "");
    setPriority(rule?.priority ?? "any");
    setTechnicianId(rule?.technician_id ?? "");
    setSortOrder(rule?.sort_order ?? 0);
    setActive(rule?.active ?? true);
  }, [rule]);

  const submit = async () => {
    if (!technicianId) { toast.error("Pick a technician"); return; }
    setSaving(true);
    const payload = {
      issue_type: issueType.trim() || null,
      priority: priority === "any" ? null : (priority as "urgent" | "high" | "normal" | "low"),
      technician_id: technicianId,
      sort_order: sortOrder,
      active,
    };
    const { error } = rule
      ? await supabase.from("assignment_rules").update(payload).eq("id", rule.id)
      : await supabase.from("assignment_rules").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(rule ? "Rule updated" : "Rule created");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{rule ? "Edit rule" : "New assignment rule"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>Issue type (leave blank for any)</Label>
          <Input value={issueType} onChange={(e) => setIssueType(e.target.value)} placeholder="e.g. printer, networking" />
        </div>
        <div className="grid gap-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any priority</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Assign to technician</Label>
          <Select value={technicianId} onValueChange={setTechnicianId}>
            <SelectTrigger><SelectValue placeholder="Pick a technician" /></SelectTrigger>
            <SelectContent>
              {techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Sort order</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2">
            <Switch id="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">Active</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save rule"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
