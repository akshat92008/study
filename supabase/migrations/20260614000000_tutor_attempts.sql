create table if not exists public.tutor_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete cascade,
  question text not null,
  user_answer text not null,
  evaluation_result text not null,
  ai_feedback text,
  created_at timestamptz not null default now()
);

alter table public.tutor_question_attempts enable row level security;

drop policy if exists "Users can manage their own tutor attempts" on public.tutor_question_attempts;
create policy "Users can manage their own tutor attempts"
  on public.tutor_question_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_tutor_attempts_user_concept on public.tutor_question_attempts(user_id, concept_id);
