const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local!");
  process.exit(1);
}

async function runMigration() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("=== APPLYING COGNITION OS V2 DATABASE MIGRATION ===");

  const sql = `
    -- Create learning_goals table
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

    -- Add goal_id to concepts
    ALTER TABLE "concepts" ADD COLUMN IF NOT EXISTS "goal_id" uuid REFERENCES "learning_goals"("id") ON DELETE CASCADE;

    -- Add goal_id to concept_links
    ALTER TABLE "concept_links" ADD COLUMN IF NOT EXISTS "goal_id" uuid REFERENCES "learning_goals"("id") ON DELETE CASCADE;

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
  `;

  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

  if (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } else {
    console.log("✅ Migration completed successfully!");
    console.log("Response data:", data);
  }
}

runMigration();
