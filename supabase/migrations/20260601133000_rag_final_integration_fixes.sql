-- Final RAG integration fixes for Cognition OS.
-- Fixes query log mode, source metadata return, and source-linked practice artifacts.

create extension if not exists vector;

alter table public.rag_query_logs
  add column if not exists mode text not null default 'implicit';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rag_query_logs_mode_check'
  ) then
    alter table public.rag_query_logs
      add constraint rag_query_logs_mode_check
      check (mode in ('explicit', 'implicit', 'off'));
  end if;
end $$;

alter table public.practice_items
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists topic text,
  add column if not exists source_material_id uuid references public.study_materials(id) on delete set null,
  add column if not exists source_chunk_ids uuid[];

create index if not exists practice_items_source_material_idx
  on public.practice_items(source_material_id);

create index if not exists rag_query_logs_mode_idx
  on public.rag_query_logs(user_id, mode, created_at desc);

drop function if exists public.match_study_material_chunks(
  vector(768),
  uuid,
  integer,
  uuid[],
  text,
  text,
  double precision
);

create or replace function public.match_study_material_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count integer default 5,
  material_filter uuid[] default null,
  subject_filter text default null,
  chapter_filter text default null,
  similarity_threshold double precision default 0.15
)
returns table (
  id uuid,
  material_id uuid,
  user_id uuid,
  chunk_index integer,
  page_start integer,
  page_end integer,
  heading text,
  text text,
  similarity double precision,
  material_title text,
  source_type text,
  subject text,
  chapter text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.material_id,
    c.user_id,
    c.chunk_index,
    c.page_start,
    c.page_end,
    c.heading,
    c.text,
    1 - (c.embedding <=> query_embedding) as similarity,
    m.title as material_title,
    m.source_type,
    m.subject,
    m.chapter
  from public.study_material_chunks c
  join public.study_materials m on m.id = c.material_id
  where c.user_id = match_user_id
    and m.user_id = match_user_id
    and m.status = 'ready'
    and c.embedding is not null
    and (material_filter is null or c.material_id = any(material_filter))
    and (subject_filter is null or lower(coalesce(m.subject, '')) = lower(subject_filter))
    and (chapter_filter is null or lower(coalesce(m.chapter, '')) = lower(chapter_filter))
    and (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 8));
$$;

grant execute on function public.match_study_material_chunks(
  vector(768), uuid, integer, uuid[], text, text, double precision
) to authenticated, service_role;
