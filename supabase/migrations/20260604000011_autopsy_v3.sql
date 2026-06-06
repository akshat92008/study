-- Autopsy V3: structured assessments, deterministic reports, Hermes learning memory,
-- and universal learning signals.

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  title text not null,
  assessment_type text not null check (assessment_type in (
    'mock_test', 'practice_test', 'worksheet', 'assignment', 'quiz', 'past_paper', 'custom'
  )),
  source text not null check (source in ('manual', 'pdf', 'csv', 'imported')),
  total_marks numeric null,
  scored_marks numeric null,
  duration_minutes integer null,
  taken_at timestamptz null,
  status text not null default 'draft' check (status in (
    'draft', 'extracting', 'needs_review', 'answers_pending', 'diagnosis_pending',
    'report_generating', 'report_ready', 'failed'
  )),
  extraction_status text null check (extraction_status in (
    'not_started', 'uploaded', 'extracting', 'needs_review', 'ready', 'failed', 'manual_entry_required'
  )),
  extraction_confidence numeric null check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_number integer not null,
  subject text null,
  topic text null,
  subtopic text null,
  question_text text null,
  options jsonb null,
  correct_answer text null,
  user_answer text null,
  status text not null default 'unknown' check (status in (
    'correct', 'incorrect', 'skipped', 'unattempted', 'unknown'
  )),
  marks_awarded numeric null,
  negative_marks numeric null,
  difficulty text null check (difficulty in ('easy', 'medium', 'hard', 'unknown')),
  source_page integer null,
  extraction_confidence numeric null check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  user_reviewed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, question_number)
);

create table if not exists public.mistake_diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid null references public.assessments(id) on delete cascade,
  question_id uuid null unique references public.assessment_questions(id) on delete cascade,
  manual_mistake_id uuid null,
  goal_id uuid null,
  subject text null,
  topic text null,
  mistake_type text not null default 'unknown' check (mistake_type in (
    'concept_gap', 'memory_gap', 'silly_error', 'calculation_error',
    'misread_question', 'time_pressure', 'poor_elimination', 'guessed',
    'weak_application', 'overthinking', 'lack_of_revision', 'unknown'
  )),
  user_reason text null,
  user_reason_category text null,
  ai_root_cause text null,
  final_root_cause text null,
  prevention_rule text null,
  fix_strategy text null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status text not null default 'pending_user_reason' check (status in (
    'pending_user_reason', 'analyzing', 'ready', 'fallback_used', 'failed'
  )),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- hermes_learning_memories: Legacy internal memory storage. 
-- Note: This is NOT the external Nous Hermes Agent.
create table if not exists public.hermes_learning_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  memory_type text not null check (memory_type in (
    'mistake_pattern', 'weak_topic', 'behavior_pattern', 'prevention_rule',
    'recovery_progress', 'confusion_signal', 'self_reported_weakness',
    'time_pressure_pattern', 'confidence_mismatch'
  )),
  subject text null,
  topic text null,
  pattern text not null,
  evidence_count integer not null default 1,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  prevention_rule text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  next_reminder_condition text null,
  source_refs jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'resolved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.autopsy_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null unique references public.assessments(id) on delete cascade,
  goal_id uuid null,
  report_json jsonb not null default '{}'::jsonb,
  summary_text text null,
  recoverable_marks_estimate numeric null,
  top_patterns jsonb not null default '[]'::jsonb,
  top_topics jsonb not null default '[]'::jsonb,
  status text not null default 'generating' check (status in ('generating', 'ready', 'fallback_used', 'failed')),
  generated_by text not null default 'deterministic' check (generated_by in ('deterministic', 'ai', 'hermes', 'mixed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  signal_type text not null check (signal_type in (
    'assessment_result', 'question_mistake', 'manual_mistake', 'chat_confusion',
    'revision_review', 'practice_attempt', 'source_upload', 'self_reflection',
    'task_completion'
  )),
  source_type text not null,
  source_id uuid null,
  subject text null,
  topic text null,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '{}'::jsonb,
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists assessments_user_created_idx on public.assessments(user_id, created_at desc);
create index if not exists assessments_user_status_idx on public.assessments(user_id, status);
create index if not exists assessments_user_goal_idx on public.assessments(user_id, goal_id);

