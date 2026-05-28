const { Client } = require('pg');
const password = process.env.SUPABASE_DB_PASSWORD || '';
const connectionString = `postgres://postgres:${password}@db.ubzvhajvcoiovkgwnsgu.supabase.co:5432/postgres`;

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false } // Required for Supabase direct connections sometimes
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB");
    
    await client.query(`ALTER TABLE public.event_consumer_tracking DROP CONSTRAINT IF EXISTS event_consumer_tracking_status_check`);
    console.log("Dropped old constraint");
    
    await client.query(`ALTER TABLE public.event_consumer_tracking ADD CONSTRAINT event_consumer_tracking_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))`);
    console.log("Added new constraint");

    await client.query(`ALTER TABLE public.event_consumer_tracking ALTER COLUMN status SET DEFAULT 'pending'`);
    console.log("Updated default to pending");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}
run();
