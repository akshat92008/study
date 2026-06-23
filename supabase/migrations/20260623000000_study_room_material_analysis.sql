alter table if exists public.study_materials
  add column if not exists material_analysis jsonb not null default '{}'::jsonb;

alter table if exists public.weak_area_events
  alter column goal_id drop not null,
  add column if not exists material_id uuid null references public.study_materials(id) on delete set null,
  add column if not exists weakness_description text,
  add column if not exists evidence_text text,
  add column if not exists source_chunk_id uuid null references public.study_material_chunks(id) on delete set null,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists repair_suggestion text,
  add column if not exists status text not null default 'active';

create index if not exists weak_area_events_user_material_status_idx
  on public.weak_area_events(user_id, material_id, status, last_seen_at desc);
