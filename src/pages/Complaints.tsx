import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Download,
  Star,
  QrCode,
  Pencil,
  Sparkles,
  Eye,
  Share2,
  MessageCircle,
  AlertCircle,
  Clock,
  CheckCircle2,
  ListChecks,
  Phone,
  MapPin,
  User,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { buildWhatsAppShareUrl, openWhatsAppShare } from "@/lib/whatsapp";

type Complaint = {
  id: string;
  ticket_no: string;
  customer_name: string | null;
  customer_phone: string;
  customer_address: string | null;
  issue_type: string | null;
  description: string | null;
  status: string;
  priority: string;
  source: string;
  technician_id: string | null;
  rating: number | null;
  feedback_token: string;
  bonus_fast_arrival: boolean;
  bonus_review: boolean;
  bonus_selfie: boolean;
  bonus_tools_return: boolean;
  bonus_extra_work: boolean;
  created_at: string;
  completed_at: string | null;
};

type Tech = {
  id: string;
  name: string;
  phone: string | null;
  total_points: number;
  active: boolean;
};

function buildWhatsAppMessage(c: Complaint, tech?: Tech) {
  const techName = tech?.name || "Will be assigned shortly";
  const techPhone = "9699654898"; // Mr. Muzaffar - fixed service contact
  const status = c.status.replace(/_/g, " ");
  const date = format(new Date(c.created_at), "dd MMM yyyy");
  return (
    `🙏 Hello ${c.customer_name || "Customer"},\n\n` +
    `Thank you for contacting *Ribbons Infotech*! Here is an update on your complaint:\n\n` +
    `🎫 *Ticket No:* ${c.ticket_no}\n` +
    `🔧 *Issue:* ${c.issue_type || "—"}\n` +
    `👨‍🔧 *Technician Assigned:* ${techName}\n` +
    `📞 *Service Contact:* ${techPhone}\n` +
    `📌 *Current Status:* ${status}\n` +
    `📅 *Registered On:* ${date}\n\n` +
    `For any queries, feel free to reach out to us.\n\n` +
    `📲 *Company Helpline:* 9209197076\n\n` +
    `*Team Ribbons Infotech* 🚀`
  );
}

function openWhatsApp(c: Complaint, tech?: Tech) {
  if (!buildWhatsAppShareUrl(c.customer_phone, buildWhatsAppMessage(c, tech))) {
    toast.error("No customer phone number");
    return;
  }
  openWhatsAppShare(c.customer_phone, buildWhatsAppMessage(c, tech));
}

