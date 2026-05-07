-- Technician tracking: locations + check-ins
CREATE TABLE IF NOT EXISTS public.technician_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  status text NOT NULL DEFAULT 'available',
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_loc_tech_time
  ON public.technician_locations (technician_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.technician_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL,
  complaint_id uuid,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_checkin_tech_time
  ON public.technician_checkins (technician_id, check_in_at DESC);

ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_checkins ENABLE ROW LEVEL SECURITY;

-- Locations: staff can read all; technician can insert their own
CREATE POLICY "loc read staff" ON public.technician_locations
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "loc insert own or am" ON public.technician_locations
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR EXISTS (SELECT 1 FROM public.technicians t WHERE t.id = technician_id AND t.user_id = auth.uid())
  );

-- Check-ins: staff read; technician insert/update their own; admin/manager full
CREATE POLICY "ci read staff" ON public.technician_checkins
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "ci insert own or am" ON public.technician_checkins
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR EXISTS (SELECT 1 FROM public.technicians t WHERE t.id = technician_id AND t.user_id = auth.uid())
  );

CREATE POLICY "ci update own or am" ON public.technician_checkins
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR EXISTS (SELECT 1 FROM public.technicians t WHERE t.id = technician_id AND t.user_id = auth.uid())
  );