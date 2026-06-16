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

  test('Human Physiology has deep specificity', () => {
    const physiology = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === 'human-physiology');
    expect(physiology).toBeDefined();
    
    const jsonStr = JSON.stringify(physiology);
    expect(jsonStr.toLowerCase()).toContain('breathing');
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
     const diagramHeavyBioChapters = ['human-physiology', 'plant-physiology', 'reproduction', 'ecology-and-environment', 'cell-structure-and-function', 'structural-organisation'];
     
     diagramHeavyBioChapters.forEach(slug => {
         const chapter = ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === slug);
         expect(chapter).toBeDefined();
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
