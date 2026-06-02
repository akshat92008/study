-- Add RLS policies for inserting and updating rag_ingestion_jobs

drop policy if exists "rag_ingestion_jobs_insert_own" on public.rag_ingestion_jobs;
create policy "rag_ingestion_jobs_insert_own" 
on public.rag_ingestion_jobs 
for insert 
with check (auth.uid() = user_id);

drop policy if exists "rag_ingestion_jobs_update_own" on public.rag_ingestion_jobs;
create policy "rag_ingestion_jobs_update_own" 
on public.rag_ingestion_jobs 
for update 
using (auth.uid() = user_id) 
with check (auth.uid() = user_id);
