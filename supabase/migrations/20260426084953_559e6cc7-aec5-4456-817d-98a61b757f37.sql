
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin','manager','accountant','technician');
CREATE TYPE public.complaint_status AS ENUM ('pending','assigned','in_progress','completed','reopened','cancelled');
CREATE TYPE public.complaint_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.complaint_source AS ENUM ('ivrs','manual','web');
CREATE TYPE public.tech_type AS ENUM ('full_time','on_call');
CREATE TYPE public.inv_txn_type AS ENUM ('issue','use','return','damage','restock');
CREATE TYPE public.expense_category AS ENUM ('salary','inventory','travel','utilities','rent','misc');
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','paid','overdue','cancelled');
CREATE TYPE public.invoice_kind AS ENUM ('quotation','invoice');

-- =========================================================================
-- UTIL: updated_at trigger function
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- USER ROLES (separate table — never on profiles)
-- =========================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('admin','manager','accountant','technician'));
$$;

-- =========================================================================
-- HANDLE NEW USER: create profile + give first user the admin role
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count INT;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO _count FROM public.user_roles;
  IF _count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- TECHNICIANS
-- =========================================================================
CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  type public.tech_type NOT NULL DEFAULT 'full_time',
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tech_updated BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- COMPLAINTS
-- =========================================================================
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  issue_type TEXT,
  description TEXT,
  status public.complaint_status NOT NULL DEFAULT 'pending',
  priority public.complaint_priority NOT NULL DEFAULT 'normal',
  source public.complaint_source NOT NULL DEFAULT 'manual',
  technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  rating INT,                                -- 1..5
  bonus_fast_arrival BOOLEAN NOT NULL DEFAULT FALSE,
  bonus_review BOOLEAN NOT NULL DEFAULT FALSE,
  bonus_selfie BOOLEAN NOT NULL DEFAULT FALSE,
  bonus_tools_return BOOLEAN NOT NULL DEFAULT FALSE,
  bonus_extra_work BOOLEAN NOT NULL DEFAULT FALSE,
  feedback_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_tech ON public.complaints(technician_id);

