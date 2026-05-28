import { routeTextGeneration } from '@/lib/ai/router';
import { logger } from '@/lib/utils/logger';
import { ChatIntent, IntentResult } from './chat-intent';

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
const INTENT_KEYWORDS: Partial<Record<ChatIntent, RegExp>> = {
  FLASHCARDS: /\b(revise|flashcard|quiz me|test me|spaced repetition)\b/i,
  CREATE_ARTIFACT: /\b(plan|schedule|today|timetable|what should i study)\b/i,
  AUTOPSY: /\b(autopsy|mock test|analyze my test|paper analysis)\b/i,
};

const NEUTRAL_PATTERNS = [
  /^explain\b/i, /^what is\b/i, /^how does\b/i,
  /^solve\b/i, /^give me\b/i, /^make\b/i,
];

export async function classifyMessageCombined(
  message: string,
  conversationContext?: string,
  examType?: string
): Promise<ClassificationResult> {
  // Try keyword shortcuts first
  for (const [intentStr, pattern] of Object.entries(INTENT_KEYWORDS)) {
    if (pattern.test(message)) {
      return {
        intent: { intent: intentStr as ChatIntent, topic: null, subject: null, action: null },
        emotion: 'neutral',
        confidence: 0.9,
      };
    }
  }

  // For short/neutral messages, skip LLM entirely
  if (message.length < 8 || NEUTRAL_PATTERNS.some((p) => p.test(message.trim()))) {
    return { 
      intent: { intent: 'GENERAL_CHAT', topic: null, subject: null, action: null }, 
      emotion: 'neutral', 
      confidence: 0.8 
    };
  }

  const prompt = `Student is studying: ${examType || 'NEET/JEE'}
Recent context: ${conversationContext ? conversationContext.slice(0, 200) : 'None'}

Current message: "${message.slice(0, 400)}"

Classify this student message and return ONLY valid JSON:
{
  "intent": "TUTOR_SESSION|PRACTICE|CREATE_ARTIFACT|AUTOPSY|ANALYTICS|ATLAS|FLASHCARDS|REPLAN|GENERAL_CHAT",
  "topic": "specific concept/chapter name or null",
  "subject": "subject name or null",
  "action": "reduce_tasks|lighten_intensity|add_break or null",
  "emotion": "focused|motivated|stressed|burnt_out|anxious|frustrated|confident|overwhelmed|bored|neutral",
  "confidence": number 0.0-1.0
}

Intent rules:
- "explain", "what is", "how does", "I don't understand" → TUTOR_SESSION
- "test me", "quiz me", "practice" → PRACTICE
- "make a study guide", "revision sheet", "create flashcards", "write a plan" → CREATE_ARTIFACT
- "I gave a test", "upload test", "check my mock" → AUTOPSY
- "how am I doing", "my stats" → ANALYTICS
- "knowledge map", "ATLAS" → ATLAS
- "review cards", "due cards" → FLASHCARDS
- "overwhelmed", "reduce tasks", "lighten" → REPLAN
- Everything else → GENERAL_CHAT

Emotion rules:
- Only flag non-neutral if message CLEARLY signals it
- Pure academic questions → neutral`;

  try {
    const raw = await routeTextGeneration(
      'json',
      'You are a classification model. Return only valid JSON. No markdown.',
      prompt,
      0.1,
      256
    );

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

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
    logger.warn('[classifyMessageCombined] Failed, defaulting:', err);
    return { 
      intent: { intent: 'GENERAL_CHAT', topic: null, subject: null, action: null }, 
      emotion: 'neutral', 
      confidence: 0.5 
    };
  }
}
