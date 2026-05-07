import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, ListOrdered, Users, Sparkles, Settings as SettingsIcon, Copy, Plus, Trash2, UserPlus, FileText } from "lucide-react";
import { toast } from "sonner";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ivrs-intake`;

type AppSettings = {
  id: number;
  low_stock_threshold: number;
  pts_urgent: number; pts_high: number; pts_normal: number; pts_low: number;
  pts_per_star: number;
  pts_fast_arrival: number; pts_review: number; pts_selfie: number;
  pts_tools_return: number; pts_extra_work: number;
  point_value_inr: number;
};

export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" />
      <Tabs defaultValue="ivrs">
        <TabsList className="mb-6 flex w-full overflow-x-auto no-scrollbar flex-nowrap justify-start sm:w-auto sm:inline-flex">
          <TabsTrigger value="ivrs"><Phone className="mr-2 h-4 w-4" />IVRS</TabsTrigger>
          <TabsTrigger value="rules"><ListOrdered className="mr-2 h-4 w-4" />Assignment Rules</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users & Roles</TabsTrigger>
          <TabsTrigger value="points"><Sparkles className="mr-2 h-4 w-4" />Point System</TabsTrigger>
          <TabsTrigger value="general"><SettingsIcon className="mr-2 h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="mr-2 h-4 w-4" />Document Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="ivrs"><IvrsTab /></TabsContent>
        <TabsContent value="rules"><RulesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="points"><PointsTab /></TabsContent>
        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="docs"><DocsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ IVRS ============ */
function IvrsTab() {
  const copy = () => {
    navigator.clipboard.writeText(FN_URL);
    toast.success("Webhook URL copied");
  };
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Phone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">IVRS Complaint Intake</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure your IVRS provider (Twilio, Exotel, Knowlarity…) to POST call data to this endpoint.
              Each call becomes a complaint with source <code className="rounded bg-muted px-1.5 py-0.5 text-xs">ivrs</code>.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <Label>Webhook URL (POST)</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={FN_URL} className="font-mono text-xs sm:text-sm" />
            <Button variant="outline" size="icon" onClick={copy} className="self-end sm:self-auto"><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 text-sm font-medium">Accepted fields (JSON or form-data)</div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• <code className="text-foreground">customer_phone</code> (or Twilio <code>From</code> / Exotel <code>CallerNumber</code>)</li>
              <li>• <code className="text-foreground">customer_name</code>, <code className="text-foreground">customer_address</code></li>
              <li>• <code className="text-foreground">issue_type</code> or IVR <code>digits</code> (1=Install, 2=Repair, 3=Maint, 4=Service)</li>
              <li>• <code className="text-foreground">description</code>, <code className="text-foreground">priority</code> (low/normal/high/urgent)</li>
              <li>• <code className="text-foreground">call_sid</code> for traceability</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 text-sm font-medium">Security</div>
            <p className="text-xs text-muted-foreground">
              Optionally set an <code className="text-foreground">IVRS_API_KEY</code> backend secret. When set, providers must send it as the
              <code className="text-foreground"> X-IVRS-Key</code> header.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Assignment Rules ============ */
type Rule = { id: string; issue_type: string | null; priority: string | null; technician_id: string; sort_order: number; active: boolean };
type TechLite = { id: string; name: string };

function RulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [techs, setTechs] = useState<TechLite[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", issue_type: "", priority: "any", technician_id: "", sort_order: 100 });

  const load = async () => {
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from("assignment_rules").select("*").order("sort_order"),
      supabase.from("technicians").select("id,name").eq("active", true).order("name"),
    ]);
    setRules((r || []) as Rule[]);
    setTechs((t || []) as TechLite[]);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (r: Rule) => {
    await supabase.from("assignment_rules").update({ active: !r.active }).eq("id", r.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await supabase.from("assignment_rules").delete().eq("id", id);
    load();
  };
  const save = async () => {
    if (!form.technician_id) { toast.error("Pick a technician"); return; }
    const { error } = await supabase.from("assignment_rules").insert({
      issue_type: form.issue_type || null,
      priority: form.priority === "any" ? null : (form.priority as "low"|"normal"|"high"|"urgent"),
      technician_id: form.technician_id,
      sort_order: Number(form.sort_order) || 100,
      active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Rule added");
    setOpen(false);
    setForm({ name: "", issue_type: "", priority: "any", technician_id: "", sort_order: 100 });
    load();
  };

  const techName = (id: string) => techs.find((t) => t.id === id)?.name || "—";

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">IVRS Auto-assignment rules</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When a new IVRS complaint arrives, the most-specific active rule (matching issue type and priority) wins and assigns the technician automatically.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New assignment rule</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Issue type (blank = any)</Label>
                    <Input placeholder="e.g. Repair" value={form.issue_type} onChange={(e) => setForm({ ...form, issue_type: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign to technician</Label>
                  <Select value={form.technician_id} onValueChange={(v) => setForm({ ...form, technician_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick technician" /></SelectTrigger>
                    <SelectContent>
                      {techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority order (lower = wins first)</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                </div>
                <Button className="w-full" onClick={save}>Save rule</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Issue type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No rules yet. Add one to auto-assign IVRS complaints.</TableCell></TableRow>}
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.sort_order}</TableCell>
                <TableCell>{r.issue_type || <span className="text-muted-foreground">any</span>}</TableCell>
                <TableCell>{r.priority ? <Badge variant="outline">{r.priority}</Badge> : <span className="text-muted-foreground">any</span>}</TableCell>
                <TableCell>{techName(r.technician_id)}</TableCell>
                <TableCell><Switch checked={r.active} onCheckedChange={() => toggle(r)} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============ Users & Roles ============ */
type Profile = { user_id: string; email: string | null; display_name: string | null };
type RoleRow = { user_id: string; role: "admin" | "manager" | "accountant" | "technician" };
const ALL_ROLES: RoleRow["role"][] = ["admin", "manager", "accountant", "technician"];

function UsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ display_name: "", email: "", password: "", role: "manager" });

  const load = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("user_id,email,display_name").order("created_at"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setProfiles((p || []) as Profile[]);
    setRoles((r || []) as RoleRow[]);
  };
  useEffect(() => { load(); }, []);

  const userRoles = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);
  const removeRole = async (uid: string, role: RoleRow["role"]) => {
    if (!confirm(`Remove role "${role}"?`)) return;
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    load();
  };
  const addRole = async (uid: string, role: RoleRow["role"]) => {
    if (userRoles(uid).includes(role)) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) { toast.error(error.message); return; }
    load();
  };

  const createUser = async () => {
    if (!form.email || !form.password) { toast.error("Email & password required"); return; }
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: form.email, password: form.password, role: form.role, display_name: form.display_name },
    });
    if (error || (data as { error?: string })?.error) {
      toast.error(error?.message || (data as { error?: string }).error || "Failed");
      return;
    }
    toast.success("User created");
    setOpen(false);
    setForm({ display_name: "", email: "", password: "", role: "manager" });
    load();
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Users & roles</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create new staff accounts and assign their roles.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Create user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Full name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Temporary password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={createUser}>Create user</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto no-scrollbar w-full">
        <Table className="min-w-[480px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Add role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => {
              const ur = userRoles(p.user_id);
              const remaining = ALL_ROLES.filter((r) => !ur.includes(r));
              return (
                <TableRow key={p.user_id}>
                  <TableCell className="font-medium">{p.display_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {ur.length === 0 && <span className="text-xs text-muted-foreground">no role</span>}
                      {ur.map((r) => (
                        <Badge key={r} variant="secondary" className="gap-1 capitalize">
                          {r}
                          <button onClick={() => removeRole(p.user_id, r)} className="ml-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {remaining.length > 0 ? (
                      <Select value="" onValueChange={(v) => addRole(p.user_id, v as RoleRow["role"])}>
                        <SelectTrigger className="w-[160px]"><SelectValue placeholder="+ Add role" /></SelectTrigger>
                        <SelectContent>
                          {remaining.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <span className="text-xs text-muted-foreground">all assigned</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Point System ============ */
function PointsTab() {
  const [s, setS] = useState<AppSettings | null>(null);

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => setS(data as AppSettings | null));
  }, []);

  const upd = (k: keyof AppSettings, v: number) => setS((p) => p ? { ...p, [k]: v } : p);
  const save = async () => {
    if (!s) return;
    const { error } = await supabase.from("app_settings").update({
      pts_urgent: s.pts_urgent, pts_high: s.pts_high, pts_normal: s.pts_normal, pts_low: s.pts_low,
      pts_per_star: s.pts_per_star,
      pts_fast_arrival: s.pts_fast_arrival, pts_review: s.pts_review, pts_selfie: s.pts_selfie,
      pts_tools_return: s.pts_tools_return, pts_extra_work: s.pts_extra_work,
      point_value_inr: s.point_value_inr,
    }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Point system saved");
  };

  if (!s) return <Card><CardContent className="p-12 text-center text-muted-foreground">Loading…</CardContent></Card>;

  const priorityRows: { label: string; key: keyof AppSettings; tone: string }[] = [
    { label: "Urgent", key: "pts_urgent", tone: "bg-destructive text-destructive-foreground" },
    { label: "High", key: "pts_high", tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
    { label: "Normal", key: "pts_normal", tone: "bg-muted text-foreground" },
    { label: "Low", key: "pts_low", tone: "bg-muted text-muted-foreground" },
  ];
  const bonusRows: { label: string; key: keyof AppSettings }[] = [
    { label: "Fast arrival", key: "pts_fast_arrival" },
    { label: "Customer review", key: "pts_review" },
    { label: "On-site selfie", key: "pts_selfie" },
    { label: "Tools returned on time", key: "pts_tools_return" },
    { label: "Extra work done", key: "pts_extra_work" },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold">Point system</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Points are awarded automatically when a complaint is marked completed (priority-based) and when a customer rating is set
          (above 2★ → +{s.pts_per_star} pts per extra star). Bonus categories (fast arrival, review, selfie, tools-return, extra work) can be awarded
          from the Complaints page using the ✨ button.
        </p>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority points (auto on completion)</div>
            <div className="space-y-3">
              {priorityRows.map((r) => (
                <div key={r.key} className="flex items-center gap-3">
                  <Badge className={`w-20 justify-center ${r.tone}`}>{r.label}</Badge>
                  <Input type="number" className="w-28" value={s[r.key] as number} onChange={(e) => upd(r.key, Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">points</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bonus categories</div>
            <div className="space-y-3">
              {bonusRows.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{r.label}</span>
                  <div className="flex items-center gap-2">
                    <Input type="number" className="w-28" value={s[r.key] as number} onChange={(e) => upd(r.key, Number(e.target.value))} />
                    <span className="text-sm text-muted-foreground">points</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6">
          <Label className="font-semibold">Value per point (₹)</Label>
          <Input type="number" className="w-32" value={s.point_value_inr} onChange={(e) => upd("point_value_inr", Number(e.target.value))} />
          <span className="text-sm text-muted-foreground">used in payroll incentive calculation</span>
          <div className="ml-auto"><Button onClick={save}>Save changes</Button></div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ General ============ */
function GeneralTab() {
  const [s, setS] = useState<AppSettings | null>(null);
  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => setS(data as AppSettings | null));
  }, []);
  const save = async () => {
    if (!s) return;
    const { error } = await supabase.from("app_settings").update({ low_stock_threshold: s.low_stock_threshold }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
  };
  if (!s) return <Card><CardContent className="p-12 text-center text-muted-foreground">Loading…</CardContent></Card>;
  return (
    <Card className="max-w-xl">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold">General</h2>
        <div className="mt-6 space-y-2">
          <Label>Low-stock threshold</Label>
          <div className="flex items-center gap-3">
            <Input type="number" className="w-32" value={s.low_stock_threshold} onChange={(e) => setS({ ...s, low_stock_threshold: Number(e.target.value) })} />
            <p className="text-sm text-muted-foreground">items — triggers low-stock notification when quantity drops to this number</p>
          </div>
        </div>
        <div className="mt-6"><Button onClick={save}>Save</Button></div>
      </CardContent>
    </Card>
  );
}

/* ============ DOCS / COMPANY ============ */
type DocsSettings = {
  id: number;
  company_name: string | null; company_name_alt: string | null;
  ho_address: string | null; nashik_address: string | null;
  company_phone: string | null; company_email: string | null;
  website_ho: string | null; website_nashik: string | null;
  gstin: string | null; gstin_nashik: string | null;
  bank_name: string | null; account_no: string | null; ifsc_code: string | null; branch: string | null;
  terms_conditions: string | null; customer_care_phone: string | null;
  default_gst_rate: number | null; default_cgst_rate: number | null; default_sgst_rate: number | null;
};

function DocsTab() {
  const [s, setS] = useState<DocsSettings | null>(null);
  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => setS(data as never));
  }, []);
  const save = async () => {
    if (!s) return;
    const { error } = await supabase.from("app_settings").update(s as never).eq("id", 1);
    if (error) toast.error(error.message); else toast.success("Saved");
  };
  if (!s) return <Card><CardContent className="p-12 text-center text-muted-foreground">Loading…</CardContent></Card>;
  const f = (k: keyof DocsSettings, label: string, type: string = "text") => (
    <div><Label>{label}</Label><Input type={type} value={(s[k] as string | number) ?? ""} onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })} /></div>
  );
  return (
    <Card><CardContent className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Company Identity</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {f("company_name", "Company Name")}
          {f("company_name_alt", "Alternate Name")}
          {f("company_phone", "Phone")}
          {f("company_email", "Email")}
          {f("customer_care_phone", "Customer Care Phone")}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Branches</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>HO Address</Label><Textarea rows={2} value={s.ho_address ?? ""} onChange={(e) => setS({ ...s, ho_address: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Nashik Branch Address</Label><Textarea rows={2} value={s.nashik_address ?? ""} onChange={(e) => setS({ ...s, nashik_address: e.target.value })} /></div>
          {f("website_ho", "Website (HO)")}
          {f("website_nashik", "Website (Nashik)")}
          {f("gstin", "GSTIN (Malegaon)")}
          {f("gstin_nashik", "GSTIN (Nashik)")}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Bank Details</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {f("bank_name", "Bank Name")}
          {f("account_no", "Account No")}
          {f("ifsc_code", "IFSC")}
          {f("branch", "Branch")}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Tax Defaults</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {f("default_gst_rate", "Default GST %", "number")}
          {f("default_cgst_rate", "Default CGST %", "number")}
          {f("default_sgst_rate", "Default SGST %", "number")}
        </div>
      </div>
      <div>
        <Label>Terms & Conditions</Label>
        <Textarea rows={5} value={s.terms_conditions ?? ""} onChange={(e) => setS({ ...s, terms_conditions: e.target.value })} />
      </div>
      <Button onClick={save}>Save</Button>
    </CardContent></Card>
  );
}
