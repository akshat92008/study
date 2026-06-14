import { createClient } from '@supabase/supabase-js';
import { ALL_NEET_CHAPTER_SEEDS } from '../lib/topic-seeding/templates/neet';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot run seeding script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedTopics() {
  console.log(`Starting to seed ${ALL_NEET_CHAPTER_SEEDS.length} NEET chapters into the global template registry (if applicable)...`);
  
  // NOTE: In the current architecture, templates are read statically from the codebase
  // inside \`selectSeedTemplate\`. The database table \`seeded_topics\` stores user-specific
  // instantiated topics, not the templates themselves.
  // 
  // If the product uses a \`global_seed_templates\` table, we would upsert here.
  // For now, this script validates that all chapters can be serialized and logged.
  
  let successCount = 0;
  for (const seed of ALL_NEET_CHAPTER_SEEDS) {
    try {
      // Validate serialization
      JSON.stringify(seed);
      successCount++;
    } catch (e) {
      console.error(`Failed to process seed for chapter ${seed.chapterSlug}:`, e);
    }
  }

  console.log(`Successfully verified ${successCount}/${ALL_NEET_CHAPTER_SEEDS.length} templates for deployment.`);
  console.log('Since templates are statically bundled in the app router, no DB writes are strictly required for templates unless explicitly configured.');
}

seedTopics().catch(console.error);
