import type { AgentObservation, AgentPlan, CognitionAgentTurnInput, LearningSignal, RetrievedSourceChunk } from '@/lib/agent/types';

const SOURCE_RE = /\b(uploaded|source|pdf|material|notes?|ncert|document|textbook|go through|according to)\b/i;
const CONFUSION_RE = /\b(don'?t understand|do not understand|confus|stuck|not clear|unclear|samajh nahi|samjh nahi|nahi aata|clear nahi|doubt|still don'?t)\b/i;
const COMPLETE_RE = /\b(complete session|finish session|mark.*done|session complete|done for today)\b/i;

export function buildObservation(input: CognitionAgentTurnInput): AgentObservation {
  const userMessage = input.userMessage ?? '';
  const payload = input.payload ?? {};
  return {
    channel: input.channel,
    userMessage,
    payload,
    conversationId: input.conversationId ?? null,
    sessionId: input.sessionId ?? null,
    goalId: input.goalId ?? null,
    sourceRequested: SOURCE_RE.test(userMessage),
    confusionLikely: CONFUSION_RE.test(userMessage),
    practicePayload: input.channel === 'practice' || Array.isArray((payload as any).items),
    autopsyPayload: input.channel === 'autopsy' || Boolean((payload as any).mistakeText),
    sessionCompletionRequested: input.channel === 'session' || COMPLETE_RE.test(userMessage) || Boolean((payload as any).completeSession),
  };
}

function mutationForSignal(signal: LearningSignal) {
  switch (signal.type) {
    case 'source_used':
      return 'source_used event';
    case 'weak_area_detected':
    case 'misconception_detected':
      return 'ATLAS weak concept + MEMORY card + mission update';
    case 'revision_needed':
    case 'practice_needed':
      return 'MEMORY/mission adaptation';
    case 'concept_understood':
    case 'explanation_generated':
      return 'cautious ATLAS mastery evidence';
    case 'practice_attempt_submitted':
      return 'practice attempt projection';
    case 'session_completed':
      return 'session completion';
    default:
      return signal.type;
  }
}

export function buildAgentPlan(input: {
  observation: AgentObservation;
  signals: LearningSignal[];
  sourceChunks: RetrievedSourceChunk[];
}): AgentPlan {
  const requiredTools: AgentPlan['required_tools'] = [
    { name: 'get_learner_context', input: {} },
  ];

  if (input.observation.sourceRequested || input.sourceChunks.length > 0) {
    requiredTools.push({ name: 'retrieve_source_chunks', input: { query: input.observation.userMessage, force: input.observation.sourceRequested } });
  }

  requiredTools.push({ name: 'extract_learning_signals', input: { channel: input.observation.channel } });

  if (input.observation.practicePayload) requiredTools.push({ name: 'apply_practice_attempt', input: { payload: input.observation.payload } });
  if (input.observation.sessionCompletionRequested) {
    const alreadyCompleted = (input.observation.payload as any)?.alreadyCompleted === true;
    if (!alreadyCompleted) {
      requiredTools.push({ name: 'complete_session', input: input.observation.payload });
    }
  }
  if (input.observation.autopsyPayload) requiredTools.push({ name: 'record_autopsy_mistake', input: input.observation.payload });

  const hasConceptSignal = input.signals.some((signal) => signal.concept || signal.canonicalConcept);
  if (hasConceptSignal) {
    requiredTools.push(
      { name: 'upsert_atlas_concept', input: { from: 'signals' } },
      { name: 'update_concept_mastery', input: { from: 'signals' } }
    );
  }
  if (input.signals.some((signal) => ['weak_area_detected', 'misconception_detected', 'revision_needed', 'practice_needed', 'session_completed'].includes(signal.type))) {
    requiredTools.push({ name: 'create_memory_card', input: { from: 'signals' } });
  }
  if (input.signals.length > 0) {
    requiredTools.push(
      { name: 'update_microtarget', input: { from: 'signals' } },
      { name: 'write_learning_event', input: { from: 'signals' } }
    );
  }

  const riskFlags: string[] = [];
  if (input.observation.sourceRequested && input.sourceChunks.length === 0) riskFlags.push('source_requested_without_verified_chunks');
  if (input.signals.some((signal) => signal.confidence < 0.55)) riskFlags.push('low_confidence_signal');

  return {
    answer_intent: input.observation.sourceRequested ? 'source_grounded_tutoring' : input.observation.channel,
    learning_signals: input.signals,
    required_tools: requiredTools,
    expected_mutations: Array.from(new Set(input.signals.map(mutationForSignal))),
    pedagogical_next_step: {
      type: input.signals.some((signal) => ['weak_area_detected', 'misconception_detected'].includes(signal.type)) ? 'repair_then_check' : 'continue',
    },
    confidence: input.signals.length > 0 ? Math.min(0.92, Math.max(...input.signals.map((signal) => signal.confidence))) : 0.55,
    risk_flags: riskFlags,
  };
}

