import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function resetBudget() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = 'b45cb2c9-0951-4dc5-b6a9-9445b802d67f';
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const { error: dailyErr } = await supabase
    .from('ai_usage_daily')
    .update({ total_usd: 0 })
    .eq('user_id', userId)
    .eq('usage_date', today);
    
  if (dailyErr) {
    console.error('Error resetting daily:', dailyErr);
  } else {
    console.log('Successfully reset daily usage and budget.');
  }
}

resetBudget().catch(console.error);
