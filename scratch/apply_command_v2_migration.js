const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Missing SUPABASE_DB_PASSWORD in .env.local!");
  process.exit(1);
}

const regions = ['ap-south-1', 'ap-southeast-1', 'us-east-1', 'us-west-1', 'eu-west-2', 'eu-central-1'];
const sql = `
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "current_level" text DEFAULT 'beginner';
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "preferred_learning_style" text DEFAULT 'read_write';
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "daily_hours_available" integer DEFAULT 8;
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "milestones" jsonb DEFAULT '[]'::jsonb;
`;

async function runMigration() {
  console.log("=== APPLYING COMMAND V2 DATABASE MIGRATION DIRECTLY ===");
  let migrationDone = false;

  for (const region of regions) {
    const connStr = `postgresql://postgres.ubzvhajvcoiovkgwnsgu:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    console.log(`Trying region ${region}...`);
    
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`Connected successfully to ${region}. Running SQL query...`);
      await client.query(sql);
      console.log(`✅ SQL query executed successfully on ${region}!`);
      await client.end();
      migrationDone = true;
      break;
    } catch (err) {
      console.log(`Could not connect/execute on ${region}: ${err.message}`);
    }
  }

  if (migrationDone) {
    console.log("✅ Migration completed successfully!");
  } else {
    console.error("❌ Migration failed on all regions!");
    process.exit(1);
  }
}

runMigration();
