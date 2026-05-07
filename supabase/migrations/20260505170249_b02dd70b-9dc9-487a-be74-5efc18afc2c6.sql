
-- Add purchase_order to invoice_kind enum
ALTER TYPE public.invoice_kind ADD VALUE IF NOT EXISTS 'purchase_order';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'converted';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partial';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'rejected';

-- Sequence for purchase orders
CREATE SEQUENCE IF NOT EXISTS public.po_seq START 1;

-- Update doc-no trigger to handle purchase_order
CREATE OR REPLACE FUNCTION public.tg_invoice_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.doc_no IS NULL OR NEW.doc_no = '' THEN
    IF NEW.kind = 'quotation' THEN
      NEW.doc_no := 'QUO-' || lpad(nextval('public.quote_seq')::TEXT,5,'0');
    ELSIF NEW.kind = 'purchase_order' THEN
      NEW.doc_no := 'PO-' || lpad(nextval('public.po_seq')::TEXT,5,'0');
    ELSE
      NEW.doc_no := 'INV-' || lpad(nextval('public.invoice_seq')::TEXT,5,'0');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add new columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type text DEFAULT 'gst_invoice',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS product_details text,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS po_date date,
  ADD COLUMN IF NOT EXISTS party_gstin text,
  ADD COLUMN IF NOT EXISTS company_gstin text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_rate numeric NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS sgst_rate numeric NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_no text,
  ADD COLUMN IF NOT EXISTS ifsc_code text,
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS source_quotation_id uuid,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS advanced_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_text text,
  ADD COLUMN IF NOT EXISTS company_name_override text;

-- Add document/company settings columns to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS company_name_alt text,
  ADD COLUMN IF NOT EXISTS ho_address text,
  ADD COLUMN IF NOT EXISTS nashik_address text,
  ADD COLUMN IF NOT EXISTS website_ho text,
  ADD COLUMN IF NOT EXISTS website_nashik text,
  ADD COLUMN IF NOT EXISTS gstin_nashik text,
  ADD COLUMN IF NOT EXISTS bank_name text DEFAULT 'Bank Of Maharashtra',
  ADD COLUMN IF NOT EXISTS account_no text DEFAULT '60225890080',
  ADD COLUMN IF NOT EXISTS ifsc_code text DEFAULT 'MAHB0000278',
  ADD COLUMN IF NOT EXISTS branch text DEFAULT 'Malegaon',
  ADD COLUMN IF NOT EXISTS terms_conditions text,
  ADD COLUMN IF NOT EXISTS customer_care_phone text,
  ADD COLUMN IF NOT EXISTS default_gst_rate numeric DEFAULT 18,
  ADD COLUMN IF NOT EXISTS default_cgst_rate numeric DEFAULT 9,
  ADD COLUMN IF NOT EXISTS default_sgst_rate numeric DEFAULT 9;

-- Add selling_price + hsn to inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS selling_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
