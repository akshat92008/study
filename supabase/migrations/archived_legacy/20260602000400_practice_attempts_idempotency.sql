alter table public.practice_attempts
  add column if not exists idempotency_key text;
create unique index if not exists practice_attempts_user_id_idempotency_key_idx
  on public.practice_attempts(user_id, idempotency_key)
  where idempotency_key is not null;
