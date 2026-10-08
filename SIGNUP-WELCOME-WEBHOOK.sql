-- Signup welcome email webhook
--
-- Run this ENTIRE script once in the Supabase SQL Editor
-- (Supabase Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- It:
--   1. Enables pg_net (the async-HTTP extension). Ignore this line if already enabled.
--   2. Creates function public.notify_signup_welcome() which POSTs each new
--      auth.users row to the app at https://subhalt.xyz/api/webhooks/supabase.
--   3. Creates trigger welcome_on_auth_user_created so the function runs on every
--      new signup.
--
-- The x-webhook-secret header MUST exactly match the SUPABASE_WEBHOOK_SECRET
-- environment variable set in Vercel.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_signup_welcome()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://subhalt.xyz/api/webhooks/supabase',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '08d0308ef51cefa08d3d13dd3df2f8e8af6e3b225b108a0d6a36a702bcdcf1fd'
    ),
    body := jsonb_build_object(
      'type', format('INSERT:%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME),
      'table', TG_TABLE_NAME,
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists welcome_on_auth_user_created on auth.users;

create trigger welcome_on_auth_user_created
after insert on auth.users
for each row execute function public.notify_signup_welcome();