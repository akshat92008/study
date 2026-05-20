const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;

async function test() {
  const host = 'ubzvhajvcoiovkgwnsgu.supabase.co';
  const ports = [5432, 6543];
  
  for (const port of ports) {
    console.log(`\n--- Testing ${host} on port ${port} ---`);
    const client = new Client({
      host,
      port,
      user: 'postgres.ubzvhajvcoiovkgwnsgu',
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log(`Success on port ${port}!`);
      await client.end();
      break;
    } catch (err) {
      console.log(`Error on port ${port}:`);
      console.log(`  Message: ${err.message}`);
      console.log(`  Code: ${err.code}`);
    }
  }
}

test();