export default function Complaints() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin", "manager");
  const [rows, setRows] = useState<Complaint[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [openBonus, setOpenBonus] = useState<Complaint | null>(null);
  const [openEdit, setOpenEdit] = useState<Complaint | null>(null);
  const [openDetail, setOpenDetail] = useState<Complaint | null>(null);
  const [qr, setQr] = useState<{ url: string; ticket: string } | null>(null);

  const load = async () => {
    const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(500);
    setRows((data || []) as Complaint[]);
    const { data: t } = await supabase
      .from("technicians")
      .select("id,name,phone,total_points,active")
      .eq("active", true)
      .order("name");
    setTechs((t || []) as Tech[]);
  };
  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      inProgress: rows.filter((r) => r.status === "in_progress" || r.status === "assigned").length,
      completed: rows.filter((r) => r.status === "completed").length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all") {
        if (statusFilter === "in_progress_group" && !(r.status === "in_progress" || r.status === "assigned"))
          return false;
        if (statusFilter !== "in_progress_group" && r.status !== statusFilter) return false;
      }
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.ticket_no.toLowerCase().includes(s) ||
          (r.customer_name || "").toLowerCase().includes(s) ||
          r.customer_phone.includes(s) ||
          (r.issue_type || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [rows, search, statusFilter, priorityFilter, sourceFilter]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("complaints")
      .update({ status: status as never })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      load();
    }
  };
  const assign = async (id: string, techId: string) => {
    const { error } = await supabase
      .from("complaints")
      .update({ technician_id: techId, status: "assigned" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Assigned");
      load();
    }
  };

  const autoAssign = async (c: Complaint) => {
    if (techs.length === 0) {
      toast.error("No active technicians");
      return;
    }
    const openByTech = new Map<string, number>();
    rows.forEach((r) => {
      if (r.technician_id && (r.status === "assigned" || r.status === "in_progress")) {
        openByTech.set(r.technician_id, (openByTech.get(r.technician_id) || 0) + 1);
      }
    });
    const ranked = [...techs].sort((a, b) => {
      const la = openByTech.get(a.id) || 0;
      const lb = openByTech.get(b.id) || 0;
      if (la !== lb) return la - lb;
      return (b.total_points || 0) - (a.total_points || 0);
    });
    const best = ranked[0];
    const load = openByTech.get(best.id) || 0;
    await assign(c.id, best.id);
    toast.success(`Auto-assigned to ${best.name}`, {
      description: `${load} active jobs · ${best.total_points} pts`,
    });
  };

  const showQR = async (c: Complaint) => {
    const url = `${window.location.origin}/feedback/${c.id}/${c.feedback_token}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 });
    setQr({ url: dataUrl, ticket: c.ticket_no });
  };

  const shareEta = async (c: Complaint) => {
    if (!c.technician_id) {
      toast.error("Assign a technician first");
      return;
    }
    const { data, error } = await supabase
      .from("eta_links" as never)
      .insert({ complaint_id: c.id, technician_id: c.technician_id } as never)
      .select("token")
      .single();
    if (error || !data) {
      toast.error(error?.message || "Failed");
      return;
    }
    const url = `${window.location.origin}/eta/${(data as { token: string }).token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("ETA link copied", { description: "Valid for 24 hours" });
    } catch {
      window.prompt("Copy this ETA link:", url);
    }
  };

  return (
    <div>
      <PageHeader
        title="Complaints"
        description="Manage all customer complaints from IVRS or manual entry."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => downloadCSV("complaints.csv", filtered as never)}
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            {canEdit && (
              <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> New complaint
                  </Button>
                </DialogTrigger>
                <NewComplaintDialog
                  onDone={() => {
                    setOpenNew(false);
                    load();
                  }}
                />
              </Dialog>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={ListChecks}
          tone="primary"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={AlertCircle}
          tone="warning"
          active={statusFilter === "pending"}
          onClick={() => setStatusFilter("pending")}
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={Clock}
          tone="info"
          active={statusFilter === "in_progress_group"}
          onClick={() => setStatusFilter("in_progress_group")}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          tone="success"
          active={statusFilter === "completed"}
          onClick={() => setStatusFilter("completed")}
        />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search ticket, name, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="ivrs">IVRS</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="web">Web</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No complaints match your filters.
            </CardContent>
          </Card>
        )}
        {filtered.map((c) => (
          <Card
            key={c.id}
            onClick={() => setOpenDetail(c)}
            className={cn(
              "cursor-pointer transition-colors hover:bg-muted/30",
              c.priority === "urgent" && "border-l-4 border-l-destructive",
              c.priority === "high" && "border-l-4 border-l-warning",
            )}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {c.ticket_no}
                </Badge>
                <StatusBadge s={c.status} />
              </div>
              <div className="font-medium truncate">{c.customer_name || "—"}</div>
              <div className="text-xs text-muted-foreground">{c.customer_phone}</div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <PriorityBadge p={c.priority} />
                <span className="text-muted-foreground truncate">{c.issue_type || "—"}</span>
              </div>
              <div className="flex justify-end gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpenDetail(c)}>
                  <Eye className="mr-1 h-3.5 w-3.5" /> View
                </Button>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpenEdit(c)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                )}
                {c.customer_phone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-green-500 hover:text-green-600"
                    onClick={() =>
                      openWhatsApp(
                        c,
                        techs.find((t) => t.id === c.technician_id),
                      )
                    }
                    title="Send WhatsApp update"
                  >
                    <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto no-scrollbar w-full">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    No complaints match your filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/40",
                    c.priority === "urgent" && "border-l-4 border-l-destructive",
                    c.priority === "high" && "border-l-4 border-l-warning",
                  )}
                  onClick={() => setOpenDetail(c)}
                >
                  <TableCell className="font-mono text-xs">{c.ticket_no}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.customer_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.customer_phone}</div>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">{c.issue_type}</TableCell>
                  <TableCell>
                    <PriorityBadge p={c.priority} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {c.source.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <Select value={c.technician_id || ""} onValueChange={(v) => assign(c.id, v)}>
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue placeholder="Assign…" />
                          </SelectTrigger>
                          <SelectContent>
                            {techs.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!c.technician_id && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 shrink-0"
                            title="Auto-assign best technician"
                            onClick={() => autoAssign(c)}
                          >
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      techs.find((t) => t.id === c.technician_id)?.name || "—"
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <Select value={c.status} onValueChange={(v) => setStatus(c.id, v)}>
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="reopened">Reopened</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge s={c.status} />
                    )}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground"
                    title={format(new Date(c.created_at), "dd MMM yyyy, HH:mm")}
                  >
                    {formatDistanceToNow(new Date(c.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setOpenDetail(c)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setOpenEdit(c)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => showQR(c)}
                        title="Customer feedback QR"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      {c.technician_id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => shareEta(c)}
                          title="Share live ETA link with customer"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      )}
                      {c.customer_phone && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-500 hover:text-green-600"
                          onClick={() =>
                            openWhatsApp(
                              c,
                              techs.find((t) => t.id === c.technician_id),
                            )
                          }
                          title="Send WhatsApp update"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && c.status === "completed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setOpenBonus(c)}
                          title="Bonuses"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {openBonus && (
        <BonusDialog
          complaint={openBonus}
          onClose={() => {
            setOpenBonus(null);
            load();
          }}
        />
      )}
      {openEdit && (
        <EditComplaintDialog
          complaint={openEdit}
          techs={techs}
          onClose={() => {
            setOpenEdit(null);
            load();
          }}
        />
      )}
      {openDetail && (
        <DetailSheet
          complaint={openDetail}
          techs={techs}
          onClose={() => setOpenDetail(null)}
          onEdit={() => {
            const c = openDetail;
            setOpenDetail(null);
            setOpenEdit(c);
          }}
          onShowQR={() => showQR(openDetail)}
          canEdit={canEdit}
        />
      )}

      <Dialog open={!!qr} onOpenChange={() => setQr(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer feedback QR — {qr?.ticket}</DialogTitle>
          </DialogHeader>
          {qr && (
            <div className="flex flex-col items-center gap-4 p-4">
              <img src={qr.url} alt="QR" className="rounded-lg border bg-white p-2" />
              <p className="text-center text-sm text-muted-foreground">
                Print this QR for the customer. They can scan to rate the technician.
                <br />
                The link only activates after the complaint is marked Completed.
              </p>
              <Button onClick={() => window.print()}>Print</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "warning" | "info" | "success";
  active?: boolean;
  onClick?: () => void;
}) {
  const gradientClass = {
    primary: "gradient-primary",
    warning: "gradient-warning",
    info: "gradient-info",
    success: "gradient-success",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft",
        active ? "border-primary ring-2 ring-primary/30 shadow-soft" : "border-border/60",
      )}
    >
      <div className={cn("absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl", gradientClass)} />
      <div className="relative flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-soft transition-transform group-hover:scale-110",
            gradientClass,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </button>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    urgent: "bg-destructive/15 text-destructive border-destructive/20",
    high: "bg-warning/15 text-warning border-warning/20",
    normal: "bg-primary/10 text-primary border-primary/20",
    low: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={map[p]}>
      {p}
    </Badge>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/20",
    assigned: "bg-info/15 text-info border-info/20",
    in_progress: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-success/15 text-success border-success/20",
    reopened: "bg-destructive/15 text-destructive border-destructive/20",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={map[s] || ""}>
      {s.replace("_", " ")}
    </Badge>
  );
}

function NewComplaintDialog({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    issue_type: "",
    description: "",
    priority: "normal",
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await (
      supabase.from("complaints") as never as {
        insert: (v: unknown) => Promise<{ error: Error | null }>;
      }
    ).insert({ ...form, source: "manual", priority: form.priority });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Complaint created");
      onDone();
    }
  };
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New complaint</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Customer name</Label>
            <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input
              required
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Address</Label>
          <Input
            value={form.customer_address}
            onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Issue type</Label>
            <Input
              placeholder="Repair / Install…"
              value={form.issue_type}
              onChange={(e) => setForm({ ...form, issue_type: e.target.value })}
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create"}
        </Button>
      </form>
    </DialogContent>
  );
}

