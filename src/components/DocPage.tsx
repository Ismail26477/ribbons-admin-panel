import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Download,
  Trash2,
  FileText,
  ArrowRight,
  Package,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  downloadDocPdf,
  generateDocPdf,
  amountInWordsINR,
  type DocLineItem,
  type CompanySettings,
} from "@/lib/invoicePdf";
import { openWhatsAppShare, preOpenExternalWindow } from "@/lib/whatsapp";

async function sendWhatsApp(r: Doc, company: CompanySettings) {
  const phone = (r.customer_phone || "").replace(/\D/g, "");
  if (!phone) {
    toast.error("No customer phone number");
    return;
  }
  const popup = preOpenExternalWindow();
  const label =
    r.kind === "quotation"
      ? "Quotation"
      : r.kind === "purchase_order"
        ? "Purchase Order"
        : "Invoice";
  let pdfUrl = "";
  try {
    toast.loading("Uploading PDF…", { id: "wa-pdf" });
    const pdf = generateDocPdf(r as never, company);
    const blob = pdf.output("blob");
    const path = `${r.kind}/${r.doc_no}-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("invoice-pdfs")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("invoice-pdfs").getPublicUrl(path);
    pdfUrl = data.publicUrl;
    toast.success("PDF ready", { id: "wa-pdf" });
  } catch (e) {
    toast.error(
      "PDF upload failed: " + (e instanceof Error ? e.message : "unknown"),
      { id: "wa-pdf" },
    );
  }
  const msg =
    `🙏 Hello ${r.customer_name},\n\n` +
    `Your *${label}* from *${company.company_name || "Ribbons Infotech"}* is ready.\n\n` +
    `📄 *Doc No:* ${r.doc_no}\n` +
    `📅 *Date:* ${format(new Date(r.issued_date), "dd MMM yyyy")}\n` +
    `💰 *Total:* ₹${Number(r.total).toLocaleString("en-IN")}\n\n` +
    (pdfUrl ? `📎 *Download PDF:* ${pdfUrl}\n\n` : "") +
    `For any queries, please contact us.\n` +
    `📲 *Helpline:* 9209197076\n\n` +
    `*Team ${company.company_name || "Ribbons Infotech"}* 🚀`;
  openWhatsAppShare(phone, msg, popup);
}

type Kind = "quotation" | "purchase_order" | "invoice";
type InvType = "gst_invoice" | "cash_bill" | "prioritization_bill";

interface Doc {
  id: string;
  doc_no: string;
  kind: Kind;
  status: string;
  invoice_type: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  city: string | null;
  state: string | null;
  party_gstin: string | null;
  department: string | null;
  product_details: string | null;
  po_number: string | null;
  po_date: string | null;
  location: string | null;
  line_items: DocLineItem[];
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  cgst_rate: number;
  sgst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  service_charge_rate: number;
  round_off: number;
  notes: string | null;
  terms_text: string | null;
  issued_date: string;
  due_date: string | null;
  delivery_date: string | null;
  advanced_amount: number;
  source_quotation_id: string | null;
}

interface InvItem {
  id: string;
  name: string;
  selling_price: number;
  cost: number;
  hsn_code: string | null;
  unit: string | null;
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
  converted: "secondary",
  partial: "secondary",
  approved: "default",
  rejected: "destructive",
};

export function DocPage({
  kind,
  title,
  description,
}: {
  kind: Kind;
  title: string;
  description: string;
}) {
  const [rows, setRows] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Doc | null>(null);
  const [view, setView] = useState<Doc | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [company, setCompany] = useState<CompanySettings>({});

  const load = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("kind", kind as never)
      .order("created_at", { ascending: false });
    setRows((data || []) as never);
    const { data: s } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (s) setCompany(s as CompanySettings);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [kind]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? rows
        : rows.filter((r) => r.status === statusFilter),
    [rows, statusFilter],
  );

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("invoices")
      .update({ status: status as never })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      load();
    }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const convert = async (d: Doc, targetKind: Kind) => {
    const payload = { ...d } as Partial<Doc> & Record<string, unknown>;
    delete payload.id;
    delete (payload as { doc_no?: string }).doc_no;
    payload.kind = targetKind;
    payload.status = "draft";
    payload.source_quotation_id =
      d.kind === "quotation" ? d.id : d.source_quotation_id;
    const { data, error } = await supabase
      .from("invoices")
      .insert(payload as never)
      .select("doc_no")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("invoices")
      .update({ status: "converted" as never })
      .eq("id", d.id);
    toast.success(
      `${(data as { doc_no: string }).doc_no} created from ${d.doc_no}`,
    );
    load();
  };

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return { total, counts, count: rows.length };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> New{" "}
                {kind === "invoice"
                  ? "Invoice"
                  : kind === "quotation"
                    ? "Quotation"
                    : "Purchase Order"}
              </Button>
            </DialogTrigger>
            <DocForm
              kind={kind}
              onDone={() => {
                setOpen(false);
                load();
              }}
            />
          </Dialog>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-xl font-bold">
              ₹{stats.total.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Documents</div>
            <div className="text-xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Draft</div>
            <div className="text-xl font-bold">{stats.counts.draft || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              {kind === "invoice" ? "Paid" : "Sent"}
            </div>
            <div className="text-xl font-bold text-success">
              {stats.counts[kind === "invoice" ? "paid" : "sent"] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {[
                "draft",
                "sent",
                "paid",
                "overdue",
                "cancelled",
                "converted",
                "partial",
                "approved",
                "rejected",
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Doc no</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No documents yet.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {r.doc_no}
                  </TableCell>
                  <TableCell>{r.customer_name}</TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(r.issued_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{Number(r.total).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateStatus(r.id, v)}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <Badge variant={STATUS_VARIANTS[r.status] || "outline"}>
                          {r.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "draft",
                          "sent",
                          "approved",
                          "rejected",
                          "paid",
                          "overdue",
                          "partial",
                          "cancelled",
                          "converted",
                        ].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="View"
                        onClick={() => setView(r)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="PDF"
                        onClick={() => downloadDocPdf(r as never, company)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="WhatsApp with PDF"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => sendWhatsApp(r, company)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      {kind === "quotation" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Convert to PO"
                            onClick={() => convert(r, "purchase_order")}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            PO
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Convert to Invoice"
                            onClick={() => convert(r, "invoice")}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            INV
                          </Button>
                        </>
                      )}
                      {kind === "purchase_order" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Convert to Invoice"
                          onClick={() => convert(r, "invoice")}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          INV
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {view && (
        <Dialog open onOpenChange={() => setView(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{view.doc_no}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="font-semibold">{view.customer_name}</div>
              {view.customer_address && (
                <div className="text-muted-foreground">
                  {view.customer_address}
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.line_items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {it.name}
                        {it.hsn ? ` (HSN ${it.hsn})` : ""}
                      </TableCell>
                      <TableCell className="text-right">{it.qty}</TableCell>
                      <TableCell className="text-right">
                        ₹{Number(it.price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{(Number(it.qty) * Number(it.price)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="ml-auto w-64 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{Number(view.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>₹{Number(view.tax_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Total</span>
                  <span>₹{Number(view.total).toFixed(2)}</span>
                </div>
              </div>
              <div className="text-xs italic text-muted-foreground">
                {amountInWordsINR(Number(view.total))}
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button onClick={() => downloadDocPdf(view as never, company)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// =================== DOC FORM ===================
function DocForm({ kind, onDone }: { kind: Kind; onDone: () => void }) {
  const [step, setStep] = useState<"type" | "form">(
    kind === "invoice" ? "type" : "form",
  );
  const [invoiceType, setInvoiceType] = useState<InvType>("gst_invoice");
  const [inventory, setInventory] = useState<InvItem[]>([]);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    city: "",
    state: "",
    party_gstin: "",
    department: "",
    product_details: "",
    po_number: "VERBAL",
    po_date: "",
    location: "",
    issued_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    delivery_date: "",
    notes: "",
    tax_rate: 18,
    cgst_rate: 9,
    sgst_rate: 9,
    service_charge_rate: 1,
    discount: 0,
    advanced_amount: 0,
  });
  const [items, setItems] = useState<DocLineItem[]>([
    { name: "", hsn: "", qty: 1, price: 0, unit: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Doc[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    supabase
      .from("inventory_items")
      .select("id,name,selling_price,cost,hsn_code,unit")
      .eq("active", true as never)
      .order("name")
      .then(({ data }) => setInventory((data || []) as InvItem[]));
  }, []);

  useEffect(() => {
    const q = form.customer_name.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .ilike("customer_name", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(8);
      setSuggestions((data || []) as never);
    }, 250);
    return () => clearTimeout(t);
  }, [form.customer_name]);

  const applyPrior = (d: Doc) => {
    setForm((f) => ({
      ...f,
      customer_name: d.customer_name,
      customer_phone: d.customer_phone || "",
      customer_email: d.customer_email || "",
      customer_address: d.customer_address || "",
      city: d.city || "",
      state: d.state || "",
      party_gstin: d.party_gstin || "",
      department: d.department || "",
      product_details: d.product_details || "",
      po_number: d.po_number || f.po_number,
      location: d.location || "",
    }));
    if (Array.isArray(d.line_items) && d.line_items.length)
      setItems(d.line_items as DocLineItem[]);
    setShowSuggest(false);
    toast.success(`Loaded data from ${d.doc_no}`);
  };

  const subtotal = items.reduce(
    (s, i) => s + Number(i.qty || 0) * Number(i.price || 0),
    0,
  );
  const afterDisc = subtotal - Number(form.discount || 0);
  let cgst = 0,
    sgst = 0,
    tax = 0,
    total = 0;
  if (kind !== "invoice" || invoiceType === "gst_invoice") {
    cgst = (afterDisc * Number(form.cgst_rate || 0)) / 100;
    sgst = (afterDisc * Number(form.sgst_rate || 0)) / 100;
    tax = cgst + sgst;
    total = afterDisc + tax;
  } else if (invoiceType === "prioritization_bill") {
    tax = (afterDisc * Number(form.service_charge_rate || 0)) / 100;
    total = afterDisc + tax;
  } else {
    total = afterDisc;
  }

  const updateItem = (
    idx: number,
    key: keyof DocLineItem,
    val: string | number,
  ) => {
    const next = [...items];
    (next[idx] as unknown as Record<string, unknown>)[key] = val;
    setItems(next);
  };
  const pickInventory = (idx: number, invId: string) => {
    const it = inventory.find((i) => i.id === invId);
    if (!it) return;
    const price = Number(it.selling_price) || Number(it.cost) || 0;
    const next = [...items];
    next[idx] = {
      ...next[idx],
      name: it.name,
      hsn: it.hsn_code || "",
      price,
      unit: it.unit || "",
    };
    setItems(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name) return toast.error("Customer name required");
    setBusy(true);
    const payload = {
      ...form,
      kind,
      invoice_type: kind === "invoice" ? invoiceType : null,
      due_date: form.due_date || null,
      po_date: form.po_date || null,
      delivery_date: form.delivery_date || null,
      line_items: items as never,
      subtotal,
      discount: Number(form.discount) || 0,
      tax_amount: tax,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total,
    };
    const { error } = await supabase.from("invoices").insert(payload as never);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Created");
      onDone();
    }
  };

  if (step === "type" && kind === "invoice") {
    return (
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose invoice type</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                k: "gst_invoice",
                l: "🟣 GST Invoice",
                d: "With CGST/SGST breakdown",
              },
              {
                k: "prioritization_bill",
                l: "🟡 Prioritization Bill",
                d: "Custom % charge",
              },
              { k: "cash_bill", l: "🟢 Cash Bill", d: "No GST, simple total" },
            ] as { k: InvType; l: string; d: string }[]
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => {
                setInvoiceType(t.k);
                setStep("form");
              }}
              className="rounded-lg border-2 p-4 text-left transition hover:border-primary hover:bg-muted/30"
            >
              <div className="font-semibold">{t.l}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.d}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          New{" "}
          {kind === "invoice"
            ? `Invoice (${invoiceType.replace(/_/g, " ")})`
            : kind === "quotation"
              ? "Quotation"
              : "Purchase Order"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Label>Customer name *</Label>
            <Input
              required
              value={form.customer_name}
              onChange={(e) => {
                setForm({ ...form, customer_name: e.target.value });
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
              placeholder="Type to search existing customers…"
            />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applyPrior(s)}
                    className="block w-full border-b px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent"
                  >
                    <div className="font-medium">
                      {s.customer_name}{" "}
                      <span className="text-muted-foreground">
                        • {s.doc_no}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {s.kind} • ₹{Number(s.total).toLocaleString("en-IN")} •{" "}
                      {s.customer_phone || "no phone"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.customer_phone}
              onChange={(e) =>
                setForm({ ...form, customer_phone: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label>Address</Label>
            <Input
              value={form.customer_address}
              onChange={(e) =>
                setForm({ ...form, customer_address: e.target.value })
              }
            />
          </div>
          <div>
            <Label>City</Label>
            <Input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <Label>State</Label>
            <Input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </div>
          <div>
            <Label>Party GSTIN</Label>
            <Input
              value={form.party_gstin}
              onChange={(e) =>
                setForm({ ...form, party_gstin: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={form.issued_date}
              onChange={(e) =>
                setForm({ ...form, issued_date: e.target.value })
              }
            />
          </div>
          {kind === "invoice" && invoiceType === "gst_invoice" && (
            <>
              <div>
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Product Details</Label>
                <Input
                  value={form.product_details}
                  onChange={(e) =>
                    setForm({ ...form, product_details: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>P.O. No</Label>
                <Input
                  value={form.po_number}
                  onChange={(e) =>
                    setForm({ ...form, po_number: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>P.O. Date</Label>
                <Input
                  type="date"
                  value={form.po_date}
                  onChange={(e) =>
                    setForm({ ...form, po_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </div>
            </>
          )}
          {kind === "purchase_order" && (
            <>
              <div>
                <Label>P.O. No</Label>
                <Input
                  value={form.po_number}
                  onChange={(e) =>
                    setForm({ ...form, po_number: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Delivery date</Label>
                <Input
                  type="date"
                  value={form.delivery_date}
                  onChange={(e) =>
                    setForm({ ...form, delivery_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Advanced amount (₹)</Label>
                <Input
                  type="number"
                  value={form.advanced_amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      advanced_amount: Number(e.target.value),
                    })
                  }
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label>Line items</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setItems([
                  ...items,
                  { name: "", hsn: "", qty: 1, price: 0, unit: "" },
                ])
              }
            >
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1.5">
              <Select value="" onValueChange={(v) => pickInventory(idx, v)}>
                <SelectTrigger
                  className="col-span-1 h-9 px-2"
                  title="Pick from inventory"
                >
                  <Package className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} — ₹{i.selling_price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="col-span-4"
                placeholder="Description"
                value={it.name}
                onChange={(e) => updateItem(idx, "name", e.target.value)}
              />
              <Input
                className="col-span-2"
                placeholder="HSN"
                value={it.hsn || ""}
                onChange={(e) => updateItem(idx, "hsn", e.target.value)}
              />
              <Input
                className="col-span-1"
                type="number"
                placeholder="Qty"
                value={it.qty}
                onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
              />
              <Input
                className="col-span-3"
                type="number"
                placeholder="Price"
                value={it.price}
                onChange={(e) =>
                  updateItem(idx, "price", Number(e.target.value))
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="col-span-1"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {(kind !== "invoice" || invoiceType === "gst_invoice") && (
              <>
                <div>
                  <Label>CGST %</Label>
                  <Input
                    type="number"
                    value={form.cgst_rate}
                    onChange={(e) =>
                      setForm({ ...form, cgst_rate: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>SGST %</Label>
                  <Input
                    type="number"
                    value={form.sgst_rate}
                    onChange={(e) =>
                      setForm({ ...form, sgst_rate: Number(e.target.value) })
                    }
                  />
                </div>
              </>
            )}
            {kind === "invoice" && invoiceType === "prioritization_bill" && (
              <div>
                <Label>Service charge %</Label>
                <Input
                  type="number"
                  value={form.service_charge_rate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      service_charge_rate: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
            <div>
              <Label>Discount (₹)</Label>
              <Input
                type="number"
                value={form.discount}
                onChange={(e) =>
                  setForm({ ...form, discount: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {form.discount > 0 && (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-₹{Number(form.discount).toFixed(2)}</span>
              </div>
            )}
            {cgst > 0 && (
              <div className="flex justify-between">
                <span>CGST</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
            )}
            {sgst > 0 && (
              <div className="flex justify-between">
                <span>SGST</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
            )}
            {kind === "invoice" && invoiceType === "prioritization_bill" && (
              <div className="flex justify-between">
                <span>Service charge</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
            <div className="mt-1 text-xs italic text-muted-foreground">
              {amountInWordsINR(total)}
            </div>
          </div>
        </div>

        <div>
          <Label>Notes / Terms</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
