-- SQL Migration: Learning State Engine Tables

CREATE TABLE IF NOT EXISTS "learner_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid UNIQUE NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "overall_confidence" real DEFAULT 0.5,
  "estimated_retention" real DEFAULT 0.9,
  "weekly_velocity" real DEFAULT 0.0,
  "struggle_patterns" jsonb DEFAULT '[]'::jsonb,
  "weak_areas" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Enable RLS for learner_states
ALTER TABLE "learner_states" ENABLE ROW LEVEL SECURITY;

-- Add RLS Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'learner_states' AND policyname = 'Users can manage their own learner states'
  ) THEN
    CREATE POLICY "Users can manage their own learner states" ON "learner_states"
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "learner_daily_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "date" date DEFAULT current_date,
  "confidence" real DEFAULT 0.5,
  "retention" real DEFAULT 0.9,
  "velocity" real DEFAULT 0.0,
  "hours_spent" real DEFAULT 0.0,
  "tasks_completed" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "unique_user_date" UNIQUE ("user_id", "date")
);

-- Enable RLS for learner_daily_metrics
ALTER TABLE "learner_daily_metrics" ENABLE ROW LEVEL SECURITY;

-- Add RLS Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'learner_daily_metrics' AND policyname = 'Users can manage their own daily metrics'
  ) THEN
    CREATE POLICY "Users can manage their own daily metrics" ON "learner_daily_metrics"
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Create helper function for incrementing daily tasks completed
CREATE OR REPLACE FUNCTION increment_daily_tasks_completed(p_user_id uuid, p_date date)
RETURNS void AS $$
BEGIN
  INSERT INTO learner_daily_metrics (user_id, date, tasks_completed)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET tasks_completed = learner_daily_metrics.tasks_completed + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
