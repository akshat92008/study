-- 20260607010000_mvp_agentic_idempotency_and_signals.sql
-- Tighten MIND/practice writeback idempotency for the MVP agentic loop.

alter table public.learning_signals
  add column if not exists idempotency_key text;

create unique index if not exists learning_signals_user_idempotency_key_idx
  on public.learning_signals(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.learning_signals
  drop constraint if exists learning_signals_signal_type_check;

alter table public.learning_signals
  add constraint learning_signals_signal_type_check check (signal_type in (
    'assessment_result',
    'question_mistake',
    'manual_mistake',
    'chat_confusion',
    'revision_review',
    'practice_attempt',
    'practice_requested',
    'confusion_detected',
    'concept_practiced',
    'doubt_asked',
    'source_upload',
    'self_reflection',
    'task_completion',
    'autopsy_memory_created'
  ));

create index if not exists learning_signals_user_source_created_idx
  on public.learning_signals(user_id, source_type, created_at desc);
