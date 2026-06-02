-- Migration: 20260602000200_ai_rate_limit_hardening.sql
-- Purpose: Add hourly chat caps and expensive operations daily caps.

alter table public.ai_usage_daily
  add column if not exists chat_messages_hourly int not null default 0,
  add column if not exists last_chat_hour timestamptz not null default date_trunc('hour', now()),
  add column if not exists expensive_operations int not null default 0;

create or replace function public.check_and_increment_usage_gate(
  p_user_id uuid,
  p_gate text,
  p_limit int,
  p_amount int default 1
) returns jsonb as $$
declare
  v_usage public.ai_usage_daily%rowtype;
  v_amount int := greatest(1, coalesce(p_amount, 1));
  v_used int;
  v_current_hour timestamptz := date_trunc('hour', now());
begin
  if p_gate not in ('chat_messages', 'chat_messages_hourly', 'tutor_messages', 'autopsy_uploads', 'ai_calls', 'expensive_operations') then
    raise exception 'UNKNOWN_USAGE_GATE:%', p_gate;
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if p_gate = 'chat_messages_hourly' then
    if v_usage.last_chat_hour < v_current_hour then
      v_used := 0;
    else
      v_used := coalesce(v_usage.chat_messages_hourly, 0);
    end if;
  else
    v_used := case p_gate
      when 'chat_messages' then coalesce(v_usage.chat_messages, 0)
      when 'tutor_messages' then coalesce(v_usage.tutor_messages, 0)
      when 'autopsy_uploads' then coalesce(v_usage.autopsy_uploads, 0)
      when 'ai_calls' then coalesce(v_usage.ai_calls, 0)
      when 'expensive_operations' then coalesce(v_usage.expensive_operations, 0)
    end;
  end if;

  if v_used + v_amount > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'remaining', greatest(0, p_limit - v_used),
      'limit', p_limit
    );
  end if;

  if p_gate = 'chat_messages_hourly' then
    update public.ai_usage_daily
    set
      chat_messages_hourly = v_used + v_amount,
      last_chat_hour = v_current_hour,
      updated_at = now()
    where id = v_usage.id;
  else
    update public.ai_usage_daily
    set
      chat_messages = case when p_gate = 'chat_messages' then chat_messages + v_amount else chat_messages end,
      tutor_messages = case when p_gate = 'tutor_messages' then tutor_messages + v_amount else tutor_messages end,
      autopsy_uploads = case when p_gate = 'autopsy_uploads' then autopsy_uploads + v_amount else autopsy_uploads end,
      ai_calls = case when p_gate = 'ai_calls' then ai_calls + v_amount else ai_calls end,
      expensive_operations = case when p_gate = 'expensive_operations' then expensive_operations + v_amount else expensive_operations end,
      updated_at = now()
    where id = v_usage.id;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used + v_amount,
    'remaining', greatest(0, p_limit - v_used - v_amount),
    'limit', p_limit
  );
end;
$$ language plpgsql security definer set search_path = public;
