const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { Client } = require('pg');

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = 'ubzvhajvcoiovkgwnsgu';

if (!password) {
  console.error("Missing database password in .env.local!");
  process.exit(1);
}

// We will try connecting using the transaction pooler (6543) first, then fallback to direct (5432).
const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'sa-east-1'
];

const connectionStrings = regions.map(region => 
  `postgresql://postgres.ubzvhajvcoiovkgwnsgu:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`
);

async function runDirectSQL() {
  const sql = `
    -- Recreate orchestrator_chats table to support persisted array chats
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

  for (const connStr of connectionStrings) {
    console.log(`Connecting to: ${connStr.split('@')[1]}...`);
    const client = new Client({ 
      connectionString: connStr,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    try {
      await client.connect();
      console.log("Connected successfully!");
      await client.query(sql);
      console.log("✅ Migration applied successfully!");
      await client.end();
      return;
    } catch (err) {
      console.warn("Connection/query failed:", err.message);
      try {
        await client.end();
      } catch (e) {}
    }
  }

  console.error("❌ All database connection attempts failed.");
  process.exit(1);
}

runDirectSQL();