function EditComplaintDialog({
  complaint,
  techs,
  onClose,
}: {
  complaint: Complaint;
  techs: Tech[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: complaint.customer_name || "",
    customer_phone: complaint.customer_phone,
    customer_address: complaint.customer_address || "",
    issue_type: complaint.issue_type || "",
    description: complaint.description || "",
    priority: complaint.priority,
    technician_id: complaint.technician_id || "",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      customer_name: form.customer_name || null,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address || null,
      issue_type: form.issue_type || null,
      description: form.description || null,
      priority: form.priority as never,
      technician_id: form.technician_id || null,
    };
    const { error } = await supabase.from("complaints").update(payload).eq("id", complaint.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Complaint updated");
      onClose();
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Edit complaint — <span className="font-mono text-sm">{complaint.ticket_no}</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Customer name</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                required
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={form.customer_address}
              onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Issue type</Label>
              <Input value={form.issue_type} onChange={(e) => setForm({ ...form, issue_type: e.target.value })} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Assigned technician</Label>
            <Select
              value={form.technician_id || "__none"}
              onValueChange={(v) => setForm({ ...form, technician_id: v === "__none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Unassigned —</SelectItem>
                {techs.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailSheet({
  complaint,
  techs,
  onClose,
  onEdit,
  onShowQR,
  canEdit,
}: {
  complaint: Complaint;
  techs: Tech[];
  onClose: () => void;
  onEdit: () => void;
  onShowQR: () => void;
  canEdit: boolean;
}) {
  const tech = techs.find((t) => t.id === complaint.technician_id);
  const [feedback, setFeedback] = useState<{
    rating: number;
    comment: string | null;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customer_feedback")
        .select("rating,comment,created_at")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (data) setFeedback(data);
    })();
  }, [complaint.id]);

  const timeline = [
    { label: "Created", at: complaint.created_at, done: true },
    {
      label: "Assigned",
      at: complaint.technician_id ? complaint.created_at : null,
      done: !!complaint.technician_id,
    },
    {
      label: "In progress",
      at: null,
      done: complaint.status === "in_progress" || complaint.status === "completed",
    },
    {
      label: "Completed",
      at: complaint.completed_at,
      done: complaint.status === "completed",
    },
  ];

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full overflow-y-auto pb-safe sm:max-w-md">
        <SheetHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="font-mono text-base">{complaint.ticket_no}</SheetTitle>
            <div className="flex gap-1">
              {canEdit && (
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onShowQR}>
                <QrCode className="mr-1.5 h-3.5 w-3.5" /> QR
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge s={complaint.status} />
            <PriorityBadge p={complaint.priority} />
            <Badge variant="outline" className="text-[10px]">
              {complaint.source.toUpperCase()}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Customer */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</h4>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> {complaint.customer_name || "—"}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${complaint.customer_phone}`} className="text-primary hover:underline">
                  {complaint.customer_phone}
                </a>
                <a
                  href={buildWhatsAppShareUrl(complaint.customer_phone, "") || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-xs text-success hover:underline"
                >
                  WhatsApp
                </a>
              </div>
              {complaint.customer_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{" "}
                  <span>{complaint.customer_address}</span>
                </div>
              )}
            </div>
            {complaint.customer_phone && (
              <Button
                size="sm"
                className="mt-2 w-full bg-green-500 text-white hover:bg-green-600"
                onClick={() =>
                  openWhatsApp(
                    complaint,
                    techs.find((t) => t.id === complaint.technician_id),
                  )
                }
              >
                <MessageCircle className="mr-2 h-4 w-4" /> Send WhatsApp Update
              </Button>
            )}
          </section>

          {/* Issue */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue</h4>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{complaint.issue_type || "Not specified"}</div>
              {complaint.description && (
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{complaint.description}</p>
              )}
            </div>
          </section>

          {/* Technician */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technician</h4>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              {tech ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white">
                      {tech.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{tech.name}</div>
                      <div className="text-xs text-muted-foreground">{tech.total_points} points</div>
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h4>
            <ol className="space-y-3">
              {timeline.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                      step.done
                        ? "gradient-primary border-transparent text-white"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className={cn("font-medium", !step.done && "text-muted-foreground")}>{step.label}</div>
                    {step.at && (
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(step.at), "dd MMM yyyy, HH:mm")} ·{" "}
                        {formatDistanceToNow(new Date(step.at), {
                          addSuffix: true,
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Feedback */}
          {feedback && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer feedback
              </h4>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <Star
                      key={r}
                      className={cn(
                        "h-4 w-4",
                        r <= feedback.rating ? "fill-warning text-warning" : "text-muted-foreground",
                      )}
                    />
                  ))}
                </div>
                {feedback.comment && <p className="mt-2 italic text-muted-foreground">"{feedback.comment}"</p>}
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> {format(new Date(feedback.created_at), "dd MMM yyyy")}
                </div>
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BonusDialog({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const [form, setForm] = useState({
    rating: complaint.rating || 5,
    bonus_fast_arrival: complaint.bonus_fast_arrival,
    bonus_review: complaint.bonus_review,
    bonus_selfie: complaint.bonus_selfie,
    bonus_tools_return: complaint.bonus_tools_return,
    bonus_extra_work: complaint.bonus_extra_work,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("complaints").update(form).eq("id", complaint.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Bonuses saved");
      onClose();
    }
  };
  const checks = [
    { k: "bonus_fast_arrival", l: "Fast arrival" },
    { k: "bonus_review", l: "Review taken" },
    { k: "bonus_selfie", l: "Selfie submitted" },
    { k: "bonus_tools_return", l: "Tools returned on time" },
    { k: "bonus_extra_work", l: "Extra work performed" },
  ] as const;
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bonus points — {complaint.ticket_no}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Customer rating</Label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => setForm({ ...form, rating: r })}
                  className={`flex h-10 w-10 items-center justify-center rounded-md border ${form.rating >= r ? "bg-warning/20 text-warning border-warning/30" : "text-muted-foreground"}`}
                >
                  <Star className="h-5 w-5" fill={form.rating >= r ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </div>
          {checks.map((c) => (
            <label key={c.k} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
              <Checkbox
                checked={form[c.k as keyof typeof form] as boolean}
                onCheckedChange={(v) => setForm({ ...form, [c.k]: !!v })}
              />
              <span className="text-sm">{c.l}</span>
            </label>
          ))}
          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? "Saving…" : "Save bonuses"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
