// lib/hermes/hermes-prompts.ts
// System prompts for all Hermes agents.
// Requirements:
//   - Short and structured
//   - JSON-only output
//   - Goal-aware
//   - No hallucinated certainty
//   - No motivational fluff
//   - Never reveals to user that Hermes exists

export const HERMES_MISTAKE_SYSTEM_PROMPT = `You are Amaura, an internal learning-reasoning worker for Cognition OS. You do not talk to users. You produce strict JSON for the application.

Your job:
1. Diagnose WHY the learner chose the wrong answer (their reasoning failure, not just the correct answer).
2. Map the failure to a specific weak concept.
3. Generate 3–5 targeted active-recall revision cards addressing the exact mistake pattern.
4. Suggest one concrete next action.

Rules:
- Focus on the learner's reasoning failure, not a summary of the correct answer.
- Cards must target the MISTAKE PATTERN, not generic definitions.
- If uncertain about any diagnosis, set confidence to "low" and needsHumanReview to true.
- For medical/clinical content, avoid overclaiming diagnostic certainty.
- Return ONLY valid JSON matching the exact schema. No markdown. No explanation outside the JSON.`;

export function buildMistakeUserPrompt(params: {
  question: string;
  myAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
  goalTitle?: string | null;
  subjectHint?: string | null;
  recentWeakConcepts?: Array<{ subject?: string | null; chapter?: string | null; topic?: string | null }>;
}): string {
  const weakConceptsStr = params.recentWeakConcepts && params.recentWeakConcepts.length > 0
    ? `\nRecent weak areas: ${params.recentWeakConcepts.slice(0, 5).map(c => [c.subject, c.chapter, c.topic].filter(Boolean).join(' > ')).join('; ')}`
    : '';

  const goalStr = params.goalTitle ? `\nLearning goal: ${params.goalTitle}` : '';
  const subjectStr = params.subjectHint ? `\nSubject hint: ${params.subjectHint}` : '';

  return `Analyze this student mistake and return the JSON diagnosis.
${goalStr}${subjectStr}${weakConceptsStr}

Question: ${params.question}
Student's Answer: ${params.myAnswer}
Correct Answer: ${params.correctAnswer}
Explanation: ${params.explanation || 'None provided'}

Return JSON with this exact structure:
{
  "category": "conceptual_gap" | "misread" | "calculation_error" | "formula_recall" | "wrong_diagnostic_frame" | "application_error" | "time_pressure" | "silly_error" | "exam_strategy" | "unknown",
  "subject": string | null,
  "chapter": string | null,
  "topic": string | null,
  "diagnosis": "1-2 sentences: what reasoning failure caused this mistake",
  "whyMyAnswerWasWrong": "1-2 sentences: specific reason the student's answer fails",
  "whyCorrectAnswerWorks": "1-2 sentences: why the correct answer is right",
  "keyMissedClue": "the single most important clue the student missed" | null,
  "confidence": "low" | "medium" | "high",
  "weakConcept": { "subject": string | null, "chapter": string | null, "topic": string | null, "name": "concept name" },
  "cards": [
    { "front": "question targeting the mistake pattern", "back": "answer", "type": "mistake_concept" | "error_pattern" | "similar_trap" | "formula_recall" | "source_grounded", "difficulty": "easy" | "medium" | "hard" }
  ],
  "nextAction": {
    "label": "short action label",
    "rationale": "why this action",
    "estimatedMinutes": number,
    "actionType": "review_cards" | "practice_similar" | "read_source" | "ask_mind" | "redo_question"
  },
  "safetyFlags": { "possibleHallucination": boolean, "needsHumanReview": boolean, "reason": string | undefined }
}`;
}

export const HERMES_SOURCE_SYSTEM_PROMPT = `You are Amaura, an internal learning-reasoning worker. You process study materials and return structured learning metadata as strict JSON. No markdown. No explanation.`;

export function buildSourceUserPrompt(params: {
  title: string;
  goalTitle?: string | null;
  chunks: string[];
}): string {
  const content = params.chunks.slice(0, 5).join('\n\n---\n\n');
  return `Extract learning metadata from this material.
Title: ${params.title}
Goal: ${params.goalTitle || 'General study'}

Content:
${content}

Return JSON with: sourceSummary, extractedConcepts (subject/chapter/topic/importance), suggestedCards (front/back/type), suggestedPracticePrompts, nextAction (label/rationale/estimatedMinutes), briefingDoc (executiveSummary/faqs/keyEntities), and podcastTranscript (conversational transcript between Host 1 and Host 2 exploring the document).`;
}

export const HERMES_TRACE_SYSTEM_PROMPT = `You are Amaura, an internal learning-reasoning worker. Analyze learning patterns and return a cognitive trace as strict JSON. No markdown. No explanation.`;

export function buildTraceUserPrompt(params: {
  goalTitle: string;
  recentMistakes: Array<{ category: string; subject?: string | null; chapter?: string | null; topic?: string | null }>;
  dueCardsCount: number;
  weakConceptsCount: number;
}): string {
  const mistakeSummary = params.recentMistakes.slice(0, 10)
    .map(m => `${m.category}: ${[m.subject, m.chapter, m.topic].filter(Boolean).join(' > ')}`)
    .join('\n');

  return `Analyze learning patterns for: ${params.goalTitle}

Recent mistakes (${params.recentMistakes.length}):
${mistakeSummary || 'None'}

Due cards: ${params.dueCardsCount}
Weak concepts: ${params.weakConceptsCount}

Return JSON with cognitiveTrace (repeatedWeaknesses, avoidanceSignals, forgettingRisks, improvementSignals) and recommendations (type/label/rationale).`;
}

export const HERMES_NEXT_ACTION_SYSTEM_PROMPT = `You are Amaura, an internal learning-reasoning worker. Return one concrete next action and up to 3 microtasks as strict JSON. No markdown.`;

export function buildNextActionUserPrompt(params: {
  goalTitle: string;
  weakConceptsCount: number;
  dueCardsCount: number;
  recentMistakesCount: number;
  pendingTasksCount: number;
}): string {
  return `Generate next action for learning goal: ${params.goalTitle}

State:
- Weak concepts: ${params.weakConceptsCount}
- Due revision cards: ${params.dueCardsCount}
- Recent mistakes (14 days): ${params.recentMistakesCount}
- Pending tasks today: ${params.pendingTasksCount}

Return JSON with: nextAction (label/actionType/rationale/estimatedMinutes) and microtasks (title/type/estimatedMinutes).`;
}
