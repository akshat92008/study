-- 20260604000003_missing_indexes_1000_users.sql

-- Storage bucket for Autopsy Evidence
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'autopsy-evidence',
  'autopsy-evidence',
  false,
  20971520, -- 20MB
  '{image/png,image/jpeg,image/webp,application/pdf,text/plain}'
)
on conflict (id) do update set
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
-- RLS for autopsy-evidence
create policy "Users can upload their own autopsy evidence"
  on storage.objects for insert
  with check (bucket_id = 'autopsy-evidence' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can read their own autopsy evidence"
  on storage.objects for select
  using (bucket_id = 'autopsy-evidence' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete their own autopsy evidence"
  on storage.objects for delete
  using (bucket_id = 'autopsy-evidence' and auth.uid()::text = (storage.foldername(name))[1]);
-- Missing Indexes for 1000 Users Scale
create index if not exists idx_event_queue_user_id on event_queue(user_id);
create index if not exists idx_event_queue_idempotency on event_queue(idempotency_key);
create index if not exists idx_autopsy_jobs_user_id on autopsy_jobs(user_id);
create index if not exists idx_autopsy_jobs_idempotency on autopsy_jobs(idempotency_key);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_chat_messages_idempotency on chat_messages(idempotency_key);
create index if not exists idx_session_cards_user_id on session_cards(user_id);
create index if not exists idx_mistakes_user_id on mistakes(user_id);
create index if not exists idx_revision_cards_user_id on revision_cards(user_id);
-- RLS for study_material_chunks
create policy "study_material_chunks_insert_own"
  on public.study_material_chunks for insert
  with check (auth.uid() = user_id);
create policy "study_material_chunks_update_own"
  on public.study_material_chunks for update
  using (auth.uid() = user_id);
create policy "study_material_chunks_delete_own"
  on public.study_material_chunks for delete
  using (auth.uid() = user_id);
