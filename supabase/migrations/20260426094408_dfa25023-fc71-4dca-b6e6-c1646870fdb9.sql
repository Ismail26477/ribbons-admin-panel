-- 1. Attach existing trigger functions to their tables ----------------------

-- Auto-generate ticket numbers + award points on completion
DROP TRIGGER IF EXISTS trg_complaint_ticket ON public.complaints;
CREATE TRIGGER trg_complaint_ticket
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_ticket();

DROP TRIGGER IF EXISTS trg_complaint_award_points ON public.complaints;
CREATE TRIGGER trg_complaint_award_points
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_award_points();

DROP TRIGGER IF EXISTS trg_complaints_updated_at ON public.complaints;
CREATE TRIGGER trg_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Inventory: auto-codes + stock movements
DROP TRIGGER IF EXISTS trg_inv_code ON public.inventory_items;
CREATE TRIGGER trg_inv_code
BEFORE INSERT ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.tg_inv_code();

DROP TRIGGER IF EXISTS trg_inv_updated_at ON public.inventory_items;
CREATE TRIGGER trg_inv_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_inv_apply ON public.inventory_transactions;
CREATE TRIGGER trg_inv_apply
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_inv_apply();

-- Invoices: doc_no + updated_at
DROP TRIGGER IF EXISTS trg_invoice_no ON public.invoices;
CREATE TRIGGER trg_invoice_no
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_no();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- updated_at on the rest
DROP TRIGGER IF EXISTS trg_techs_updated_at ON public.technicians;
CREATE TRIGGER trg_techs_updated_at
BEFORE UPDATE ON public.technicians
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_factories_updated_at ON public.factories;
CREATE TRIGGER trg_factories_updated_at
BEFORE UPDATE ON public.factories
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- New user → profile + role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Notification triggers ---------------------------------------------------

-- New / urgent complaints
CREATE OR REPLACE FUNCTION public.tg_notify_new_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (title, body, level, link)
  VALUES (
    CASE WHEN NEW.priority = 'urgent' THEN '🚨 URGENT complaint' ELSE 'New complaint' END,
    COALESCE(NEW.ticket_no,'') || ' — ' || COALESCE(NEW.customer_phone,'') ||
      CASE WHEN NEW.issue_type IS NOT NULL THEN ' • ' || NEW.issue_type ELSE '' END,
    CASE WHEN NEW.priority = 'urgent' THEN 'urgent'
         WHEN NEW.priority = 'high' THEN 'warning' ELSE 'info' END,
    '/complaints'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_complaint ON public.complaints;
CREATE TRIGGER trg_notify_new_complaint
AFTER INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_complaint();

-- Assignment changes
CREATE OR REPLACE FUNCTION public.tg_notify_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tech_user_id uuid; tech_name text;
BEGIN
  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id AND NEW.technician_id IS NOT NULL THEN
    SELECT user_id, name INTO tech_user_id, tech_name
      FROM public.technicians WHERE id = NEW.technician_id;
    INSERT INTO public.notifications (user_id, title, body, level, link)
    VALUES (
      tech_user_id,
      'New complaint assigned to you',
      COALESCE(NEW.ticket_no,'') || ' • ' || COALESCE(NEW.issue_type,'General') ||
        ' (' || NEW.priority::text || ')',
      'info',
      '/complaints'
    );
    INSERT INTO public.notifications (title, body, level, link)
    VALUES (
      'Complaint assigned',
      COALESCE(NEW.ticket_no,'') || ' → ' || COALESCE(tech_name,'technician'),
      'info',
      '/complaints'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_assignment_change ON public.complaints;
CREATE TRIGGER trg_notify_assignment_change
AFTER UPDATE OF technician_id ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_assignment_change();

-- Low-stock alerts
CREATE OR REPLACE FUNCTION public.tg_notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE threshold INT;
BEGIN
  threshold := COALESCE(NEW.low_stock_threshold,
                       (SELECT low_stock_threshold FROM public.app_settings WHERE id = 1), 5);
  IF NEW.quantity <= threshold AND (OLD.quantity IS NULL OR OLD.quantity > threshold) THEN
    INSERT INTO public.notifications (title, body, level, link)
    VALUES (
      '⚠️ Low stock',
      NEW.name || ' (' || NEW.item_code || ') — ' || NEW.quantity || ' ' || COALESCE(NEW.unit,'pcs') || ' left',
      'warning',
      '/inventory'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.inventory_items;
CREATE TRIGGER trg_notify_low_stock
AFTER INSERT OR UPDATE OF quantity ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_low_stock();

-- 3. Realtime ----------------------------------------------------------------
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.complaints   REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Allow staff inserts to notifications (so the IVRS function & seed scripts can write) ---
DROP POLICY IF EXISTS "notif insert staff" ON public.notifications;
CREATE POLICY "notif insert staff"
ON public.notifications FOR INSERT
WITH CHECK (is_staff(auth.uid()) OR auth.uid() IS NULL);
