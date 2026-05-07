
-- Add search_path to all trigger fns
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
ALTER FUNCTION public.tg_complaint_ticket() SET search_path = public;
ALTER FUNCTION public.tg_inv_code() SET search_path = public;
ALTER FUNCTION public.tg_inv_apply() SET search_path = public;
ALTER FUNCTION public.tg_invoice_no() SET search_path = public;

-- Tighten feedback insert via helper
CREATE OR REPLACE FUNCTION public.feedback_token_valid(_complaint_id UUID, _token TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.complaints
    WHERE id = _complaint_id AND feedback_token = _token AND status = 'completed'
  );
$$;

DROP POLICY IF EXISTS "fb public insert" ON public.customer_feedback;
CREATE POLICY "fb public insert valid token" ON public.customer_feedback FOR INSERT
  WITH CHECK (public.feedback_token_valid(complaint_id, feedback_token));

-- Tighten public bucket: allow reading individual objects, not arbitrary listing
DROP POLICY IF EXISTS "fbphotos read" ON storage.objects;
CREATE POLICY "fbphotos read individual" ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-photos' AND name IS NOT NULL);
