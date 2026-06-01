-- No-PULSE Cognition OS runtime hardening:
-- usage gates, deterministic semantic memory, episodic memory, and analytics baselines.

alter table public.ai_usage_daily
  add column if not exists chat_messages int not null default 0,
  add column if not exists tutor_messages int not null default 0,
  add column if not exists autopsy_uploads int not null default 0,
  add column if not exists ai_calls int not null default 0;

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
begin
  if p_gate not in ('chat_messages', 'tutor_messages', 'autopsy_uploads', 'ai_calls') then
    raise exception 'UNKNOWN_USAGE_GATE:%', p_gate;
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  v_used := case p_gate
    when 'chat_messages' then coalesce(v_usage.chat_messages, 0)
    when 'tutor_messages' then coalesce(v_usage.tutor_messages, 0)
    when 'autopsy_uploads' then coalesce(v_usage.autopsy_uploads, 0)
    when 'ai_calls' then coalesce(v_usage.ai_calls, 0)
  end;

  if v_used + v_amount > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'remaining', greatest(0, p_limit - v_used),
      'limit', p_limit
    );
  end if;

  update public.ai_usage_daily
  set
    chat_messages = case when p_gate = 'chat_messages' then chat_messages + v_amount else chat_messages end,
    tutor_messages = case when p_gate = 'tutor_messages' then tutor_messages + v_amount else tutor_messages end,
    autopsy_uploads = case when p_gate = 'autopsy_uploads' then autopsy_uploads + v_amount else autopsy_uploads end,
    ai_calls = case when p_gate = 'ai_calls' then ai_calls + v_amount else ai_calls end,
    updated_at = now()
  where id = v_usage.id;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used + v_amount,
    'remaining', greatest(0, p_limit - v_used - v_amount),
    'limit', p_limit
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.check_and_increment_usage_gate(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.check_and_increment_usage_gate(uuid, text, int, int) to service_role;

alter table public.chat_memory
  add column if not exists source_type text not null default 'global_chat',
  add column if not exists source_id text,
  add column if not exists role text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_chat_memory_source_dedupe
  on public.chat_memory(user_id, source_type, source_id, role)
  where source_id is not null;

create index if not exists idx_chat_memory_source_lookup
  on public.chat_memory(user_id, source_type, created_at desc);

drop function if exists public.match_chat_memory(vector, float, int, uuid);
drop function if exists public.match_chat_memory(vector(768), float, int, uuid);

create or replace function public.match_chat_memory(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
) returns table (
  id uuid,
  content text,
  similarity float,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    cm.id,
    cm.content,
    1 - (cm.embedding <=> query_embedding) as similarity,
    cm.created_at
  from public.chat_memory cm
  where cm.user_id = p_user_id
    and cm.embedding is not null
    and 1 - (cm.embedding <=> query_embedding) > match_threshold
  order by
    (1 - (cm.embedding <=> query_embedding)) desc,
    coalesce(cm.importance_score, cm.importance, 0) desc,
    cm.created_at desc
  limit match_count;
$$;

revoke execute on function public.match_chat_memory(vector(768), float, int, uuid) from public, anon;
grant execute on function public.match_chat_memory(vector(768), float, int, uuid) to authenticated, service_role;

create table if not exists public.episodic_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  source_type text not null,
  source_id text,
  importance_score numeric(4,2) not null default 0,
  emotional_salience numeric(4,2) not null default 0,
  retrieval_weight numeric(6,3) not null default 0,
  last_referenced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.episodic_memories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'episodic_memories'
      and policyname = 'Users access own episodic_memories'
  ) then
    create policy "Users access own episodic_memories"
      on public.episodic_memories for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create unique index if not exists idx_episodic_memory_source_dedupe
  on public.episodic_memories(user_id, source_type, source_id)
  where source_id is not null;

create index if not exists idx_episodic_memory_retrieval
  on public.episodic_memories(user_id, retrieval_weight desc, created_at desc);

alter table public.chat_messages
  add column if not exists prompt_version text;

alter table public.ai_usage_events
  add column if not exists prompt_version text;

create table if not exists public.outcome_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  mock_score numeric,
  subject_scores jsonb not null default '{}'::jsonb,
  recoverable_marks numeric,
  mastery_percent numeric,
  revision_consistency numeric,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, snapshot_date)
);

create table if not exists public.feature_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  chat_sessions int not null default 0,
  autopsy_uploads int not null default 0,
  revision_cards_reviewed int not null default 0,
  study_sessions_completed int not null default 0,
  tutor_turns int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, usage_date)
);

alter table public.outcome_snapshots enable row level security;
alter table public.feature_usage_daily enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['outcome_snapshots', 'feature_usage_daily'] loop
    execute format('drop policy if exists "Users access own %I" on public.%I', t, t);
    execute format(
      'create policy "Users access own %I" on public.%I for select using (auth.uid() = user_id)',
      t,
      t
    );
  end loop;
end $$;
