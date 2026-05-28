-- 019_soul_layer.sql
-- Phase 12: Soul Layer - Emotional Architecture & Episodic Memory System

-- 1. Create vector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create memory_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type') THEN
    CREATE TYPE memory_type AS ENUM ('victory', 'struggle', 'turning_point', 'behavioral_quirk');
  END IF;
END
$$;

-- 3. Create episodic_memories table
CREATE TABLE IF NOT EXISTS episodic_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  concept_id uuid REFERENCES concepts(id) ON DELETE SET NULL,
  type memory_type NOT NULL,
  description text NOT NULL,
  emotional_context text,
  importance_score real DEFAULT 1.0,
  decay_factor real DEFAULT 0.05,
  created_at timestamp DEFAULT now(),
  last_recalled_at timestamp,
  embedding vector(768)
);

-- 4. Enable RLS on episodic_memories
ALTER TABLE episodic_memories ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policy for episodic_memories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'episodic_memories' AND policyname = 'Users can manage their own episodic memories'
  ) THEN
    CREATE POLICY "Users can manage their own episodic memories" ON episodic_memories
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

-- 6. Add columns to student_models
ALTER TABLE student_models ADD COLUMN IF NOT EXISTS optimal_pacing text DEFAULT 'standard';
ALTER TABLE student_models ADD COLUMN IF NOT EXISTS fatigue_threshold_minutes integer DEFAULT 90;
ALTER TABLE student_models ADD COLUMN IF NOT EXISTS comeback_probability real DEFAULT 0.8;
ALTER TABLE student_models ADD COLUMN IF NOT EXISTS explanation_preference text DEFAULT 'conceptual_first';

-- 7. Define get_salient_memories RPC function
CREATE OR REPLACE FUNCTION get_salient_memories(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_pulse_state text,
  p_limit integer DEFAULT 2
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  concept_id uuid,
  type memory_type,
  description text,
  emotional_context text,
  importance_score real,
  decay_factor real,
  created_at timestamp,
  last_recalled_at timestamp,
  salience_score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.id,
    em.user_id,
    em.concept_id,
    em.type,
    em.description,
    em.emotional_context,
    em.importance_score,
    em.decay_factor,
    em.created_at,
    em.last_recalled_at,
    (
      (em.importance_score * exp(- em.decay_factor * (EXTRACT(epoch FROM (now() - em.created_at)) / 86400.0)))
      + (COALESCE(1.0 - (em.embedding <=> p_query_embedding), 0.0) * 1.5)
      + (CASE 
          WHEN p_pulse_state IN ('frustrated', 'overwhelmed', 'burnt_out') AND em.type = 'struggle' THEN 1.0
          WHEN p_pulse_state IN ('frustrated', 'overwhelmed', 'burnt_out') AND em.type = 'turning_point' THEN 0.8
          ELSE 0.0 
         END)
    )::double precision AS salience_score
  FROM episodic_memories em
  WHERE em.user_id = p_user_id
  ORDER BY salience_score DESC
  LIMIT p_limit;
END;
$$;
