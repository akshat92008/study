import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function resetUsage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = 'b45cb2c9-0951-4dc5-b6a9-9445b802d67f';
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('ai_usage_daily')
    .update({ ai_calls: 0, chat_messages: 0 })
    .eq('user_id', userId)
    .eq('usage_date', today);
    
  if (error) {
    console.error('Error resetting usage:', error);
  } else {
    console.log('Successfully reset usage for user.');
  }
}

resetUsage().catch(console.error);
