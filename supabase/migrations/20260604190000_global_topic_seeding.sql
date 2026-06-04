-- ============================================================================
-- Cognition OS — Global Topic Seeding
-- Creates durable topic/microtarget map for any user goal.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE IF NOT EXISTS public.seeded_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  subject text NOT NULL,
  chapter text NOT NULL,
  topic text NOT NULL,
  microtarget text NOT NULL,
  parent_topic_id uuid NULL REFERENCES public.seeded_topics(id) ON DELETE SET NULL,
  order_index integer DEFAULT 0,
  topic_slug text,
  microtarget_slug text,
  mastery_score numeric DEFAULT 0,
  confidence text DEFAULT 'low',
  source text DEFAULT 'seeded_template',
  template_key text NOT NULL DEFAULT 'custom_goal_seed',
  status text DEFAULT 'not_started',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.seeded_topics
  ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic_slug text,
  ADD COLUMN IF NOT EXISTS microtarget_slug text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
UPDATE public.seeded_topics
SET
  topic_slug = COALESCE(
    topic_slug,
    NULLIF(regexp_replace(lower(topic), '[^a-z0-9]+', '-', 'g'), '')
  ),
  microtarget_slug = COALESCE(
    microtarget_slug,
    NULLIF(regexp_replace(lower(microtarget), '[^a-z0-9]+', '-', 'g'), '')
  )
WHERE topic_slug IS NULL OR microtarget_slug IS NULL;
UPDATE public.seeded_topics
SET
  topic_slug = COALESCE(topic_slug, 'topic'),
  microtarget_slug = COALESCE(microtarget_slug, 'microtarget');
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, goal_id, template_key, topic_slug, microtarget_slug
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.seeded_topics
)
DELETE FROM public.seeded_topics st
USING ranked r
WHERE st.id = r.id AND r.rn > 1;
ALTER TABLE public.seeded_topics
  DROP CONSTRAINT IF EXISTS seeded_topics_user_goal_template_microtarget_key;
ALTER TABLE public.seeded_topics
  DROP CONSTRAINT IF EXISTS seeded_topics_goal_template_topic_microtarget_key;
ALTER TABLE public.seeded_topics
  ADD CONSTRAINT seeded_topics_goal_template_topic_microtarget_key
  UNIQUE (user_id, goal_id, template_key, topic_slug, microtarget_slug);
CREATE INDEX IF NOT EXISTS seeded_topics_user_id_idx
  ON public.seeded_topics(user_id);
CREATE INDEX IF NOT EXISTS seeded_topics_goal_id_idx
  ON public.seeded_topics(goal_id);
CREATE INDEX IF NOT EXISTS seeded_topics_goal_order_idx
  ON public.seeded_topics(user_id, goal_id, order_index);
CREATE INDEX IF NOT EXISTS seeded_topics_goal_status_idx
  ON public.seeded_topics(user_id, goal_id, status);
CREATE INDEX IF NOT EXISTS seeded_topics_template_key_idx
  ON public.seeded_topics(template_key);
ALTER TABLE public.seeded_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own seeded topics" ON public.seeded_topics;
DROP POLICY IF EXISTS "Users can view their own seeded topics" ON public.seeded_topics;
DROP POLICY IF EXISTS "Users can update their own seeded topics" ON public.seeded_topics;
DROP POLICY IF EXISTS "Users can delete their own seeded topics" ON public.seeded_topics;
CREATE POLICY "Users can insert their own seeded topics"
  ON public.seeded_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own seeded topics"
  ON public.seeded_topics FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own seeded topics"
  ON public.seeded_topics FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own seeded topics"
  ON public.seeded_topics FOR DELETE
  USING (auth.uid() = user_id);
