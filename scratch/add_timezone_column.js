const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { Client } = require('pg');

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

const connectionStrings = regions.map(region => 
  `postgresql://postgres.ubzvhajvcoiovkgwnsgu:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`
);

async function addTimezoneColumn() {
  const sql = `
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'Asia/Kolkata';
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
      console.log("✅ Column 'timezone' added/verified in 'profiles' successfully!");
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

addTimezoneColumn();
