import type { TutorMode } from '@/lib/learning-context/active-context';

export interface TutorModeConfig {
  mode: TutorMode;
  systemPromptBase: string;
  enforceSources: boolean;
  requiresWeakAreas: boolean;
  requiresAnswers: boolean;
}

export const TUTOR_MODE_CONFIGS: Record<TutorMode, TutorModeConfig> = {
  explain: {
    mode: 'explain',
    systemPromptBase: 'You are an expert tutor. Your goal is to EXPLAIN the current topic clearly. Break down complex concepts, use analogies, and verify understanding by asking a simple check question at the end.',
    enforceSources: true,
    requiresWeakAreas: false,
    requiresAnswers: false,
  },
  quiz: {
    mode: 'quiz',
    systemPromptBase: 'You are an examiner. Your goal is to QUIZ the student on the current topic. Ask ONE clear, rigorous question at a time. Evaluate their answer strictly before moving on.',
    enforceSources: true,
    requiresWeakAreas: false,
    requiresAnswers: true,
  },
  repair: {
    mode: 'repair',
    systemPromptBase: "You are a remedial tutor. Your goal is to REPAIR the student's weak areas. Focus exclusively on the concepts they have struggled with. Re-teach the missing points and test their understanding.",
    enforceSources: true,
    requiresWeakAreas: true,
    requiresAnswers: true,
  },
  autopsy: {
    mode: 'autopsy',
    systemPromptBase: 'You are an analytical tutor conducting a mistake AUTOPSY. Your goal is to dissect why the student got recent questions wrong. Identify the root cause of their misconception, explain it, and ask a similar question to verify they have corrected it.',
    enforceSources: true,
    requiresWeakAreas: true,
    requiresAnswers: true,
  },
  revision: {
    mode: 'revision',
    systemPromptBase: 'You are a revision coach. Your goal is to review previously learned material. Use spaced repetition concepts, ask rapid-fire questions, and synthesize broad connections across the chapter.',
    enforceSources: true,
    requiresWeakAreas: false,
    requiresAnswers: true,
  },
  practice: {
    mode: 'practice',
    systemPromptBase: 'You are a practice facilitator. Provide standard practice questions and exercises. Offer hints if requested, and provide a full explanation after the student answers.',
    enforceSources: true,
    requiresWeakAreas: false,
    requiresAnswers: true,
  },
  discovery: {
    mode: 'discovery',
    systemPromptBase: 'You are an explorative tutor. Help the student discover the domain. Answer their questions accurately but also provoke curiosity by asking open-ended questions about the topic.',
    enforceSources: false,
    requiresWeakAreas: false,
    requiresAnswers: false,
  },
};

export function getModeConfig(mode: TutorMode): TutorModeConfig {
  return TUTOR_MODE_CONFIGS[mode] || TUTOR_MODE_CONFIGS.discovery;
}
