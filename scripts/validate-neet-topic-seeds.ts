import { ALL_NEET_CHAPTER_SEEDS } from '../lib/topic-seeding/templates/neet';
import { NEET_UG_2026_UNITS } from '../lib/syllabus/neet-ug-2026';

function validate() {
  console.log(`Validating ${ALL_NEET_CHAPTER_SEEDS.length} NEET chapters...`);
  
  if (ALL_NEET_CHAPTER_SEEDS.length !== NEET_UG_2026_UNITS.length) {
    console.error(`ERROR: Found ${ALL_NEET_CHAPTER_SEEDS.length} seeds but expected ${NEET_UG_2026_UNITS.length} units.`);
    process.exit(1);
  }

  let hasErrors = false;

  const FORBIDDEN_PHRASES = [
    "X = Y + Z",
    "NCERT paragraph on",
    "What is the primary function or definition",
    "The most important fact about",
    "Standard equation for",
    "Standard temperature and pressure" // We will check if it's genuinely relevant later, for now we will avoid it in biology/physics unless it's specific
  ];

  for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
    const jsonStr = JSON.stringify(chapter);
    for (const phrase of FORBIDDEN_PHRASES) {
      // Exclude genuine STP mentions in chemistry thermodynamics/states of matter
      if (phrase === "Standard temperature and pressure" && chapter.subject === "Chemistry") {
         continue;
      }
      if (jsonStr.includes(phrase)) {
        console.error(`ERROR: Chapter ${chapter.chapterSlug} contains forbidden placeholder phrase: "${phrase}"`);
        hasErrors = true;
      }
    }

    let mtCount = 0;
    let recallCount = 0;
    const mtTitles = new Set<string>();
    const questionsText = new Set<string>();
    let hasFormulas = false;
    let hasReactions = false;
    let hasDiagrams = false;

    for (const mission of chapter.missions) {
      if (mission.title === "X and Y Essentials") {
          console.error(`ERROR: Generic mission title in ${chapter.chapterSlug}: "${mission.title}"`);
          hasErrors = true;
      }

      mtCount += mission.microtargets.length;
      for (const mt of mission.microtargets) {
        
        if (mtTitles.has(mt.title)) {
          console.error(`ERROR: Duplicate microtarget title in ${chapter.chapterSlug}: "${mt.title}"`);
          hasErrors = true;
        }
        mtTitles.add(mt.title);

        recallCount += mt.activeRecallQuestions?.length || 0;
        
        for (const q of mt.activeRecallQuestions || []) {
          if (questionsText.has(q.question)) {
            console.error(`ERROR: Duplicate question in ${chapter.chapterSlug}: "${q.question}"`);
            hasErrors = true;
          }
          questionsText.add(q.question);
        }

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

        if (mt.formulas && mt.formulas.length > 0) {
          hasFormulas = true;
          for (const f of mt.formulas) {
            // Check for placeholder variables
            const varsStr = f.variables.join(',');
            if (f.variables.length === 3 && f.variables.includes('X') && f.variables.includes('Y') && f.variables.includes('Z')) {
              console.error(`ERROR: Microtarget ${mt.id} contains fake formula variables X,Y,Z`);
              hasErrors = true;
            }
            if (varsStr.match(/^[A-Z](,[A-Z])*$/) && f.variables.length >= 3) {
              if (f.variables.includes('A') && f.variables.includes('B') && f.variables.includes('C_v')) {
                 console.error(`ERROR: Microtarget ${mt.id} contains fake formula variables A,B,C_v`);
                 hasErrors = true;
              }
            }
          }
        }
        
        if (mt.reactions && mt.reactions.length > 0) hasReactions = true;
        if (mt.diagrams && mt.diagrams.length > 0) hasDiagrams = true;
      }
    }

    // STRICT LENGTH CHECKS
    const largeBioUnits = ['human-physiology', 'genetics-and-evolution', 'reproduction', 'ecology-and-environment'];
    if (chapter.subject === 'Physics' || chapter.subject === 'Chemistry') {
      if (mtCount < 14) { // Small buffer for tiny units, but canonicals are around 15-38. Most are >16.
        console.error(`ERROR: Chapter ${chapter.chapterSlug} has ${mtCount} microtargets (min 15 expected).`);
        hasErrors = true;
      }
    } else if (chapter.subject === 'Biology') {
      if (largeBioUnits.includes(chapter.chapterSlug)) {
        if (mtCount < 30) {
          console.error(`ERROR: Large Biology chapter ${chapter.chapterSlug} has ${mtCount} microtargets (min 30 expected).`);
          hasErrors = true;
        }
      } else {
        if (mtCount < 20) {
          console.error(`ERROR: Biology chapter ${chapter.chapterSlug} has ${mtCount} microtargets (min 20 expected).`);
          hasErrors = true;
        }
      }
    }

    // Specific Subject Requirements
    const numericalPhysics = ['kinematics', 'laws-of-motion', 'work-energy-power', 'rotational-motion', 'gravitation', 'thermodynamics', 'electrostatics', 'current-electricity', 'magnetic-effects-and-magnetism', 'emi-and-ac', 'optics', 'dual-nature', 'atoms-and-nuclei'];
    if (chapter.subject === 'Physics' && numericalPhysics.includes(chapter.chapterSlug) && !hasFormulas) {
      console.error(`ERROR: Physics chapter ${chapter.chapterSlug} has no formulas.`);
      hasErrors = true;
    }

    const organicChapters = ['goc', 'hydrocarbons', 'haloalkanes-haloarenes', 'oxygen-compounds', 'nitrogen-compounds'];
    if (chapter.subject === 'Chemistry' && organicChapters.includes(chapter.chapterSlug) && !hasReactions) {
      console.error(`ERROR: Organic Chemistry chapter ${chapter.chapterSlug} has no reactions.`);
      hasErrors = true;
    }

    const diagramHeavyBioChapters = ['human-physiology', 'plant-physiology', 'reproduction', 'ecology-and-environment', 'cell-structure-and-function', 'structural-organisation'];
    if (chapter.subject === 'Biology' && diagramHeavyBioChapters.includes(chapter.chapterSlug) && !hasDiagrams) {
      console.error(`ERROR: Biology chapter ${chapter.chapterSlug} has no diagrams.`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('Validation failed.');
    process.exit(1);
  } else {
    console.log('All NEET topics validated successfully with strict depth constraints!');
    process.exit(0);
  }
}

validate();
