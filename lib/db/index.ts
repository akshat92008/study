import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '');
const connectionString = process.env.DATABASE_URL || 
  `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${supabaseHost}:5432/postgres`;

const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
