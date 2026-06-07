import { logger } from '@/lib/utils/logger';

export type LearningSignal =
  | {
      type: 'weak_area_detected';
      concept: string;
      canonicalConcept?: string;
      confidence: number;
      evidence: string;
      source: 'chat' | 'practice' | 'autopsy' | 'revision';
    }
  | {
      type: 'misconception_detected';
      concept: string;
      canonicalConcept?: string;
      misconception: string;
      correction: string;
      confidence: number;
      evidence: string;
      source: 'chat' | 'practice' | 'autopsy';
    }
  | {
      type: 'concept_understood';
      concept: string;
      canonicalConcept?: string;
      confidence: number;
      evidence: string;
      source: 'chat' | 'practice' | 'autopsy' | 'revision';
    }
  | {
      type: 'source_used';
      materialId: string;
      title: string;
      chunkIds: string[];
      confidence: number;
    }
  | {
      type: 'explanation_generated';
      concept?: string;
      confidence: number;
    };

export interface ExtractLearningSignalsInput {
  userId: string;
  userMessage: string;
  assistantMessage: string;
  mindContext?: any;
  retrievedChunks?: any[];
  source: 'chat' | 'practice' | 'autopsy' | 'revision';
}

const CONFUSION_PHRASES = [
  "i don't understand",
  "i am confused",
  "not clear",
  "still confused",
  "explain again",
  "what is",
  "why is",
  "samajh nahi aa raha",
  "nahi aata",
  "i keep forgetting",
  "i got it wrong",
  "confused about"
];

/**
 * Extracts learning signals from conversation using heuristics.
 */
export async function extractLearningSignals(
  input: ExtractLearningSignalsInput
): Promise<LearningSignal[]> {
  const signals: LearningSignal[] = [];
  const { userMessage, assistantMessage, retrievedChunks = [] } = input;
  const userLower = userMessage.toLowerCase();

  // 1. Source Used Signal
  if (retrievedChunks.length > 0) {
    const materialId = retrievedChunks[0].materialId;
    const title = retrievedChunks[0].title;
    signals.push({
      type: 'source_used',
      materialId,
      title,
      chunkIds: retrievedChunks.map(c => c.id),
      confidence: 0.95
    });
  }

  // 2. Weak Area Detection (Heuristic)
  let detectedConcept: string | null = null;
  
  // Try to find concept in confusion phrases
  for (const phrase of CONFUSION_PHRASES) {
    if (userLower.includes(phrase)) {
      // Extract what follows the phrase or is near it
      const remaining = userLower.split(phrase)[1]?.trim();
      if (remaining && remaining.length > 2) {
        detectedConcept = remaining.split(/[.?!,]/)[0].trim();
        break;
      }
    }
  }

  // Fallback: Use retrieved chunks to find concept names if confusion detected
  const isConfused = CONFUSION_PHRASES.some(p => userLower.includes(p));
  if (isConfused && !detectedConcept && retrievedChunks.length > 0) {
    detectedConcept = retrievedChunks[0].title; // Use material title as proxy
  }

  if (isConfused && detectedConcept) {
    signals.push({
      type: 'weak_area_detected',
      concept: detectedConcept,
      confidence: 0.8,
      evidence: userMessage,
      source: input.source
    });
  }

  // 3. Concept Understood Detection (Heuristic)
  const isUnderstood = /\b(got it|understood|makes sense|i see|clear now)\b/i.test(userLower);
  if (isUnderstood && !isConfused) {
    // If we have a detected concept from assistant message or chunks
    const concept = detectedConcept || retrievedChunks[0]?.title;
    if (concept) {
      signals.push({
        type: 'concept_understood',
        concept,
        confidence: 0.7,
        evidence: userMessage,
        source: input.source
      });
    }
  }

  // 4. Misconception Detection (Simplified heuristic)
  if (userLower.includes("i thought") && (userLower.includes("but") || assistantMessage.toLowerCase().includes("actually") || assistantMessage.toLowerCase().includes("no,"))) {
    const concept = detectedConcept || retrievedChunks[0]?.title || "Unknown Concept";
    signals.push({
      type: 'misconception_detected',
      concept,
      misconception: userMessage,
      correction: assistantMessage.slice(0, 500),
      confidence: 0.75,
      evidence: userMessage,
      source: 'chat'
    });
  }

  return signals;
}
