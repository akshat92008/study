-- Harden Autopsy Jobs
-- Modifies the check constraint on status to include 'queued' and 'dead_letter'
-- Migrates existing 'pending' statuses to 'queued'

BEGIN;

-- Drop existing constraint
ALTER TABLE "public"."autopsy_jobs" DROP CONSTRAINT IF EXISTS "autopsy_jobs_status_check";

-- Add new constraint
ALTER TABLE "public"."autopsy_jobs" 
  ADD CONSTRAINT "autopsy_jobs_status_check" 
  CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'completed'::"text", 'needs_user_input'::"text", 'failed'::"text", 'dead_letter'::"text"])));

-- Migrate any existing pending jobs
UPDATE "public"."autopsy_jobs" 
SET "status" = 'queued' 
WHERE "status" = 'pending';

COMMIT;
