-- Migration: Universal Goal Resolution & Curriculum Storage
-- Adds domain fields to learning_goals and creates goal_curriculum_nodes table.

-- 1. Alter learning_goals table safely
ALTER TABLE "public"."learning_goals" 
ADD COLUMN IF NOT EXISTS "subject" text,
ADD COLUMN IF NOT EXISTS "domain" text,
ADD COLUMN IF NOT EXISTS "exam" text,
ADD COLUMN IF NOT EXISTS "grade" text,
ADD COLUMN IF NOT EXISTS "board" text,
ADD COLUMN IF NOT EXISTS "target_outcome" text,
ADD COLUMN IF NOT EXISTS "confidence" numeric,
ADD COLUMN IF NOT EXISTS "needs_clarification" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "clarification_question" text;
-- 2. Create goal_curriculum_nodes table
CREATE TABLE IF NOT EXISTS "public"."goal_curriculum_nodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "subject" "text",
    "domain" "text",
    "unit" "text",
    "chapter" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "estimated_minutes" integer,
    "mastery_score" numeric DEFAULT 0,
    "status" "text" DEFAULT 'not_started'::text,
    "source" "text" NOT NULL CHECK (source IN ('template', 'ai_generated', 'fallback', 'manual')),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "goal_curriculum_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_curriculum_nodes_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE
);
-- 3. Setup Indexes
CREATE INDEX IF NOT EXISTS "idx_goal_curriculum_nodes_user_goal" ON "public"."goal_curriculum_nodes" USING btree ("user_id", "goal_id");
CREATE INDEX IF NOT EXISTS "idx_goal_curriculum_nodes_user_goal_order" ON "public"."goal_curriculum_nodes" USING btree ("user_id", "goal_id", "order_index");
CREATE INDEX IF NOT EXISTS "idx_goal_curriculum_nodes_user_goal_status" ON "public"."goal_curriculum_nodes" USING btree ("user_id", "goal_id", "status");
-- 4. Enable RLS
ALTER TABLE "public"."goal_curriculum_nodes" ENABLE ROW LEVEL SECURITY;
-- 5. Policies
CREATE POLICY "Users access own goal_curriculum_nodes" 
ON "public"."goal_curriculum_nodes" 
USING ("auth"."uid"() = "user_id") 
WITH CHECK ("auth"."uid"() = "user_id");
-- Allow service_role
CREATE POLICY "service_role_all_goal_curriculum_nodes" 
ON "public"."goal_curriculum_nodes" 
USING (current_setting('request.jwt.claim.role', true) = 'service_role') 
WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');
GRANT ALL ON TABLE "public"."goal_curriculum_nodes" TO "anon";
GRANT ALL ON TABLE "public"."goal_curriculum_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_curriculum_nodes" TO "service_role";
