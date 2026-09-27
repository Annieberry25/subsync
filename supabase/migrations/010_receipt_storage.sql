-- ==========================================
-- Migration 010: Receipt scan usage + receipt file storage.
--
-- Three gaps closed here:
--
--  1. `bill_payments` is defined in the consolidated `supabase/schema.sql`
--     but never had its own migration, so a migration-only deployment was
--     missing the table entirely (including its `receipts` JSONB and `source`
--     columns). The idempotent block below is a no-op where the table already
--     exists, so existing deployments are unaffected.
--
--  2. `receipt_scan_usage` records each scan so the previously-unenforced
--     `maxReceiptScansPerMonth` plan limit can actually be applied. Rows are
--     written server-side only; the browser never reads or writes this table.
--
--  3. `receipts.storage` holds the actual uploaded file (PDF invoice or
--     screenshot) in Supabase Storage. Until now `receipts` was a JSONB
--     metadata array with no bytes behind it, so "attach a receipt" stored
--     nothing that could ever be opened again.
-- ==========================================

-- ---------- 0. Ensure bill_payments exists on migration-only deployments ----

CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  custom_category TEXT,
  provider_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  country TEXT DEFAULT 'Nigeria',
  region TEXT,
  city TEXT,
  payment_frequency TEXT CHECK (payment_frequency IN ('one_time', 'monthly', 'yearly', 'weekly', 'quarterly', 'custom')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  receipts JSONB,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt_scan', 'email_discovered')),
  provider_reference TEXT,
  official_provider_url TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON public.bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON public.bill_payments(payment_date);

-- ---------- 1. Scan usage counter ----------

CREATE TABLE IF NOT EXISTS public.receipt_scan_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload', 'paste', 'email', 'gmail')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_receipt_scan_usage_user_created
  ON public.receipt_scan_usage (user_id, created_at DESC);

ALTER TABLE public.receipt_scan_usage ENABLE ROW LEVEL SECURITY;

-- No client policies: quota accounting must not be client-writable.
REVOKE ALL ON public.receipt_scan_usage FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.receipt_scan_usage TO service_role;

-- ---------- 2. Receipt file storage ----------

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Owning record. Exactly one of these is set.
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  bill_payment_id UUID REFERENCES public.bill_payments(id) ON DELETE CASCADE,

  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),

  -- Extracted context, kept denormalised so the receipt list renders without
  -- re-running the parser.
  amount NUMERIC(14, 2),
  currency TEXT,
  provider TEXT,
  payment_date DATE,
  extraction_confidence JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT receipts_single_parent
    CHECK (num_nonnulls(subscription_id, bill_payment_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_subscription_path
  ON public.receipts (subscription_id, storage_path)
  WHERE subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_bill_path
  ON public.receipts (bill_payment_id, storage_path)
  WHERE bill_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts (user_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_select_own" ON public.receipts;
CREATE POLICY "receipts_select_own" ON public.receipts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "receipts_insert_own" ON public.receipts;
CREATE POLICY "receipts_insert_own" ON public.receipts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "receipts_update_own" ON public.receipts;
CREATE POLICY "receipts_update_own" ON public.receipts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "receipts_delete_own_rows" ON public.receipts;
CREATE POLICY "receipts_delete_own_rows" ON public.receipts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;

DROP TRIGGER IF EXISTS update_receipts_updated_at ON public.receipts;
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The bucket is private. Reads go through a signed URL minted server-side after
-- an ownership check, so a leaked path is not enough to read a receipt.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object keys are namespaced by user id. The RLS policies on storage.objects are
-- NOT applied in this file: storage.objects is owned by supabase_storage_admin,
-- while the dashboard SQL editor (and supabase db push) runs as postgres, which
-- errors with "must be owner of table objects" (SQLSTATE 42501).
--
-- Apply the companion file `010b_storage_object_policies.sql` to create them,
-- or add them via Dashboard → Storage → receipts → Policies.
