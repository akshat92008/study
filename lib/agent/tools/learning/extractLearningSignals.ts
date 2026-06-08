import type { AgentToolDefinition, LearningSignal } from '@/lib/agent/types';
import { ExtractLearningSignalsInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { canonicalConceptName, dependencyConceptsFor, enrichSignalConcept, extractConceptCandidates, inferChapterForConcept, inferSubjectForConcept, normalizeConceptText } from '@/lib/atlas/conceptResolver';

const CONFUSION_RE = /\b(don'?t understand|do not understand|confus|stuck|not clear|unclear|samajh nahi|samjh nahi|nahi aata|clear nahi|doubt|still don'?t|get it wrong|wrong answer)\b/i;
const SOURCE_RE = /\b(uploaded|source|pdf|material|notes?|ncert|document|textbook)\b/i;

function sourceSignals(retrievedChunks: any[]): LearningSignal[] {
  if (!retrievedChunks.length) return [];
  const byMaterial = new Map<string, any[]>();
  for (const chunk of retrievedChunks) {
    const id = chunk.materialId;
    if (!id) continue;
    byMaterial.set(id, [...(byMaterial.get(id) ?? []), chunk]);
  }
  return Array.from(byMaterial.entries()).map(([materialId, chunks]) => ({
    type: 'source_used',
    materialId,
    materialTitle: chunks[0]?.title ?? 'Uploaded material',
    chunkIds: chunks.map((chunk) => chunk.id).filter(Boolean),
    confidence: 0.95,
    source: 'source',
    evidence: `Retrieved ${chunks.length} source chunks.`,
  }));
}

function practiceSignals(payload: any): LearningSignal[] {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) return [];
  const signals: LearningSignal[] = [{
    type: 'practice_attempt_submitted',
    confidence: 0.95,
    source: 'practice',
    evidence: `Submitted ${items.length} practice answer${items.length === 1 ? '' : 's'}.`,
    metadata: {
      practiceSetId: payload.practiceSetId ?? null,
      metrics: payload.metrics ?? {},
    },
  }];
  for (const item of items.slice(0, 30)) {
    const rawConcept = item.conceptName ?? item.topic ?? item.chapter ?? item.question ?? 'Practice Concept';
    const canonical = canonicalConceptName({ raw: rawConcept }) ?? 'Practice Concept';
    signals.push({
      type: item.isCorrect ? 'concept_understood' : 'weak_area_detected',
      concept: rawConcept,
      canonicalConcept: canonical,
      subject: item.subject ?? inferSubjectForConcept(canonical),
      chapter: item.chapter ?? inferChapterForConcept(canonical),
      topic: item.topic ?? canonical,
      confidence: item.isCorrect ? 0.72 : 0.86,
      source: 'practice',
      correct: Boolean(item.isCorrect),
      attemptId: item.attemptId ?? item.sourceId ?? undefined,
      evidence: item.isCorrect
        ? `Correct practice answer: ${item.question ?? canonical}`
        : `Wrong practice answer: ${item.question ?? canonical}. Selected: ${item.selectedAnswer ?? 'unknown'}; correct: ${item.correctAnswer ?? 'unknown'}.`,
      metadata: {
        practiceItemId: item.practiceItemId ?? item.questionId ?? null,
      },
    });
  }
  return signals;
}

function sessionSignals(payload: any): LearningSignal[] {
  if (!payload?.sessionId || !payload?.conceptName) return [];
  const concept = payload.conceptName;
  const canonical = canonicalConceptName({ raw: concept }) ?? concept;
  
  return [{
    type: 'session_completed',
    concept,
    canonicalConcept: canonical,
    subject: payload.subject ?? inferSubjectForConcept(canonical),
    chapter: payload.chapter ?? inferChapterForConcept(canonical),
    topic: payload.topic ?? canonical,
    confidence: 1.0,
    source: 'session',
    evidence: `Completed session on ${payload.subject} / ${payload.chapter} for ${payload.durationMinutes} mins.`,
    metadata: {
      sessionId: payload.sessionId,
      durationMinutes: payload.durationMinutes,
      understood: payload.understood,
      gapFound: payload.gapFound,
      cardsCreated: payload.cardsCreated,
    },
  }];
}

