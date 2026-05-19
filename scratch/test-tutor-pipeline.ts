import Module from 'module';
import dotenv from 'dotenv';
import path from 'path';

// 1. Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

// 2. Initialize Direct Supabase Client
const directSupabase = createSupabaseClient(supabaseUrl, supabaseServiceKey);

// 3. Hijack Node's require/module resolver for `@/lib/supabase/server`
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id.includes('lib/supabase/server') || id === '@/lib/supabase/server') {
    return {
      createClient: async () => {
        return directSupabase;
      },
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// 4. Run tests
async function runTest() {
  console.log("=== Socratic MIND -> ATLAS + MEMORY INTEGRATION TEST ===");

  try {
    // Dynamically import engines after require hijack is set up
    const { updateConceptState, getPrerequisiteChain } = await import('../lib/engines/cognition-graph');
    const { createSingleCard } = await import('../lib/engines/revision-engine');

    // Step A: Find or create a test profile
    console.log("Step A: Resolving test user profile...");
    let { data: profile } = await directSupabase.from('profiles').select('id').limit(1).single();
    
    if (!profile) {
      console.log("No profile found. Creating a test profile...");
      const testUserId = '00000000-0000-0000-0000-000000000000';
      const { data: newProfile, error } = await directSupabase.from('profiles').insert({
        id: testUserId,
        email: 'test-user@cognitionos.internal',
        full_name: 'Test Student',
        exam_type: 'NEET',
        target_score: 650,
      }).select().single();
      
      if (error) throw error;
      profile = newProfile;
    }

    if (!profile) {
      throw new Error("Failed to resolve user profile.");
    }
    
    const userId = profile.id;
    console.log(`Using User ID: ${userId}`);

    // Step B: Set up two test concepts for prerequisite link validation
    console.log("\nStep B: Setting up test concepts A & B...");
    
    // Clear old test concepts/links if any
    await directSupabase.from('concept_links').delete().eq('user_id', userId);
    await directSupabase.from('concepts').delete().eq('user_id', userId).in('name', ['Test Concept A (Newton Laws)', 'Test Concept B (Friction)']);

    const { data: conceptA, error: errA } = await directSupabase.from('concepts').insert({
      user_id: userId,
      name: 'Test Concept A (Newton Laws)',
      subject: 'Physics',
      chapter: 'Laws of Motion',
      mastery: 'not_started',
    }).select().single();
    if (errA) throw errA;

    const { data: conceptB, error: errB } = await directSupabase.from('concepts').insert({
      user_id: userId,
      name: 'Test Concept B (Friction)',
      subject: 'Physics',
      chapter: 'Laws of Motion',
      mastery: 'exposed',
    }).select().single();
    if (errB) throw errB;

    console.log(`Created Concept A: "${conceptA.name}" (Mastery: ${conceptA.mastery})`);
    console.log(`Created Concept B: "${conceptB.name}" (Mastery: ${conceptB.mastery})`);

    // Create prerequisite link: Concept A -> Concept B (Concept A is a prerequisite for Concept B)
    console.log("Linking A as a prerequisite for B...");
    const { error: linkErr } = await directSupabase.from('concept_links').insert({
      user_id: userId,
      source_concept_id: conceptA.id,
      target_concept_id: conceptB.id,
      link_type: 'prerequisite',
      strength: 0.8
    });
    if (linkErr) throw linkErr;

    // Step C: Verify getPrerequisiteChain traverses correctly
    console.log("\nStep C: Verifying prerequisite chain traversal...");
    const weakPrereqs = await getPrerequisiteChain(conceptB.id);
    console.log("Weak prerequisites found for Concept B:", weakPrereqs);

    if (!weakPrereqs || weakPrereqs.length === 0 || weakPrereqs[0].name !== 'Test Concept A (Newton Laws)') {
      throw new Error("Prerequisite chain traversal failed to locate Concept A!");
    }
    console.log("✅ Prerequisite chain traversal verified successfully.");

    // Step D: Simulate Socratic Success (updateConceptState with correct=true)
    console.log("\nStep D: Simulating Socratic tutor success (Understood = true)...");
    const oldTimesCorrect = conceptA.times_correct;
    
    // Simulate student demonstrating understanding of Concept A
    await updateConceptState(conceptA.id, true, 0);

    const { data: updatedA } = await directSupabase.from('concepts').select('*').eq('id', conceptA.id).single();
    console.log(`Concept A updated times correct: ${updatedA.times_correct} (was ${oldTimesCorrect})`);
    console.log(`Concept A new mastery: ${updatedA.mastery}`);

    if (updatedA.times_correct !== oldTimesCorrect + 1) {
      throw new Error("Socratic success update failed to increment times_correct in ATLAS!");
    }
    console.log("✅ Socratic ATLAS mastery upgrade verified successfully.");

    // Step E: Simulate Socratic Gap Found (createSingleCard)
    console.log("\nStep E: Simulating Socratic gap detection (gapFound)...");
    const gapQuestion = "Under what condition does static friction reach its maximum value?";
    const gapAnswer = "When the applied force equals the limiting friction force (f_s,max = mu_s * N).";

    // Clear old test cards
    await directSupabase.from('revision_cards')
      .delete()
      .eq('user_id', userId)
      .eq('concept_id', conceptB.id)
      .like('front', '%static friction%');

    await createSingleCard(
      userId,
      conceptB.id,
      gapQuestion,
      gapAnswer,
      'Physics',
      'Laws of Motion'
    );

    // Verify card was created in the database
    const { data: cards } = await directSupabase.from('revision_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('concept_id', conceptB.id)
      .like('front', '%static friction%');

    if (!cards || cards.length === 0) {
      throw new Error("MEMORY gap card creation failed! No card inserted.");
    }

    const createdCard = cards[0];
    console.log("Created Gap Card Details:");
    console.log(`- Front: ${createdCard.front}`);
    console.log(`- Back: ${createdCard.back}`);
    console.log(`- Stability: ${createdCard.stability}`);
    console.log(`- Difficulty: ${createdCard.difficulty}`);

    if (!createdCard.front.includes('[Tutor Gap]') || !createdCard.back.includes('limiting friction')) {
      throw new Error("MEMORY card contents or difficulty tuning is malformed!");
    }
    console.log("✅ MEMORY gap card generation verified successfully.");

    // Clean up test records
    console.log("\nCleaning up test database records...");
    await directSupabase.from('concept_links').delete().eq('user_id', userId);
    await directSupabase.from('concepts').delete().eq('user_id', userId).in('name', ['Test Concept A (Newton Laws)', 'Test Concept B (Friction)']);
    await directSupabase.from('revision_cards').delete().eq('user_id', userId).eq('concept_id', conceptB.id);

    console.log("\n==================================================");
    console.log("🎉 ALL SOCRATIC INTEGRATION TESTS PASSED! 🎉");
    console.log("==================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error(err);
    process.exit(1);
  }
}

runTest();