create index if not exists assessment_questions_user_assessment_idx on public.assessment_questions(user_id, assessment_id);
create index if not exists assessment_questions_user_status_idx on public.assessment_questions(user_id, status);
create index if not exists assessment_questions_user_topic_idx on public.assessment_questions(user_id, subject, topic);

create index if not exists mistake_diagnoses_user_assessment_idx on public.mistake_diagnoses(user_id, assessment_id);
create index if not exists mistake_diagnoses_user_type_idx on public.mistake_diagnoses(user_id, mistake_type);
create index if not exists mistake_diagnoses_user_topic_idx on public.mistake_diagnoses(user_id, subject, topic);

create index if not exists hermes_learning_memories_user_idx on public.hermes_learning_memories(user_id);
create index if not exists hermes_learning_memories_user_status_idx on public.hermes_learning_memories(user_id, status);
create index if not exists hermes_learning_memories_user_subject_idx on public.hermes_learning_memories(user_id, subject);
create index if not exists hermes_learning_memories_user_topic_idx on public.hermes_learning_memories(user_id, topic);
create index if not exists hermes_learning_memories_user_type_idx on public.hermes_learning_memories(user_id, memory_type);
create index if not exists hermes_learning_memories_user_severity_idx on public.hermes_learning_memories(user_id, severity);
create index if not exists hermes_learning_memories_user_last_seen_idx on public.hermes_learning_memories(user_id, last_seen_at desc);

create index if not exists autopsy_reports_user_created_idx on public.autopsy_reports(user_id, created_at desc);
create index if not exists autopsy_reports_user_assessment_idx on public.autopsy_reports(user_id, assessment_id);

create index if not exists learning_signals_user_created_idx on public.learning_signals(user_id, created_at desc);
create index if not exists learning_signals_user_type_idx on public.learning_signals(user_id, signal_type);
create index if not exists learning_signals_user_topic_idx on public.learning_signals(user_id, subject, topic);

drop trigger if exists assessments_updated_at on public.assessments;
create trigger assessments_updated_at before update on public.assessments
  for each row execute function public.update_updated_at();

drop trigger if exists assessment_questions_updated_at on public.assessment_questions;
create trigger assessment_questions_updated_at before update on public.assessment_questions
  for each row execute function public.update_updated_at();

drop trigger if exists mistake_diagnoses_updated_at on public.mistake_diagnoses;
create trigger mistake_diagnoses_updated_at before update on public.mistake_diagnoses
  for each row execute function public.update_updated_at();

drop trigger if exists hermes_learning_memories_updated_at on public.hermes_learning_memories;
create trigger hermes_learning_memories_updated_at before update on public.hermes_learning_memories
  for each row execute function public.update_updated_at();

drop trigger if exists autopsy_reports_updated_at on public.autopsy_reports;
create trigger autopsy_reports_updated_at before update on public.autopsy_reports
  for each row execute function public.update_updated_at();

alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.mistake_diagnoses enable row level security;
alter table public.hermes_learning_memories enable row level security;
alter table public.autopsy_reports enable row level security;
alter table public.learning_signals enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assessments',
    'assessment_questions',
    'mistake_diagnoses',
    'hermes_learning_memories',
    'autopsy_reports',
    'learning_signals'
  ] loop
    execute format('drop policy if exists "%s_select_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id)', table_name, table_name);
    execute format('drop policy if exists "%s_insert_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id)', table_name, table_name);
    execute format('drop policy if exists "%s_update_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name, table_name);
    execute format('drop policy if exists "%s_delete_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id)', table_name, table_name);
  end loop;
end $$;

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
  v_consumers text[];
begin
  v_consumers := case p_type
    when 'CHAT_MESSAGE_PROCESSED' then array['chat_side_effect_engine', 'mind_agent']
    when 'CHAT_MESSAGE_CREATED' then array['chat_side_effect_engine', 'mind_agent']
    when 'CHAT_LEARNING_SIGNAL' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'command_agent', 'planner_agent']
    when 'CHAT_SESSION_SUMMARIZE' then array['chat_side_effect_engine']
    when 'MATERIAL_UPLOADED' then array['rag_agent']
    when 'MATERIAL_INGESTION_REQUESTED' then array['rag_agent']
    when 'MATERIAL_INGESTED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'RAG_QUERY_USED' then array['mind_agent']
    when 'RAG_CARD_CANDIDATE_CREATED' then array['memory_agent']
    when 'MIND_ACTION_REQUESTED' then array['mind_agent']
    when 'MIND_CONTEXT_REFRESHED' then array['mind_agent']
    when 'AUTOPSY_UPLOAD_RECEIVED' then array['autopsy_engine']
    when 'MOCK_TEST_UPLOADED' then array['autopsy_engine']
    when 'AUTOPSY_PROCESSING_COMPLETED' then array['autopsy_agent', 'planner_agent']
    when 'TEST_ANALYSIS_COMPLETED' then array['autopsy_agent', 'planner_agent', 'command_agent']
    when 'AUTOPSY_MISTAKE_EXTRACTED' then array['autopsy_agent']
    when 'AUTOPSY_MISTAKE_APPROVED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'AUTOPSY_MISTAKE_REJECTED' then array['autopsy_agent']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MOCK_TEST_ANALYZED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'AUTOPSY_V3_ASSESSMENT_CREATED' then array['autopsy_agent']
    when 'AUTOPSY_V3_QUESTIONS_UPSERTED' then array['autopsy_agent']
    when 'AUTOPSY_V3_REASONS_COLLECTED' then array['autopsy_agent']
    when 'AUTOPSY_V3_REPORT_READY' then array['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent']
    when 'HERMES_MEMORY_UPDATED' then array['memory_agent', 'planner_agent']
    when 'LEARNING_SIGNAL_INGESTED' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine', 'command_agent', 'planner_agent']
    when 'REVISION_CARD_REVIEWED' then array['memory_agent', 'atlas_agent', 'planner_agent']
    when 'REVISION_COMPLETED' then array['memory_agent', 'atlas_agent', 'planner_agent', 'command_agent']
    when 'MEMORY_CARD_CREATE_REQUESTED' then array['memory_agent']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine', 'command_agent', 'planner_agent']
    when 'ATLAS_MASTERY_UPDATE_REQUESTED' then array['atlas_agent']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine', 'command_agent', 'planner_agent']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'SESSION_CARD_COMPLETED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'SESSION_RECOMMENDATION_REQUESTED' then array['planner_agent']
    when 'SESSION_RECOMMENDATION_CREATED' then array['mind_agent']
    when 'LEARNER_STATE_CHANGED' then array['planner_agent', 'mind_agent']
    when 'PLANNER_REPLAN_REQUESTED' then array['planner_agent', 'command_agent']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine', 'command_engine']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'PRACTICE_ATTEMPT_SUBMITTED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'ONBOARDING_QUIZ_COMPLETE' then array['learning_state_engine', 'planner_agent', 'command_agent']
    when 'HERMES_MISTAKE_REVIEW_REQUESTED' then array['hermes_worker']
    when 'HERMES_SOURCE_PROCESS_REQUESTED' then array['hermes_worker']
    when 'HERMES_REVISION_QUALITY_REQUESTED' then array['hermes_worker']
    when 'HERMES_TRACE_REQUESTED' then array['hermes_worker']
    when 'HERMES_NEXT_ACTION_REQUESTED' then array['hermes_worker']
    else array[]::text[]
  end;

  if p_user_id is null or array_length(v_consumers, 1) is null then
    raise exception 'unsupported_event_type';
  end if;

  with inserted as (
    insert into public.event_queue (
      user_id, type, payload, idempotency_key, metadata, status, next_attempt_at
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
    unnest(v_consumers),
    'PENDING',
    now(),
    now()
  on conflict (event_id, consumer_name) do nothing;

  return v_event_id;
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
to service_role;
