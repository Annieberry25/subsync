-- ==========================================
-- Storage RLS policies for the receipts bucket.
--
-- storage.objects is owned by supabase_storage_admin, so neither the dashboard
-- SQL editor (role postgres) nor supabase db push can create policies on it:
--   ERROR: 42501: must be owner of table objects
--   ERROR: 42501: permission denied to set role "supabase_storage_admin"
--
-- The SQL below only works on projects where postgres has membership in
-- supabase_storage_admin. On supabase cloud this is typically NOT granted, so
-- use the Dashboard UI instead:
--
--   Dashboard → Storage → receipts → (bucket row) → "New policy"
--   Target roles: authenticated   Operations: SELECT / INSERT / DELETE
--   Policy overrides: reference bucket_id/folder checks below.
--
-- Equivalent UI policies (paste the expression into the USING / WITH CHECK box):
--   Name: receipts_read_own    SELECT  → USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
--   Name: receipts_write_own   INSERT  → WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
--   Name: receipts_delete_own  DELETE  → USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
--
-- Only run this file if you have confirmed postgres can switch to the storage
-- admin role.
-- ==========================================

BEGIN;

SET LOCAL ROLE supabase_storage_admin;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_read_own" ON storage.objects;
CREATE POLICY "receipts_read_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "receipts_write_own" ON storage.objects;
CREATE POLICY "receipts_write_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "receipts_delete_own" ON storage.objects;
CREATE POLICY "receipts_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

RESET ROLE;

COMMIT;