-- ==========================================
-- Migration 002: add subscription metadata columns.
-- The app (database.types.ts + subscription-modal.tsx) expects end_date,
-- account_links, receipts, and is_synced on public.subscriptions.
-- ==========================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS account_links JSONB,
  ADD COLUMN IF NOT EXISTS receipts JSONB,
  ADD COLUMN IF NOT EXISTS is_synced BOOLEAN;