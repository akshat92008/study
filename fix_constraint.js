const { Client } = require('pg');
const password = process.env.SUPABASE_DB_PASSWORD || '';
const connectionString = `postgres://postgres.ubzvhajvcoiovkgwnsgu:${password}@db.ubzvhajvcoiovkgwnsgu.supabase.co:5432/postgres`;

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB");
    
    // Drop the old constraint
    await client.query(`ALTER TABLE public.event_consumer_tracking DROP CONSTRAINT IF EXISTS event_consumer_tracking_status_check`);
    console.log("Dropped old constraint");
    
    // Add the new constraint
    await client.query(`ALTER TABLE public.event_consumer_tracking ADD CONSTRAINT event_consumer_tracking_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))`);
    console.log("Added new constraint");

    // Also change default if needed
    await client.query(`ALTER TABLE public.event_consumer_tracking ALTER COLUMN status SET DEFAULT 'pending'`);
    console.log("Updated default to pending");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}
run();
