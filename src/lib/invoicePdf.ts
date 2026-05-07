import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DocLineItem {
  name: string;
  hsn?: string | null;
  qty: number;
  price: number;
  unit?: string | null;
}

export interface DocLike {
  id?: string;
  doc_no: string;
  kind: "invoice" | "quotation" | "purchase_order";
  invoice_type?: string | null; // gst_invoice | cash_bill | prioritization_bill
  status: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  city?: string | null;
  state?: string | null;
  party_gstin?: string | null;
  department?: string | null;
  product_details?: string | null;
  po_number?: string | null;
  po_date?: string | null;
  location?: string | null;
  line_items: DocLineItem[];
  subtotal: number;
  discount?: number;
  tax_rate: number;
  tax_amount: number;
  cgst_rate?: number;
  sgst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  round_off?: number;
  service_charge_rate?: number;
  total: number;
  notes?: string | null;
  terms_text?: string | null;
  issued_date: string;
  due_date?: string | null;
  delivery_date?: string | null;
  advanced_amount?: number;
  bank_name?: string | null;
  account_no?: string | null;
  ifsc_code?: string | null;
  branch?: string | null;
}

export interface CompanySettings {
  company_name?: string | null;
  company_name_alt?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_address?: string | null;
  ho_address?: string | null;
  nashik_address?: string | null;
  website_ho?: string | null;
  website_nashik?: string | null;
  gstin?: string | null;
  gstin_nashik?: string | null;
  bank_name?: string | null;
  account_no?: string | null;
  ifsc_code?: string | null;
  branch?: string | null;
  terms_conditions?: string | null;
  customer_care_phone?: string | null;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rs = (n: number) => `Rs. ${fmt(n)}`;

// -- Indian-system amount in words --
function inWords(num: number): string {
  num = Math.floor(num);
  if (num === 0) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number): string => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  const three = (n: number): string => {
    const h = Math.floor(n / 100), r = n % 100;
    return (h ? a[h] + " Hundred" + (r ? " and " : "") : "") + (r ? two(r) : "");
  };
  let res = "";
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  if (crore) res += three(crore) + " Crore ";
  if (lakh) res += two(lakh) + " Lakh ";
  if (thousand) res += two(thousand) + " Thousand ";
  if (num) res += three(num);
  return res.trim();
}

export function amountInWordsINR(n: number): string {
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let s = inWords(rupees) + " Rupees";
  if (paise) s += " and " + inWords(paise) + " Paise";
  return s + " Only";
}

const PRIMARY: [number, number, number] = [99, 102, 241];

// Border around page
function pageBorder(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(0).setLineWidth(0.5).rect(8, 8, w - 16, h - 16);
}

