-- Canonical MVP schema alignment.
-- This migration is intentionally additive/idempotent so a fresh database and an
-- already-migrated database converge on the same runtime contract.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists exam_type text,
  add column if not exists streak_days int default 0,
  add column if not exists last_active_at timestamptz,
  add column if not exists current_level text,
  add column if not exists timezone text default 'UTC';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'exam'
  ) then
    execute 'update public.profiles set exam_type = coalesce(exam_type, exam)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'current_streak'
  ) then
    execute 'update public.profiles set streak_days = coalesce(streak_days, current_streak, 0)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'last_active_date'
  ) then
    execute 'update public.profiles set last_active_at = coalesce(last_active_at, last_active_date::timestamptz)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Learning goals
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'study_goals'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'learning_goals'
  ) then
    alter table public.study_goals rename to learning_goals;
  end if;
end $$;

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  target_completion_date timestamptz,
  current_level text,
  preferred_learning_style text,
  daily_hours_available int,
  roadmap jsonb,
  milestones jsonb,
  progress float default 0,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.learning_goals
  add column if not exists target_completion_date timestamptz,
  add column if not exists current_level text,
  add column if not exists preferred_learning_style text,
  add column if not exists daily_hours_available int,
  add column if not exists milestones jsonb,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_learning_goals_user_status
  on public.learning_goals(user_id, status);

alter table public.learning_goals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'learning_goals' and policyname = 'Users access own learning_goals'
  ) then
    create policy "Users access own learning_goals"
      on public.learning_goals for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ATLAS concepts and links
-- ---------------------------------------------------------------------------
alter table public.concepts
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists mastery text,
  add column if not exists confidence text default 'low',
  add column if not exists forgetting_probability float default 1.0,
  add column if not exists times_reviewed float default 0,
  add column if not exists times_correct float default 0,
  add column if not exists times_incorrect float default 0,
  add column if not exists version int default 1;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery'
  ) then
    execute 'alter table public.concepts alter column mastery type text using mastery::text';
  end if;
end $$;

do $$
declare
  v_mastery_tier text;
  v_mastery_level text;
  v_exposure_count text;
  v_correct_count text;
begin
  v_mastery_tier := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery_tier'
  ) then 'mastery_tier' else 'null::text' end;

  v_mastery_level := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery_level'
  ) then 'mastery_level' else 'null::numeric' end;

  v_exposure_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'exposure_count'
  ) then 'exposure_count' else '0' end;

  v_correct_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'correct_count'
  ) then 'correct_count' else '0' end;

  execute format($sql$
    update public.concepts
    set mastery = coalesce(
      mastery::text,
      (case
        when %1$s::text in ('weak') then 'exposed'
        when %1$s::text in ('developing', 'proficient', 'mastered') then %1$s::text
        when %2$s::numeric >= 0.85 then 'mastered'
        when %2$s::numeric >= 0.60 then 'proficient'
        when %2$s::numeric >= 0.25 then 'developing'
        when %2$s::numeric > 0 then 'exposed'
        else 'not_started'
      end)::text
    )
  $sql$, v_mastery_tier, v_mastery_level);

  execute format($sql$
    update public.concepts
    set
      times_reviewed = coalesce(times_reviewed, %1$s, 0),
      times_correct = coalesce(times_correct, %2$s, 0),
      times_incorrect = coalesce(times_incorrect, greatest(coalesce(%1$s, 0) - coalesce(%2$s, 0), 0)),
      forgetting_probability = coalesce(forgetting_probability, 1.0),
      confidence = coalesce(confidence, 'low')
  $sql$, v_exposure_count, v_correct_count);
end $$;

create index if not exists idx_concepts_user_mastery
  on public.concepts(user_id, mastery);
create index if not exists idx_concepts_forgetting
  on public.concepts(user_id, forgetting_probability desc);

create table if not exists public.mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  old_mastery text,
  new_mastery text not null,
  source text not null,
  source_id text,
  evidence text,
  created_at timestamptz default now()
);

create index if not exists idx_mastery_events_user
  on public.mastery_events(user_id, created_at desc);
create index if not exists idx_mastery_events_concept
  on public.mastery_events(concept_id, created_at desc);

alter table public.mastery_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mastery_events' and policyname = 'Users access own mastery_events'
  ) then
    create policy "Users access own mastery_events"
      on public.mastery_events for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.concept_links
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists source_concept_id uuid,
  add column if not exists target_concept_id uuid;

do $$
declare
  v_from_concept text;
  v_to_concept text;
