-- Migration: 20260530000006_rpc_security_lockdown.sql
-- Purpose: Complete security definer RPC lockdown for any missing functions

create or replace function public.update_learner_state_incrementally(
  p_user_id uuid,
  p_confidence_delta numeric,
  p_retention_delta numeric,
  p_velocity_delta int
) returns void as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  insert into public.learner_states (
    user_id,
    overall_confidence,
    estimated_retention,
    weekly_velocity,
    updated_at
  )
  values (
    p_user_id,
    greatest(0.0, least(1.0, 0.5 + p_confidence_delta)),
    greatest(0.0, least(1.0, 0.5 + p_retention_delta)),
    greatest(0, p_velocity_delta),
    now()
  )
  on conflict (user_id) do update
  set
    overall_confidence = greatest(0.0, least(1.0, public.learner_states.overall_confidence + p_confidence_delta)),
    estimated_retention = greatest(0.0, least(1.0, public.learner_states.estimated_retention + p_retention_delta)),
    weekly_velocity = greatest(0, public.learner_states.weekly_velocity + p_velocity_delta),
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;