-- Auto ticket number
CREATE SEQUENCE IF NOT EXISTS public.complaint_seq START 1001;
CREATE OR REPLACE FUNCTION public.tg_complaint_ticket()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticket_no IS NULL OR NEW.ticket_no = '' THEN
    NEW.ticket_no := 'CMP-' || lpad(nextval('public.complaint_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_complaint_ticket BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_ticket();

-- =========================================================================
-- IVRS CALL LOGS
-- =========================================================================
CREATE TABLE public.ivrs_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT,
  caller_phone TEXT,
  digits TEXT,
  issue_type TEXT,
  raw_payload JSONB,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ivrs_call_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- ASSIGNMENT RULES
-- =========================================================================
CREATE TABLE public.assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_type TEXT,
  priority public.complaint_priority,
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- INVENTORY
-- =========================================================================
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT DEFAULT 'pcs',
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.inv_seq START 1;
CREATE OR REPLACE FUNCTION public.tg_inv_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
    n := nextval('public.inv_seq');
    NEW.item_code := 'RBN-' || lpad(n::TEXT,5,'0');
  END IF;
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := NEW.item_code;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_inv_code BEFORE INSERT ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_inv_code();

CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
  txn_type public.inv_txn_type NOT NULL,
  quantity INT NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Update item qty on txn
CREATE OR REPLACE FUNCTION public.tg_inv_apply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE delta INT := 0;
BEGIN
  IF NEW.txn_type IN ('use','damage','issue') THEN delta := -NEW.quantity;
  ELSIF NEW.txn_type IN ('return','restock') THEN delta := NEW.quantity;
  END IF;
  UPDATE public.inventory_items SET quantity = quantity + delta WHERE id = NEW.item_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_inv_apply AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_inv_apply();

-- =========================================================================
-- FACTORIES
-- =========================================================================
CREATE TABLE public.factories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  manager_name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_fact_updated BEFORE UPDATE ON public.factories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  units_produced INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- EXPENSES
-- =========================================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.expense_category NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor TEXT,
  description TEXT,
  bill_url TEXT,         -- storage path
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_exp_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- INVOICES & QUOTATIONS
-- =========================================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_no TEXT NOT NULL UNIQUE,
  kind public.invoice_kind NOT NULL DEFAULT 'invoice',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::JSONB,   -- [{description, qty, price}]
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 18,       -- GST default
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_inv2_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.quote_seq START 1;
CREATE OR REPLACE FUNCTION public.tg_invoice_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.doc_no IS NULL OR NEW.doc_no = '' THEN
    IF NEW.kind = 'quotation' THEN
      NEW.doc_no := 'QUO-' || lpad(nextval('public.quote_seq')::TEXT,5,'0');
    ELSE
      NEW.doc_no := 'INV-' || lpad(nextval('public.invoice_seq')::TEXT,5,'0');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoice_no BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_no();

-- =========================================================================
-- CUSTOMER FEEDBACK (public-writable via complaint feedback_token)
-- =========================================================================
CREATE TABLE public.customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  feedback_token TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  customer_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_feedback_complaint ON public.customer_feedback(complaint_id);

-- =========================================================================
-- POINT EVENTS (audit + payroll source)
-- =========================================================================
CREATE TABLE public.point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  points INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pe_tech ON public.point_events(technician_id);

-- =========================================================================
-- APP SETTINGS (single row, id=1)
-- =========================================================================
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  point_value_inr NUMERIC(8,2) NOT NULL DEFAULT 10,
  pts_urgent INT NOT NULL DEFAULT 20,
  pts_high INT NOT NULL DEFAULT 15,
  pts_normal INT NOT NULL DEFAULT 10,
  pts_low INT NOT NULL DEFAULT 5,
  pts_per_star INT NOT NULL DEFAULT 3,
  pts_fast_arrival INT NOT NULL DEFAULT 5,
  pts_review INT NOT NULL DEFAULT 5,
  pts_selfie INT NOT NULL DEFAULT 3,
  pts_tools_return INT NOT NULL DEFAULT 3,
  pts_extra_work INT NOT NULL DEFAULT 10,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  ivrs_api_key TEXT,
  company_name TEXT NOT NULL DEFAULT 'Ribbons Infotech Pvt. Ltd.',
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  gstin TEXT,
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                  -- NULL means broadcast to all staff
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  level TEXT NOT NULL DEFAULT 'info',   -- info | warn | error | success
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_user ON public.notifications(user_id, read);

-- =========================================================================
-- AUTO-AWARD POINTS WHEN COMPLAINT COMPLETED
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_complaint_award_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.app_settings%ROWTYPE; pts INT := 0; rb INT := 0; bb INT := 0;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.technician_id IS NOT NULL THEN
    SELECT * INTO s FROM public.app_settings WHERE id = 1;
    pts := CASE NEW.priority
      WHEN 'urgent' THEN s.pts_urgent
      WHEN 'high' THEN s.pts_high
      WHEN 'normal' THEN s.pts_normal
      WHEN 'low' THEN s.pts_low END;
    INSERT INTO public.point_events (technician_id, complaint_id, reason, points)
      VALUES (NEW.technician_id, NEW.id, 'completion-' || NEW.priority, pts);

    IF NEW.rating IS NOT NULL AND NEW.rating > 2 THEN
      rb := (NEW.rating - 2) * s.pts_per_star;
      INSERT INTO public.point_events (technician_id, complaint_id, reason, points)
        VALUES (NEW.technician_id, NEW.id, 'rating-bonus', rb);
    END IF;

    IF NEW.bonus_fast_arrival THEN bb := bb + s.pts_fast_arrival;
      INSERT INTO public.point_events (technician_id, complaint_id, reason, points)
        VALUES (NEW.technician_id, NEW.id, 'fast-arrival', s.pts_fast_arrival); END IF;
    IF NEW.bonus_review THEN bb := bb + s.pts_review;
      INSERT INTO public.point_events (technician_id, complaint_id, reason, points)
        VALUES (NEW.technician_id, NEW.id, 'review-taken', s.pts_review); END IF;
    IF NEW.bonus_selfie THEN bb := bb + s.pts_selfie;
      INSERT INTO public.point_events (technician_id, complaint_id, reason, points)
        VALUES (NEW.technician_id, NEW.id, 'selfie', s.pts_selfie); END IF;
    IF NEW.bonus_tools_return THEN bb := bb + s.pts_tools_return;
      INSERT INTO public.point_events (technician_id, complaint_id, reason, points)
        VALUES (NEW.technician_id, NEW.id, 'tools-return', s.pts_tools_return); END IF;
    IF NEW.bonus_extra_work THEN bb := bb + s.pts_extra_work;
      INSERT INTO public.point_events (technician_id, complaint_id, reason, points)
        VALUES (NEW.technician_id, NEW.id, 'extra-work', s.pts_extra_work); END IF;

    UPDATE public.technicians SET total_points = total_points + pts + rb + bb
      WHERE id = NEW.technician_id;
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_complaint_points BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_award_points();

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- profiles: users see/edit own; staff see all
CREATE POLICY "profiles select own or staff" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- user_roles: any authenticated user can read their own roles; admins manage
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- technicians: staff read; admin/manager write
CREATE POLICY "tech read staff" ON public.technicians FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "tech write am" ON public.technicians FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- complaints: admin/manager all; technicians only their own; accountant read
CREATE POLICY "complaints read" ON public.complaints FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accountant')
    OR EXISTS (SELECT 1 FROM public.technicians t WHERE t.id = complaints.technician_id AND t.user_id = auth.uid())
  );
CREATE POLICY "complaints write am" ON public.complaints FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "complaints update tech own" ON public.complaints FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.technicians t WHERE t.id = complaints.technician_id AND t.user_id = auth.uid()));

