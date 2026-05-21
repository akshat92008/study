const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;
const tenant = "ubzvhajvcoiovkgwnsgu";

async function test(host, port, user) {
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS: Connected with host=${host}, port=${port}, user=${user}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ FAIL: host=${host}, port=${port}, user=${user} -> ${err.message}`);
    return false;
  }
}

async function run() {
  const hosts = [
    `aws-1-ap-northeast-1.pooler.supabase.com`,
    `aws-0-ap-northeast-1.pooler.supabase.com`
  ];
  const users = [
    `postgres.${tenant}`,
    `postgres`
  ];
  const ports = [5432, 6543];

  for (const host of hosts) {
    for (const port of ports) {
      for (const user of users) {
        await test(host, port, user);
      }
    }
  }
}

run();
