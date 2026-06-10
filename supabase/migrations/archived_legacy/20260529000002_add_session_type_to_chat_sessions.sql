ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'global';
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_session_type_check CHECK (session_type IN ('global', 'tutor', 'practice', 'onboarding'));
