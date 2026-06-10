import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('--- Stripe Sync Check ---');
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, stripe_customer_id, subscription_status')
    .not('stripe_customer_id', 'is', null);

  if (error) {
    console.error('Failed to fetch profiles:', error.message);
    process.exit(1);
  }

  console.log(`Found ${data.length} users with Stripe Customer IDs.`);

  let misaligned = 0;
  for (const user of data) {
    if (!user.subscription_status || user.subscription_status === 'free' || user.subscription_status === 'inactive') {
      console.warn(`[WARN] User ${user.email} (${user.id}) has a Stripe Customer ID (${user.stripe_customer_id}) but subscription_status is '${user.subscription_status}'.`);
      misaligned++;
    }
  }

  if (misaligned > 0) {
    console.log(`\\nResult: ${misaligned} users may have misaligned subscription statuses.`);
  } else {
    console.log('\\nResult: All Stripe users appear to have active aligned subscription statuses.');
  }
}

main().catch(console.error);
