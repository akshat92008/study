import type { HermesIntent, HermesIntentType } from './types';

export type { HermesIntent, HermesIntentType };

const SUBJECTS = [
  'physics',
  'chemistry',
  'biology',
  'math',
  'mathematics',
  'history',
  'geography',
  'civics',
  'economics',
  'react',
  'javascript',
  'python',
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractSubject(text: string): string | undefined {
  return SUBJECTS.find((subject) => new RegExp(`\\b${subject}\\b`, 'i').test(text));
}

function extractTopic(input: string): string | undefined {
  const patterns = [
    /\b(?:on|about|for)\s+(.+)$/i,
    /\bexplain\s+(.+)$/i,
    /\b(?:quiz|flashcards?|cards)\s+(?:on|about|for)?\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    const value = match?.[1]?.trim();
    if (value && value.length <= 120) return value.replace(/[?.!]+$/, '');
  }
  return undefined;
}

function createIntent(
  type: HermesIntentType,
  confidence: number,
  input: string,
  reason: string,
  extra: Partial<HermesIntent> = {}
): HermesIntent {
  return {
    type,
    confidence,
    entities: {
      subject: extractSubject(input),
      topic: extractTopic(input),
      ...extra.entities,
    },
    requiresLLM: false,
    reason,
    ...extra,
  };
}

export function classifyHermesIntent(input: string): HermesIntent {
  const raw = input.trim();
  const text = normalize(raw);
  if (!text) {
    return createIntent('unknown', 0.1, raw, 'empty input');
  }

  const createGoalMatch = text.match(
    /\b(?:i want to|create|make|start|set up|setup|add)\b.*\b(?:goal|master|learn|prepare|study)\b|\bprepare for\b|\bmaster\b/
  );
  if (createGoalMatch && !/\b(?:quiz|flashcards?|autopsy|mistake)\b/.test(text)) {
    const goalTitle = raw
      .replace(/^(i want to|create|make|start|set up|setup|add)\s+(a\s+)?(goal\s+for\s+)?/i, '')
      .replace(/^goal\s+for\s+/i, '')
      .trim();
    return createIntent('create_goal', 0.86, raw, 'goal creation keywords', {
      entities: { goalTitle: goalTitle || raw, subject: extractSubject(raw), topic: undefined },
    });
  }

  if (/\b(what should i do now|today'?s mission|today mission|next mission|start mission|mission for today)\b/.test(text)) {
    return createIntent('get_today_mission', 0.92, raw, 'mission request');
  }

  if (/\b(source status|pdf ready|file ready|material ready|upload status|indexing status)\b/.test(text)) {
    return createIntent('check_source_status', 0.9, raw, 'source status request');
  }

  if (/\b(upload|add)\b.*\b(pdf|source|material|notes|file)\b/.test(text)) {
    return createIntent('upload_source', 0.8, raw, 'upload source request');
  }

  if (/\b(generate|make|create|give me|prepare|build|start)\b.*\b(quiz|mcq|mcqs|practice questions|test)\b/.test(text)) {
    return createIntent('generate_quiz', 0.88, raw, 'quiz generation request');
  }

  if (/\b(submit|check|grade)\b.*\b(quiz|answer|attempt)\b/.test(text)) {
    return createIntent('submit_quiz', 0.78, raw, 'quiz submission request');
  }

  if (/\b(autopsy|mistake review|i got this wrong|why did i get|analy[sz]e my mistake)\b/.test(text)) {
    return createIntent('run_autopsy', 0.9, raw, 'mistake autopsy request', {
      requiresLLM: true,
    });
  }

  if (/\b(generate|make|create|build)\b.*\b(flashcards?|cards|anki)\b/.test(text)) {
    return createIntent('create_flashcards', 0.9, raw, 'flashcard generation request', {
      requiresLLM: true,
    });
  }

  if (/\b(due reviews?|review queue|due cards|what is due|open review)\b/.test(text)) {
    return createIntent('get_due_reviews', 0.86, raw, 'review queue request');
  }

  if (/\b(weak areas|weak concepts|weak topics|where am i weak|what am i weak|weakest)\b/.test(text)) {
    return createIntent('show_weak_areas', 0.9, raw, 'weak area request');
  }

  if (/\b(open|show|go to)\b.*\b(review|dashboard|autopsy|sources?|materials?|cognition|knowledge|planner)\b/.test(text)) {
    const moduleMatch = text.match(/\b(review|dashboard|autopsy|sources?|materials?|cognition|knowledge|planner)\b/);
    return createIntent('open_module', 0.78, raw, 'navigation request', {
      entities: { module: moduleMatch?.[1] },
    });
  }

  if (/\b(explain|teach|what is|why does|how does)\b/.test(text)) {
    return createIntent('explain_concept', 0.75, raw, 'concept explanation request', {
      requiresLLM: true,
    });
  }

  if (/\b(plan|schedule|study session|timetable)\b/.test(text)) {
    return createIntent('plan_study_session', 0.74, raw, 'study planning request');
  }

  if (/\b(progress|summary|summari[sz]e|how am i doing)\b/.test(text)) {
    return createIntent('summarize_progress', 0.8, raw, 'progress summary request');
  }

  return createIntent('unknown', 0.35, raw, 'no deterministic match');
}