begin
  v_from_concept := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concept_links' and column_name = 'from_concept_id'
  ) then 'from_concept_id' else 'source_concept_id' end;

  v_to_concept := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concept_links' and column_name = 'to_concept_id'
  ) then 'to_concept_id' else 'target_concept_id' end;

  execute format($sql$
    update public.concept_links
    set
      source_concept_id = coalesce(source_concept_id, %1$s),
      target_concept_id = coalesce(target_concept_id, %2$s)
  $sql$, v_from_concept, v_to_concept);
end $$;

-- ---------------------------------------------------------------------------
-- MEMORY revision cards
-- ---------------------------------------------------------------------------
alter table public.revision_cards
  add column if not exists due timestamptz,
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists elapsed_days int default 0,
  add column if not exists scheduled_days int default 0,
  add column if not exists reps int default 0,
  add column if not exists lapses int default 0,
  add column if not exists last_review timestamptz,
  add column if not exists forgetting_probability float default 1.0;

do $$
declare
  v_due_at text;
  v_last_review_at text;
  v_review_count text;
  v_lapse_count text;
begin
  v_due_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'due_at'
  ) then 'due_at' else 'due' end;

  v_last_review_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'last_review_at'
  ) then 'last_review_at' else 'last_review' end;

  v_review_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'review_count'
  ) then 'review_count' else '0' end;

  v_lapse_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'lapse_count'
  ) then 'lapse_count' else '0' end;

  execute format($sql$
    update public.revision_cards
    set
      due = coalesce(due, %1$s),
      last_review = coalesce(last_review, %2$s),
      reps = coalesce(reps, %3$s, 0),
      lapses = coalesce(lapses, %4$s, 0)
  $sql$, v_due_at, v_last_review_at, v_review_count, v_lapse_count);
end $$;

alter table public.revision_cards drop constraint if exists revision_cards_state_check;

do $$
declare
  state_type text;
begin
  select data_type into state_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'state';

  if state_type <> 'integer' then
    execute $sql$
      alter table public.revision_cards
        alter column state drop default,
        alter column state type int using (
          case
            when state ~ '^[0-9]+$' then state::int
            when state = 'new' then 0
            when state = 'learning' then 1
            when state = 'review' then 2
            when state = 'relearning' then 3
            when state = 'suspended' then 4
            else 0
          end
        ),
        alter column state set default 0
    $sql$;
  else
    alter table public.revision_cards alter column state set default 0;
  end if;
end $$;

alter table public.revision_cards
  add constraint revision_cards_state_check check (state between 0 and 4);

drop index if exists idx_revision_cards_due;
create index if not exists idx_revision_cards_due
  on public.revision_cards(user_id, due)
  where state <> 4;

create table if not exists public.revision_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.revision_cards(id) on delete cascade,
  rating int not null check (rating between 1 and 4),
  prev_stability float,
  new_stability float,
  prev_difficulty float,
  new_difficulty float,
  review_duration_ms int,
  reviewed_at timestamptz default now()
);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'revision_logs') then
    alter table public.revision_logs
      add column if not exists elapsed_days int,
      add column if not exists scheduled_days int,
      add column if not exists state int,
      add column if not exists response_time_ms int,
      add column if not exists created_at timestamptz default now();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AUTOPSY tables
-- ---------------------------------------------------------------------------
alter table public.mock_autopsies
  add column if not exists exam_type text,
  add column if not exists total_questions int default 0,
  add column if not exists correct_count int default 0,
  add column if not exists incorrect_count int default 0,
  add column if not exists unattempted_count int default 0,
  add column if not exists current_score numeric default 0,
  add column if not exists recoverable_marks numeric default 0,
  add column if not exists potential_score numeric default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mock_autopsies' and column_name = 'exam'
  ) then
    execute 'update public.mock_autopsies set exam_type = coalesce(exam_type, exam)';
  end if;
end $$;

create table if not exists public.autopsy_questions (
  id uuid primary key default gen_random_uuid(),
  autopsy_id uuid not null references public.mock_autopsies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  question_number int not null,
  subject text,
  chapter text,
  subtopic text,
  difficulty text,
  status text not null default 'Unattempted',
  question_text text,
  correct_answer text,
  student_answer text,
  mistake_category text,
  reasoning text,
  marks_lost numeric default 0,
  ocr_confidence numeric,
  created_at timestamptz default now()
);

alter table public.autopsy_questions
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists subtopic text,
  add column if not exists difficulty text,
  add column if not exists status text default 'Unattempted',
  add column if not exists question_text text,
  add column if not exists correct_answer text,
  add column if not exists student_answer text,
  add column if not exists mistake_category text,
  add column if not exists reasoning text,
  add column if not exists marks_lost numeric default 0,
  add column if not exists ocr_confidence numeric,
  add column if not exists created_at timestamptz default now();

create index if not exists idx_autopsy_questions_autopsy
  on public.autopsy_questions(autopsy_id, question_number);
