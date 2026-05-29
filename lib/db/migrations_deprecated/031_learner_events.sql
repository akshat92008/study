-- 031_learner_events.sql

-- Append‑only event store for learner actions
CREATE TABLE learner_event (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learner_event_user ON learner_event(user_id);
