-- Migration: 20260610000001_chat_turn_status.sql
-- Purpose: Module 6 — Add turn_status and prompt_version tracking to chat_messages.
-- This enables recovery from partial chat turns (provider failed after user message saved).

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS turn_status text
    NOT NULL DEFAULT 'completed'
    CHECK (turn_status IN (
      'pending_user_saved',
      'assistant_streaming',
      'assistant_saved',
      'failed_usage',
      'failed_provider',
      'failed_internal',
      'completed'
    )),
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Unique index to prevent duplicate assistant turns per idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_idempotency_key_uniq
  ON public.chat_messages(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for finding failed turns for recovery UI
CREATE INDEX IF NOT EXISTS chat_messages_failed_turns_idx
  ON public.chat_messages(user_id, turn_status, created_at)
  WHERE turn_status IN ('failed_provider', 'failed_internal');

-- Index for session message loading (with status filter)
CREATE INDEX IF NOT EXISTS chat_messages_session_status_idx
  ON public.chat_messages(session_id, turn_status, created_at);
