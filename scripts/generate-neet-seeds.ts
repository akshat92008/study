import * as fs from 'fs';
import * as path from 'path';
import { NEET_UG_2026_UNITS, NeetUgUnit } from '../lib/syllabus/neet-ug-2026';

const BASE_DIR = path.join(__dirname, '..', 'lib', 'topic-seeding', 'templates', 'neet');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateMissions(unit: NeetUgUnit) {
  const missions = [];
  const baseKeywords = unit.keywords.length >= 4 ? unit.keywords : [...unit.keywords, 'basics', 'advanced', 'applications', 'concepts'];
  
  for (let i = 0; i < 6; i++) {
    const keyword1 = baseKeywords[i % baseKeywords.length];
    const keyword2 = baseKeywords[(i + 1) % baseKeywords.length];
    
    const microtargets = [];
    for (let j = 0; j < 4; j++) {
      const activeRecallQuestions = [];
      for (let k = 0; k < 5; k++) {
        activeRecallQuestions.push(`{
          id: "${unit.chapterSlug}-q-${i}-${j}-${k}",
          question: "What is the primary function or definition of ${keyword1} and ${keyword2} in the context of ${unit.unitTitle}?",
          expectedAnswerPoints: [
            "It relates to the core principle of ${keyword1}",
            "It interacts with ${keyword2}"
          ],
          acceptedSynonyms: ["${keyword1} principle", "${keyword2} basics"],
          conceptTags: ["${keyword1.replace(/\s+/g, '_')}", "${keyword2.replace(/\s+/g, '_')}"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "${unit.subject}",
            unitSlug: "${unit.chapterSlug}",
            chapterSlug: "${unit.chapterSlug}",
            topicSlug: "${unit.chapterSlug}-topic-${i}",
            subtopicSlug: "${keyword1.replace(/\s+/g, '-').toLowerCase()}",
            conceptSlug: "${keyword2.replace(/\s+/g, '-').toLowerCase()}",
            microskillSlug: "skill-${j}-${k}"
          },
          errorPatterns: [
            {
              slug: "confuses-${keyword1.replace(/\s+/g, '-').toLowerCase()}",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that ${keyword1} behaves differently than ${keyword2}."
            }
          ]
        }`);
      }

      microtargets.push(`{
        id: "${unit.chapterSlug}-mt-${i}-${j}",
        title: "Mastering ${capitalize(keyword1)} and ${capitalize(keyword2)}",
        conceptTags: ["${keyword1.replace(/\s+/g, '_')}", "${keyword2.replace(/\s+/g, '_')}"],
        ncertAnchors: ["NCERT paragraph on ${keyword1}"],
        mustKnowFacts: [
          "The most important fact about ${keyword1} is its relationship with ${keyword2}.",
          "Always remember the standard unit and formula for ${keyword1}."
        ],
        formulas: [
          {
            name: "Standard equation for ${keyword1}",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing ${keyword1} with ${keyword2}.",
          "Forgetting the sign convention in ${keyword1} calculations."
        ],
        activeRecallQuestions: [
          ${activeRecallQuestions.join(',\n          ')}
        ],
        pyqPatterns: [
          "Numerical on ${keyword1} and ${keyword2}.",
          "Assertion-Reason based on ${keyword1} properties."
        ],
        masteryCriteria: [
          "Can accurately define ${keyword1}.",
          "Can solve numericals involving ${keyword2}."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }`);
    }

    missions.push(`{
      id: "${unit.chapterSlug}-m-${i}",
      title: "${capitalize(keyword1)} and ${capitalize(keyword2)} Essentials",
      description: "A comprehensive mission covering ${keyword1} and ${keyword2}.",
      conceptTags: ["${keyword1.replace(/\s+/g, '_')}", "${keyword2.replace(/\s+/g, '_')}"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        ${microtargets.join(',\n        ')}
      ]
    }`);
  }
  return missions;
}

function generateFileContent(unit: NeetUgUnit) {
  const missionsStr = generateMissions(unit);
  
  return `import { ChapterSeed } from '../../../types';

export const ${unit.chapterSlug.replace(/-/g, '_')}_seed: ChapterSeed = {
  exam: "NEET",
  syllabusVersion: "NEET_UG_2026",
  subject: "${unit.subject}",
  unitNumber: ${unit.unitNumber},
  unitTitle: "${unit.unitTitle}",
  chapterSlug: "${unit.chapterSlug}",
  chapterTitle: "${unit.unitTitle}",
  classLevel: "${unit.classLevel === 'mixed' ? 'mixed' : unit.classLevel}",
  aliases: ${JSON.stringify(unit.aliases)},
  ncertMapping: ${JSON.stringify(unit.ncertMapping)},
  prerequisites: [],
  estimatedHours: 8,
  priority: "high",
  missions: [
    ${missionsStr.join(',\n    ')}
  ]
};
`;
}

function run() {
  ensureDir(BASE_DIR);
  const subjects = ['physics', 'chemistry', 'biology'];
  subjects.forEach(s => ensureDir(path.join(BASE_DIR, s)));

  const imports: string[] = [];
  const exports: string[] = [];

  NEET_UG_2026_UNITS.forEach(unit => {
    const folder = unit.subject.toLowerCase();
    const filePath = path.join(BASE_DIR, folder, `${unit.chapterSlug}.ts`);
    
    fs.writeFileSync(filePath, generateFileContent(unit));
    console.log(`Generated ${filePath}`);
    
    const varName = `${unit.chapterSlug.replace(/-/g, '_')}_seed`;
    imports.push(`import { ${varName} } from './${folder}/${unit.chapterSlug}';`);
    exports.push(`export { ${varName} };`);
  });

  const indexContent = `import { ChapterSeed } from '../../types';

${imports.join('\n')}

${exports.join('\n')}

export const ALL_NEET_CHAPTER_SEEDS: ChapterSeed[] = [
  ${NEET_UG_2026_UNITS.map(u => `${u.chapterSlug.replace(/-/g, '_')}_seed`).join(',\n  ')}
];
`;

  fs.writeFileSync(path.join(BASE_DIR, 'index.ts'), indexContent);
  console.log('Generated index.ts');
}

run();
