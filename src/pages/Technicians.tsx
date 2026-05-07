import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Download, Search, Phone, Mail, MapPin, Calendar, Award, Briefcase, Camera,
  Star, Activity, Users, CheckCircle2, Heart, IdCard, Building2, Banknote, Edit3, X
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";

interface Tech {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: string;
  base_salary: number;
  total_points: number;
  active: boolean;
  notes: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  date_of_birth: string | null;
  joining_date: string | null;
  designation: string | null;
  skills: string[] | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  blood_group: string | null;
  gender: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  created_at?: string;
}

const initials = (name: string) =>
  name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export default function Technicians() {
  const [rows, setRows] = useState<Tech[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Tech | null>(null);
  const [detail, setDetail] = useState<Tech | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("technicians").select("*").order("total_points", { ascending: false });
    setRows((data || []) as Tech[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (t: Tech) => {
    await supabase.from("technicians").update({ active: !t.active }).eq("id", t.id);
    toast.success(`${t.name} ${!t.active ? "activated" : "deactivated"}`);
    load();
  };

  const filtered = useMemo(() => rows.filter((r) => {
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone || "").includes(search) ||
      (r.designation || "").toLowerCase().includes(search.toLowerCase());
    const matchType =
      filterType === "all" ||
      (filterType === "active" && r.active) ||
      (filterType === "inactive" && !r.active) ||
      filterType === r.type;
    return matchSearch && matchType;
  }), [rows, search, filterType]);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.active).length,
    fullTime: rows.filter((r) => r.type === "full_time").length,
    onCall: rows.filter((r) => r.type === "on_call").length,
    points: rows.reduce((s, r) => s + (r.total_points || 0), 0),
  }), [rows]);

  return (
    <div>
      <PageHeader
        title="Technicians"
        description="Premium team directory — manage profiles, performance & details."
        actions={
          <>
            <Button variant="outline" size="sm" className="w-full sm:w-auto"
              onClick={() => downloadCSV("technicians.csv", filtered as never)}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Add technician
                </Button>
              </DialogTrigger>
              <TechDialog onDone={() => { setOpen(false); load(); }} />
            </Dialog>
          </>
        }
      />

      {/* Stat ribbon */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard icon={Users} label="Total" value={stats.total} gradient="gradient-primary" />
        <StatCard icon={CheckCircle2} label="Active" value={stats.active} gradient="gradient-success" />
        <StatCard icon={Briefcase} label="Full-time" value={stats.fullTime} gradient="gradient-info" />
        <StatCard icon={Activity} label="On-call" value={stats.onCall} gradient="gradient-warning" />
        <StatCard icon={Award} label="Total Points" value={stats.points} gradient="gradient-pink" className="col-span-2 sm:col-span-1" />
      </div>

      {/* Filters */}
      <Card className="glass mb-5 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, phone, or designation…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9" />
          </div>
          <Tabs value={filterType} onValueChange={setFilterType} className="w-full sm:w-auto">
            <TabsList className="w-full overflow-x-auto no-scrollbar sm:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="full_time">Full-time</TabsTrigger>
              <TabsTrigger value="on_call">On-call</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {/* Premium card grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No technicians found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t, idx) => (
            <TechCard key={t.id} t={t} rank={idx + 1}
              onView={() => setDetail(t)}
              onEdit={() => setEdit(t)}
              onToggle={() => toggleActive(t)} />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {edit && (
        <Dialog open onOpenChange={() => setEdit(null)}>
          <TechDialog row={edit} onDone={() => { setEdit(null); load(); }} />
        </Dialog>
      )}

      {/* Detail slide-over */}
      <TechDetailSheet tech={detail} onClose={() => setDetail(null)}
        onEdit={() => { if (detail) { const t = detail; setDetail(null); setEdit(t); } }} />
    </div>
  );
}

