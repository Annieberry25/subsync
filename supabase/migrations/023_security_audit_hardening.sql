-- =============================================================================
-- Migration 023: Security Audit Hardening
-- =============================================================================
-- 1. Restrict public.check_rate_limit RPC to service_role only (F-05)
-- 2. Lock down public.profiles column-level UPDATE privileges so full_name must
--    route through public.update_user_name (30-day cooldown) and email cannot
--    be spoofed via PostgREST, plus sync auth.users email updates (F-04, F-08)
-- 3. Enforce MFA (aal2) on public.is_admin() and public.set_user_admin(), add
--    FOR UPDATE locking against last-admin TOCTOU race, and forbid self-demotion
--    in SQL (F-02, F-16)
-- 4. Enforce storage_path prefix and foreign-key ownership in public.receipts
--    INSERT/UPDATE RLS policies (F-17)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rate-limit RPC: service_role only
-- ---------------------------------------------------------------------------
revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Profiles column-level privilege hardening + auth.users email sync
-- ---------------------------------------------------------------------------
revoke update (
  id,
  email,
  full_name,
  created_at,
  is_admin,
  plan_tier,
  plan_expires_at
) on public.profiles from anon, authenticated;

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email,
           updated_at = timezone('utc'::text, now())
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth();

-- ---------------------------------------------------------------------------
-- 3. Admin helpers: MFA (aal2) enforcement, self-demotion guard & row locking
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select p.is_admin
        from public.profiles p
       where p.id = auth.uid()
         and (
           not exists (
             select 1
               from auth.mfa_factors mf
              where mf.user_id = auth.uid()
                and mf.status = 'verified'
           )
           or coalesce(auth.jwt()->>'aal', '') = 'aal2'
         )
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.set_user_admin(
  target_user_id uuid,
  make_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin privileges required'
      using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot change your own admin role.'
      using errcode = '22023';
  end if;

  if make_admin = false then
    -- Lock all current admin rows to serialize concurrent demotions and
    -- prevent two admins from demoting each other simultaneously.
    perform 1
       from public.profiles
      where is_admin = true
        for update;

    select count(*) into admin_count
      from public.profiles
     where is_admin = true
       and id <> target_user_id;

    if admin_count < 1 then
      raise exception 'Cannot remove the last admin account.'
        using errcode = '22023';
    end if;
  end if;

  update public.profiles
     set is_admin = make_admin,
         updated_at = timezone('utc'::text, now())
   where id = target_user_id;
end;
$$;

revoke all on function public.set_user_admin(uuid, boolean) from public, anon;
grant execute on function public.set_user_admin(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Receipts RLS: enforce storage_path folder prefix and FK ownership
-- ---------------------------------------------------------------------------
drop policy if exists "receipts_insert_own" on public.receipts;
create policy "receipts_insert_own"
  on public.receipts
  for insert
  with check (
    user_id = auth.uid()
    and (
      storage_path is null
      or storage_path like (auth.uid()::text || '/%')
    )
    and (
      subscription_id is null
      or exists (
        select 1
          from public.subscriptions s
         where s.id = subscription_id
           and s.user_id = auth.uid()
      )
    )
    and (
      bill_payment_id is null
      or exists (
        select 1
          from public.bill_payments b
         where b.id = bill_payment_id
           and b.user_id = auth.uid()
      )
    )
  );

drop policy if exists "receipts_update_own" on public.receipts;
create policy "receipts_update_own"
  on public.receipts
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      storage_path is null
      or storage_path like (auth.uid()::text || '/%')
    )
    and (
      subscription_id is null
      or exists (
        select 1
          from public.subscriptions s
         where s.id = subscription_id
           and s.user_id = auth.uid()
      )
    )
    and (
      bill_payment_id is null
      or exists (
        select 1
          from public.bill_payments b
         where b.id = bill_payment_id
           and b.user_id = auth.uid()
      )
    )
  );

