const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;

async function test() {
  const host = 'db.ubzvhajvcoiovkgwnsgu.supabase.co';
  const connStr = `postgresql://postgres:${password}@${host}:5432/postgres`;
  console.log(`Testing direct host ${host}...`);
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log("Success connecting to direct host!");
    await client.end();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

test();
