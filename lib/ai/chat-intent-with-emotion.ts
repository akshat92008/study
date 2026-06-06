import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { logger } from '@/lib/utils/logger';
import { ChatIntent, IntentResult } from './chat-intent';
import {
  isBudgetExceeded,
  isBudgetUnavailable,
  registerPromptAudit,
  reserveBudgetForModelCall,
} from '@/lib/ai/cost-guard';
import { getPromptVersion } from '@/lib/ai/prompt-version';

export type EmotionalState =
  | 'focused' | 'motivated' | 'stressed' | 'burnt_out' | 'anxious'
  | 'frustrated' | 'confident' | 'overwhelmed' | 'bored' | 'neutral';

interface ClassificationResult {
  intent: IntentResult;
  emotion: EmotionalState;
  confidence: number;
}

const VALID_EMOTIONS = new Set<EmotionalState>([
  'focused', 'motivated', 'stressed', 'burnt_out', 'anxious',
  'frustrated', 'confident', 'overwhelmed', 'bored', 'neutral',
]);

// Fast keyword pre-screens — skip the LLM call entirely for obvious cases
const INTENT_KEYWORDS: Partial<Record<string, RegExp>> = {
  FLASHCARDS: /\b(revise|flashcard|quiz me|test me|spaced repetition)\b/i,
  CREATE_ARTIFACT: /\b(plan|schedule|today|timetable|what should i study|microtarget|planner|add task|add.*microtarget)\b/i,
  AUTOPSY: /\b(autopsy|mock test|analyze my test|paper analysis)\b/i,
  PRACTICE_REQUESTED: /\b(generate.*mcq|give me practice|some questions on)\b/i,
  MISTAKE_ADMITTED: /\b(i got it wrong|i confused|i made a mistake|i thought it was)\b/i,
  CONCEPT_CONFUSION: /\b(i don'?t understand|i'm stuck on|explain.*again|not getting)\b/i,
};

const NEUTRAL_PATTERNS = [
  /^explain\b/i, /^what is\b/i, /^how does\b/i,
  /^solve\b/i, /^give me\b/i, /^make\b/i,
];

export async function classifyMessageCombined(
  message: string,
  conversationContext?: string,
  examType?: string,
  userId?: string
): Promise<ClassificationResult> {
  // Try keyword shortcuts first
  for (const [intentStr, pattern] of Object.entries(INTENT_KEYWORDS)) {
    if (pattern && pattern.test(message)) {
      return {
        intent: { intent: intentStr as any, topic: null, subject: null, action: null },
        emotion: 'neutral',
        confidence: 0.9,
      };
    }
  }

  // For short/neutral messages, skip LLM entirely
  if (message.length < 8 || NEUTRAL_PATTERNS.some((p) => p.test(message.trim()))) {
    return { 
      intent: { intent: 'GENERAL_CHAT' as any, topic: null, subject: null, action: null }, 
      emotion: 'neutral', 
      confidence: 0.8 
    };
  }

  const prompt = `Student is studying: ${examType || 'NEET/JEE'}
  Recent context: ${conversationContext ? conversationContext.slice(0, 200) : 'None'}

  Current message: "${message.slice(0, 400)}"

  Classify this student message and return ONLY valid JSON:
  {
  "intent": "DOUBT_ASKED|CONCEPT_CONFUSION|PRACTICE_REQUESTED|PRACTICE_ATTEMPT_SUBMITTED|ANSWER_CHECK_REQUESTED|MISTAKE_ADMITTED|REVISION_REQUESTED|SOURCE_GROUNDED_QUERY|GOAL_PLANNING_REQUEST|REMEMBER_THIS|GENERAL_CHAT",
  "topic": "specific concept/chapter name or null",
  "subject": "subject name or null",
  "action": "reduce_tasks|lighten_intensity|add_break or null",
  "emotion": "focused|motivated|stressed|burnt_out|anxious|frustrated|confident|overwhelmed|bored|neutral",
  "confidence": number 0.0-1.0
  }

  Intent rules:
  - "explain", "what is", "how does" → DOUBT_ASKED
  - "I don't understand", "I'm stuck on X", "confused between X and Y" → CONCEPT_CONFUSION
  - "generate 10 MCQs", "give me questions" → PRACTICE_REQUESTED
  - "1A 2B 3C", "the answer is C" → PRACTICE_ATTEMPT_SUBMITTED
  - "is this correct?", "did I solve this right" → ANSWER_CHECK_REQUESTED
  - "I got Q4 wrong because", "I confused LH and FSH", "my mistake" → MISTAKE_ADMITTED
  - "review cards", "due cards", "revise" → REVISION_REQUESTED
  - "according to the uploaded PDF", "what does the document say" → SOURCE_GROUNDED_QUERY
  - "make a study guide", "revision sheet", "what should I study today" → GOAL_PLANNING_REQUEST
  - "remember this", "save this for review", "add to my cards" → REMEMBER_THIS
  - Everything else → GENERAL_CHAT

Emotion rules:
- Only flag non-neutral if message CLEARLY signals it
- Pure academic questions → neutral`;

  try {
    const parsed = await budgetedGenerateJSON<any>({
      userId: userId || 'anonymous',
      feature: 'intent-classification',
      route: 'chat:intent-emotion',
      model: 'fast',
      systemPrompt: 'You are a classification model. Return only valid JSON. No markdown.',
      userPrompt: prompt,
    });

    const emotion = VALID_EMOTIONS.has(parsed.emotion) ? parsed.emotion : 'neutral';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.7;

    return { 
      intent: {
        intent: parsed.intent || 'GENERAL_CHAT',
        topic: parsed.topic || null,
        subject: parsed.subject || null,
        action: parsed.action || null
      }, 
      emotion, 
      confidence 
    };
  } catch (err) {
    if (isBudgetExceeded(err) || isBudgetUnavailable(err)) {
      logger.warn('[classifyMessageCombined] Budget unavailable, defaulting to GENERAL_CHAT');
    } else {
      logger.warn('[classifyMessageCombined] Failed, defaulting:', err);
    }
    return { 
      intent: { intent: 'GENERAL_CHAT', topic: null, subject: null, action: null }, 
      emotion: 'neutral', 
      confidence: 0.5 
    };
  }
}
