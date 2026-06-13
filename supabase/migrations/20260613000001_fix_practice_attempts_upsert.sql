-- Fix the ON CONFLICT issue for practice_attempts by explicitly adding the constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'practice_attempts_user_id_idempotency_key_key'
  ) THEN
    ALTER TABLE public.practice_attempts 
    ADD CONSTRAINT practice_attempts_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);
  END IF;
END $$;
