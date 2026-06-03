-- Goal-scoped product context for Cognition OS.
-- Learning goals are the primary container; chat, sources, revision,
-- progress, mistakes, practice, and daily missions can all attach to a goal.

alter table if exists public.chat_sessions
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists is_primary_for_goal boolean not null default false;

alter table if exists public.chat_sessions
  drop constraint if exists chat_sessions_session_type_check;

alter table if exists public.chat_sessions
  add constraint chat_sessions_session_type_check
  check (session_type in ('global', 'thread', 'goal', 'quick', 'tutor', 'practice', 'onboarding'));

create index if not exists idx_chat_sessions_user_goal_updated
  on public.chat_sessions(user_id, goal_id, updated_at desc);

create unique index if not exists idx_chat_sessions_goal_primary
  on public.chat_sessions(user_id, goal_id)
  where is_primary_for_goal = true
    and goal_id is not null
    and archived_at is null;

create index if not exists idx_chat_sessions_user_archived_updated
  on public.chat_sessions(user_id, archived_at, updated_at desc);

alter table if exists public.learning_goals
  add column if not exists subject text,
  add column if not exists domain text,
  add column if not exists exam_type text,
  add column if not exists target_level text,
  add column if not exists description text,
  add column if not exists primary_chat_session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists last_active_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_learning_goals_user_status_last_active
  on public.learning_goals(user_id, status, last_active_at desc);

create index if not exists idx_learning_goals_primary_chat
  on public.learning_goals(primary_chat_session_id);

alter table if exists public.study_materials
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;

create index if not exists idx_study_materials_user_goal_status
  on public.study_materials(user_id, goal_id, status);

create index if not exists idx_study_materials_user_session
  on public.study_materials(user_id, chat_session_id);

alter table if exists public.revision_cards
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists source_message_id uuid references public.chat_messages(id) on delete set null;

create index if not exists idx_revision_cards_user_goal_due
  on public.revision_cards(user_id, goal_id, due);

create index if not exists idx_revision_cards_user_session_due
  on public.revision_cards(user_id, chat_session_id, due);

alter table if exists public.concepts
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;

create index if not exists idx_concepts_user_goal_mastery
  on public.concepts(user_id, goal_id, mastery);

create index if not exists idx_concepts_user_goal_score
  on public.concepts(user_id, goal_id, mastery_score);

alter table if exists public.mistakes
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;

create index if not exists idx_mistakes_user_goal_created
  on public.mistakes(user_id, goal_id, created_at desc);

alter table if exists public.mock_autopsies
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;

create index if not exists idx_mock_autopsies_user_goal_created
  on public.mock_autopsies(user_id, goal_id, created_at desc);

alter table if exists public.autopsy_jobs
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;

create index if not exists idx_autopsy_jobs_user_goal_created
  on public.autopsy_jobs(user_id, goal_id, created_at desc);

alter table if exists public.autopsy_questions
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;

create index if not exists idx_autopsy_questions_user_goal_created
  on public.autopsy_questions(user_id, goal_id, created_at desc);

alter table if exists public.practice_sets
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;

create index if not exists idx_practice_sets_user_goal_created
  on public.practice_sets(user_id, goal_id, created_at desc);

alter table if exists public.session_cards
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;

create index if not exists idx_session_cards_user_goal_date
  on public.session_cards(user_id, goal_id, date desc);

create unique index if not exists idx_session_cards_user_date_goal_not_null
  on public.session_cards(user_id, date, goal_id)
  where goal_id is not null;

alter table if exists public.daily_microtasks
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;

create index if not exists idx_daily_microtasks_user_goal_date
  on public.daily_microtasks(user_id, goal_id, task_date);

alter table if exists public.daily_plans
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;

create index if not exists idx_daily_plans_user_goal_date
  on public.daily_plans(user_id, goal_id, plan_date desc);
