alter table public.mock_autopsies
  add column if not exists total_questions integer not null default 0,
  add column if not exists correct_count integer not null default 0,
  add column if not exists incorrect_count integer not null default 0,
  add column if not exists unattempted_count integer not null default 0,
  add column if not exists current_score numeric not null default 0,
  add column if not exists potential_score numeric not null default 0,
  add column if not exists recoverable_marks numeric not null default 0,
  add column if not exists status text not null default 'processing';
