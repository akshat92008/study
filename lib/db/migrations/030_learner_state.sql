-- 030_learner_state.sql
-- Learner state persistence.
-- NOTE: References profiles(id), not users(id). There is no users table in this schema.

DROP TABLE IF EXISTS learner_state CASCADE;

CREATE TABLE IF NOT EXISTS learner_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  concept_id UUID NOT NULL,
  mastery_score NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_concept FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
  CONSTRAINT learner_state_unique UNIQUE(user_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_state_user ON learner_state(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_state_concept ON learner_state(concept_id);

ALTER TABLE learner_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own learner_state"
  ON learner_state FOR ALL USING (auth.uid() = user_id);
