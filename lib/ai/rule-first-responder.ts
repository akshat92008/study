// lib/ai/rule-first-responder.ts
// Handles simple user intents deterministically without calling an AI model.
// This saves massive amounts of tokens for common queries.

import { isRuleFirstEnabled } from './cost-mode';
import { getCachedAiResponse, normalizePromptForCache, buildAiCacheKey } from './response-cache';
import { detectTaskComplexity } from './task-complexity';
import { logger } from '@/lib/utils/logger';

export interface RuleFirstResult {
  handled: boolean;
  response?: string;
  tokenSavedEstimate?: number;
  shouldQueue?: boolean; // For offloading to background worker
}

// ─── REGEX TRIGGERS ──────────────────────────────────────────────────────────

const WEAK_TOPICS_RE = /\b(weak(est)? (chapters?|topics?|subjects?|areas?)|what am i bad at|what should i focus on)\b/i;
const DAILY_STATS_RE = /\b(how many questions (today|did i do)|today'?s stats|my progress today)\b/i;
const REVISE_NOW_RE = /\b(what should i revise( now)?|overdue cards|pending revision)\b/i;
const LARGE_MCQ_RE = /\b([2-9]\d|1\d{2,})\s+(mcq|question|flashcard)s?\b/i;
const DEFINITION_RE = /^(what is|define) ([a-z0-9 ]{2,30})\??$/i;
const SKIP_REPAIR_RE = /\b(skip|later|ignore|continue anyway|not now)\b/i;
const REPAIR_RETEST_RE = /\b(retest|repair|mistake|wrong|answer this|start repair)\b/i;

// ─── HANDLERS ────────────────────────────────────────────────────────────────

function handleWeakTopics(mindContext: any): string | null {
  const weak = mindContext?.weakConcepts || [];
  const mistakes = mindContext?.recentMistakes || [];
  const struggles = mindContext?.recentPracticeStruggles || [];
  const dueCards = mindContext?.topOverdueCards || [];

  if (weak?.length > 0) {
    const list = weak.slice(0, 5).map((w: any) => `- **${w.name}** (${w.subject || 'Mixed'})`).join('\n');
    return `Based on your saved mastery state, these are your weakest topics right now:\n\n${list}\n\nYour next session should start with one focused repair set on the first topic.`;
  }

  if (mistakes?.length > 0 || struggles?.length > 0) {
    const mistakeTopics = mistakes
      .map((m: any) => ({
        name: m.topic || m.chapter || m.category || 'Recent mistake',
        subject: m.subject || 'Mixed',
      }));
    const struggleTopics = struggles
      .map((s: any) => ({
        name: s.conceptName || s.chapter || 'Practice struggle',
        subject: s.subject || 'Mixed',
      }));
    const list = [...mistakeTopics, ...struggleTopics]
      .filter((item, index, all) => all.findIndex(other => other.name === item.name && other.subject === item.subject) === index)
      .slice(0, 5)
      .map((item) => `- **${item.name}** (${item.subject})`)
      .join('\n');
    return `I do not have a separate weak-concept projection saved yet, but your recent mistakes point to these weak areas:\n\n${list}\n\nI am treating these as the next repair targets.`;
  }

  if (dueCards?.length > 0) {
    const list = dueCards
      .slice(0, 5)
      .map((card: any) => `- ${card.front || card.topic || 'Due review card'}`)
      .join('\n');
    return `No weak topics are flagged yet, but these review cards are due now:\n\n${list}\n\nStart here and I will update weak areas from your next answers.`;
  }

  return 'I do not have weak topics saved for this goal yet. Submit a quiz or upload a source, and I will update this from your actual mistakes instead of guessing.';
}

function handleDailyStats(mindContext: any): string | null {
  // If we had actual daily stats in mindContext, we'd use them.
  // Assuming they aren't currently plumbed in fully, we fall back.
  if (mindContext?.masteryStats) {
    const { masteredCount, totalConcepts, masteryPercent } = mindContext.masteryStats;
    return `You've mastered **${masteredCount} out of ${totalConcepts}** core concepts (${masteryPercent}% overall mastery). Keep going!`;
  }
  return null;
}

function handleReviseNow(mindContext: any): string | null {
  const count = mindContext?.overdueCardsCount || 0;
  if (count === 0) {
    return "You have no overdue flashcards to revise right now. Great job keeping up!";
  }

  const top = mindContext?.topOverdueCards || [];
  let topicList = '';
  if (top.length > 0) {
    const topics = Array.from(new Set(top.map((c: any) => c.topic || 'General'))).slice(0, 3);
    topicList = `\nThey mostly cover: ${topics.join(', ')}.`;
  }

  return `You have **${count} overdue flashcards** waiting for you.${topicList}\n\nWould you like to do a quick 10-card review session now?`;
}

function handleDueRetestFirst(message: string, mindContext: any): string | null {
  const due = mindContext?.dueRetests || [];
  if (due.length === 0 || SKIP_REPAIR_RE.test(message) || REPAIR_RETEST_RE.test(message)) return null;

  const retest = due[0];
  const mistake = retest.mistake || {};
  const label = mistake.concept || mistake.topic || mistake.chapter || 'your due retest';
  return [
    `Before we continue, your **${label}** retest is due.`,
    ``,
    `Answer this first: ${retest.question}`,
    ``,
    `This is the proof step. If you pass it, the mistake can be marked repaired; if you want to skip, say "skip for now."`,
  ].join('\n');
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

/**
 * Attempt to handle the user's chat message deterministically.
 */
export async function tryRuleFirstResponse(
  userId: string,
  message: string,
  mindContext: any
): Promise<RuleFirstResult> {
  if (!isRuleFirstEnabled() || !message || message.trim().length === 0) {
    return { handled: false };
  }

  const trimmed = message.trim();

  const retestFirst = handleDueRetestFirst(trimmed, mindContext);
  if (retestFirst) {
    logger.info('[RuleFirst] Prioritized due mistake retest', { userId });
    return { handled: true, response: retestFirst, tokenSavedEstimate: 900 };
  }

  // 1. Weak topics
  if (WEAK_TOPICS_RE.test(trimmed)) {
    const response = handleWeakTopics(mindContext);
    if (response) {
      logger.info('[RuleFirst] Handled weak topics query', { userId });
      return { handled: true, response, tokenSavedEstimate: 800 };
    }
  }

  // 2. Daily Stats
  if (DAILY_STATS_RE.test(trimmed)) {
    const response = handleDailyStats(mindContext);
    if (response) {
      logger.info('[RuleFirst] Handled daily stats query', { userId });
      return { handled: true, response, tokenSavedEstimate: 800 };
    }
  }

  // 3. Revise Now
  if (REVISE_NOW_RE.test(trimmed)) {
    const response = handleReviseNow(mindContext);
    if (response) {
      logger.info('[RuleFirst] Handled revise now query', { userId });
      return { handled: true, response, tokenSavedEstimate: 800 };
    }
  }

  // 4. Large MCQ/Flashcard Generation offload
  // If they ask for 50 questions, we don't want to tie up the chat route.
  // We can acknowledge and signal the route to queue it.
  if (LARGE_MCQ_RE.test(trimmed)) {
    // The actual queuing logic will be handled by the route or ChatPlannerService,
    // but we can signal it here.
    logger.info('[RuleFirst] Detected large generation request', { userId });
    return {
      handled: true,
      shouldQueue: true,
      response: "That's a large request! I'm queuing it up as a background job. You can continue studying, and the document will appear in your Study Materials when it's ready.",
      tokenSavedEstimate: 3000
    };
  }

  // 5. Short definitions (check semantic cache directly)
  const isDef = DEFINITION_RE.test(trimmed);
  const complexity = detectTaskComplexity(trimmed);

  if (isDef || complexity === 'simple') {
    const norm = normalizePromptForCache(trimmed);
    const cacheKey = buildAiCacheKey('chat', norm);
    const cached = await getCachedAiResponse(cacheKey);

    if (cached?.responseText) {
      logger.info('[RuleFirst] Handled via Semantic Cache hit', { userId, cacheKey });
      return {
        handled: true,
        response: cached.responseText,
        tokenSavedEstimate: cached.tokenEstimate > 0 ? cached.tokenEstimate : 800
      };
    }
  }

  return { handled: false };
}