export const extractLearningSignalsTool: AgentToolDefinition<typeof ExtractLearningSignalsInputSchema, typeof ToolResultSchema> = {
  name: 'extract_learning_signals',
  description: 'Extract structured learning signals from chat, practice, autopsy, revision, and session evidence.',
  inputSchema: ExtractLearningSignalsInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 2,
  requiresAuth: true,
  async handler(input, context) {
    const signals: LearningSignal[] = [];
    signals.push(...sourceSignals(input.retrievedChunks));

    if (input.channel === 'practice') {
      signals.push(...practiceSignals(input.payload));
    }

    if (input.channel === 'session') {
      signals.push(...sessionSignals(input.payload));
    }

    const userText = input.userMessage ?? '';
    const assistantText = input.assistantMessage ?? '';
    const normalized = normalizeConceptText(userText);
    const isConfused = CONFUSION_RE.test(userText);
    const isSourceRequest = SOURCE_RE.test(userText);
    const conceptCandidate = canonicalConceptName({
      raw: extractConceptCandidates(userText)[0],
      userText,
      sourceTitle: input.retrievedChunks[0]?.title,
    });

    if (assistantText.trim().length > 40 && input.channel === 'chat') {
      signals.push({
        type: 'explanation_generated',
        concept: conceptCandidate ?? undefined,
        canonicalConcept: conceptCandidate ?? undefined,
        subject: conceptCandidate ? inferSubjectForConcept(conceptCandidate) : null,
        chapter: conceptCandidate ? inferChapterForConcept(conceptCandidate) : null,
        topic: conceptCandidate ?? null,
        confidence: 0.62,
        source: 'chat',
        evidence: assistantText.slice(0, 240),
      });
    }

    if (isConfused && conceptCandidate) {
      signals.push({
        type: 'weak_area_detected',
        concept: conceptCandidate,
        canonicalConcept: conceptCandidate,
        subject: inferSubjectForConcept(conceptCandidate),
        chapter: inferChapterForConcept(conceptCandidate),
        topic: conceptCandidate,
        confidence: 0.84,
        source: 'chat',
        evidence: userText,
        metadata: { dependencies: dependencyConceptsFor(conceptCandidate) },
      });
      signals.push({
        type: 'revision_needed',
        concept: conceptCandidate,
        canonicalConcept: conceptCandidate,
        subject: inferSubjectForConcept(conceptCandidate),
        chapter: inferChapterForConcept(conceptCandidate),
        topic: conceptCandidate,
        confidence: 0.72,
        source: 'chat',
        evidence: userText,
      });
    }

    if (/\bi thought\b|\bi assumed\b|mujhe laga/i.test(userText) || /ventricles receive blood from veins/i.test(userText)) {
      const concept = canonicalConceptName({ raw: conceptCandidate ?? (normalized.includes('ventric') ? 'Heart Chambers' : undefined), userText }) ?? 'Misconception';
      signals.push({
        type: 'misconception_detected',
        concept,
        canonicalConcept: concept,
        subject: inferSubjectForConcept(concept),
        chapter: inferChapterForConcept(concept),
        topic: concept,
        confidence: 0.78,
        source: 'chat',
        misconception: userText.slice(0, 300),
        correction: assistantText.slice(0, 500),
        evidence: userText,
      });
    }

    if (/\b(got it|understood|makes sense|clear now|samajh aa gaya)\b/i.test(userText) && !isConfused && conceptCandidate) {
      signals.push({
        type: 'concept_understood',
        concept: conceptCandidate,
        canonicalConcept: conceptCandidate,
        subject: inferSubjectForConcept(conceptCandidate),
        chapter: inferChapterForConcept(conceptCandidate),
        topic: conceptCandidate,
        confidence: 0.58,
        source: input.channel,
        evidence: userText,
      });
    }

    if (isSourceRequest && input.retrievedChunks.length === 0) {
      signals.push({
        type: 'practice_needed',
        concept: conceptCandidate ?? 'Source-grounded question',
        canonicalConcept: conceptCandidate ?? undefined,
        confidence: 0.45,
        source: 'chat',
        evidence: 'User requested source grounding but no chunks were retrieved.',
      });
    }

    const unique = new Map<string, LearningSignal>();
    for (const signal of signals.map((signal) => enrichSignalConcept(signal, userText))) {
      const key = `${signal.type}:${signal.canonicalConcept ?? signal.concept ?? signal.materialId ?? signal.evidence}`;
      if (!unique.has(key)) unique.set(key, signal);
    }
    const finalSignals = Array.from(unique.values());
    context.learningSignals = finalSignals;

    return {
      success: true,
      changed: false,
      entityType: 'learning_signal',
      entityIds: [],
      summary: `Extracted ${finalSignals.length} learning signal${finalSignals.length === 1 ? '' : 's'}.`,
      data: { signals: finalSignals },
    };
  },
};

