-- Migration: 20260530000008_atomic_ai_budget.sql
-- Purpose: Combine AI budget check and spend into a single atomic transaction.

create or replace function public.atomic_ai_budget_spend(
  p_user_id uuid,
  p_feature text,
  p_model text,
  p_cost numeric,
  p_prompt_tokens int,
  p_completion_tokens int,
  p_route text,
  p_daily_limit_usd numeric default 0.25
) returns void as $$
declare
  v_usage public.ai_usage_daily%rowtype;
  v_cost numeric := greatest(coalesce(p_cost, 0), 0);
  v_prompt int := greatest(coalesce(p_prompt_tokens, 0), 0);
  v_completion int := greatest(coalesce(p_completion_tokens, 0), 0);
  v_total int := v_prompt + v_completion;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if coalesce(v_usage.estimated_cost, 0) + v_cost > p_daily_limit_usd then
    update public.ai_usage_daily
    set budget_exceeded_count = coalesce(budget_exceeded_count, 0) + 1,
        updated_at = now()
    where id = v_usage.id;
    raise exception 'AI_DAILY_BUDGET_EXCEEDED';
  end if;

  insert into public.ai_usage_logs (
    user_id,
    usage_date,
    feature,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost,
    route,
    metadata
  ) values (
    p_user_id,
    current_date,
    p_feature,
    p_model,
    v_prompt,
    v_completion,
    v_total,
    v_cost,
    p_route,
    jsonb_build_object('type', 'atomic_spend')
  );

  update public.ai_usage_daily
  set estimated_cost = coalesce(estimated_cost, 0) + v_cost,
      estimated_tokens = coalesce(estimated_tokens, 0) + v_total,
      updated_at = now()
  where id = v_usage.id;

end;
$$ language plpgsql volatile security definer set search_path = public;

-- Revoke and grant as needed
revoke execute on function public.atomic_ai_budget_spend(uuid, text, text, numeric, int, int, text, numeric) from public, authenticated;
grant execute on function public.atomic_ai_budget_spend(uuid, text, text, numeric, int, int, text, numeric) to service_role;
