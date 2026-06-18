import { describe, test, expect } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';

describe('NEET Specificity Tests', () => {
  test('Kinematics has deep specificity', () => {
    const kinematics = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === 'kinematics');
    expect(kinematics).toBeDefined();
    
    const jsonStr = JSON.stringify(kinematics);
    expect(jsonStr.toLowerCase()).toContain('displacement');
    expect(jsonStr.toLowerCase()).toContain('acceleration');
    expect(jsonStr.toLowerCase()).toContain('projectile');
    expect(jsonStr.toLowerCase()).toContain('circular');
    expect(jsonStr.toLowerCase()).toContain('relative');
    
    // Check formulas exist
    let hasEquations = false;
    kinematics!.missions.forEach(m => {
        m.microtargets.forEach(mt => {
            if (mt.formulas && mt.formulas.length > 0) hasEquations = true;
        });
    });
    expect(hasEquations).toBe(true);
  });

  test('Human Physiology sub-chapters have deep specificity', () => {
    // After the split, human-physiology is now 7 sub-chapters
    const humanPhysioSlugs = [
      'human-physiology-digestion',
      'human-physiology-breathing',
      'human-physiology-circulation',
      'human-physiology-excretion',
      'human-physiology-locomotion',
      'human-physiology-neural',
      'human-physiology-chemical',
    ];

    for (const slug of humanPhysioSlugs) {
      const chapter = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === slug);
      expect(chapter, `Missing sub-chapter: ${slug}`).toBeDefined();
      expect(chapter!.missions.length).toBeGreaterThanOrEqual(1);
    }

    // Check breathing sub-chapter contains breathing-specific content
    const breathing = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === 'human-physiology-breathing');
    const breathingJson = JSON.stringify(breathing);
    expect(breathingJson.toLowerCase()).toContain('breathing');

    // Check circulation sub-chapter contains circulation-specific content
    const circulation = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === 'human-physiology-circulation');
    const circulationJson = JSON.stringify(circulation);
    expect(circulationJson.toLowerCase()).toContain('heart');
  });

  test('GOC has deep specificity', () => {
    const goc = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === 'goc');
    expect(goc).toBeDefined();
    
    const jsonStr = JSON.stringify(goc);
    expect(jsonStr.toLowerCase()).toContain('inductive');
    expect(jsonStr.toLowerCase()).toContain('resonance');
    expect(jsonStr.toLowerCase()).toContain('hyperconjugation');
    expect(jsonStr.toLowerCase()).toContain('electrophile');
    expect(jsonStr.toLowerCase()).toContain('carbocation');
    
    let hasReactions = false;
    goc!.missions.forEach(m => {
        m.microtargets.forEach(mt => {
            if (mt.reactions && mt.reactions.length > 0) hasReactions = true;
        });
    });
    expect(hasReactions).toBe(true);
  });
  
  test('Biology has diagram coverage', () => {
     // human-physiology is now sub-chapters; check the ones that are diagram-heavy
     const diagramHeavyBioChapters = [
       'human-physiology-digestion',
       'human-physiology-breathing',
       'human-physiology-circulation',
       'plant-physiology',
       'reproduction',
       'ecology-and-environment',
       'cell-structure-and-function',
       'structural-organisation',
     ];
     
     diagramHeavyBioChapters.forEach(slug => {
         const chapter = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === slug);
         expect(chapter, `Missing chapter: ${slug}`).toBeDefined();
         let hasDiagram = false;
         chapter!.missions.forEach(m => {
             m.microtargets.forEach(mt => {
                 if (mt.diagrams && mt.diagrams.length > 0) hasDiagram = true;
             });
         });
         expect(hasDiagram).toBe(true, `Chapter ${slug} missing diagrams`);
     });
  });

  test('Chemistry organic has reaction coverage', () => {
     const organicChapters = ['goc', 'hydrocarbons', 'haloalkanes-haloarenes', 'oxygen-containing-compounds', 'nitrogen-containing-compounds'];
     
     organicChapters.forEach(slug => {
         const chapter = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === slug);
         expect(chapter).toBeDefined();
         let hasReaction = false;
         chapter!.missions.forEach(m => {
             m.microtargets.forEach(mt => {
                 if (mt.reactions && mt.reactions.length > 0) hasReaction = true;
             });
         });
         expect(hasReaction).toBe(true, `Chapter ${slug} missing reactions`);
     });
  });
});
