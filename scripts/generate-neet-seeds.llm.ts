import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { NEET_UG_2026_UNITS } from '../lib/syllabus/neet-ug-2026';

const BASE_DIR = path.join(process.cwd(), 'lib/topic-seeding/templates/neet');
const DATA_DIR = path.join(BASE_DIR, 'data');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const schema = {
  type: 'object',
  properties: {
    missions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          conceptTags: { type: 'array', items: { type: 'string' } },
          estimatedMinutes: { type: 'number' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          microtargets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                conceptTags: { type: 'array', items: { type: 'string' } },
                ncertAnchors: { type: 'array', items: { type: 'string' } },
                mustKnowFacts: { type: 'array', items: { type: 'string' } },
                formulas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      expression: { type: 'string' },
                      variables: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'expression', 'variables']
                  }
                },
                reactions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      equation: { type: 'string' },
                      reagentConditions: { type: 'array', items: { type: 'string' } },
                      mechanismTags: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'equation', 'reagentConditions', 'mechanismTags']
                  }
                },
                diagrams: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      labels: { type: 'array', items: { type: 'string' } },
                      provesOrShows: { type: 'string' },
                      commonLabelTraps: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'labels', 'provesOrShows', 'commonLabelTraps']
                  }
                },
                commonTraps: { type: 'array', items: { type: 'string' } },
                masteryCriteria: { type: 'array', items: { type: 'string' } },
                pyqPatterns: { type: 'array', items: { type: 'string' } },
                estimatedMinutes: { type: 'number' },
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                activeRecallQuestions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      question: { type: 'string' },
                      expectedAnswerPoints: { type: 'array', items: { type: 'string' } },
                      acceptedSynonyms: { type: 'array', items: { type: 'string' } },
                      conceptTags: { type: 'array', items: { type: 'string' } },
                      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                      taxonomyPath: {
                        type: 'object',
                        properties: {
                          topicSlug: { type: 'string' },
                          subtopicSlug: { type: 'string' },
                          conceptSlug: { type: 'string' },
                          microskillSlug: { type: 'string' },
                          subject: { type: 'string' },
                          unitSlug: { type: 'string' },
                          chapterSlug: { type: 'string' }
                        },
                        required: ['topicSlug', 'subtopicSlug', 'conceptSlug', 'microskillSlug', 'subject', 'unitSlug', 'chapterSlug']
                      }
                    },
                    required: ['id', 'question', 'expectedAnswerPoints', 'acceptedSynonyms', 'conceptTags', 'difficulty', 'taxonomyPath']
                  }
                }
              },
              required: ['id', 'title', 'conceptTags', 'ncertAnchors', 'mustKnowFacts', 'commonTraps', 'masteryCriteria', 'pyqPatterns', 'estimatedMinutes', 'difficulty', 'activeRecallQuestions']
            }
          }
        },
        required: ['id', 'title', 'description', 'conceptTags', 'estimatedMinutes', 'difficulty', 'microtargets']
      }
    }
  },
  required: ['missions']
};

async function generateChapterData(unit: any) {
  const prompt = \`Generate highly detailed, exhaustively deep JSON seed data for the NEET syllabus chapter: "\${unit.chapterSlug}" in \${unit.subject}.
    Constraints:
    1. Physics/Chemistry chapters MUST have at least 20 microtargets. Biology MUST have at least 30 microtargets (50+ for large units like human physiology).
    2. Do NOT use fake formulas (e.g. F=ma everywhere). Only use real formulas for the exact topic.
    3. Include reactions for Organic Chemistry. Include diagrams for Biology.
    4. Taxonomy slugs must NOT be generic (e.g., no topic-0).
    5. No placeholder phrases like "NCERT paragraph on".
    6. Include specific commonTraps and PYQ patterns.\`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema as any,
      temperature: 0.1
    }
  });

  return JSON.parse(response.text || '{}');
}

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY is not set. Please export it and run again.');
    process.exit(1);
  }

  // We skip Kinematics, GOC, and Human Physiology as they are manually perfected.
  const skipList = ['kinematics', 'goc', 'some-basic-principles-of-organic-chemistry', 'human-physiology'];
  
  for (const unit of NEET_UG_2026_UNITS) {
    if (skipList.includes(unit.chapterSlug)) continue;

    console.log(\`Generating deep seed data for \${unit.chapterSlug}...\`);
    const data = await generateChapterData(unit);
    
    const subjectPath = path.join(DATA_DIR, unit.subject.toLowerCase());
    fs.mkdirSync(subjectPath, { recursive: true });
    
    fs.writeFileSync(path.join(subjectPath, \`\${unit.chapterSlug}.json\`), JSON.stringify(data, null, 2));
    console.log(\`✅ Finished \${unit.chapterSlug}\`);
  }
}

run();