create index if not exists idx_autopsy_questions_user
  on public.autopsy_questions(user_id, created_at desc);

alter table public.autopsy_questions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'autopsy_questions' and policyname = 'Users access own autopsy_questions'
  ) then
    create policy "Users access own autopsy_questions"
      on public.autopsy_questions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.mistakes drop constraint if exists mistakes_category_check;
alter table public.mistakes
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists topic text,
  add column if not exists total_marks numeric default 0,
  add column if not exists time_spent_seconds int,
  add column if not exists ai_analysis text,
  add column if not exists improvement_suggestion text,
  add column if not exists is_recurring boolean default false,
  add column if not exists occurrence_count int default 1;

-- ---------------------------------------------------------------------------
-- COMMAND study sessions and cards
-- ---------------------------------------------------------------------------
alter table public.study_sessions
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.study_sessions
  add column if not exists date date default current_date,
  add column if not exists completed_at timestamptz,
  add column if not exists topic text,
  add column if not exists concept_name text,
  add column if not exists understood boolean default false,
  add column if not exists gap_found text,
  add column if not exists cards_created int default 0,
  add column if not exists session_type text default 'study',
  add column if not exists is_completed boolean default false,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists summary text;

update public.study_sessions
set date = coalesce(ended_at, started_at, created_at)::date
where date is null;

create index if not exists idx_study_sessions_user_date
  on public.study_sessions(user_id, date);

-- ---------------------------------------------------------------------------
-- MIND tutor session state
-- ---------------------------------------------------------------------------
alter table public.tutor_sessions
  add column if not exists current_state text default 'DIAGNOSTIC',
  add column if not exists misconception_detected text,
  add column if not exists turns_count int default 0,
  add column if not exists is_completed boolean default false;

create index if not exists idx_tutor_sessions_active
  on public.tutor_sessions(user_id, is_completed, created_at desc);

-- ---------------------------------------------------------------------------
-- Student model durability
-- ---------------------------------------------------------------------------
alter table public.student_models
  add column if not exists chronic_weaknesses jsonb,
  add column if not exists fatigue_threshold_minutes int default 45,
  add column if not exists peak_productivity_hour int default 10,
  add column if not exists last_updated timestamptz,
  add column if not exists last_updated_at timestamptz;

do $$
declare
  v_type text;
begin
  select data_type into v_type from information_schema.columns
  where table_schema = 'public' and table_name = 'student_models' and column_name = 'chronic_weaknesses';
  
  if v_type is not null and v_type <> 'jsonb' then
    execute 'alter table public.student_models alter column chronic_weaknesses type jsonb using to_jsonb(chronic_weaknesses)';
  end if;
end $$;

do $$
declare
  v_weaknesses text;
  v_last_inferred_at text;
  v_updated_at text;
begin
  v_weaknesses := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_models' and column_name = 'weaknesses'
  ) then 'to_jsonb(weaknesses)' else 'null::jsonb' end;

  v_last_inferred_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_models' and column_name = 'last_inferred_at'
  ) then 'last_inferred_at' else 'null::timestamptz' end;

  v_updated_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_models' and column_name = 'updated_at'
  ) then 'updated_at' else 'null::timestamptz' end;

  execute format($sql$
    update public.student_models
    set
      chronic_weaknesses = coalesce(chronic_weaknesses, %1$s),
      last_updated = coalesce(last_updated, %2$s, %3$s),
      last_updated_at = coalesce(last_updated_at, last_updated, %2$s, %3$s)
  $sql$, v_weaknesses, v_last_inferred_at, v_updated_at);
end $$;

alter table public.learner_states
  add column if not exists state_type text default 'aggregate',
  add column if not exists overall_confidence numeric default 0.5,
  add column if not exists estimated_retention numeric default 0.5,
  add column if not exists weekly_velocity int default 0,
  add column if not exists updated_at timestamptz default now();

with ranked as (
  select
    id,
    row_number() over (partition by user_id, state_type order by created_at desc) as rn
  from public.learner_states
)
delete from public.learner_states ls
using ranked
where ls.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists idx_learner_states_user_state_type_unique
  on public.learner_states(user_id, state_type);

create or replace function public.update_learner_state_incrementally(
  p_user_id uuid,
  p_confidence_delta numeric,
  p_retention_delta numeric,
  p_velocity_delta int
) returns void as $$
begin
  insert into public.learner_states (
    user_id,
    state_type,
    state_value,
    overall_confidence,
    estimated_retention,
    weekly_velocity,
    confidence,
    updated_at
  )
  values (
    p_user_id,
    'aggregate',
    '{}'::jsonb,
    greatest(0.0, least(1.0, 0.5 + p_confidence_delta)),
    greatest(0.0, least(1.0, 0.5 + p_retention_delta)),
    greatest(0, p_velocity_delta),
    1.0,
    now()
  )
  on conflict (user_id, state_type) do update
  set
    overall_confidence = greatest(0.0, least(1.0, public.learner_states.overall_confidence + p_confidence_delta)),
    estimated_retention = greatest(0.0, least(1.0, public.learner_states.estimated_retention + p_retention_delta)),
    weekly_velocity = greatest(0, public.learner_states.weekly_velocity + p_velocity_delta),
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Durable global chat and long-term memory
-- ---------------------------------------------------------------------------
alter table public.chat_sessions
  add column if not exists session_type text default 'global',
  add column if not exists is_global boolean default false;

