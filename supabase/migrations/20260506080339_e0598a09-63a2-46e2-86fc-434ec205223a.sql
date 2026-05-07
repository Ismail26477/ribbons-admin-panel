INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-pdfs', 'invoice-pdfs', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Invoice PDFs are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-pdfs');

CREATE POLICY "Authenticated can upload invoice PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-pdfs');

CREATE POLICY "Authenticated can update invoice PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoice-pdfs');