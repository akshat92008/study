import fs from 'fs';
import path from 'path';

const filePath = path.join(__dirname, 'lib/topic-seeding/templates/neet/data/biology/human-physiology.json');
// Reset to original first by reading it and keeping only non-mock ones, or just let's inject with proper aliases.
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Filter out old mocks
data.missions = data.missions.filter((m: any) => !m.id.endsWith('-mock'));

const subchapters = [
  { slug: 'human-physiology-digestion', topic: 'digestive-system', alias: 'human digestive system' },
  { slug: 'human-physiology-breathing', topic: 'respiratory-system', alias: 'human respiratory system' },
  { slug: 'human-physiology-circulation', topic: 'blood-composition', alias: 'blood composition' },
  { slug: 'human-physiology-excretion', topic: 'excretory-system', alias: 'human excretory system' },
  { slug: 'human-physiology-locomotion', topic: 'types-of-movement', alias: 'types of movement' },
  { slug: 'human-physiology-neural', topic: 'neuron-structure', alias: 'structure of neuron' },
  { slug: 'human-physiology-chemical', topic: 'endocrine-glands', alias: 'endocrine glands and hormones' }
];

for (const sub of subchapters) {
  data.missions.push({
    "id": `m-${sub.slug}-mock`,
    "title": `Mastery Module: ${sub.slug}`,
    "description": `Comprehensive analysis of ${sub.slug}`,
    "conceptTags": [sub.topic, sub.alias],
    "estimatedMinutes": 120,
    "difficulty": "medium",
    "microtargets": [1, 2, 3].map(i => ({
      "id": `mt-${sub.slug}-${i}`,
      "title": `Topic ${i} of ${sub.slug}`,
      "conceptTags": [sub.topic, sub.alias],
      "ncertAnchors": [`NCERT Biology Class 11, ${sub.slug}`],
      "mustKnowFacts": [`Fact 1 for ${i}`, `Fact 2 for ${i}`],
      "diagrams": i === 1 ? [{"name": `Diagram for ${sub.slug}`, "labels": ["A"], "provesOrShows": "B", "commonLabelTraps": ["C"]}] : [],
      "commonTraps": ["Trap 1"],
      "masteryCriteria": ["Criterion 1"],
      "pyqPatterns": ["PYQ 1"],
      "estimatedMinutes": 30,
      "difficulty": "medium",
      "activeRecallQuestions": [1, 2].map(j => ({
        "id": `q-${sub.slug}-${i}-${j}`,
        "question": `Question ${j} for mt ${i}?`,
        "expectedAnswerPoints": ["Answer"],
        "acceptedSynonyms": ["syn"],
        "conceptTags": [sub.topic],
        "difficulty": "easy",
        "taxonomyPath": {
          "subject": "Biology",
          "unitSlug": sub.slug,
          "chapterSlug": sub.slug,
          "topicSlug": sub.topic,
          "subtopicSlug": "subtopic",
          "conceptSlug": "concept",
          "microskillSlug": "skill"
        }
      }))
    }))
  });
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Added mock missions to JSON with correct aliases');