/* ───────────────── Stat Card ───────────────── */
function StatCard({ icon: Icon, label, value, gradient, className = "" }:
  { icon: any; label: string; value: number; gradient: string; className?: string }) {
  return (
    <Card className={`card-hover overflow-hidden border-0 p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-soft ${gradient}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
        </div>
      </div>
    </Card>
  );
}

/* ───────────────── Tech Card ───────────────── */
function TechCard({ t, rank, onView, onEdit, onToggle }:
  { t: Tech; rank: number; onView: () => void; onEdit: () => void; onToggle: () => void }) {
  return (
    <Card className="card-hover group relative overflow-hidden border-0 shadow-sm">
      {/* Banner */}
      <div className="gradient-hero relative h-20">
        <div className="absolute inset-0 opacity-30" style={{ background: "var(--gradient-mesh)" }} />
        {rank <= 3 && (
          <Badge className="absolute right-3 top-3 gap-1 bg-white/20 text-white backdrop-blur">
            <Award className="h-3 w-3" /> #{rank}
          </Badge>
        )}
        <Badge variant={t.active ? "default" : "secondary"}
          className={`absolute left-3 top-3 ${t.active ? "bg-success text-success-foreground" : ""}`}>
          {t.active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="px-5 pb-5">
        {/* Avatar */}
        <div className="-mt-10 mb-3 flex items-end justify-between">
          <Avatar className="h-20 w-20 border-4 border-card shadow-md">
            {t.avatar_url && <AvatarImage src={t.avatar_url} alt={t.name} />}
            <AvatarFallback className="gradient-primary text-lg font-semibold text-primary-foreground">
              {initials(t.name)}
            </AvatarFallback>
          </Avatar>
          <Switch checked={t.active} onCheckedChange={onToggle} className="mb-1" />
        </div>

        {/* Name + role */}
        <div className="mb-3">
          <h3 className="truncate text-lg font-semibold">{t.name}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {t.designation || (t.type === "full_time" ? "Full-time Technician" : "On-call Technician")}
          </p>
        </div>

        {/* Quick info */}
        <div className="mb-3 space-y-1.5 text-sm">
          {t.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.phone}</span>
            </div>
          )}
          {t.city && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.city}{t.state ? `, ${t.state}` : ""}</span>
            </div>
          )}
        </div>

        {/* Skills */}
        {t.skills && t.skills.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {t.skills.slice(0, 3).map((s) => (
              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
            ))}
            {t.skills.length > 3 && (
              <Badge variant="outline" className="text-xs">+{t.skills.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-warning">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-base font-bold">{t.total_points}</span>
            </div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Points</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-foreground">
              ₹{Number(t.base_salary).toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Salary</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onView}>
            View
          </Button>
          <Button size="sm" className="flex-1" onClick={onEdit}>
            <Edit3 className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ───────────────── Detail Sheet ───────────────── */
function TechDetailSheet({ tech, onClose, onEdit }:
  { tech: Tech | null; onClose: () => void; onEdit: () => void }) {
  return (
    <Sheet open={!!tech} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {tech && (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">{tech.name}</SheetTitle>
            </SheetHeader>

            {/* Hero */}
            <div className="-mx-6 -mt-6 gradient-hero p-6 pb-12 text-white">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 border-4 border-white/30 shadow-lg">
                  {tech.avatar_url && <AvatarImage src={tech.avatar_url} alt={tech.name} />}
                  <AvatarFallback className="bg-white/20 text-xl font-semibold text-white backdrop-blur">
                    {initials(tech.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-2xl font-bold">{tech.name}</h2>
                  <p className="truncate text-white/80">{tech.designation || "Technician"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className="bg-white/20 text-white backdrop-blur">
                      {tech.type === "full_time" ? "Full-time" : "On-call"}
                    </Badge>
                    <Badge className={tech.active ? "bg-success" : "bg-white/20 text-white"}>
                      {tech.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="-mt-6 px-1">
              <Card className="grid grid-cols-3 divide-x p-0 shadow-md">
                <div className="p-4 text-center">
                  <Star className="mx-auto h-4 w-4 text-warning" />
                  <p className="mt-1 text-lg font-bold">{tech.total_points}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Points</p>
                </div>
                <div className="p-4 text-center">
                  <Banknote className="mx-auto h-4 w-4 text-success" />
                  <p className="mt-1 text-lg font-bold">₹{Number(tech.base_salary / 1000).toFixed(0)}k</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Salary</p>
                </div>
                <div className="p-4 text-center">
                  <Calendar className="mx-auto h-4 w-4 text-primary" />
                  <p className="mt-1 text-lg font-bold">
                    {tech.joining_date ? Math.max(0, Math.floor((Date.now() - new Date(tech.joining_date).getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0}m
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground">Tenure</p>
                </div>
              </Card>
            </div>

            <Tabs defaultValue="contact" className="mt-6">
              <TabsList className="w-full overflow-x-auto no-scrollbar">
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="work">Work</TabsTrigger>
                <TabsTrigger value="bank">Bank & ID</TabsTrigger>
              </TabsList>

              <TabsContent value="contact" className="space-y-2">
                <InfoRow icon={Phone} label="Phone" value={tech.phone} />
                <InfoRow icon={Mail} label="Email" value={tech.email} />
                <InfoRow icon={MapPin} label="Address"
                  value={[tech.address, tech.city, tech.state, tech.pincode].filter(Boolean).join(", ")} />
                <InfoRow icon={Heart} label="Emergency contact"
                  value={tech.emergency_contact_name && tech.emergency_contact_phone
                    ? `${tech.emergency_contact_name} • ${tech.emergency_contact_phone}` : null} />
              </TabsContent>

              <TabsContent value="personal" className="space-y-2">
                <InfoRow icon={Calendar} label="Date of birth" value={tech.date_of_birth} />
                <InfoRow icon={Users} label="Gender" value={tech.gender} />
                <InfoRow icon={Heart} label="Blood group" value={tech.blood_group} />
              </TabsContent>

              <TabsContent value="work" className="space-y-2">
                <InfoRow icon={Briefcase} label="Designation" value={tech.designation} />
                <InfoRow icon={Calendar} label="Joining date" value={tech.joining_date} />
                <InfoRow icon={Activity} label="Type"
                  value={tech.type === "full_time" ? "Full-time" : "On-call"} />
                {tech.skills && tech.skills.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-xs uppercase text-muted-foreground">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tech.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                )}
                {tech.notes && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-xs uppercase text-muted-foreground">Notes</p>
                    <p className="text-sm">{tech.notes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bank" className="space-y-2">
                <InfoRow icon={IdCard} label="ID proof"
                  value={tech.id_proof_type && tech.id_proof_number
                    ? `${tech.id_proof_type} • ${tech.id_proof_number}` : null} />
                <InfoRow icon={Building2} label="Account holder" value={tech.bank_account_name} />
                <InfoRow icon={Banknote} label="Account number" value={tech.bank_account_number} />
                <InfoRow icon={Building2} label="IFSC" value={tech.bank_ifsc} />
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
              <Button className="flex-1" onClick={onEdit}>
                <Edit3 className="mr-1 h-4 w-4" /> Edit profile
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ───────────────── Add/Edit Dialog ───────────────── */
function TechDialog({ row, onDone }: { row?: Tech; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: row?.name || "",
    phone: row?.phone || "",
    email: row?.email || "",
    password: "",
    type: row?.type || "full_time",
    base_salary: row?.base_salary || 0,
    notes: row?.notes || "",
    avatar_url: row?.avatar_url || "",
    address: row?.address || "",
    city: row?.city || "",
    state: row?.state || "",
    pincode: row?.pincode || "",
    date_of_birth: row?.date_of_birth || "",
    joining_date: row?.joining_date || "",
    designation: row?.designation || "",
    skills: (row?.skills || []).join(", "),
    emergency_contact_name: row?.emergency_contact_name || "",
    emergency_contact_phone: row?.emergency_contact_phone || "",
    id_proof_type: row?.id_proof_type || "",
    id_proof_number: row?.id_proof_number || "",
    blood_group: row?.blood_group || "",
    gender: row?.gender || "",
    bank_account_name: row?.bank_account_name || "",
    bank_account_number: row?.bank_account_number || "",
    bank_ifsc: row?.bank_ifsc || "",
  });
  const [busy, setBusy] = useState(false);

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("technician-avatars").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("technician-avatars").getPublicUrl(path);
    setForm((f) => ({ ...f, avatar_url: data.publicUrl }));
    setUploading(false);
    toast.success("Photo uploaded");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { password, ...rest } = form;
    const payload: any = {
      ...rest,
      type: form.type as "full_time" | "on_call",
      skills: form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : null,
      base_salary: Number(form.base_salary) || 0,
      date_of_birth: form.date_of_birth || null,
      joining_date: form.joining_date || null,
      avatar_url: form.avatar_url || null,
    };

    // If creating new technician with email + password, create auth user via edge function
    let user_id: string | null = null;
    if (!row && password && form.email) {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: form.email, password, role: "technician", display_name: form.name }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Failed to create login"); setBusy(false); return; }
      user_id = j.user_id;
    }
    if (user_id) payload.user_id = user_id;

    const { error } = row
      ? await supabase.from("technicians").update(payload).eq("id", row.id)
      : await supabase.from("technicians").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(row ? "Profile updated" : "Technician added" + (user_id ? " with login" : "")); onDone(); }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{row ? "Edit technician profile" : "Add new technician"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        {/* Avatar uploader */}
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
          <Avatar className="h-20 w-20 border-2 border-card">
            {form.avatar_url && <AvatarImage src={form.avatar_url} />}
            <AvatarFallback className="gradient-primary text-lg text-primary-foreground">
              {form.name ? initials(form.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="mb-1 text-sm font-medium">Profile photo</p>
            <p className="mb-2 text-xs text-muted-foreground">JPG or PNG. Max 2MB.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            <Button type="button" variant="outline" size="sm" disabled={uploading}
              onClick={() => fileRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              {uploading ? "Uploading…" : form.avatar_url ? "Change photo" : "Upload photo"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="basic">
          <TabsList className="w-full overflow-x-auto no-scrollbar">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="bank">Bank & ID</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3">
            <div><Label>Full name *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Designation</Label>
                <Input placeholder="e.g. Senior Technician"
                  value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <div><Label>Employment type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="on_call">On-call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!row && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <Label>Login password (optional)</Label>
                <Input type="text" placeholder="Set a password so technician can log in via app/website"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Provide email + password to create a login account. Min 6 chars.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="address" className="space-y-3">
            <div><Label>Street address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div><Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Emergency contact name</Label>
                <Input value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} /></div>
              <div><Label>Emergency contact phone</Label>
                <Input value={form.emergency_contact_phone}
                  onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} /></div>
            </div>
          </TabsContent>

          <TabsContent value="personal" className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Date of birth</Label>
                <Input type="date" value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              <div><Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Blood group</Label>
              <Select value={form.blood_group} onValueChange={(v) => setForm({ ...form, blood_group: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) =>
                    <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="work" className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Joining date</Label>
                <Input type="date" value={form.joining_date}
                  onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></div>
              <div><Label>Base salary (₹)</Label>
                <Input type="number" min={0} value={form.base_salary}
                  onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Skills (comma-separated)</Label>
              <Input placeholder="AC repair, Plumbing, Electrical"
                value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></div>
            <div><Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </TabsContent>

          <TabsContent value="bank" className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>ID proof type</Label>
                <Select value={form.id_proof_type} onValueChange={(v) => setForm({ ...form, id_proof_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="PAN">PAN</SelectItem>
                    <SelectItem value="Driving License">Driving License</SelectItem>
                    <SelectItem value="Voter ID">Voter ID</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>ID proof number</Label>
                <Input value={form.id_proof_number}
                  onChange={(e) => setForm({ ...form, id_proof_number: e.target.value })} /></div>
            </div>
            <div><Label>Account holder name</Label>
              <Input value={form.bank_account_name}
                onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Account number</Label>
                <Input value={form.bank_account_number}
                  onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></div>
              <div><Label>IFSC code</Label>
                <Input value={form.bank_ifsc}
                  onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} /></div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Saving…" : row ? "Save changes" : "Add technician"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