// =================== GST INVOICE (matches Image 1 / 5) ===================
function buildGstInvoice(doc: jsPDF, inv: DocLike, c: CompanySettings) {
  pageBorder(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = 12;
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("BILL OF SUPPLY", w / 2, y + 3, { align: "center" });
  y += 6;
  // Company name
  doc.setFontSize(18).setFont("helvetica", "bold");
  doc.text((c.company_name || "RIBBON'S INFOTECH").toUpperCase(), w / 2, y + 5, { align: "center" });
  y += 8;
  doc.setFontSize(8).setFont("helvetica", "normal");
  if (c.ho_address) doc.text("MALEGAON [HO] : " + c.ho_address, w / 2, y + 4, { align: "center" });
  y += 4;
  if (c.nashik_address) doc.text("NASHIK BRANCH : " + c.nashik_address, w / 2, y + 4, { align: "center" });
  y += 6;
  // Email/phone/gstin row
  doc.setFontSize(8);
  doc.text(`Email : ${c.company_email || ""}`, 12, y + 4);
  doc.text(`PH : ${c.company_phone || ""}`, w - 12, y + 4, { align: "right" });
  y += 4;
  if (c.website_ho) doc.text(`Website : ${c.website_ho}`, 12, y + 4);
  doc.text(`GSTIN : ${c.gstin || ""}`, w - 12, y + 4, { align: "right" });
  y += 4;
  if (c.website_nashik) doc.text(`Website : ${c.website_nashik}`, 12, y + 4);
  y += 6;
  doc.line(10, y, w - 10, y);
  y += 2;

  // Customer Details + Invoice Details two columns
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("Customer Details", 12, y + 4);
  doc.text("", w / 2 + 4, y + 4);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const leftLines: string[] = [
    inv.customer_name || "",
    inv.customer_address || "",
    inv.party_gstin ? `GSTIN: ${inv.party_gstin}` : "",
  ].filter(Boolean);
  let ly = y;
  leftLines.forEach((l) => { doc.text(l, 12, ly + 4); ly += 4; });
  if (inv.city) { doc.text(`CITY: ${inv.city}`, 12, ly + 4); ly += 4; }
  if (inv.state) { doc.text(`STATE: ${inv.state}`, 12, ly + 4); ly += 4; }
  if (inv.customer_phone) { doc.text(`PH: ${inv.customer_phone}`, 12, ly + 4); ly += 4; }

  // right details
  const rightRows = [
    ["Department", inv.department || "—"],
    ["Invoice No", inv.doc_no],
    ["Invoice Date", inv.issued_date],
    ["Product Details", inv.product_details || "—"],
    ["P.O. No", inv.po_number || "VERBAL"],
    ["P.O. Date", inv.po_date || inv.issued_date],
    ["Party GSTIN", inv.party_gstin || "—"],
    ["Location", inv.location || "—"],
  ];
  let ry = y;
  rightRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold").text(`${k}:`, w / 2 + 4, ry + 4);
    doc.setFont("helvetica", "normal").text(String(v), w / 2 + 40, ry + 4);
    ry += 4;
  });
  y = Math.max(ly, ry) + 4;
  doc.line(10, y, w - 10, y); y += 2;

  // Items table with HSN
  autoTable(doc, {
    startY: y,
    head: [["Product Description", "HSN NO", "QTY", "Unit Rates", "Amount"]],
    body: inv.line_items.map((it) => [
      `• ${it.name}`,
      it.hsn || "",
      String(it.qty),
      fmt(it.price),
      fmt(it.qty * it.price),
    ]),
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "center" }, 2: { halign: "right" },
      3: { halign: "right" }, 4: { halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable
  let yy = (doc.lastAutoTable?.finalY || y) + 4;

  // Tax / totals block (right) — matches reference bill
  const tx = w - 12;
  const labels: [string, number][] = [];
  labels.push(["Total Invoice Amount in Words", 0]); // placeholder for left label spacing only? skip
  labels.length = 0;
  labels.push(["Total Amount", inv.subtotal]);
  if ((inv.cgst_amount || 0) > 0) labels.push([`Add CGST @ ${inv.cgst_rate || 9}%`, inv.cgst_amount || 0]);
  if ((inv.sgst_amount || 0) > 0) labels.push([`Add SGST @ ${inv.sgst_rate || 9}%`, inv.sgst_amount || 0]);
  if ((inv.discount || 0) > 0) labels.push(["Discount", -(inv.discount || 0)]);
  if ((inv.round_off || 0) !== 0) labels.push(["Round Off", inv.round_off || 0]);
  doc.setFontSize(9).setFont("helvetica", "normal");
  labels.forEach(([k, v]) => {
    doc.text(k, tx - 60, yy + 4); doc.text(fmt(v), tx, yy + 4, { align: "right" });
    yy += 4;
  });
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.setFillColor(...PRIMARY).setTextColor(255);
  doc.rect(tx - 70, yy + 1, 80, 7, "F");
  doc.text("Total:", tx - 65, yy + 6);
  doc.text(rs(inv.total), tx - 2, yy + 6, { align: "right" });
  doc.setTextColor(0);
  yy += 10;

  // Amount in words
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("Total Invoice Amount in Words:", 12, yy + 4); yy += 4;
  doc.setFont("helvetica", "normal");
  const words = doc.splitTextToSize(amountInWordsINR(inv.total).toUpperCase(), w - 24);
  doc.text(words, 12, yy + 4); yy += words.length * 4 + 4;

  // Bank details
  doc.setFont("helvetica", "bold");
  doc.text("Bank Details", 12, yy + 4); yy += 4;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Name: ${inv.bank_name || c.bank_name || "—"}`, 12, yy + 4);
  doc.text(`Account No: ${inv.account_no || c.account_no || "—"}`, w / 2, yy + 4);
  yy += 4;
  doc.text(`Branch: ${inv.branch || c.branch || "—"}`, 12, yy + 4);
  doc.text(`IFSC Code: ${inv.ifsc_code || c.ifsc_code || "—"}`, w / 2, yy + 4);
  yy += 6;

  // Customer care
  if (c.customer_care_phone) {
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(`CUSTOMER CARE (COMPLAINTS & ONLINE PRODUCT PURCHASING) : ${c.customer_care_phone}`, 12, yy + 4);
    yy += 6;
  }

  // Footer block: T&C + signatures
  doc.line(10, yy, w - 10, yy); yy += 4;
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("Terms & Conditions", 12, yy + 4);
  doc.text("Customer Name", w / 2, yy + 4);
  doc.text("FOR " + (c.company_name || "RIBBON'S INFOTECH").toUpperCase(), w - 12, yy + 4, { align: "right" });
  yy += 4;
  doc.setFont("helvetica", "normal").setFontSize(8);
  const tc = (c.terms_conditions ||
    "• Good Once Sold Will Not Be Taken Back\n• No Warranty On Proximity Card, Power Supply, Exit Reader, Batteries, EM Lock, Physically Damaged, Burned Products & Voltage Related Failures\n• Standard Warranty Against Manufacturing Defect\n• Subject to Malegaon Jurisdiction Only").split("\n");
  let tcy = yy + 4;
  tc.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, w / 2 - 14);
    doc.text(wrapped, 12, tcy);
    tcy += wrapped.length * 3.5;
  });
  // signatures
  doc.text("Signature", w - 12, yy + 28, { align: "right" });
  doc.text("Authorised Signature", w - 12, yy + 36, { align: "right" });
  yy = Math.max(tcy, yy + 40);

  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(`Make All Checks Payable To "${(c.company_name || "RIBBONS INFOTECH").toUpperCase()}"`, w / 2, yy + 6, { align: "center" });
  doc.setFont("helvetica", "italic").setFontSize(8);
  doc.text("Your Happiness Is Our Priority, If Not Happy We Will Make It Right !!", w / 2, yy + 11, { align: "center" });
  doc.text("Thank You For Your Business !!", w / 2, yy + 15, { align: "center" });
}

// =================== CASH BILL ===================
function buildCashBill(doc: jsPDF, inv: DocLike, c: CompanySettings) {
  pageBorder(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = 12;

  // Header
  doc.setFontSize(20).setFont("helvetica", "bold");
  doc.text((c.company_name || "RIBBON'S INFOTECH").toUpperCase(), 12, y + 6);
  doc.setFontSize(16).setFont("helvetica", "bold");
  doc.text("INVOICE", w - 12, y + 6, { align: "right" });
  y += 8;
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text("REG. OFFICE:", 12, y + 4); y += 4;
  if (c.ho_address) doc.text("MALEGAON (HO) : " + c.ho_address, 12, y + 4);
  y += 4;
  doc.text(`PH :- ${c.company_phone || ""}`, 12, y + 4);
  y += 6;
  doc.line(10, y, w - 10, y); y += 4;

  // To/customer + right info box
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("To,", 12, y);
  doc.setFont("helvetica", "normal");
  let ly = y + 4;
  doc.text(inv.customer_name, 12, ly); ly += 4;
  if (inv.customer_address) {
    const lines = doc.splitTextToSize(inv.customer_address, w / 2 - 20);
    doc.text(lines, 12, ly); ly += lines.length * 4;
  }
  if (inv.customer_phone) { doc.text(`MOB: ${inv.customer_phone}`, 12, ly); ly += 4; }

  autoTable(doc, {
    startY: y - 2,
    margin: { left: w / 2 + 4, right: 10 },
    body: [
      ["INVOICE #", inv.doc_no],
      ["DATE", inv.issued_date],
      ["COMPANY", inv.department || inv.product_details || "—"],
      ["TERMS", "CASH"],
    ],
    theme: "grid",
    bodyStyles: { fontSize: 9, fontStyle: "bold" },
    columnStyles: { 0: { fillColor: [240, 240, 240], cellWidth: 30 } },
  });
  // @ts-expect-error lastAutoTable
  y = Math.max(ly, doc.lastAutoTable?.finalY || ly) + 4;

  autoTable(doc, {
    startY: y,
    head: [["DESCRIPTION OF GOODS", "QTY", "UNIT PRICE", "AMOUNT"]],
    body: inv.line_items.map((it) => [
      it.name,
      String(it.qty) + (it.unit ? " " + it.unit : ""),
      fmt(it.price),
      fmt(it.qty * it.price),
    ]),
    theme: "grid",
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable
  let yy = (doc.lastAutoTable?.finalY || y) + 2;

  doc.setFillColor(220, 220, 220);
  doc.rect(10, yy, w - 20, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("TOTAL", 14, yy + 5);
  doc.text("WITH TAX", w / 2, yy + 5, { align: "center" });
  doc.text(fmt(inv.total), w - 14, yy + 5, { align: "right" });
  yy += 12;

  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("AMOUNT IN WORDS:", 12, yy);
  doc.setFont("helvetica", "normal");
  const words = doc.splitTextToSize(amountInWordsINR(inv.total).toUpperCase(), w - 24);
  doc.text(words, 12, yy + 5);
  yy += 5 + words.length * 4 + 4;

  doc.setFont("helvetica", "normal").setFontSize(8);
  const defaults = [
    "Note: 1. WIRE FITTING CHARGES SHOULD BE EXTRA ON LABOUR BASIS, AS PER REQUIREMENT.",
    "        2. PRICES MAY VARY (+/-) ON ACTUAL ON-SIGHT CONDITIONS.",
    "        3. GST ARE APPLICABLE AS FOLLOWING @18 % (SGST+CGST).",
  ];
  defaults.forEach((d) => {
    const wrapped = doc.splitTextToSize(d, w - 24);
    doc.text(wrapped, 12, yy); yy += wrapped.length * 4;
  });
  yy += 2;

  doc.setFont("helvetica", "italic").setFontSize(8);
  doc.text("Your Happiness Is Our Priority, If Not Happy We Will Make It Right :)", w / 2, yy + 6, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  if (c.company_email)
    doc.text(`Please feel free to contact on ${c.company_phone || ""}, or ${c.company_email}`, w / 2, yy + 11, { align: "center" });
}

// =================== PRIORITIZATION BILL ===================
function buildPrioritizationBill(doc: jsPDF, inv: DocLike, c: CompanySettings) {
  // Reuse GST layout but replace tax block with service charge
  pageBorder(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = 12;
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("PRIORITIZATION BILL", w / 2, y + 4, { align: "center" });
  y += 6;
  doc.setFontSize(18);
  doc.text((c.company_name || "RIBBON'S INFOTECH").toUpperCase(), w / 2, y + 6, { align: "center" });
  y += 10;
  doc.setFontSize(8).setFont("helvetica", "normal");
  if (c.ho_address) doc.text(c.ho_address, w / 2, y + 3, { align: "center" });
  y += 4;
  doc.text(`PH : ${c.company_phone || ""}   GSTIN : ${c.gstin || ""}`, w / 2, y + 4, { align: "center" });
  y += 6;
  doc.line(10, y, w - 10, y); y += 3;
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("Bill To:", 12, y + 4); doc.setFont("helvetica", "normal");
  doc.text(inv.customer_name, 30, y + 4);
  doc.text(`Bill No: ${inv.doc_no}`, w - 12, y + 4, { align: "right" });
  y += 8;
  if (inv.customer_address) { doc.text(inv.customer_address, 12, y); y += 4; }
  doc.text(`Date: ${inv.issued_date}`, w - 12, y, { align: "right" });
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Description", "QTY", "Unit Rate", "Amount"]],
    body: inv.line_items.map((it) => [it.name, String(it.qty), fmt(it.price), fmt(it.qty * it.price)]),
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable
  let yy = (doc.lastAutoTable?.finalY || y) + 6;

  const tx = w - 12;
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("Subtotal:", tx - 60, yy); doc.text(fmt(inv.subtotal), tx, yy, { align: "right" }); yy += 5;
  doc.text(`Service Charge (${inv.service_charge_rate || 1}%):`, tx - 60, yy);
  doc.text(fmt(inv.tax_amount), tx, yy, { align: "right" }); yy += 6;
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.setFillColor(...PRIMARY).setTextColor(255);
  doc.rect(tx - 70, yy - 4, 80, 8, "F");
  doc.text("GRAND TOTAL:", tx - 65, yy + 1); doc.text(rs(inv.total), tx - 2, yy + 1, { align: "right" });
  doc.setTextColor(0);
  yy += 10;

  doc.setFont("helvetica", "bold").setFontSize(9).text("Amount in Words:", 12, yy);
  doc.setFont("helvetica", "normal");
  const words = doc.splitTextToSize(amountInWordsINR(inv.total).toUpperCase(), w - 24);
  doc.text(words, 12, yy + 5);
  yy += 5 + words.length * 4 + 4;

  doc.setFont("helvetica", "italic").setFontSize(8);
  doc.text("Thank You For Your Business !!", w / 2, yy + 6, { align: "center" });
}

// =================== QUOTATION (matches Image 2 style) ===================
function buildQuotation(doc: jsPDF, inv: DocLike, c: CompanySettings) {
  pageBorder(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = 12;

  // Header
  doc.setFontSize(20).setFont("helvetica", "bold");
  doc.text((c.company_name || "RIBBON'S INFOTECH").toUpperCase(), 12, y + 6);
  doc.setFontSize(16).setFont("helvetica", "bold");
  doc.text("QUOTATION", w - 12, y + 6, { align: "right" });
  y += 8;
  doc.setFontSize(8).setFont("helvetica", "normal");
  if (c.ho_address) doc.text("REG. OFFICE: " + c.ho_address, 12, y + 4);
  y += 4;
  doc.text(`PH: ${c.company_phone || ""}`, 12, y + 4);
  y += 6;
  doc.line(10, y, w - 10, y); y += 4;

  // Two columns: To / Quotation # box
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("To,", 12, y);
  doc.setFont("helvetica", "normal");
  let ly = y + 4;
  doc.text(inv.customer_name, 12, ly); ly += 4;
  if (inv.customer_address) {
    const lines = doc.splitTextToSize(inv.customer_address, w / 2 - 20);
    doc.text(lines, 12, ly); ly += lines.length * 4;
  }
  if (inv.customer_phone) { doc.text(`MOB: ${inv.customer_phone}`, 12, ly); ly += 4; }

  // Right details box
  autoTable(doc, {
    startY: y - 2,
    margin: { left: w / 2 + 4, right: 10 },
    body: [
      ["QUOTATION #", inv.doc_no],
      ["DATE", inv.issued_date],
      ["COMPANY", inv.department || inv.product_details || "—"],
      ["TERMS", "NET 15 DAYS"],
    ],
    theme: "grid",
    bodyStyles: { fontSize: 9, fontStyle: "bold" },
    columnStyles: { 0: { fillColor: [240, 240, 240], cellWidth: 30 } },
  });
  // @ts-expect-error lastAutoTable
  y = Math.max(ly, doc.lastAutoTable?.finalY || ly) + 4;

  autoTable(doc, {
    startY: y,
    head: [["DESCRIPTION OF GOODS", "QTY", "UNIT PRICE", "AMOUNT"]],
    body: inv.line_items.map((it) => [
      it.name,
      String(it.qty) + (it.unit ? " " + it.unit : ""),
      fmt(it.price),
      fmt(it.qty * it.price),
    ]),
    theme: "grid",
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable
  let yy = (doc.lastAutoTable?.finalY || y) + 2;

  // Total row
  doc.setFillColor(220, 220, 220);
  doc.rect(10, yy, w - 20, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("TOTAL", 14, yy + 5);
  doc.text("WITH TAX", w / 2, yy + 5, { align: "center" });
  doc.text(fmt(inv.total), w - 14, yy + 5, { align: "right" });
  yy += 12;

  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("AMOUNT IN WORDS:", 12, yy);
  doc.setFont("helvetica", "normal");
  const words = doc.splitTextToSize(amountInWordsINR(inv.total).toUpperCase(), w - 24);
  doc.text(words, 12, yy + 5);
  yy += 5 + words.length * 4 + 4;

  if (inv.notes) {
    doc.setFont("helvetica", "bold").setFontSize(9).text("Notes:", 12, yy); yy += 4;
    doc.setFont("helvetica", "normal").setFontSize(8);
    const n = doc.splitTextToSize(inv.notes, w - 24);
    doc.text(n, 12, yy); yy += n.length * 4 + 2;
  } else {
    doc.setFont("helvetica", "normal").setFontSize(8);
    const defaults = [
      "Note: 1. WIRE FITTING CHARGES SHOULD BE EXTRA ON LABOUR BASIS, AS PER REQUIREMENT. (E.g. PIPE/OPEN/POP/CLIP FITMENTS, etc)",
      "        2. WIRE QUOTATION SHOULD BE VARIES (+/-) ON ACTUAL ON-SIGHT CONDITIONS.",
      "        3. GST ARE APPLICABLE AS FOLLOWING @18 % (SGST+CGST).",
    ];
    defaults.forEach((d) => {
      const wrapped = doc.splitTextToSize(d, w - 24);
      doc.text(wrapped, 12, yy); yy += wrapped.length * 4;
    });
    yy += 2;
  }

  doc.setFont("helvetica", "italic").setFontSize(8);
  doc.text("Your Happiness Is Our Priority, If Not Happy We Will Make It Right :)", w / 2, yy + 6, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text("Should you have any enquiries regarding this Quotation,", w / 2, yy + 11, { align: "center" });
  if (c.company_email)
    doc.text(`Please feel free to contact on ${c.company_phone || ""}, or ${c.company_email}`, w / 2, yy + 15, { align: "center" });
  doc.setFont("helvetica", "italic").setFontSize(7);
  doc.text("(Please read backpage for detailed T&C)", w / 2, yy + 20, { align: "center" });
}

// =================== PURCHASE ORDER (matches Image 4) ===================
function buildPurchaseOrder(doc: jsPDF, inv: DocLike, c: CompanySettings) {
  pageBorder(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = 12;
  doc.setFontSize(20).setFont("helvetica", "bold");
  doc.text((c.company_name || "RIBBON'S INFOTECH").toUpperCase(), 12, y + 6);
  doc.setFontSize(14);
  doc.text("PURCHASE NOTE", w - 12, y + 6, { align: "right" });
  y += 12;
  doc.line(10, y, w - 10, y); y += 4;

  // Customer info box (left) + Date/PO# (right)
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(10, y, w / 2 - 14, 6, "F");
  doc.text("CUSTOMER INFO", 12, y + 4);
  doc.setFont("helvetica", "normal");
  let ly = y + 10;
  doc.text(`To: ${inv.customer_name}`, 12, ly); ly += 4;
  if (inv.customer_address) { doc.text(inv.customer_address, 12, ly); ly += 4; }
  if (inv.customer_phone) { doc.text(`MOB: ${inv.customer_phone}`, 12, ly); ly += 4; }

  // Right info table
  autoTable(doc, {
    startY: y,
    margin: { left: w / 2 + 4, right: 10 },
    body: [
      ["DATE", inv.issued_date],
      ["P.O. #", inv.po_number || inv.doc_no],
      ["DELIVERY DATE", inv.delivery_date || "—"],
    ],
    theme: "grid",
    bodyStyles: { fontSize: 9, fontStyle: "bold" },
    columnStyles: { 0: { fillColor: [240, 240, 240], cellWidth: 35 } },
  });
  // @ts-expect-error lastAutoTable
  y = Math.max(ly, doc.lastAutoTable?.finalY || ly) + 4;

  autoTable(doc, {
    startY: y,
    head: [["SR NO", "QUANTITY", "DESCRIPTION", "AMOUNT"]],
    body: inv.line_items.map((it, i) => [String(i + 1), String(it.qty) + (it.unit ? " " + it.unit : ""), it.name, fmt(it.qty * it.price)]),
    theme: "grid",
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold" },
    columnStyles: { 0: { halign: "center", cellWidth: 16 }, 1: { halign: "center", cellWidth: 25 }, 3: { halign: "right" } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable
  let yy = (doc.lastAutoTable?.finalY || y) + 2;

  doc.setFillColor(220, 220, 220);
  doc.rect(10, yy, w - 20, 7, "F");
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("TOTAL (WITH TAX)", 14, yy + 5);
  doc.text(fmt(inv.total), w - 14, yy + 5, { align: "right" });
  yy += 12;

  // Confirmation text
  doc.setFont("helvetica", "normal").setFontSize(8);
  const confirm = "ALL THE DESCRIBED PRICES OF ABOVE PRODUCTS ARE ACCEPTABLE & WELL UNDERSTOOD TO ME, AND I CONFIRMED PURCHASE (P.O.) OF THIS PRODUCTS WITH ADVANCED AMOUNT OF TOTAL PAYMENT.";
  const cLines = doc.splitTextToSize(confirm, w - 24);
  doc.text(cLines, 12, yy); yy += cLines.length * 4 + 4;

  // Customer Name + Date + Signature row
  doc.text(`Customer Name: ${inv.customer_name}`, 12, yy);
  doc.text(`Date: ${inv.issued_date}`, w / 2 + 4, yy);
  doc.text("Sign:", w - 30, yy);
  yy += 6;

  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("THIS IS NOT TAX INVOICE", w / 2, yy + 4, { align: "center" });
  yy += 8;

  // Advance / Balance
  const balance = Math.max(0, inv.total - (inv.advanced_amount || 0));
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Advanced: ${rs(inv.advanced_amount || 0)}`, 12, yy + 4);
  doc.text(`Balance: ${rs(balance)}`, w / 2 + 4, yy + 4);
  doc.text(`TOTAL: ${rs(inv.total)}`, w - 12, yy + 4, { align: "right" });
  yy += 8;

  doc.setFont("helvetica", "italic").setFontSize(8);
  doc.text("Thank you !!", w / 2, yy + 4, { align: "center" });
  yy += 8;
  // dual footer
  doc.line(10, yy, w - 10, yy); yy += 4;
  doc.setFontSize(7);
  if (c.ho_address) doc.text(`MALEGAON: ${c.ho_address}`, 12, yy + 3);
  yy += 4;
  if (c.nashik_address) doc.text(`NASHIK: ${c.nashik_address}`, 12, yy + 3);
  yy += 4;
  doc.text(`PH: ${c.company_phone || ""}   |   ${c.company_email || ""}`, 12, yy + 3);
}

