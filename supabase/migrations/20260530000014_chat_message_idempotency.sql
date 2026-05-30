-- 040_chat_message_idempotency.sql
-- MODULE 3: Prevent duplicate assistant message writes across route branches and worker retries.
--
-- The route is the canonical writer of assistant messages.
-- The event worker must never insert a second row for the same assistant response.
-- We enforce this with a deterministic idempotency_key written by the route and a unique
-- partial index (NULL keys are excluded so legacy rows are unaffected).

-- 1. Add the column (safe: IF NOT EXISTS, no default, nullable = backward compatible)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2. Unique partial index — only rows that carry a key participate in the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_idempotency_key_idx
  ON chat_messages (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
