-- Add premium profile fields to technicians
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS skills text[],
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS id_proof_type text,
  ADD COLUMN IF NOT EXISTS id_proof_number text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text;

-- Storage bucket for technician avatars (public for easy display)
INSERT INTO storage.buckets (id, name, public)
VALUES ('technician-avatars', 'technician-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tech avatars public read') THEN
    CREATE POLICY "tech avatars public read" ON storage.objects
      FOR SELECT USING (bucket_id = 'technician-avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tech avatars staff write') THEN
    CREATE POLICY "tech avatars staff write" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'technician-avatars' AND public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tech avatars staff update') THEN
    CREATE POLICY "tech avatars staff update" ON storage.objects
      FOR UPDATE USING (bucket_id = 'technician-avatars' AND public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tech avatars staff delete') THEN
    CREATE POLICY "tech avatars staff delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'technician-avatars' AND public.is_staff(auth.uid()));
  END IF;
END $$;