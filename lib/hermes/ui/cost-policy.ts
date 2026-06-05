import type { HermesIntent, HermesIntentType } from './types';

export type HermesHeavyPolicy = {
  allowed: boolean;
  reason: string;
  dailyCap: number;
  hourlyCap: number;
};

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const LLM_ALLOWED_INTENTS = new Set<HermesIntentType>([
  'explain_concept',
  'generate_quiz',
  'create_flashcards',
  'run_autopsy',
]);

const LLM_FORBIDDEN_INTENTS = new Set<HermesIntentType>([
  'get_today_mission',
  'check_source_status',
  'upload_source',
  'get_due_reviews',
  'show_weak_areas',
  'summarize_progress',
  'open_module',
]);

export function getHermesHeavyCaps(intent: HermesIntentType) {
  const defaultDaily = envInt('HERMES_UI_MAX_HEAVY_CALLS_PER_DAY', 10);
  const defaultHourly = envInt('HERMES_UI_MAX_HEAVY_CALLS_PER_HOUR', 5);

  if (intent === 'run_autopsy') {
    return { dailyCap: envInt('HERMES_UI_MAX_AUTOPSY_PER_DAY', 3), hourlyCap: defaultHourly };
  }
  if (intent === 'create_flashcards') {
    return { dailyCap: envInt('HERMES_UI_MAX_FLASHCARDS_PER_DAY', 5), hourlyCap: defaultHourly };
  }
  if (intent === 'generate_quiz') {
    return { dailyCap: envInt('HERMES_UI_MAX_QUIZZES_PER_DAY', 5), hourlyCap: defaultHourly };
  }
  return { dailyCap: defaultDaily, hourlyCap: defaultHourly };
}

export function evaluateHermesHeavyPolicy(intent: HermesIntent, reason?: string): HermesHeavyPolicy {
  const caps = getHermesHeavyCaps(intent.type);

  if (LLM_FORBIDDEN_INTENTS.has(intent.type)) {
    return {
      allowed: false,
      reason: `LLM is forbidden for ${intent.type}.`,
      ...caps,
    };
  }

  if (!LLM_ALLOWED_INTENTS.has(intent.type)) {
    return {
      allowed: false,
      reason: `No Heavy path is registered for ${intent.type}.`,
      ...caps,
    };
  }

  return {
    allowed: true,
    reason: reason ?? intent.reason,
    ...caps,
  };
}

export function buildHermesHeavyMetadata(input: {
  intent: HermesIntent;
  reason: string;
  goalId?: string | null;
}) {
  return {
    hermesLayer: 'heavy',
    reason: input.reason,
    intent: input.intent.type,
    goalId: input.goalId ?? null,
    route: '/api/hermes/command',
  };
}
