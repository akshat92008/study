import { resolveTopicSkeletonForText } from './lib/topic-seeding/templates/neet/topic-skeleton';

const text = 'Human respiratory system anatomy body-fluids-and-circulation human-respiratory-system-anatomy breathing circulation excretion locomotion neural endocrine NCERT Biology Class 11, Chapter: Human Physiology, Section detailing Human respiratory system anatomy';
const chapterSlug = 'human-physiology-breathing';

const result = resolveTopicSkeletonForText(text, chapterSlug);
console.log('Result:', result);
