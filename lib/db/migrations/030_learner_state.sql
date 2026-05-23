-- 030_learner_state.sql

-- Learner state persistence
CREATE TABLE learner_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  concept_id UUID NOT NULL,
  mastery_score NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_concept FOREIGN KEY (concept_id) REFERENCES concepts(id)
);

CREATE INDEX idx_learner_state_user ON learner_state(user_id);
CREATE INDEX idx_learner_state_concept ON learner_state(concept_id);
