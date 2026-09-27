-- Postgres-backed rate limiter for the Edge middleware.
-- Replaces the throwaway in-memory Map with persistent sliding-window counters
-- so limits survive cold starts and apply across instances/regions.

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  bucket_start timestamptz not null,
  count bigint not null default 1,
  expires_at timestamptz not null,
  unique (bucket_key, bucket_start)
);

create index if not exists rate_limit_events_expires_at_idx on public.rate_limit_events (expires_at);

alter table public.rate_limit_events enable row level security;

create type public.rate_limit_result as (
  allowed boolean,
  retry_after_seconds integer,
  count bigint,
  limit_value integer
);

create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_window_seconds integer default 60,
  p_max_requests integer default 30
) returns public.rate_limit_result
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_seconds integer := greatest(p_window_seconds, 1);
  v_max_requests integer := greatest(p_max_requests, 1);
  v_bucket_start timestamptz;
  v_count bigint;
  v_expires_at timestamptz;
  v_result public.rate_limit_result;
begin
  -- Sliding window aligned to the epoch (works for any window size).
  select to_timestamp(floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds)
    into v_bucket_start;

  -- Opportunistic cleanup of expired buckets.
  delete from public.rate_limit_events where expires_at < v_now;

  -- Atomically increment the current bucket within this transaction.
  select count, expires_at
    into v_count, v_expires_at
    from public.rate_limit_events
   where bucket_key = p_bucket_key
     and bucket_start = v_bucket_start
   for update;

  if v_count is null then
    insert into public.rate_limit_events (bucket_key, bucket_start, count, expires_at)
    values (p_bucket_key, v_bucket_start, 1, v_bucket_start + make_interval(secs => v_window_seconds))
    returning count into v_count;
    v_expires_at := v_bucket_start + make_interval(secs => v_window_seconds);
  else
    update public.rate_limit_events
       set count = count + 1
     where bucket_key = p_bucket_key
       and bucket_start = v_bucket_start
    returning count into v_count;
  end if;

  v_result.allowed := v_count <= v_max_requests;
  v_result.retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (v_expires_at - v_now)))::integer
  );
  v_result.count := v_count;
  v_result.limit_value := v_max_requests;

  return v_result;
end;
$$;

-- RPC is the only access path: deny direct table access, allow the function.
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer)
  to anon, authenticated, service_role;
grant select, insert, update, delete on public.rate_limit_events to service_role;