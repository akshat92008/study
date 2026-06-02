import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function resetHourlyUsage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = 'b45cb2c9-0951-4dc5-b6a9-9445b802d67f';

  // Get current UTC hour
  const now = new Date();
  const currentHourStr = now.toISOString().substring(0, 13) + ':00:00';

  const { data, error } = await supabase
    .from('ai_usage_hourly')
    .update({ chat_messages: 0 })
    .eq('user_id', userId)
    .eq('usage_hour', currentHourStr);
    
  if (error) {
    console.error('Error resetting hourly usage:', error);
  } else {
    console.log('Successfully reset hourly usage for user.');
  }

  // Also reset daily usage just in case
  const today = now.toISOString().split('T')[0];
  const { error: dailyErr } = await supabase
    .from('ai_usage_daily')
    .update({ ai_calls: 0, chat_messages: 0 })
    .eq('user_id', userId)
    .eq('usage_date', today);
    
  if (dailyErr) {
    console.error('Error resetting daily:', dailyErr);
  } else {
    console.log('Successfully reset daily usage.');
  }
}

resetHourlyUsage().catch(console.error);
