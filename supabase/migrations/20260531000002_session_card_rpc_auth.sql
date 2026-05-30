-- Migration: 20260531000002_session_card_rpc_auth.sql
-- Purpose: Lock down authenticated-callable session-card SECURITY DEFINER RPCs.

create or replace function public.complete_daily_session_card(
  p_user_id uuid,
  p_date date default current_date
) returns jsonb as $$
declare
  v_updated int;
  v_version int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  update public.session_cards
  set
    "isCompleted" = true,
    "completedAt" = now(),
    is_completed = true,
    completed_at = now()
  where user_id = p_user_id
    and date = p_date
    and ("isCompleted" = false or "isCompleted" is null);

  get diagnostics v_updated = row_count;

  update public.profiles
  set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    updated_at = now()
  where id = p_user_id
  returning learner_state_version into v_version;

  return jsonb_build_object(
    'updated', v_updated,
    'newVersion', v_version,
    'date', p_date
  );
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke execute on function public.complete_daily_session_card(uuid, date) from public;
grant execute on function public.complete_daily_session_card(uuid, date) to authenticated;

create or replace function public.invalidate_session_card(
  p_user_id uuid,
  p_reason text default 'manual_invalidation'
) returns jsonb as $$
declare
  v_version int;
  v_deleted int := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  get diagnostics v_deleted = row_count;

  update public.profiles
  set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    updated_at = now()
  where id = p_user_id
  returning learner_state_version into v_version;

  return jsonb_build_object(
    'deleted', v_deleted,
    'newVersion', v_version,
    'reason', p_reason
  );
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke execute on function public.invalidate_session_card(uuid, text) from public;
grant execute on function public.invalidate_session_card(uuid, text) to authenticated;
