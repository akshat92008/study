-- Repair loop: canonical mistake/risk object, delayed retests, and
-- idempotent keys for "never lose the same mark twice".

alter table if exists public.mistakes
  add column if not exists concept text,
  add column if not exists mistake_text text,
  add column if not exists why_wrong text,
  add column if not exists exam_trap text,
  add column if not exists severity integer not null default 1,
  add column if not exists last_tested_at timestamptz,
  add column if not exists next_retest_at timestamptz,
  add column if not exists repaired_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists normalized_key text;

update public.mistakes
set
  concept = coalesce(nullif(concept, ''), nullif(topic, ''), nullif(chapter, ''), nullif(category, ''), 'Unclassified concept'),
  mistake_text = coalesce(nullif(mistake_text, ''), nullif(question_text, ''), nullif(ai_analysis, ''), 'Unspecified mistake'),
  why_wrong = coalesce(nullif(why_wrong, ''), nullif(ai_analysis, ''), nullif(improvement_suggestion, '')),
  severity = greatest(coalesce(severity, 1), 1),
  status = case
    when status in ('corrected_by_user') or recovered = true then 'repaired'
    when status in ('rejected') then 'ignored'
    when status in ('pending_review', 'verified_mistake') or status is null then 'open'
    else status
  end,
  repaired_at = case
    when repaired_at is not null then repaired_at
    when recovered_at is not null then recovered_at
    when recovered = true then now()
    else null
  end,
  updated_at = coalesce(updated_at, created_at, now()),
  normalized_key = coalesce(
    normalized_key,
    encode(
      digest(
        coalesce(public.normalize_academic_text(coalesce(concept, topic, chapter, category, '')), '') || chr(10) ||
        coalesce(public.normalize_academic_text(coalesce(mistake_text, question_text, ai_analysis, '')), ''),
        'sha256'
      ),
      'hex'
    )
  )
where concept is null
   or mistake_text is null
   or status in ('pending_review', 'verified_mistake', 'rejected', 'corrected_by_user')
   or normalized_key is null;

alter table if exists public.mistakes
  alter column concept set not null,
  alter column concept set default 'Unclassified concept',
  alter column mistake_text set not null,
  alter column mistake_text set default 'Unspecified mistake',
  alter column status set default 'open';

alter table if exists public.mistakes
  drop constraint if exists mistakes_status_check;
alter table if exists public.mistakes
  add constraint mistakes_status_check
    check (status in (
      'open',
      'repairing',
      'retest_due',
      'repaired',
      'ignored',
      -- legacy statuses remain readable during upgrade/backfill windows.
      'pending_review',
      'verified_mistake',
      'rejected',
      'corrected_by_user'
    ));

alter table if exists public.mistakes
  drop constraint if exists mistakes_source_check;
alter table if exists public.mistakes
  add constraint mistakes_source_check
    check (source in ('quiz', 'autopsy', 'chat', 'manual', 'diagnostic'));

create index if not exists idx_mistakes_user_status_retest
  on public.mistakes(user_id, status, next_retest_at);
create index if not exists idx_mistakes_user_concept_key
  on public.mistakes(user_id, normalized_key);

do $$
begin
  create unique index if not exists idx_mistakes_user_normalized_key_unique
    on public.mistakes(user_id, normalized_key)
    where normalized_key is not null;
exception
  when unique_violation then
    raise notice 'Skipping unique mistake normalized_key index until existing duplicates are merged';
end $$;

create table if not exists public.mistake_retests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mistake_id uuid not null references public.mistakes(id) on delete cascade,
  goal_id uuid null references public.learning_goals(id) on delete set null,
  due_at timestamptz not null,
  question text not null,
  status text not null default 'due' check (status in ('due', 'passed', 'failed')),
  attempt_count integer not null default 0,
  last_attempted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mistake_retests enable row level security;
drop policy if exists "mistake_retests_select_own" on public.mistake_retests;
create policy "mistake_retests_select_own"
  on public.mistake_retests for select
  using (auth.uid() = user_id);
drop policy if exists "mistake_retests_insert_own" on public.mistake_retests;
create policy "mistake_retests_insert_own"
  on public.mistake_retests for insert
  with check (auth.uid() = user_id);
drop policy if exists "mistake_retests_update_own" on public.mistake_retests;
create policy "mistake_retests_update_own"
  on public.mistake_retests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "mistake_retests_delete_own" on public.mistake_retests;
create policy "mistake_retests_delete_own"
  on public.mistake_retests for delete
  using (auth.uid() = user_id);

create index if not exists idx_mistake_retests_user_due
  on public.mistake_retests(user_id, status, due_at);
create index if not exists idx_mistake_retests_mistake
  on public.mistake_retests(mistake_id, status, due_at);

do $$
begin
  create unique index if not exists idx_mistake_retests_one_due_per_mistake
    on public.mistake_retests(mistake_id)
    where status = 'due';
exception
  when unique_violation then
    raise notice 'Skipping one-due-retest index until duplicate due retests are merged';
end $$;

alter table if exists public.session_cards
  add column if not exists "targetMistakeId" uuid null references public.mistakes(id) on delete set null,
  add column if not exists "targetRetestId" uuid null references public.mistake_retests(id) on delete set null,
  add column if not exists "repairPhase" text null check ("repairPhase" in ('immediate_repair', 'delayed_retest'));
