// lib/ai/chat-intent.ts
// Fast intent classifier — runs in ~100ms on the fast model tier.
// Keeps intent detection separate from response generation so both can be optimized independently.

import { routeTextGeneration } from './router';
import { logger } from '@/lib/utils/logger';

export type ChatIntent =
  | 'TUTOR_SESSION'     // explain, what is, how does, I don't understand
  | 'PRACTICE'          // test me, quiz me, give me questions
  | 'CREATE_ARTIFACT'   // make a study guide, revision sheet, flashcards, plan
  | 'AUTOPSY'           // I gave a test, upload test, check my mock
  | 'ANALYTICS'         // how am I doing, my stats, my progress
  | 'ATLAS'             // knowledge map, ATLAS, what do I know
  | 'FLASHCARDS'        // review cards, due cards, revise
  | 'REPLAN'            // overwhelmed, reduce tasks, lighten load
  | 'GENERAL_CHAT';     // hey, hi, casual, emotional, off-topic

export interface IntentResult {
  intent: ChatIntent;
  topic: string | null;
  subject: string | null;
  action: string | null; // for REPLAN: 'reduce_tasks' | 'lighten_intensity' | 'add_break'
}

const INTENT_SYSTEM = `You are an intent classifier for an AI study companion. Classify the student message and return JSON only. No explanation. No markdown.`;

export async function detectChatIntent(
  message: string,
  recentHistory: Array<{ role: string; content: string }>,
  examType: string
): Promise<IntentResult> {
  const historySnippet = recentHistory
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'S' : 'A'}: ${m.content.slice(0, 100)}`)
    .join('\n');

  const prompt = `Student is studying: ${examType}
Recent context:
${historySnippet || 'No prior context'}

Current message: "${message}"

Classify and return JSON:
{
  "intent": "TUTOR_SESSION|PRACTICE|CREATE_ARTIFACT|AUTOPSY|ANALYTICS|ATLAS|FLASHCARDS|REPLAN|GENERAL_CHAT",
  "topic": "specific concept/chapter name or null",
  "subject": "subject name or null",
  "action": "reduce_tasks|lighten_intensity|add_break or null"
}

Rules:
- "explain", "what is", "how does", "I don't understand", "teach me" → TUTOR_SESSION
- "test me", "quiz me", "give me questions", "practice" → PRACTICE
- "make a study guide", "revision sheet", "create flashcards", "write a plan", "prepare a planner", "help me prepare", "study plan", "revise everything", "full syllabus revision", "add to microtargets", "microtarget", "add task", "update planner" → CREATE_ARTIFACT
- "I gave a test", "upload test", "check my mock", "analyse my test", "I scored" → AUTOPSY
- "how am I doing", "my stats", "progress", "percentage" → ANALYTICS
- "knowledge map", "ATLAS", "what do I know" → ATLAS
- "review cards", "due cards", "flashcard queue" → FLASHCARDS
- "overwhelmed", "reduce tasks", "too much", "lighten", "I'm stressed" → REPLAN
- Everything else, greetings, casual → GENERAL_CHAT

IMPORTANT: If the message asks to BUILD or CREATE a plan/schedule/planner — even if it mentions "mock test" — classify as CREATE_ARTIFACT not AUTOPSY. AUTOPSY is only for analysing a test the student already took and wants to upload.`;

  try {
    const raw = await routeTextGeneration('json', INTENT_SYSTEM, prompt, 0.1, 256);
    const clean = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      intent: parsed.intent || 'GENERAL_CHAT',
      topic: parsed.topic || null,
      subject: parsed.subject || null,
      action: parsed.action || null,
    };
  } catch (err) {
    logger.warn('Intent detection failed — defaulting to GENERAL_CHAT', err);
    return { intent: 'GENERAL_CHAT', topic: null, subject: null, action: null };
  }
}

// Build proper alternating conversation messages for AI providers.
// This is the critical function — it converts chat history into structured turns.
export function buildConversationMessages(
  history: Array<{ role: string; content: string }>,
  currentMessage: string,
  prependContext?: string // extra context injected into the last user turn
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const raw = (history || [])
    .slice(-14) // last 14 messages = 7 full turns
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim());

  // Deduplicate consecutive same-role messages (Google Gemini requirement)
  const deduped: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of raw) {
    const role = msg.role as 'user' | 'assistant';
    const last = deduped[deduped.length - 1];
    if (last && last.role === role) {
      // Merge consecutive same-role messages
      last.content += '\n\n' + msg.content.slice(0, 1500);
    } else {
      deduped.push({ role, content: msg.content.slice(0, 2000) });
    }
  }

  // Strip out METADATA markers from stored assistant messages so the AI
  // doesn't see ===METADATA=== blocks in conversation history
  const cleaned = deduped.map(m => ({
    ...m,
    content: m.content.replace(/\n\n===METADATA===[\s\S]*/g, '').trim(),
  }));

  // Append current user message (with optional context prefix)
  const currentContent = prependContext
    ? `${prependContext}\n\n${currentMessage}`
    : currentMessage;

  cleaned.push({ role: 'user', content: currentContent || '' });

  return cleaned;
}
