import { EventDispatcher } from '@/lib/events/orchestrator';
import { safePublishEvent } from '@/lib/events/safe-publish';
import { normalizeLearningSignal } from './normalizer';
import type { LearningSignalInput, NormalizedLearningSignal } from './types';

export async function ingestLearningSignal(
  supabase: any,
  input: LearningSignalInput,
  options: { publishEvent?: boolean; idempotencyKey?: string } = {}
): Promise<NormalizedLearningSignal> {
  const signal = normalizeLearningSignal(input);
  const { error } = await supabase.from('learning_signals').insert(signal);
  if (error) throw error;

  if (options.publishEvent !== false) {
    await safePublishEvent({
      user_id: signal.user_id,
      type: 'LEARNING_SIGNAL_INGESTED',
      data: {
        signalType: signal.signal_type,
        sourceType: signal.source_type,
        sourceId: signal.source_id,
        goalId: signal.goal_id,
        subject: signal.subject,
        topic: signal.topic,
        confidence: signal.confidence,
      },
      metadata: { source: 'learning_signals_ingest', goalId: signal.goal_id },
      idempotency_key: options.idempotencyKey ?? `learning_signal:${signal.user_id}:${signal.signal_type}:${signal.source_id ?? crypto.randomUUID()}`,
    });
  }

  return signal;
}

export async function ingestLearningSignals(
  supabase: any,
  inputs: LearningSignalInput[],
  options: { publishEvent?: boolean } = {}
) {
  const signals = inputs.map(normalizeLearningSignal);
  if (signals.length === 0) return [];
  const { error } = await supabase.from('learning_signals').insert(signals);
  if (error) throw error;

  if (options.publishEvent !== false) {
    await Promise.all(signals.slice(0, 10).map((signal) =>
      safePublishEvent({
        user_id: signal.user_id,
        type: 'LEARNING_SIGNAL_INGESTED',
        data: {
          signalType: signal.signal_type,
          sourceType: signal.source_type,
          sourceId: signal.source_id,
          goalId: signal.goal_id,
          subject: signal.subject,
          topic: signal.topic,
          confidence: signal.confidence,
        },
        metadata: { source: 'learning_signals_ingest', goalId: signal.goal_id },
        idempotency_key: `learning_signal:${signal.user_id}:${signal.signal_type}:${signal.source_id ?? crypto.randomUUID()}`,
      })
    ));
  }

  return signals;
}
