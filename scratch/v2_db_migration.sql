-- ==========================================
-- COGNITION OS V2 SCHEMA MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ubzvhajvcoiovkgwnsgu/sql/new
-- ==========================================

-- 1. Recreate orchestrator_chats table to support persisted array chats
DROP TABLE IF EXISTS "orchestrator_chats" CASCADE;

CREATE TABLE "orchestrator_chats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid UNIQUE NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "messages" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Enable RLS for orchestrator_chats
ALTER TABLE "orchestrator_chats" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for orchestrator_chats
CREATE POLICY "Users can manage their own global chats" ON "orchestrator_chats"
  FOR ALL USING (auth.uid() = user_id);


-- 2. Create learning_goals table
CREATE TABLE IF NOT EXISTS "learning_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "target_completion_date" timestamp,
  "confidence_score" real DEFAULT 0.5,
  "status" text DEFAULT 'active',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Enable RLS for learning_goals
ALTER TABLE "learning_goals" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for learning_goals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'learning_goals' AND policyname = 'Users can manage their own learning goals'
  ) THEN
    CREATE POLICY "Users can manage their own learning goals" ON "learning_goals"
    FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;


-- 3. Link concepts and concept_links to learning_goals
ALTER TABLE "concepts" ADD COLUMN IF NOT EXISTS "goal_id" uuid REFERENCES "learning_goals"("id") ON DELETE CASCADE;
ALTER TABLE "concept_links" ADD COLUMN IF NOT EXISTS "goal_id" uuid REFERENCES "learning_goals"("id") ON DELETE CASCADE;

-- 4. Create universal student_events if it does not exist
CREATE TABLE IF NOT EXISTS "student_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Enable RLS for student_events
ALTER TABLE "student_events" ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for student_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_events' AND policyname = 'Users access own events'
  ) THEN
    CREATE POLICY "Users access own events" ON "student_events" FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;
