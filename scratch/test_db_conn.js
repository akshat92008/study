const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = 'ubzvhajvcoiovkgwnsgu';

async function test() {
  const regions = ['ap-south-1', 'ap-southeast-1', 'us-east-1', 'us-west-1', 'eu-west-2', 'eu-central-1'];
  
  for (const region of regions) {
    const connStr = `postgresql://postgres.ubzvhajvcoiovkgwnsgu:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    console.log(`\n--- Testing ${region} ---`);
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log(`Success on ${region}!`);
      await client.end();
      break;
    } catch (err) {
      console.log(`Error on ${region}:`);
      console.log(`  Message: ${err.message}`);
      console.log(`  Code: ${err.code}`);
      console.log(`  Detail: ${err.detail}`);
      console.log(`  Hint: ${err.hint}`);
    }
  }
}

test();
