-- ==========================================
-- Migration 006: Supabase-backed persistence for activity log, AI chat
-- conversations, and inbox items.
--
-- Strategy (per product decision): Supabase is the source of truth and every
-- write goes straight to the DB. The apps keep a localStorage mirror as a
-- read fallback; there is NO pending-sync queue (offline writes are not
-- pushed later).
-- ==========================================

-- ------------------------------------------
-- 1. ACTIVITY LOG
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID,
  subscription_name TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14, 2),
  currency TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_time ON public.activity_log (user_id, timestamp DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity log"
  ON public.activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity log"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity log"
  ON public.activity_log FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity log"
  ON public.activity_log FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------
-- 2. AI CHAT CONVERSATIONS
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_time ON public.ai_conversations (user_id, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------
-- 3. INBOX ITEMS
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_favourited BOOLEAN NOT NULL DEFAULT false,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  action_type TEXT,
  action_label TEXT,
  subscription_name TEXT,
  subscription_price NUMERIC(14, 2),
  currency TEXT,
  provider_url TEXT,
  metadata JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_date ON public.inbox_items (user_id, date DESC);

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inbox items"
  ON public.inbox_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inbox items"
  ON public.inbox_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inbox items"
  ON public.inbox_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inbox items"
  ON public.inbox_items FOR DELETE
  USING (auth.uid() = user_id);