-- ============================================================================
-- ROW LEVEL SECURITY — Defense in depth
-- ============================================================================

-- Enable RLS on all user-data tables
alter table profiles enable row level security;
alter table concepts enable row level security;
alter table concept_links enable row level security;
alter table revision_cards enable row level security;
alter table revision_logs enable row level security;
alter table mock_autopsies enable row level security;
alter table mistakes enable row level security;
alter table study_tasks enable row level security;
alter table study_goals enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table chat_memory enable row level security;
alter table materials enable row level security;
alter table material_chunks enable row level security;
alter table student_models enable row level security;
alter table learner_states enable row level security;
alter table performance_snapshots enable row level security;
alter table events enable row level security;
alter table event_consumers enable row level security;

-- ============================================================================
-- GENERIC USER-OWNED POLICY GENERATOR
-- ============================================================================
do $$
declare
  t text;
  user_tables text[] := array[
    'profiles','concepts','concept_links','revision_cards','revision_logs',
    'mock_autopsies','mistakes','study_tasks','study_goals',
    'chat_sessions','chat_messages','chat_memory',
    'materials','material_chunks',
    'student_models','learner_states','performance_snapshots','events'
  ];
begin
  foreach t in array user_tables loop
    -- SELECT
    execute format('
      create policy "%I_select_own" on %I
      for select using (auth.uid() = user_id);
    ', t, t);
    
    -- INSERT
    execute format('
      create policy "%I_insert_own" on %I
      for insert with check (auth.uid() = user_id);
    ', t, t);
    
    -- UPDATE
    execute format('
      create policy "%I_update_own" on %I
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    ', t, t);
    
    -- DELETE
    execute format('
      create policy "%I_delete_own" on %I
      for delete using (auth.uid() = user_id);
    ', t, t);
  end loop;
end$$;

-- ============================================================================
-- EVENT_CONSUMERS — special policy (joins via events)
-- ============================================================================
create policy "event_consumers_select_own" on event_consumers
  for select using (
    exists (
      select 1 from events
      where events.id = event_consumers.event_id
      and events.user_id = auth.uid()
    )
  );

-- ============================================================================
-- HYBRID SEARCH RPC (SECURITY DEFINER — but checks user_id)
-- ============================================================================
create or replace function match_chat_memory(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5,
  p_user_id uuid default null
)
returns table (
  id uuid,
  content text,
  summary text,
  similarity float,
  importance float,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Enforce: must pass user_id, must match auth.uid()
  if p_user_id is null or p_user_id != auth.uid() then
    raise exception 'Unauthorized: user_id mismatch';
  end if;

  return query
  select
    cm.id,
    cm.content,
    cm.summary,
    1 - (cm.embedding <=> query_embedding) as similarity,
    cm.importance,
    cm.created_at
  from chat_memory cm
  where cm.user_id = p_user_id
    and cm.embedding is not null
    and 1 - (cm.embedding <=> query_embedding) > match_threshold
  order by cm.embedding <=> query_embedding
  limit match_count;
end;
$$;

grant execute on function match_chat_memory to authenticated;

-- Similar for material_chunks
create or replace function match_material_chunks(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5,
  p_user_id uuid default null
)
returns table (
  id uuid,
  material_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id != auth.uid() then
    raise exception 'Unauthorized: user_id mismatch';
  end if;

  return query
  select
    mc.id, mc.material_id, mc.content,
    1 - (mc.embedding <=> query_embedding) as similarity,
    mc.metadata
  from material_chunks mc
  where mc.user_id = p_user_id
    and mc.embedding is not null
    and 1 - (mc.embedding <=> query_embedding) > match_threshold
  order by mc.embedding <=> query_embedding
  limit match_count;
end;
$$;

grant execute on function match_material_chunks to authenticated;
