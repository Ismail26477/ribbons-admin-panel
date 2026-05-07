import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Download, Search, Barcode as BarcodeIcon,
  AlertTriangle, Pencil, Trash2, Upload, Printer, ArrowUpDown, ArrowUp, ArrowDown,
  IndianRupee, PackageOpen, Boxes, History, ScanLine, ArrowLeftRight, ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";
import JsBarcode from "jsbarcode";

interface Item {
  id: string; item_code: string; barcode: string; name: string; category: string | null;
  unit: string | null; cost: number; quantity: number; low_stock_threshold: number;
  supplier?: string | null; description?: string | null;
}

interface Txn {
  id: string; item_id: string; txn_type: string; quantity: number;
  notes: string | null; created_at: string;
  technician_id?: string | null;
  technicians?: { name: string } | null;
}

interface Tech { id: string; name: string; active: boolean; }

type SortKey = "item_code" | "name" | "category" | "cost" | "quantity";
type SortDir = "asc" | "desc";

export default function Inventory() {
  const [rows, setRows] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [restockItem, setRestockItem] = useState<Item | null>(null);
  const [logItem, setLogItem] = useState<Item | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [bcItem, setBcItem] = useState<Item | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [bulkPrint, setBulkPrint] = useState<Item[] | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const importRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("inventory_items").select("*").order("name");
    setRows((data || []) as Item[]);
  };
  useEffect(() => { load(); }, []);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const f = rows.filter((r) => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (stockFilter === "low" && !(r.quantity > 0 && r.quantity <= r.low_stock_threshold)) return false;
      if (stockFilter === "out" && r.quantity > 0) return false;
      if (search && !(`${r.name} ${r.item_code} ${r.barcode} ${r.supplier ?? ""}`)
        .toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      const va = a[sortKey] ?? ""; const vb = b[sortKey] ?? "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, search, catFilter, stockFilter, sortKey, sortDir]);

  const handleScanFound = (item: Item) => {
    setScanOpen(false);
    setRestockItem(item);
  };


  const onDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", deleteItem.id);
    if (error) toast.error(error.message);
    else { toast.success("Item deleted"); setDeleteItem(null); load(); }
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const toggleSel = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const lowCount = rows.filter((r) => r.quantity > 0 && r.quantity <= r.low_stock_threshold).length;
  const outCount = rows.filter((r) => r.quantity === 0).length;
  const totalValue = rows.reduce((s, r) => s + Number(r.cost) * r.quantity, 0);

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = String(e.target?.result || "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { toast.error("Empty CSV"); return; }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const records = lines.slice(1).map((ln) => {
        const cells = parseCsvLine(ln);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
        return obj;
      });
      const payload = records
        .filter((r) => r.name)
        .map((r) => ({
          name: r.name,
          category: r.category || null,
          unit: r.unit || "pcs",
          cost: Number(r.cost) || 0,
          quantity: Number(r.quantity) || 0,
          low_stock_threshold: Number(r.low_stock_threshold ?? r["low stock"] ?? 5),
          supplier: r.supplier || null,
          description: r.description || null,
          item_code: r.item_code || "",
          barcode: r.barcode || "",
        }));
      if (!payload.length) { toast.error("No rows with a name column"); return; }
      const { error } = await supabase.from("inventory_items").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success(`Imported ${payload.length} items`); load(); }
    };
    reader.readAsText(file);
  };

  const SortHead = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
    >
      {label}
      {sortKey === k ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock items with auto-generated codes, audit log and barcodes."
        actions={
          <>
            <input
              ref={importRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setScanOpen(true)}>
              <ScanLine className="mr-2 h-4 w-4" /> Scan barcode
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => importRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto"
              onClick={() => downloadCSV("inventory.csv", filtered as never)}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto"
              disabled={!filtered.length}
              onClick={() => setBulkPrint(selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered)}>
              <Printer className="mr-2 h-4 w-4" /> Print labels
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New item</Button>
              </DialogTrigger>
              <ItemDialog onDone={() => { setOpen(false); load(); }} />
            </Dialog>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Boxes className="h-5 w-5" />} tone="primary" label="Total items" value={String(rows.length)} />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} tone="warning" label="Low stock" value={String(lowCount)} />
        <StatCard icon={<PackageOpen className="h-5 w-5" />} tone="destructive" label="Out of stock" value={String(outCount)} />
        <StatCard icon={<IndianRupee className="h-5 w-5" />} tone="success"
          label="Total stock value" value={`₹${totalValue.toLocaleString("en-IN")}`} />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, code, barcode, supplier…"
              value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-sm">
              {selected.size} selected
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto no-scrollbar w-full">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead><SortHead k="item_code" label="Code" /></TableHead>
                <TableHead><SortHead k="name" label="Name" /></TableHead>
                <TableHead><SortHead k="category" label="Category" /></TableHead>
                <TableHead><SortHead k="cost" label="Cost" /></TableHead>
                <TableHead><SortHead k="quantity" label="Quantity" /></TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No items found
                </TableCell></TableRow>
              )}
              {filtered.map((i) => {
                const lowStock = i.quantity > 0 && i.quantity <= i.low_stock_threshold;
                const out = i.quantity === 0;
                return (
                  <TableRow key={i.id} className={out ? "bg-destructive/5" : lowStock ? "bg-warning/5" : ""}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggleSel(i.id)} />
                    </TableCell>
                    <TableCell className="cursor-pointer font-mono text-xs" onClick={() => setDetailItem(i)}>{i.item_code}</TableCell>
                    <TableCell className="cursor-pointer font-medium" onClick={() => setDetailItem(i)}>
                      <div>{i.name}</div>
                      {i.supplier && <div className="text-xs text-muted-foreground">{i.supplier}</div>}
                    </TableCell>
                    <TableCell>{i.category && <Badge variant="outline">{i.category}</Badge>}</TableCell>
                    <TableCell>₹{Number(i.cost).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`min-w-[3.5rem] text-center font-semibold ${out ? "text-destructive" : lowStock ? "text-warning" : ""}`}>
                          {i.quantity} {i.unit}
                        </span>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setRestockItem(i)} title="Stock movement">
                          <ArrowLeftRight className="h-3 w-3" />
                          <span className="ml-1 text-xs">Move</span>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setLogItem(i)} title="Movement log">
                          <ScrollText className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setBcItem(i)} title="Barcode">
                          <BarcodeIcon className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditItem(i)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteItem(i)} title="Delete"
                          className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {bcItem && <BarcodeDialog item={bcItem} onClose={() => setBcItem(null)} />}
      {bulkPrint && <BulkBarcodeDialog items={bulkPrint} onClose={() => setBulkPrint(null)} />}
      {editItem && (
        <Dialog open={true} onOpenChange={() => setEditItem(null)}>
          <ItemDialog item={editItem} onDone={() => { setEditItem(null); load(); }} />
        </Dialog>
      )}
      {restockItem && (
        <RestockDialog item={restockItem} onClose={() => setRestockItem(null)} onDone={() => { setRestockItem(null); load(); }} />
      )}
      {detailItem && (
        <ItemDetailDrawer item={detailItem} onClose={() => setDetailItem(null)} />
      )}
      {logItem && <MovementLogDialog item={logItem} onClose={() => setLogItem(null)} />}
      {scanOpen && <ScanBarcodeDialog onClose={() => setScanOpen(false)} onFound={handleScanFound} />}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteItem?.name}</strong> ({deleteItem?.item_code}) will be permanently removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: "primary" | "warning" | "destructive" | "success"; label: string; value: string }) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-md p-2 ${toneCls}`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BarcodeDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const value = item.barcode || item.item_code || "";
  const setRef = (node: SVGSVGElement | null) => {
    if (!node || !value) return;
    try {
      JsBarcode(node, value, {
        format: "CODE128",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (err) {
      console.error("Barcode generation failed", err);
    }
  };
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item.name}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-6 print:p-2">
          <div className="text-sm text-muted-foreground">Code: {item.item_code}</div>
          {value ? (
            <svg ref={setRef} className="max-w-full" />
          ) : (
            <div className="text-sm text-destructive">No barcode value set for this item.</div>
          )}
        </div>
        <Button onClick={() => window.print()}>Print label</Button>
      </DialogContent>
    </Dialog>
  );
}

function BulkBarcodeDialog({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const svgs = containerRef.current?.querySelectorAll<SVGSVGElement>("svg[data-bc]");
    svgs?.forEach((svg) => {
      const code = svg.getAttribute("data-bc")!;
      JsBarcode(svg, code, { format: "CODE128", width: 1.6, height: 50, fontSize: 11, displayValue: true });
    });
  }, [items]);
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Print {items.length} labels</DialogTitle>
        </DialogHeader>
        <div ref={containerRef} className="max-h-[60vh] overflow-auto rounded-lg bg-white p-4 print:max-h-none print:overflow-visible">
          <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
            {items.map((it) => (
              <div key={it.id} className="rounded border border-dashed border-muted-foreground/30 p-2 text-center">
                <div className="truncate text-xs font-semibold text-foreground">{it.name}</div>
                <div className="text-[10px] text-muted-foreground">₹{Number(it.cost).toLocaleString("en-IN")}</div>
                <svg data-bc={it.barcode} />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ item, onDone }: { item?: Item; onDone: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? "",
    unit: item?.unit ?? "pcs",
    cost: item?.cost ?? 0,
    quantity: item?.quantity ?? 0,
    low_stock_threshold: item?.low_stock_threshold ?? 5,
    supplier: item?.supplier ?? "",
    description: item?.description ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (isEdit) {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          name: form.name, category: form.category || null, unit: form.unit,
          cost: form.cost, low_stock_threshold: form.low_stock_threshold,
          supplier: form.supplier || null, description: form.description || null,
        })
        .eq("id", item!.id);
      setBusy(false);
      if (error) toast.error(error.message);
      else { toast.success("Item updated"); onDone(); }
    } else {
      const { error } = await supabase.from("inventory_items").insert({
        ...form,
        category: form.category || null,
        supplier: form.supplier || null,
        description: form.description || null,
        item_code: "", barcode: "",
      });
      setBusy(false);
      if (error) toast.error(error.message);
      else { toast.success("Item created"); onDone(); }
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{isEdit ? `Edit ${item!.item_code}` : "New inventory item"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid gap-3">
        <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><Label>Cost (₹)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
          {!isEdit && (
            <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
          )}
          <div><Label>Low stock at</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Supplier</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
        <div><Label>Description / notes</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        {!isEdit && <p className="text-xs text-muted-foreground">Item code and barcode will be generated automatically.</p>}
        {isEdit && <p className="text-xs text-muted-foreground">To change quantity, use the Restock button or +/− buttons (creates an audit trail).</p>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Create"}</Button>
      </form>
    </DialogContent>
  );
}

function RestockDialog({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<"restock" | "use" | "damage" | "return" | "issue">("restock");
  const [qty, setQty] = useState(10);
  const [notes, setNotes] = useState("");
  const [techId, setTechId] = useState<string>("none");
  const [techs, setTechs] = useState<Tech[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("technicians").select("id,name,active").eq("active", true).order("name")
      .then(({ data }) => setTechs((data || []) as Tech[]));
  }, []);

  const isInbound = type === "restock" || type === "return";
  const willBe = isInbound ? item.quantity + qty : item.quantity - qty;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) { toast.error("Quantity must be positive"); return; }
    if (!isInbound && qty > item.quantity) {
      toast.error(`Only ${item.quantity} ${item.unit ?? "units"} in stock`);
      return;
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("inventory_transactions").insert({
      item_id: item.id,
      txn_type: type,
      quantity: qty,
      notes: notes || null,
      technician_id: techId === "none" ? null : techId,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Stock movement recorded"); onDone(); }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Stock movement — {item.name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            Current: <strong>{item.quantity} {item.unit}</strong> → After:{" "}
            <strong className={willBe < 0 ? "text-destructive" : ""}>{willBe} {item.unit}</strong>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restock">Restock (+)</SelectItem>
                <SelectItem value="return">Return (+)</SelectItem>
                <SelectItem value="issue">Issue / Take (−)</SelectItem>
                <SelectItem value="use">Use / Consume (−)</SelectItem>
                <SelectItem value="damage">Damage (−)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div>
            <Label>Technician</Label>
            <Select value={techId} onValueChange={setTechId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Job #CMP-001042, broken on site…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record movement"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScanBarcodeDialog({ onClose, onFound }: { onClose: () => void; onFound: (item: Item) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => { hiddenRef.current?.focus(); }, []);

  const lookup = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setBusy(true);
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .or(`barcode.eq.${value},item_code.eq.${value}`)
      .limit(1)
      .maybeSingle();
    setBusy(false);
    if (data) onFound(data as Item);
    else toast.error(`No item found for barcode: ${value}`);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Scan barcode</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          {/* Hidden auto-focus input that catches USB/Bluetooth scanner keystrokes */}
          <input
            ref={hiddenRef}
            className="sr-only"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value;
                (e.target as HTMLInputElement).value = "";
                lookup(v);
              }
            }}
          />
          <div className="relative h-32 overflow-hidden rounded-lg border-2 border-dashed border-primary/40 bg-muted/30">
            <div className="absolute inset-x-4 top-1/2 h-0.5 animate-scan-line bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <ScanLine className="h-10 w-10 text-primary/60" />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Point your scanner here — or type a code below
          </p>
          <div className="grid gap-2">
            <Label>Barcode / Item Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(code); } }}
                placeholder="e.g. RBN-00012"
              />
              <Button type="button" onClick={() => lookup(code)} disabled={busy}>
                Find item
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovementLogDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("inventory_transactions")
        .select("id,item_id,txn_type,quantity,notes,created_at,technician_id,technicians(name)")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTxns((data || []) as unknown as Txn[]);
      setLoading(false);
    })();
  }, [item.id]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const tone = (t: string) =>
    t === "damage" ? "bg-destructive/15 text-destructive border-destructive/30"
    : (t === "issue" || t === "use") ? "bg-warning/15 text-warning border-warning/30"
    : "bg-success/15 text-success border-success/30";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Movement log — {item.name}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : txns.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No movements yet</div>
          ) : (
            <div className="space-y-2">
              {txns.map((t) => {
                const isIn = t.txn_type === "restock" || t.txn_type === "return";
                return (
                  <Card key={t.id}>
                    <CardContent className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`capitalize ${tone(t.txn_type)}`}>
                            {t.txn_type}
                          </Badge>
                          <span className={`font-semibold ${isIn ? "text-success" : "text-destructive"}`}>
                            {isIn ? "+" : "−"}{t.quantity} {item.unit}
                          </span>
                          {t.technicians?.name && (
                            <span className="text-xs text-muted-foreground">• {t.technicians.name}</span>
                          )}
                        </div>
                        {t.notes && <div className="mt-1 text-xs text-muted-foreground break-words">{t.notes}</div>}
                      </div>
                      <div className="whitespace-nowrap text-xs text-muted-foreground">{fmt(t.created_at)}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemDetailDrawer({ item, onClose }: { item: Item; onClose: () => void }) {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("inventory_transactions")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTxns((data || []) as Txn[]);
      setLoading(false);
    })();
  }, [item.id]);

  const lowStock = item.quantity > 0 && item.quantity <= item.low_stock_threshold;
  const out = item.quantity === 0;

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{item.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Code</div>
              <div className="font-mono text-sm">{item.item_code}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Quantity</div>
              <div className={`text-lg font-semibold ${out ? "text-destructive" : lowStock ? "text-warning" : ""}`}>
                {item.quantity} {item.unit}
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Unit cost</div>
              <div className="text-lg font-semibold">₹{Number(item.cost).toLocaleString("en-IN")}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Stock value</div>
              <div className="text-lg font-semibold">₹{(Number(item.cost) * item.quantity).toLocaleString("en-IN")}</div>
            </CardContent></Card>
          </div>

          <div className="space-y-1 text-sm">
            {item.category && <Row label="Category">{item.category}</Row>}
            {item.supplier && <Row label="Supplier">{item.supplier}</Row>}
            <Row label="Low stock alert">{item.low_stock_threshold} {item.unit}</Row>
            <Row label="Barcode"><span className="font-mono text-xs">{item.barcode}</span></Row>
            {item.description && <Row label="Notes">{item.description}</Row>}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" /> Movement history
            </div>
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                ) : txns.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No movements yet</div>
                ) : (
                  <div className="divide-y">
                    {txns.map((t) => {
                      const isIn = t.txn_type === "restock" || t.txn_type === "return";
                      return (
                        <div key={t.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={isIn ? "default" : "secondary"} className="capitalize">{t.txn_type}</Badge>
                              <span className={`font-semibold ${isIn ? "text-success" : "text-destructive"}`}>
                                {isIn ? "+" : "−"}{t.quantity}
                              </span>
                            </div>
                            {t.notes && <div className="mt-1 text-xs text-muted-foreground">{t.notes}</div>}
                          </div>
                          <div className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
