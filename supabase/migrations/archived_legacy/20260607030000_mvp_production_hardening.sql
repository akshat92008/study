-- 20260607030000_mvp_production_hardening.sql
-- Canonical migration to ensure production DB has all schema elements
-- required by the MVP learning loop. Safe to re-run — uses IF NOT EXISTS
-- for all DDL statements.

-- ============================================================
-- A. practice_attempts idempotency_key
-- ============================================================
alter table public.practice_attempts
  add column if not exists idempotency_key text;

create unique index if not exists practice_attempts_user_id_idempotency_key_idx
  on public.practice_attempts(user_id, idempotency_key)
  where idempotency_key is not null;

-- ============================================================
-- B. agent_actions title field
-- ============================================================
alter table public.agent_actions
  add column if not exists title text;

-- Backfill title for existing rows
update public.agent_actions
set title = case
  when agent_name = 'mind' then 'MIND observation'
  when agent_name = 'atlas' then 'ATLAS map update'
  when agent_name = 'memory' then 'MEMORY card created'
  when agent_name = 'planner' then 'PLANNER adapted session'
  when agent_name = 'command' then 'COMMAND mission updated'
  else agent_name || ' action'
end
where title is null;

-- ============================================================
-- C. Required profiles fields referenced by runtime code
-- ============================================================
alter table public.profiles
  add column if not exists streak_days integer not null default 0;

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- ============================================================
-- D. revision_cards origin and approval_status (if referenced)
-- ============================================================
alter table public.revision_cards
  add column if not exists origin text default 'manual'
  check (origin in ('manual', 'chat', 'autopsy', 'practice', 'source'));

alter table public.revision_cards
  add column if not exists approval_status text default 'approved'
  check (approval_status in ('approved', 'pending', 'rejected'));

-- ============================================================
-- E. session_cards repair phase fields
-- ============================================================
alter table if exists public.session_cards
  add column if not exists "targetMistakeId" uuid null,
  add column if not exists "targetRetestId" uuid null,
  add column if not exists "repairPhase" text null
  check ("repairPhase" in ('immediate_repair', 'delayed_retest'));

-- ============================================================
-- F. Ensure rag_ingestion_jobs table and policies exist
-- (Required by ingest logic in lib/rag/ingest.ts)
-- ============================================================
create table if not exists public.rag_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.study_materials(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'extracting', 'chunking', 'embedding', 'completed', 'failed')),
  idempotency_key text,
  error text,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rag_jobs_user_material
  on public.rag_ingestion_jobs(user_id, material_id);

create index if not exists idx_rag_jobs_idempotency
  on public.rag_ingestion_jobs(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.rag_ingestion_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rag_ingestion_jobs'
    and policyname = 'Users access own rag_ingestion_jobs'
  ) then
    create policy "Users access own rag_ingestion_jobs"
      on public.rag_ingestion_jobs for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- G. RAG query log for diagnostics
-- ============================================================
create table if not exists public.rag_query_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  material_ids uuid[],
  retrieved_chunk_ids uuid[],
  total_chunks integer default 0,
  total_context_chars integer default 0,
  grounded boolean default false,
  mode text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rag_query_logs_user_created
  on public.rag_query_logs(user_id, created_at desc);

alter table public.rag_query_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rag_query_logs'
    and policyname = 'Users access own rag_query_logs'
  ) then
    create policy "Users access own rag_query_logs"
      on public.rag_query_logs for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- H. Ensure study_material_chunks has correct columns
-- (Chunk content column — some schemas may have 'text', others 'content')
-- Create a view that aliases to 'content' for compatibility
-- ============================================================
do $$
begin
  -- If chunks table exists but has no 'content' column, rename 'text' to 'content'
  if exists (
    select 1 from information_schema.columns
    where table_name = 'study_material_chunks' and column_name = 'text'
    and not exists (
      select 1 from information_schema.columns
      where table_name = 'study_material_chunks' and column_name = 'content'
    )
  ) then
    alter table public.study_material_chunks rename column text to content;
  end if;
exception
  when undefined_column then
    raise notice 'Column text does not exist or content already present — skipping rename';
end $$;

-- ============================================================
-- I. Verify match_study_material_chunks RPC exists for RAG
-- Create if missing (fallback for keyword search)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'match_study_material_chunks'
    and pronamespace = (select oid from pg_namespace where nspname = 'public')
  ) then
    create or replace function public.match_study_material_chunks(
      query_embedding real[],
      match_user_id uuid,
      match_count int default 10,
      material_filter uuid[] default null,
      subject_filter text default null,
      chapter_filter text default null,
      similarity_threshold float default 0.5
    ) returns table(
      id uuid,
      material_id uuid,
      material_title text,
      source_type text,
      subject text,
      chapter text,
      heading text,
      page_start int,
      page_end int,
      text text,
      similarity float
    ) as $func$
    begin
      return query
      select
        smc.id,
        smc.material_id,
        sm.title as material_title,
        sm.source_type,
        sm.subject,
        sm.chapter,
        smc.heading,
        smc.page_start,
        smc.page_end,
        smc.content as text,
        1.0 as similarity
      from study_material_chunks smc
      join study_materials sm on sm.id = smc.material_id
      where smc.user_id = match_user_id
        and sm.status = 'ready'
        and (material_filter is null or smc.material_id = any(material_filter))
        and (subject_filter is null or sm.subject = subject_filter)
        and (chapter_filter is null or sm.chapter = chapter_filter)
        and smc.content ilike '%' || subject_filter || '%'
      order by smc.updated_at desc
      limit match_count;
    end;
    $func$ language plpgsql volatile security definer;
  end if;
end $$;

-- ============================================================
-- J. Ensure practice_items has concept_id and concept_name
-- ============================================================
alter table if exists public.practice_items
  add column if not exists concept_id uuid,
  add column if not exists concept_name text;

-- ============================================================
-- K. Ensure practice_sets has goal_id
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'practice_sets' and column_name = 'goal_id'
  ) then
    alter table public.practice_sets
      add column goal_id uuid references public.learning_goals(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- L. Ensure mistakes has normalized_key and repair fields
-- ============================================================
alter table if exists public.mistakes
  add column if not exists normalized_key text,
  add column if not exists concept text,
  add column if not exists mistake_text text,
  add column if not exists why_wrong text,
  add column if not exists exam_trap text,
  add column if not exists severity integer not null default 1,
  add column if not exists last_tested_at timestamptz,
  add column if not exists next_retest_at timestamptz,
  add column if not exists repaired_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_mistakes_user_status_retest
  on public.mistakes(user_id, status, next_retest_at);
create index if not exists idx_mistakes_user_concept_key
  on public.mistakes(user_id, normalized_key);

-- ============================================================
-- M. Ensure profiles has exam_type column
-- ============================================================
alter table if exists public.profiles
  add column if not exists exam_type text;

-- ============================================================
-- N. learning_goals needs these columns for session card logic
-- ============================================================
alter table if exists public.learning_goals
  add column if not exists target_level text,
  add column if not exists progress integer default 0;