// ============= dispatch =============
export function generateDocPdf(inv: DocLike, c: CompanySettings = {}): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  if (inv.kind === "quotation") buildQuotation(doc, inv, c);
  else if (inv.kind === "purchase_order") buildPurchaseOrder(doc, inv, c);
  else {
    const t = inv.invoice_type || "gst_invoice";
    if (t === "cash_bill") buildCashBill(doc, inv, c);
    else if (t === "prioritization_bill") buildPrioritizationBill(doc, inv, c);
    else buildGstInvoice(doc, inv, c);
  }
  return doc;
}

export const downloadDocPdf = (inv: DocLike, c?: CompanySettings) => {
  generateDocPdf(inv, c).save(`${inv.doc_no}.pdf`);
};

// Backward compat — old code paths
export const downloadInvoicePdf = downloadDocPdf;
export const generateInvoicePdf = generateDocPdf;

export const emailInvoiceLink = (inv: DocLike, company?: CompanySettings): string => {
  const subject = encodeURIComponent(`${inv.kind === "invoice" ? "Invoice" : inv.kind === "quotation" ? "Quotation" : "Purchase Order"} ${inv.doc_no}`);
  const lines = [
    `Hi ${inv.customer_name},`,
    "",
    `Please find ${inv.doc_no} attached.`,
    `Total: Rs. ${Number(inv.total).toFixed(2)}`,
    inv.due_date ? `Due date: ${inv.due_date}` : "",
    "",
    "Thanks,",
    company?.company_name || "Ribbons Infotech",
  ].filter(Boolean).join("%0D%0A");
  return `mailto:${inv.customer_email || ""}?subject=${subject}&body=${lines}`;
};
