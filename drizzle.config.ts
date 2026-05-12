import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(
      'https://',
      'postgresql://postgres:postgres@'
    ).replace('.supabase.co', '.supabase.co:5432/postgres'),
  },
});