alter table public.chat_sessions
  drop constraint if exists chat_sessions_session_type_check;

with ranked as (
  select
    id,
    row_number() over (partition by user_id order by updated_at desc nulls last, created_at desc) as rn
  from public.chat_sessions
  where session_type = 'global'
)
update public.chat_sessions cs
set session_type = 'archived'
from ranked
where cs.id = ranked.id
  and ranked.rn > 1;

update public.chat_sessions
set is_global = (session_type = 'global');

create unique index if not exists idx_chat_sessions_one_global
  on public.chat_sessions(user_id)
  where session_type = 'global';

alter table public.chat_messages
  add column if not exists token_count int,
  add column if not exists estimated_cost numeric default 0;

alter table public.chat_memory drop constraint if exists chat_memory_memory_type_check;
alter table public.chat_memory
  add column if not exists source text default 'chat',
  add column if not exists importance_score numeric,
  add column if not exists novelty_score numeric,
  add column if not exists emotional_score numeric,
  add column if not exists learning_score numeric,
  add column if not exists repetition_score numeric,
  add column if not exists memory_type text default 'episodic',
  add column if not exists updated_at timestamptz default now(),
  add constraint chat_memory_memory_type_check
    check (memory_type in (
      'episodic',
      'semantic',
      'procedural',
      'learner_profile',
      'concept_gap',
      'mistake_pattern',
      'preference',
      'goal',
      'behavioral_pattern'
    ));

-- ---------------------------------------------------------------------------
-- Event locking/retry fields
-- ---------------------------------------------------------------------------
alter table public.event_queue
  add column if not exists retry_count int default 0,
  add column if not exists next_attempt_at timestamptz default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_error text;

alter table public.consumer_locks
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_error text;

alter table public.event_dlq
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists event_type text,
  add column if not exists event_metadata jsonb default '{}'::jsonb,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_notes text;

update public.consumer_locks
set next_attempt_at = coalesce(next_attempt_at, next_retry_at);

-- ---------------------------------------------------------------------------
-- Daily AI usage accounting
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  chat_calls int default 0,
  autopsy_calls int default 0,
  image_calls int default 0,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  total_tokens int default 0,
  estimated_cost numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_usage_daily' and policyname = 'Users view own ai_usage_daily'
  ) then
    create policy "Users view own ai_usage_daily"
      on public.ai_usage_daily for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Canonical event enqueue and leasing functions
-- ---------------------------------------------------------------------------
create or replace function public.create_event_with_consumers(
  p_user_id uuid,
  p_type text,
  p_data jsonb,
  p_idempotency_key text,
  p_source text,
  p_metadata jsonb
) returns uuid as $$
declare
  v_event_id uuid;
begin
  with inserted as (
    insert into public.event_queue (
      user_id,
      type,
      payload,
      idempotency_key,
      metadata,
      status,
      next_attempt_at
    ) values (
      p_user_id,
      p_type,
      coalesce(p_data, '{}'::jsonb),
      p_idempotency_key,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', coalesce(p_source, 'system')),
      'PENDING',
      now()
    )
    on conflict (idempotency_key) do nothing
    returning id
  )
  select id into v_event_id from inserted;

  if v_event_id is null then
    select id into v_event_id
    from public.event_queue
    where idempotency_key = p_idempotency_key;
    return v_event_id;
  end if;

  insert into public.consumer_locks (
    event_id,
    consumer_name,
    status,
    next_retry_at,
    next_attempt_at
  )
  select
    v_event_id,
    unnest(array[
      'learning_state_engine',
      'atlas_engine',
      'memory_engine',
      'command_engine',
      'concept_expansion_engine',
      'chat_side_effect_engine'
    ]::text[]),
    'PENDING',
    now(),
    now()
  on conflict (event_id, consumer_name) do nothing;

  return v_event_id;
end;
$$ language plpgsql volatile security definer set search_path = public;

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
    where cl.status in ('PENDING', 'RETRY_SCHEDULED')
      and coalesce(cl.next_attempt_at, cl.next_retry_at, now()) <= now()
      and (cl.lease_expires_at is null or cl.lease_expires_at < now())
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
