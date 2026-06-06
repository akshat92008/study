-- Add archived_at to chat_sessions to support archiving threads
alter table if exists public.chat_sessions
  add column if not exists archived_at timestamptz;
-- Ensure RLS allows the user to update their own sessions (if not already handled)
drop policy if exists "users_can_update_own_chat_sessions" on public.chat_sessions;
create policy "users_can_update_own_chat_sessions" on public.chat_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
