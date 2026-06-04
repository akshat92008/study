import type { SeedTemplate, SeedTopicParams } from './types';
export function buildFallbackTemplate(params: SeedTopicParams): SeedTemplate {
  const subject = params.subject || params.subjects?.[0] || 'General';
  const chapter = params.chapter || params.goalTitle || 'Custom Goal';
  return {
    templateKey: 'custom_goal_seed',
    subject,
    chapter,
    displayName: chapter,
    aliases: [],
    topics: [
      {
        orderIndex: 1,
        topic: 'Core Fundamentals',
        microtarget: `Understand the core fundamentals of ${chapter}.`,
      },
      {
        orderIndex: 2,
        topic: 'Key Definitions and Concepts',
        microtarget: `Learn the key definitions and concepts required for ${chapter}.`,
      },
      {
        orderIndex: 3,
        topic: 'Important Rules, Formulas, or Principles',
        microtarget: `Memorize and apply the most important rules, formulas, or principles in ${chapter}.`,
      },
      {
        orderIndex: 4,
        topic: 'Worked Examples',
        microtarget: `Study worked examples from ${chapter} and explain each step.`,
      },
      {
        orderIndex: 5,
        topic: 'Practice Questions',
        microtarget: `Attempt basic and medium-level practice questions from ${chapter}.`,
      },
      {
        orderIndex: 6,
        topic: 'Common Mistakes',
        microtarget: `Identify and avoid common mistakes in ${chapter}.`,
      },
      {
        orderIndex: 7,
        topic: 'Mixed Review',
        microtarget: `Complete mixed revision and practice for ${chapter}.`,
      },
    ],
  };
}
