import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  console.log('Starting cleanup of leaked global data...');

  const tables = [
    'seeded_topics',
    'goal_curriculum_nodes',
    'daily_microtasks',
    'session_cards',
    'concepts',
    'mistakes',
    'revision_cards'
  ];

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .delete()
      .is('goal_id', null)
      .select('id');

    if (error) {
      console.error(`Failed to clean ${table}:`, error.message);
    } else {
      console.log(`Cleaned ${data.length} orphaned rows from ${table}.`);
    }
  }

  // Next, we find goals and verify their domain
  const { data: goals } = await supabase.from('learning_goals').select('id, title, domain');
  
  if (goals) {
    for (const goal of goals) {
      // If domain isn't "chemistry" but there are chemistry seeded topics, we should delete them
      if (goal.domain !== 'chemistry' && goal.domain !== 'neet') {
        const { data: chemTopics } = await supabase
          .from('seeded_topics')
          .delete()
          .eq('goal_id', goal.id)
          .eq('subject', 'chemistry')
          .select('id');
          
        if (chemTopics && chemTopics.length > 0) {
          console.log(`Cleaned ${chemTopics.length} leaked chemistry topics from goal ${goal.title}`);
        }
      }
    }
  }

  console.log('Cleanup complete.');
}

main().catch(console.error);
