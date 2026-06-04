import { createClient } from '@supabase/supabase-js';
import { seedTopicsForGoal } from '../lib/topic-seeding/topic-seeder';

// Uses service role key for testing bypass RLS
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runTests() {
  console.log('Testing Topic Seeding System...');

  // 1. Create a dummy user and goal
  const userId = '00000000-0000-0000-0000-000000000001';
  const goalId = '00000000-0000-0000-0000-000000000001';
  
  await supabase.from('profiles').upsert({
    id: userId,
    full_name: 'Test User',
    exam_type: 'NEET',
  });
  
  await supabase.from('learning_goals').upsert({
    id: goalId,
    user_id: userId,
    title: 'NEET Physics 2026',
    status: 'active',
  });

  // 2. Run Seeding
  console.log('Seeding topics for NEET Physics...');
  const result = await seedTopicsForGoal(supabase as any, userId, goalId, 'NEET Physics Kinematics');
  
  console.log(`Seeded ${result.count} topics successfully!`);

  if (result.count === 0) {
    console.error('FAIL: No topics seeded.');
  }

  // 3. Test Idempotency
  console.log('Testing Idempotency...');
  const result2 = await seedTopicsForGoal(supabase as any, userId, goalId, 'NEET Physics Kinematics');
  console.log(`Seeded ${result2.count} topics on second run (should be 0).`);
  
  if (result2.count > 0) {
    console.error('FAIL: Idempotency failed, topics duplicated.');
  }

  // 4. Test fallback for unknown domain
  console.log('Testing Custom Goal Fallback...');
  const customGoalId = '00000000-0000-0000-0000-000000000002';
  await supabase.from('learning_goals').upsert({
    id: customGoalId,
    user_id: userId,
    title: 'Custom Learning Goal',
    status: 'active',
  });
  const fallbackResult = await seedTopicsForGoal(supabase as any, userId, customGoalId, 'Custom Goal');
  console.log(`Seeded ${fallbackResult.count} topics for custom goal.`);

  console.log('Done!');
}

runTests().catch(console.error);
