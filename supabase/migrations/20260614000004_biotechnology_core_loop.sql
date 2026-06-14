-- Complete the goal -> source -> tutor -> mastery -> dashboard loop.

alter table public.study_materials
  drop constraint if exists study_materials_status_check;
alter table public.study_materials
  add constraint study_materials_status_check check (status in (
    'uploaded', 'queued', 'processing', 'parsed', 'embedding', 'ready',
    'failed', 'retryable_failed', 'needs_user_action', 'archived'
  ));

alter table public.study_materials
  add column if not exists last_error_code text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_finished_at timestamptz,
  add column if not exists last_processed_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists chunk_count integer not null default 0,
  add column if not exists embedding_count integer not null default 0,
  add column if not exists detected_subject text,
  add column if not exists detected_chapter text,
  add column if not exists goal_match_score numeric,
  add column if not exists mismatch_warning_acknowledged boolean not null default false;

alter table public.study_materials
  alter column goal_match_score type numeric using goal_match_score::numeric;

alter table public.study_material_chunks
  add column if not exists content text;
alter table public.study_material_chunks
  alter column text drop not null;

update public.study_material_chunks
set content = text
where content is null and text is not null;

update public.study_material_chunks
set text = content
where text is null and content is not null;

alter table public.tutor_question_attempts
  add column if not exists goal_id uuid references public.learning_goals(id) on delete cascade,
  add column if not exists mission_id uuid,
  add column if not exists microtarget_id uuid,
  add column if not exists question_id text,
  add column if not exists question_text text,
  add column if not exists expected_answer_points jsonb not null default '[]'::jsonb,
  add column if not exists score text,
  add column if not exists numeric_score numeric not null default 0,
  add column if not exists matched_points jsonb not null default '[]'::jsonb,
  add column if not exists missing_points jsonb not null default '[]'::jsonb,
  add column if not exists misconceptions jsonb not null default '[]'::jsonb,
  add column if not exists concept_tags text[] not null default '{}';

alter table public.tutor_question_attempts
  drop constraint if exists tutor_question_attempts_score_check;
alter table public.tutor_question_attempts
  add constraint tutor_question_attempts_score_check
  check (score is null or score in ('correct', 'partial', 'incorrect'));

create index if not exists tutor_attempts_goal_created_idx
  on public.tutor_question_attempts(user_id, goal_id, created_at desc);
create index if not exists tutor_attempts_question_idx
  on public.tutor_question_attempts(user_id, goal_id, question_id);

create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.learning_goals(id) on delete cascade,
  event_type text not null,
  concept_tags text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.concept_mastery
  alter column concept_id drop not null;
alter table public.concept_mastery
  add column if not exists goal_id uuid references public.learning_goals(id) on delete cascade,
  add column if not exists chapter_slug text,
  add column if not exists concept_tag text,
  add column if not exists correct_count integer not null default 0,
  add column if not exists partial_count integer not null default 0,
  add column if not exists incorrect_count integer not null default 0,
  add column if not exists last_practiced_at timestamptz,
  add column if not exists last_result text;

create unique index if not exists concept_mastery_goal_tag_unique
  on public.concept_mastery(user_id, goal_id, chapter_slug, concept_tag)
  where goal_id is not null and chapter_slug is not null and concept_tag is not null;
create index if not exists concept_mastery_goal_score_idx
  on public.concept_mastery(user_id, goal_id, mastery_score);

create table if not exists public.weak_area_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.learning_goals(id) on delete cascade,
  chapter_slug text not null,
  concept_tag text not null,
  severity text not null check (severity in ('active', 'urgent')),
  source_question_id uuid references public.tutor_question_attempts(id) on delete set null,
  missing_points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists weak_area_events_active_idx
  on public.weak_area_events(user_id, goal_id, created_at desc)
  where resolved_at is null;

alter table public.learning_events enable row level security;
alter table public.weak_area_events enable row level security;

drop policy if exists "Users manage own learning events" on public.learning_events;
create policy "Users manage own learning events"
  on public.learning_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own weak area events" on public.weak_area_events;
create policy "Users manage own weak area events"
  on public.weak_area_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.learning_events to authenticated;
grant select, insert, update, delete on public.weak_area_events to authenticated;
grant select, insert, update, delete on public.learning_events to service_role;
grant select, insert, update, delete on public.weak_area_events to service_role;