-- ivrs_call_logs: staff read
CREATE POLICY "ivrs read staff" ON public.ivrs_call_logs FOR SELECT
  USING (public.is_staff(auth.uid()));

-- assignment_rules
CREATE POLICY "rules read staff" ON public.assignment_rules FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "rules write am" ON public.assignment_rules FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- inventory
CREATE POLICY "inv read staff" ON public.inventory_items FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "inv write am" ON public.inventory_items FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "invtxn read staff" ON public.inventory_transactions FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "invtxn insert staff" ON public.inventory_transactions FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));

-- factories
CREATE POLICY "fact read staff" ON public.factories FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "fact write am" ON public.factories FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "prod read staff" ON public.production_logs FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "prod write am" ON public.production_logs FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- expenses: admin & accountant
CREATE POLICY "exp read aa" ON public.expenses FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));
CREATE POLICY "exp write aa" ON public.expenses FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));

-- invoices: admin/manager/accountant
CREATE POLICY "inv2 read amac" ON public.invoices FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'accountant'));
CREATE POLICY "inv2 write amac" ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'accountant'));

-- customer_feedback: PUBLIC can insert (token enforced in code), staff read
CREATE POLICY "fb public insert" ON public.customer_feedback FOR INSERT
  WITH CHECK (TRUE);
CREATE POLICY "fb staff read" ON public.customer_feedback FOR SELECT
  USING (public.is_staff(auth.uid()));

-- point_events: staff read; system writes via trigger (security definer)
CREATE POLICY "pe read staff" ON public.point_events FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "pe insert am" ON public.point_events FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- app_settings: staff read; admin write
CREATE POLICY "set read staff" ON public.app_settings FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "set write admin" ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- notifications: own + broadcast read; system writes
CREATE POLICY "notif read" ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR (user_id IS NULL AND public.is_staff(auth.uid())));
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() OR (user_id IS NULL AND public.is_staff(auth.uid())));

-- =========================================================================
-- STORAGE BUCKETS
-- =========================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('bills','bills', false),
  ('proofs','proofs', false),
  ('feedback-photos','feedback-photos', true)
ON CONFLICT DO NOTHING;

-- bills: admin/accountant read+write
CREATE POLICY "bills read" ON storage.objects FOR SELECT
  USING (bucket_id = 'bills' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')));
CREATE POLICY "bills write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bills' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')));

-- proofs: staff read+write
CREATE POLICY "proofs read" ON storage.objects FOR SELECT
  USING (bucket_id = 'proofs' AND public.is_staff(auth.uid()));
CREATE POLICY "proofs write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proofs' AND public.is_staff(auth.uid()));

-- feedback-photos: public read; public insert (token-gated in code)
CREATE POLICY "fbphotos read" ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-photos');
CREATE POLICY "fbphotos write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feedback-photos');
