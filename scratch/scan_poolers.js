const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const password = process.env.SUPABASE_DB_PASSWORD;
const tenant = "ubzvhajvcoiovkgwnsgu";
const user = `postgres.${tenant}`;

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

async function checkConnection(host, port) {
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
    console.log(`✅ SUCCESS: Connected to ${host}:${port}`);
    await client.end();
    return true;
  } catch (err) {
    const msg = err.message;
    if (!msg.includes("not found") && !msg.includes("timeout") && !msg.includes("ENOTFOUND")) {
      console.log(`ℹ️ INTERESTING: ${host}:${port} -> ${msg}`);
    }
    return false;
  }
}

async function run() {
  console.log("Starting full pooler scan...");
  const promises = [];

  for (const region of regions) {
    for (const prefix of ['aws-0', 'aws-1']) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      for (const port of [5432, 6543]) {
        promises.push(checkConnection(host, port));
      }
    }
  }

  const results = await Promise.all(promises);
  const successCount = results.filter(Boolean).length;
  console.log(`Scan finished. Success count: ${successCount}`);
}

run();
