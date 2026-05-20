const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

async function runMigration() {
  const sqlPath = path.join(__dirname, 'learner_state_migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("=== SCANNING ALL SUPABASE REGIONS AND PORTS FOR MIGRATION ===");
  let success = false;

  for (const region of regions) {
    for (const port of [6543, 5432]) {
      const connStr = `postgresql://postgres.ubzvhajvcoiovkgwnsgu:${password}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
      
      const client = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000
      });

      try {
        await client.connect();
        console.log(`🎉 SUCCESS! Connected to ${region} on port ${port}. Running migration...`);
        await client.query(sql);
        console.log("✅ Learning State Engine migration applied successfully!");
        await client.end();
        success = true;
        break;
      } catch (err) {
        // Silent catch for region scanning
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

runMigration();
