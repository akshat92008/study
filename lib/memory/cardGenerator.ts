import type { LearningSignal } from '@/lib/agent/types';

export function generateMemoryCard(signal: LearningSignal) {
  const concept = signal.canonicalConcept ?? signal.concept ?? 'this concept';
  if (signal.type === 'misconception_detected') {
    return {
      front: `Fix the misconception: ${concept}`,
      back: [
        signal.misconception ? `Misconception: ${signal.misconception}` : null,
        signal.correction ? `Correction: ${signal.correction}` : null,
        'Recall the correct mechanism, then apply it to one NEET-style example.',
      ].filter(Boolean).join('\n'),
    };
  }

  return {
    front: `Explain ${concept} without looking at notes.`,
    back: [
      signal.evidence ? `Trigger: ${signal.evidence.slice(0, 240)}` : null,
      `Core review: define ${concept}, state the key mechanism, and name one common trap.`,
    ].filter(Boolean).join('\n'),
  };
}

