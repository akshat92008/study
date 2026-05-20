const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Missing database password in .env.local!");
  process.exit(1);
}

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

const sql = `
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "current_level" text DEFAULT 'beginner';
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "preferred_learning_style" text DEFAULT 'read_write';
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "daily_hours_available" integer DEFAULT 8;
  ALTER TABLE "learning_goals" ADD COLUMN IF NOT EXISTS "milestones" jsonb DEFAULT '[]'::jsonb;
`;

async function scanAndRun() {
  console.log("=== SCANNING ALL SUPABASE REGIONS AND PORTS ===");
  let success = false;

  for (const region of regions) {
    for (const port of [6543, 5432]) {
      const connStr = `postgresql://postgres.ubzvhajvcoiovkgwnsgu:${password}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
      console.log(`Testing ${region} on port ${port}...`);
      
      const client = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000
      });

      try {
        await client.connect();
        console.log(`🎉 SUCCESS! Connected to ${region} on port ${port}. Running migration...`);
        await client.query(sql);
        console.log("✅ COMMAND v2 columns added successfully!");
        await client.end();
        success = true;
        break;
      } catch (err) {
        // Suppress print to avoid clutter unless it is success
      }
    }
    if (success) break;
  }

  if (success) {
    console.log("✅ Database migration completed!");
  } else {
    console.error("❌ Unable to connect to Supabase database in any region.");
    process.exit(1);
  }
}

scanAndRun();
