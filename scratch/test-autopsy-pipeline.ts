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
  console.log("=== AUTOPSY -> ATLAS -> MEMORY INTEGRATION TEST ===");

  try {
    // Dynamically import engines after require hijack is set up
    const { updateConceptState } = await import('../lib/engines/cognition-graph');
    const { createCardFromMistake } = await import('../lib/engines/revision-engine');
    const { seedConceptsForSubject } = await import('../lib/engines/cognition-graph');

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
    
    const userId = profile.id;
    console.log(`Using User ID: ${userId}`);

    // Step B: Seed concepts if none exist
    let { data: concepts } = await directSupabase.from('concepts').select('*').eq('user_id', userId);
    if (!concepts || concepts.length === 0) {
      console.log("No concepts found for user. Seeding Physics: Kinematics...");
      await seedConceptsForSubject(userId, 'Physics', ['Kinematics']);
      const { data: reloadedConcepts } = await directSupabase.from('concepts').select('*').eq('user_id', userId);
      concepts = reloadedConcepts || [];
    }

    if (concepts.length === 0) {
      throw new Error("Failed to seed concepts.");
    }

    // Choose target concept (e.g., Vector Addition or first concept)
    const targetConcept = concepts.find(c => c.name.includes('Vector')) || concepts[0];
    console.log(`Target concept for testing: "${targetConcept.name}" (ID: ${targetConcept.id})`);
    console.log(`Initial Mastery: ${targetConcept.mastery}, Times Incorrect: ${targetConcept.times_incorrect}`);

    // Step C: Trigger ATLAS mastery downscale (updateConceptState with correct=false, timeSpent=0)
    console.log("\nStep C: Simulating autopsy mistake on ATLAS...");
    await updateConceptState(targetConcept.id, false, 0);

    // Verify concept was updated
    const { data: updatedConcept } = await directSupabase.from('concepts').select('*').eq('id', targetConcept.id).single();
    console.log(`Updated Mastery: ${updatedConcept.mastery}, Times Incorrect: ${updatedConcept.times_incorrect}`);
    
    if (updatedConcept.times_incorrect !== targetConcept.times_incorrect + 1) {
      throw new Error("ATLAS mastery downscale failed to increment times_incorrect!");
    }
    console.log("✅ ATLAS downscale verified successfully.");

    // Step D: Trigger MEMORY card creation (createCardFromMistake)
    console.log("\nStep D: Simulating autopsy mistake card generation in MEMORY...");
    const testQuestion = "Calculate the dot product of vectors A = 2i + 3j and B = 4i - j.";
    const testAnswer = "5";
    const testReasoning = "Student confused dot product sum with vector components addition.";

    // Clean up any existing test cards first
    await directSupabase.from('revision_cards')
      .delete()
      .eq('user_id', userId)
      .eq('concept_id', targetConcept.id)
      .like('front', '%Calculate the dot product%');

    await createCardFromMistake(
      userId,
      targetConcept.id,
      targetConcept.subject,
      targetConcept.chapter,
      testQuestion,
      testAnswer,
      testReasoning
    );

    // Verify card was created in the database
    const { data: cards } = await directSupabase.from('revision_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('concept_id', targetConcept.id)
      .like('front', '%Calculate the dot product%');

    if (!cards || cards.length === 0) {
      throw new Error("MEMORY card creation failed! No card inserted.");
    }

    const createdCard = cards[0];
    console.log("Created Card Details:");
    console.log(`- Front: ${createdCard.front}`);
    console.log(`- Back: ${createdCard.back}`);
    console.log(`- State (FSRS): ${createdCard.state}`);
    console.log(`- Due (FSRS): ${createdCard.due}`);

    if (!createdCard.front.includes('[Mistake Recovery]') || !createdCard.back.includes('Why you got it wrong:')) {
      throw new Error("MEMORY card contents are malformed!");
    }
    console.log("✅ MEMORY card generation verified successfully.");

    console.log("\n==================================================");
    console.log("🎉 ALL INTEGRATION PIPELINE TESTS PASSED SUCCESSFULLY! 🎉");
    console.log("==================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error(err);
    process.exit(1);
  }
}

runTest();
