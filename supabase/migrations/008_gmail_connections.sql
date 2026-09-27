-- ==========================================
-- Migration 008: Real Gmail OAuth connections.
--
-- Replaces the simulated localStorage flag with a server-side record of the
-- user's authorized Gmail inbox. Tokens (access + refresh) are stored here and
-- are NEVER readable by the browser. All reads/writes happen server-side via
-- the service role (request auth comes from the Supabase session on the route).
-- ==========================================

CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  credentials JSONB NOT NULL,
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'revoked', 'error')),
  last_scan_at TIMESTAMPTZ,
  last_scan_status TEXT,
  last_scan_count INTEGER,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id
  ON public.gmail_connections (user_id);

DROP TRIGGER IF EXISTS update_gmail_connections_updated_at ON public.gmail_connections;
CREATE TRIGGER update_gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- No client-side policies: the browser never reads tokens or connection rows.
-- The status route answers membership questions via the service role using the
-- authenticated session, keeping tokens fully server-side.
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gmail_connections FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_connections TO service_role;