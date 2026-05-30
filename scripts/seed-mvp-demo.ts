import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function seedDemo() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot run demo seed in production env.');
    process.exit(1);
  }

  if (process.env.DEMO_SEED_ALLOWED !== 'true') {
    console.error('❌ You must set DEMO_SEED_ALLOWED=true to run this script.');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Need service role to bypass RLS

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase env vars missing.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Seeding demo data...');

  // Create a fake test user in auth if we were to do it fully, 
  // but usually for demo we assume a specific user id or we create one
  // For safety, we will just create a profile with a known dummy UUID 
  // ONLY if it doesn't exist. Actually, we should create a full auth user.
  // To keep it simple and safe, let's create a profile with a fixed UUID.
  const demoUserId = '00000000-0000-0000-0000-000000000001';

  // 1. Profile
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .upsert({
      id: demoUserId,
      email: 'founder-demo@cognition-os.local',
      full_name: 'Founder Demo',
      exam: 'neet',
      level: 'intermediate',
      current_streak: 2
    })
    .select()
    .single();

  if (pErr) console.error('Profile error:', pErr);
  else console.log('✅ Upserted profile:', profile.id);

  // 2. Learning Goal
  const { data: goal, error: gErr } = await supabase
    .from('study_goals')
    .insert({
      user_id: demoUserId,
      title: 'Master Physics Kinematics',
      status: 'active'
    })
    .select();
  if (gErr) console.error('Goal error:', gErr);
  else console.log(`✅ Created study_goal: ${goal.length} rows`);

  // 3. Concepts
  const { data: concepts, error: cErr } = await supabase
    .from('concepts')
    .insert([
      { user_id: demoUserId, subject: 'Physics', chapter: 'Kinematics', topic: '1D Motion', name: 'Velocity', mastery_tier: 'weak' },
      { user_id: demoUserId, subject: 'Physics', chapter: 'Kinematics', topic: '1D Motion', name: 'Acceleration', mastery_tier: 'developing' }
    ])
    .select();
  if (cErr) console.error('Concepts error:', cErr);
  else console.log(`✅ Created concepts: ${concepts.length} rows`);

  // 4. Revision Cards
  if (concepts && concepts.length > 0) {
    const { data: cards, error: rcErr } = await supabase
      .from('revision_cards')
      .insert([
        { user_id: demoUserId, concept_id: concepts[0].id, front: 'What is Velocity?', back: 'Rate of change of displacement' }
      ])
      .select();
    if (rcErr) console.error('Cards error:', rcErr);
    else console.log(`✅ Created revision_cards: ${cards.length} rows`);
  }

  // 5. Chat Session
  const { data: session, error: sErr } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: demoUserId,
      title: 'Study 1D Motion'
    })
    .select()
    .single();
  if (sErr) console.error('Session error:', sErr);
  else console.log(`✅ Created chat_session:`, session.id);

  // 6. Mock Autopsy
  const { data: autopsy, error: aErr } = await supabase
    .from('mock_autopsies')
    .insert({
      user_id: demoUserId,
      exam: 'neet',
      test_name: 'Demo Weekly Test',
      total_marks: 720,
      marks_obtained: 600,
      status: 'pending'
    })
    .select()
    .single();
  if (aErr) console.error('Autopsy error:', aErr);
  else console.log(`✅ Created mock_autopsy:`, autopsy.id);

  // 7. Event pending
  const { data: evt, error: evErr } = await supabase
    .from('student_events')
    .insert({
      user_id: demoUserId,
      type: 'autopsy.uploaded',
      data: { autopsy_id: autopsy?.id },
      status: 'pending'
    })
    .select();
  if (evErr) console.error('Event error:', evErr);
  else console.log(`✅ Created pending event: ${evt.length} rows`);

  console.log('\n🎉 Demo Seed Complete.');
}

seedDemo();
