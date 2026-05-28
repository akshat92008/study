-- MIND Tutor FSM States
CREATE TABLE IF NOT EXISTS tutor_session_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL, -- Logical grouping for the 8-10 exchange loop
  concept_id uuid REFERENCES concepts(id) ON DELETE SET NULL,
  current_state text NOT NULL DEFAULT 'DIAGNOSTIC', -- 'DIAGNOSTIC' | 'SOCRATIC_PROBE' | 'GROUNDING_EXPLANATION' | 'RETRIEVAL_TEST' | 'SYNTHESIS'
  misconception_detected text,
  turns_count integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE tutor_session_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own tutor states"
  ON tutor_session_states FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tutor_session_states_user_concept 
  ON tutor_session_states(user_id, concept_id);
