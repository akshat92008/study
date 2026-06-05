import { createAdminClient } from '../lib/supabase/admin';
import { syncProfileAggregates } from '../lib/profiles/sync';

async function main() {
  const supabase = createAdminClient();

  console.log('Fetching all users to recompute profile aggregates...');
  
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id');
    
  if (error) {
    console.error('Error fetching users:', error);
    process.exit(1);
  }

  console.log(`Found ${users.length} users. Starting recomputation...`);

  let count = 0;
  for (const user of users) {
    try {
      await syncProfileAggregates(user.id);
      count++;
      if (count % 100 === 0) {
        console.log(`Processed ${count} / ${users.length} users...`);
      }
    } catch (err) {
      console.error(`Failed to sync profile for user ${user.id}:`, err);
    }
  }

  console.log(`Successfully recomputed profiles for ${count} users.`);
}

main().catch(err => {
  console.error('Fatal error in recompute-study-profile:', err);
  process.exit(1);
});
