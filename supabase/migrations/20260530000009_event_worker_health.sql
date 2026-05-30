-- Migration: 20260530000009_event_worker_health.sql
-- Purpose: Fix event worker locks staying stuck forever if a worker crashes mid-process.

create or replace function public.acquire_event_leases(
  p_worker_id text,
  p_limit int,
  p_lease_timeout interval
) returns table (
  lock_id uuid,
  event_id uuid,
  consumer_name text,
  event_type text,
  event_payload jsonb,
  event_metadata jsonb,
  user_id uuid,
  retry_count int
) as $$
begin
  return query
  with available_locks as (
    select cl.id
    from public.consumer_locks cl
    where (
        -- Standard pending or scheduled retry
        (cl.status in ('PENDING', 'RETRY_SCHEDULED') and coalesce(cl.next_attempt_at, cl.next_retry_at, now()) <= now())
        or 
        -- Recover crashed workers (stuck in PROCESSING with expired lease)
        (cl.status = 'PROCESSING' and cl.lease_expires_at is not null and cl.lease_expires_at < now())
      )
      and cl.retry_count < 3
    order by cl.created_at asc
    limit p_limit
    for update skip locked
  ),
  updated_locks as (
    update public.consumer_locks cl
    set
      status = 'PROCESSING',
      worker_id = p_worker_id,
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at = now() + p_lease_timeout,
      updated_at = now()
    from available_locks al
    where cl.id = al.id
    returning cl.id, cl.event_id, cl.consumer_name, cl.retry_count
  ),
  touched_events as (
    update public.event_queue eq
    set
      status = 'PROCESSING',
      locked_by = p_worker_id,
      locked_at = now(),
      updated_at = now()
    from updated_locks ul
    where eq.id = ul.event_id
    returning eq.id
  )
  select
    ul.id,
    ul.event_id,
    ul.consumer_name,
    eq.type,
    eq.payload,
    eq.metadata,
    eq.user_id,
    ul.retry_count
  from updated_locks ul
  join public.event_queue eq on eq.id = ul.event_id;
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke execute on function public.acquire_event_leases(text, int, interval) from public, authenticated;
grant execute on function public.acquire_event_leases(text, int, interval) to service_role;
