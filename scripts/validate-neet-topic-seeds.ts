import { ALL_NEET_CHAPTER_SEEDS } from '../lib/topic-seeding/templates/neet';
import { NEET_UG_2026_UNITS } from '../lib/syllabus/neet-ug-2026';

function validate() {
  console.log(`Validating ${ALL_NEET_CHAPTER_SEEDS.length} NEET chapters...`);
  
  if (ALL_NEET_CHAPTER_SEEDS.length !== NEET_UG_2026_UNITS.length) {
    console.error(`ERROR: Found ${ALL_NEET_CHAPTER_SEEDS.length} seeds but expected ${NEET_UG_2026_UNITS.length} units.`);
    process.exit(1);
  }

  let hasErrors = false;

  for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
    if (chapter.missions.length < 4) {
      console.error(`ERROR: Chapter ${chapter.chapterSlug} has ${chapter.missions.length} missions (min 4).`);
      hasErrors = true;
    }

    let mtCount = 0;
    let recallCount = 0;

    for (const mission of chapter.missions) {
      mtCount += mission.microtargets.length;
      for (const mt of mission.microtargets) {
        recallCount += mt.activeRecallQuestions?.length || 0;
        
        if (!mt.mustKnowFacts || mt.mustKnowFacts.length === 0) {
          console.error(`ERROR: Microtarget ${mt.id} missing mustKnowFacts`);
          hasErrors = true;
        }
        
        if (!mt.commonTraps || mt.commonTraps.length === 0) {
          console.error(`ERROR: Microtarget ${mt.id} missing commonTraps`);
          hasErrors = true;
        }
        
        if (!mt.masteryCriteria || mt.masteryCriteria.length === 0) {
          console.error(`ERROR: Microtarget ${mt.id} missing masteryCriteria`);
          hasErrors = true;
        }
      }
    }

    if (mtCount < 12) {
      console.error(`ERROR: Chapter ${chapter.chapterSlug} has ${mtCount} microtargets (min 12).`);
      hasErrors = true;
    }

    if (recallCount < 25) {
      console.error(`ERROR: Chapter ${chapter.chapterSlug} has ${recallCount} recall questions (min 25).`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('Validation failed.');
    process.exit(1);
  } else {
    console.log('All NEET topics validated successfully!');
    process.exit(0);
  }
}

validate();
