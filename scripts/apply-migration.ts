import { Client } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function applyMigration() {
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) {
    console.error('DATABASE_URL not found.');
    process.exit(1);
  }

  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  const sql = fs.readFileSync('supabase/migrations/20260602000000_event_queue_indexes.sql', 'utf8');

  try {
    await client.query(sql);
    console.log('✅ Migration applied successfully.');
  } catch (err) {
    console.error('❌ Failed to apply migration:', err);
  } finally {
    await client.end();
  }
}

applyMigration();
