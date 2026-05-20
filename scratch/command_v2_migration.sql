-- Add new columns to learning_goals table for COMMAND v2 support
ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "current_level" text DEFAULT 'beginner';
ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "preferred_learning_style" text DEFAULT 'read_write';
ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "daily_hours_available" integer DEFAULT 8;
ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "milestones" jsonb DEFAULT '[]'::jsonb;
