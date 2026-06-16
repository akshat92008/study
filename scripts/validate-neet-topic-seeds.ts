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
    "Generic subtopic",
    "Mastering X and Y",
    "Important Concept"
  ];

  for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
    const jsonStr = JSON.stringify(chapter);
    for (const phrase of FORBIDDEN_PHRASES) {
      if (jsonStr.includes(phrase)) {
        console.error(`ERROR: Chapter ${chapter.chapterSlug} contains forbidden placeholder phrase: "${phrase}"`);
        hasErrors = true;
      }
    }

    // Check for fake numbered slugs like kinematics-topic-0
    if (jsonStr.match(/topic-0/i) || jsonStr.match(/skill-0-[0-9]+/i)) {
        console.error(`ERROR: Chapter ${chapter.chapterSlug} contains fake numbered slugs.`);
        hasErrors = true;
    }

    let mtCount = 0;
    let recallCount = 0;
    const mtTitles = new Set<string>();
    const questionsText = new Set<string>();
    let hasFormulas = false;
    let hasReactions = false;
    let hasDiagrams = false;
    
    // For deep coverage checks
    let combinedTagsAndTitles = "";

    for (const mission of chapter.missions) {
      if (mission.title === "X and Y Essentials" || mission.title === "Mastering X and Y") {
          console.error(`ERROR: Generic mission title in ${chapter.chapterSlug}: "${mission.title}"`);
          hasErrors = true;
      }

      mtCount += mission.microtargets.length;
      for (const mt of mission.microtargets) {
        combinedTagsAndTitles += " " + mt.title.toLowerCase() + " " + mt.conceptTags.join(" ");

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
          
          if (!q.taxonomyPath || !q.taxonomyPath.subtopicSlug || q.taxonomyPath.subtopicSlug === '') {
              console.error(`ERROR: Missing taxonomy path in ${chapter.chapterSlug} for question: "${q.question}"`);
              hasErrors = true;
          }
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
            if (f.variables.length === 3 && f.variables.includes('X') && f.variables.includes('Y') && f.variables.includes('Z')) {
              console.error(`ERROR: Microtarget ${mt.id} contains fake formula variables X,Y,Z`);
              hasErrors = true;
            }
            if (f.expression === 'F = m a' || f.expression === 'PV = nRT') {
                if (chapter.chapterSlug !== 'laws-of-motion' && f.expression === 'F = m a') {
                    console.error(`ERROR: Fake F=ma in ${chapter.chapterSlug}`);
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
    const largeBioUnits = ['human-physiology', 'genetics-and-evolution', 'reproduction', 'ecology-and-environment', 'plant-physiology'];
    if (chapter.subject === 'Physics' || chapter.subject === 'Chemistry') {
      if (mtCount < 20) { 
        console.error(`ERROR: Chapter ${chapter.chapterSlug} has ${mtCount} microtargets (min 20 expected).`);
        hasErrors = true;
      }
    } else if (chapter.subject === 'Biology') {
      if (largeBioUnits.includes(chapter.chapterSlug)) {
        if (mtCount < 50) {
          console.error(`ERROR: Large Biology chapter ${chapter.chapterSlug} has ${mtCount} microtargets (min 50 expected).`);
          hasErrors = true;
        }
      } else {
        if (mtCount < 30) {
          console.error(`ERROR: Biology chapter ${chapter.chapterSlug} has ${mtCount} microtargets (min 30 expected).`);
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

    const organicChapters = ['goc', 'hydrocarbons', 'haloalkanes-haloarenes', 'oxygen-containing-compounds', 'nitrogen-containing-compounds'];
    if (chapter.subject === 'Chemistry' && organicChapters.includes(chapter.chapterSlug) && !hasReactions) {
      console.error(`ERROR: Organic Chemistry chapter ${chapter.chapterSlug} has no reactions.`);
      hasErrors = true;
    }

    const diagramHeavyBioChapters = ['human-physiology', 'plant-physiology', 'reproduction', 'ecology-and-environment', 'cell-structure-and-function', 'structural-organisation'];
    if (chapter.subject === 'Biology' && diagramHeavyBioChapters.includes(chapter.chapterSlug) && !hasDiagrams) {
      console.error(`ERROR: Biology chapter ${chapter.chapterSlug} has no diagrams.`);
      hasErrors = true;
    }

    // Specific Content Coverage Requirements
    if (chapter.chapterSlug === 'kinematics') {
        if (!combinedTagsAndTitles.match(/graph/i) || !combinedTagsAndTitles.match(/projectile/i) || !combinedTagsAndTitles.match(/relative/i) || !combinedTagsAndTitles.match(/circular/i)) {
             console.error(`ERROR: Kinematics lacks required subtopics (graph/projectile/relative/circular).`);
             hasErrors = true;
        }
    }

    if (chapter.chapterSlug === 'human-physiology') {
        if (!combinedTagsAndTitles.match(/breathing/i) || !combinedTagsAndTitles.match(/circulation/i) || !combinedTagsAndTitles.match(/excretion/i) || !combinedTagsAndTitles.match(/locomotion/i) || !combinedTagsAndTitles.match(/neural/i) || !combinedTagsAndTitles.match(/endocrine/i)) {
             console.error(`ERROR: Human Physiology lacks required subtopics.`);
             hasErrors = true;
        }
    }

    if (chapter.chapterSlug === 'goc') {
        if (!combinedTagsAndTitles.match(/inductive/i) || !combinedTagsAndTitles.match(/resonance/i) || !combinedTagsAndTitles.match(/hyperconjugation/i) || !combinedTagsAndTitles.match(/acid/i) || !combinedTagsAndTitles.match(/basic/i) || !combinedTagsAndTitles.match(/intermediate/i)) {
             console.error(`ERROR: GOC lacks required subtopics (inductive/resonance/hyperconjugation/acidity/basicity/intermediates).`);
             hasErrors = true;
        }
    }
    
    if (chapter.chapterSlug === 'genetics-and-evolution') {
        if (!combinedTagsAndTitles.match(/mendel/i) || !combinedTagsAndTitles.match(/molecular/i) || !combinedTagsAndTitles.match(/evolution/i) || !combinedTagsAndTitles.match(/hardy/i)) {
             console.error(`ERROR: Genetics lacks required subtopics.`);
             hasErrors = true;
        }
    }
    
    if (chapter.chapterSlug === 'biotechnology') {
        if (!combinedTagsAndTitles.match(/restriction/i) || !combinedTagsAndTitles.match(/pcr/i) || !combinedTagsAndTitles.match(/vector/i) || !combinedTagsAndTitles.match(/bioreactor/i)) {
             console.error(`ERROR: Biotechnology lacks required subtopics.`);
             hasErrors = true;
        }
    }
  }

  if (hasErrors) {
    console.error('Validation failed. Please fix the above errors.');
    process.exit(1);
  } else {
    console.log('All NEET topics validated successfully with strict depth constraints!');
    process.exit(0);
  }
}

validate();
