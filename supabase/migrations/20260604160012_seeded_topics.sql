CREATE TABLE IF NOT EXISTS "public"."seeded_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "goal_id" "uuid" NOT NULL REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE,
    "subject" "text" NOT NULL,
    "chapter" "text" NOT NULL,
    "topic" "text" NOT NULL,
    "microtarget" "text" NOT NULL,
    "parent_topic_id" "uuid",
    "mastery_score" numeric DEFAULT 0,
    "confidence" "text" DEFAULT 'low'::text,
    "source" "text" DEFAULT 'seeded_template'::text,
    "template_key" "text",
    "status" "text" DEFAULT 'active'::text,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id")
);

-- Idempotency constraint
ALTER TABLE "public"."seeded_topics" 
    ADD CONSTRAINT "seeded_topics_user_goal_template_microtarget_key" 
    UNIQUE ("user_id", "goal_id", "template_key", "microtarget");

ALTER TABLE "public"."seeded_topics" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own seeded topics"
    ON "public"."seeded_topics" FOR INSERT
    WITH CHECK ("auth"."uid"() = "user_id");

CREATE POLICY "Users can view their own seeded topics"
    ON "public"."seeded_topics" FOR SELECT
    USING ("auth"."uid"() = "user_id");

CREATE POLICY "Users can update their own seeded topics"
    ON "public"."seeded_topics" FOR UPDATE
    USING ("auth"."uid"() = "user_id");

CREATE POLICY "Users can delete their own seeded topics"
    ON "public"."seeded_topics" FOR DELETE
    USING ("auth"."uid"() = "user_id");

CREATE INDEX "seeded_topics_user_id_idx" ON "public"."seeded_topics" ("user_id");
CREATE INDEX "seeded_topics_goal_id_idx" ON "public"."seeded_topics" ("goal_id");
