import { describe, expect, it } from 'vitest';
import { normalizeLearningSignal } from '@/lib/learning-signals/normalizer';

describe('chat learning signal normalization', () => {
  it('accepts durable MIND chat signal types used by the finalizer', () => {
    for (const signalType of ['doubt_asked', 'practice_requested', 'concept_practiced', 'confusion_detected'] as const) {
      const normalized = normalizeLearningSignal({
        user_id: '00000000-0000-0000-0000-000000000001',
        signal_type: signalType,
        source_type: 'global_chat',
        source_id: '00000000-0000-0000-0000-000000000011',
        confidence: 0.7,
        evidence: {},
        idempotency_key: `chat_signal:test:${signalType}`,
      });

      expect(normalized.signal_type).toBe(signalType);
      expect(normalized.idempotency_key).toBe(`chat_signal:test:${signalType}`);
    }
  });
});
