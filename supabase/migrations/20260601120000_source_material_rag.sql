-- Source-grounded study material RAG for MIND.

create extension if not exists vector;

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_filename text null,
  mime_type text not null,
  storage_path text null,
  source_type text not null default 'upload'
    check (source_type in ('upload', 'ncert', 'notes', 'coaching', 'pyq', 'solution', 'other')),
  exam_type text null,
  subject text null,
  chapter text null,
  topic text null,
  language text not null default 'en',
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed', 'archived')),
  page_count int null,
  char_count int null,
  content_hash text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_material_chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.study_materials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  page_start int null,
  page_end int null,
  heading text null,
  text text not null,
  token_estimate int null,
  content_hash text null,
  embedding vector(768) null,
  embedding_provider text null,
  embedding_model text null,
  fts_vector tsvector generated always as (to_tsvector('english', coalesce(text, ''))) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_query_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  material_ids uuid[] null,
  retrieved_chunk_ids uuid[] null,
  answer_message_id uuid null,
  total_chunks int,
  total_context_chars int,
  grounded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_materials_user on public.study_materials(user_id);
create index if not exists idx_study_materials_user_status on public.study_materials(user_id, status);
create index if not exists idx_study_materials_subject_chapter on public.study_materials(user_id, subject, chapter);
create unique index if not exists idx_study_materials_user_content_hash_unique
  on public.study_materials(user_id, content_hash)
  where content_hash is not null and status <> 'archived';

create index if not exists idx_study_material_chunks_user_material on public.study_material_chunks(user_id, material_id);
create index if not exists idx_study_material_chunks_material_index on public.study_material_chunks(material_id, chunk_index);
create unique index if not exists idx_study_material_chunks_material_hash_unique
  on public.study_material_chunks(material_id, content_hash)
  where content_hash is not null;
create index if not exists idx_study_material_chunks_fts on public.study_material_chunks using gin(fts_vector);
create index if not exists idx_study_material_chunks_embedding_hnsw
  on public.study_material_chunks using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

alter table public.study_materials enable row level security;
alter table public.study_material_chunks enable row level security;
alter table public.rag_query_logs enable row level security;

drop policy if exists "study_materials_select_own" on public.study_materials;
create policy "study_materials_select_own"
on public.study_materials for select
using (auth.uid() = user_id);

drop policy if exists "study_materials_insert_own" on public.study_materials;
create policy "study_materials_insert_own"
on public.study_materials for insert
with check (auth.uid() = user_id);

drop policy if exists "study_materials_update_own" on public.study_materials;
create policy "study_materials_update_own"
on public.study_materials for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "study_materials_delete_own" on public.study_materials;
create policy "study_materials_delete_own"
on public.study_materials for delete
using (auth.uid() = user_id);

drop policy if exists "study_material_chunks_select_own" on public.study_material_chunks;
create policy "study_material_chunks_select_own"
on public.study_material_chunks for select
using (auth.uid() = user_id);

drop policy if exists "rag_query_logs_select_own" on public.rag_query_logs;
create policy "rag_query_logs_select_own"
on public.rag_query_logs for select
using (auth.uid() = user_id);

drop policy if exists "rag_query_logs_insert_own" on public.rag_query_logs;
create policy "rag_query_logs_insert_own"
on public.rag_query_logs for insert
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-materials',
  'study-materials',
  false,
  20971520,
  array['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown', 'application/markdown']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "study_material_storage_select_own" on storage.objects;
create policy "study_material_storage_select_own"
on storage.objects for select
using (
  bucket_id = 'study-materials'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "study_material_storage_insert_own" on storage.objects;
create policy "study_material_storage_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'study-materials'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "study_material_storage_delete_own" on storage.objects;
create policy "study_material_storage_delete_own"
on storage.objects for delete
using (
  bucket_id = 'study-materials'
  and auth.uid()::text = split_part(name, '/', 1)
);

alter table public.practice_items
  add column if not exists subject text null,
  add column if not exists chapter text null,
  add column if not exists topic text null,
  add column if not exists source_material_id uuid null references public.study_materials(id) on delete set null,
  add column if not exists source_chunk_ids uuid[] null;

alter table public.practice_attempts drop constraint if exists practice_attempts_confidence_check;
alter table public.practice_attempts
  add constraint practice_attempts_confidence_check
  check (confidence in ('easy', 'medium', 'hard', 'forgot', 'again', 'knew') or confidence is null);

create index if not exists idx_practice_items_source_material on public.practice_items(source_material_id);

drop function if exists public.match_study_material_chunks(vector(768), uuid, int, uuid[], text, text, float);
create or replace function public.match_study_material_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 5,
  material_filter uuid[] default null,
  subject_filter text default null,
  chapter_filter text default null,
  similarity_threshold float default 0.68
)
returns table (
  id uuid,
  material_id uuid,
  material_title text,
  source_type text,
  chunk_index int,
  page_start int,
  page_end int,
  heading text,
  text text,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> match_user_id) then
    raise exception 'Unauthorized: user_id mismatch';
  end if;

  return query
  select
    smc.id,
    smc.material_id,
    sm.title as material_title,
    sm.source_type,
    smc.chunk_index,
    smc.page_start,
    smc.page_end,
    smc.heading,
    smc.text,
    (1 - (smc.embedding <=> query_embedding))::float as similarity
  from public.study_material_chunks smc
  join public.study_materials sm on sm.id = smc.material_id
  where smc.user_id = match_user_id
    and sm.user_id = match_user_id
    and sm.status = 'ready'
    and smc.embedding is not null
    and (material_filter is null or smc.material_id = any(material_filter))
    and (subject_filter is null or sm.subject ilike '%' || subject_filter || '%')
    and (chapter_filter is null or sm.chapter ilike '%' || chapter_filter || '%')
    and (1 - (smc.embedding <=> query_embedding)) >= similarity_threshold
  order by smc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 8);
end;
$$;

revoke execute on function public.match_study_material_chunks(vector(768), uuid, int, uuid[], text, text, float)
from public, anon;
grant execute on function public.match_study_material_chunks(vector(768), uuid, int, uuid[], text, text, float)
to authenticated, service_role;
