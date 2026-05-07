-- 1) ETA share links
CREATE TABLE public.eta_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  technician_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(12), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eta_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eta read staff" ON public.eta_links
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "eta write am" ON public.eta_links
  FOR ALL USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Public token validity check (used for both eta_links lookup and tech location read)
CREATE OR REPLACE FUNCTION public.eta_token_valid(_token text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT technician_id FROM public.eta_links
  WHERE token = _token AND expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.eta_get_link(_token text)
RETURNS TABLE(complaint_id uuid, technician_id uuid, expires_at timestamptz, ticket_no text, customer_name text, customer_address text, technician_name text, technician_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.complaint_id, e.technician_id, e.expires_at,
         c.ticket_no, c.customer_name, c.customer_address,
         t.name, t.phone
  FROM public.eta_links e
  JOIN public.complaints c ON c.id = e.complaint_id
  JOIN public.technicians t ON t.id = e.technician_id
  WHERE e.token = _token AND e.expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.eta_get_location(_token text)
RETURNS TABLE(lat double precision, lng double precision, status text, address text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.lat, l.lng, l.status, l.address, l.created_at
  FROM public.technician_locations l
  WHERE l.technician_id = public.eta_token_valid(_token)
  ORDER BY l.created_at DESC
  LIMIT 1;
$$;

-- 2) AMC Contracts
CREATE TYPE public.amc_frequency AS ENUM ('monthly','quarterly','half_yearly','yearly');

CREATE TABLE public.amc_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  service_type text,
  frequency public.amc_frequency NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  next_service_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amc read staff" ON public.amc_contracts
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "amc write am" ON public.amc_contracts
  FOR ALL USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE TRIGGER amc_updated_at BEFORE UPDATE ON public.amc_contracts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Daily AMC processor
CREATE OR REPLACE FUNCTION public.process_amc_due()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; new_next date;
BEGIN
  FOR r IN
    SELECT * FROM public.amc_contracts
    WHERE active = true AND next_service_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
    INSERT INTO public.complaints (customer_name, customer_phone, customer_address, issue_type, description, source, priority)
    VALUES (r.customer_name, r.customer_phone, r.customer_address,
      COALESCE(r.service_type, 'AMC Service'),
      'Auto-generated from AMC contract', 'manual', 'normal');

    new_next := CASE r.frequency
      WHEN 'monthly' THEN r.next_service_date + interval '1 month'
      WHEN 'quarterly' THEN r.next_service_date + interval '3 months'
      WHEN 'half_yearly' THEN r.next_service_date + interval '6 months'
      WHEN 'yearly' THEN r.next_service_date + interval '1 year'
    END;

    UPDATE public.amc_contracts SET next_service_date = new_next WHERE id = r.id;
  END LOOP;
END; $$;