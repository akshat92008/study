import type { LearningSignal } from '@/lib/agent/types';

const KNOWN_CONCEPTS = [
  'tachycardia',
  'heart rate regulation',
  'sa node',
  'sinoatrial node',
  'cardiac conduction',
  'cardiac cycle',
  'blood flow direction',
  'heart chambers',
  'ventricles',
  'atria',
  'circulatory system',
  'cardiac output',
  'blood pressure',
  'electrocardiogram',
];

const STOP_PREFIX_RE = /^(about|on|for|in|with|this|that|the|a|an|topic|chapter|concept|please|pls|again)\s+/i;
const STOP_SUFFIX_RE = /\s+(please|pls|again|properly|clearly|from my source|from source)$/i;

export function normalizeConceptText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleizeConcept(value: string) {
  const normalized = normalizeConceptText(value)
    .replace(STOP_PREFIX_RE, '')
    .replace(STOP_SUFFIX_RE, '')
    .trim();
  if (!normalized) return 'General Concept';
  return normalized
    .split(' ')
    .map((part) => part.length <= 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function inferSubjectForConcept(concept: string): string | null {
  const text = normalizeConceptText(concept);
  if (/\b(heart|cardiac|tachycardia|ventricle|atria|blood|circulatory|sa node|sinoatrial)\b/.test(text)) {
    return 'Biology';
  }
  if (/\b(mole|equilibrium|bond|organic|reaction|acid|base)\b/.test(text)) return 'Chemistry';
  if (/\b(force|motion|current|voltage|optics|wave|energy)\b/.test(text)) return 'Physics';
  return null;
}

export function inferChapterForConcept(concept: string): string | null {
  const text = normalizeConceptText(concept);
  if (/\b(heart|cardiac|tachycardia|ventricle|atria|blood|circulatory|sa node|sinoatrial)\b/.test(text)) {
    return 'Body Fluids and Circulation';
  }
  return null;
}

export function extractConceptCandidates(text: string): string[] {
  const normalized = normalizeConceptText(text);
  const found = KNOWN_CONCEPTS.filter((concept) => normalized.includes(concept));
  if (found.length > 0) return found;

  const patterns = [
    /(?:understand|confused about|confusion in|stuck on|doubt in|explain|what is|why is)\s+([a-z0-9\s]{3,80})/i,
    /mujhe\s+([a-z0-9\s]{3,80})\s+(?:samajh|samjh|nahi)/i,
    /([a-z0-9\s]{3,80})\s+(?:samajh nahi|samjh nahi|confusing|clear nahi)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = match?.[1]?.split(/\b(?:but|because|ki|hai|he|please)\b/)[0]?.trim();
    if (candidate && candidate.length >= 3) return [candidate];
  }

  return [];
}

export function canonicalConceptName(input: {
  raw?: string | null;
  userText?: string | null;
  sourceTitle?: string | null;
}) {
  const raw = input.raw?.trim();
  if (raw) {
    const normalized = normalizeConceptText(raw);
    const known = KNOWN_CONCEPTS.find((concept) => normalized.includes(concept));
    return titleizeConcept(known ?? normalized);
  }

  const textCandidates = extractConceptCandidates(input.userText ?? '');
  if (textCandidates.length > 0) return titleizeConcept(textCandidates[0]);

  if (input.sourceTitle) return titleizeConcept(input.sourceTitle);
  return null;
}

export function enrichSignalConcept(signal: LearningSignal, userText?: string): LearningSignal {
  if (!['weak_area_detected', 'misconception_detected', 'concept_understood', 'practice_needed', 'revision_needed', 'practice_attempt_submitted'].includes(signal.type)) {
    return signal;
  }
  const canonical = canonicalConceptName({
    raw: signal.concept ?? signal.canonicalConcept,
    userText,
    sourceTitle: signal.materialTitle,
  });
  if (!canonical) return signal;
  return {
    ...signal,
    concept: signal.concept ?? canonical,
    canonicalConcept: canonical,
    subject: signal.subject ?? inferSubjectForConcept(canonical),
    chapter: signal.chapter ?? inferChapterForConcept(canonical),
    topic: signal.topic ?? canonical,
  };
}

export function dependencyConceptsFor(concept: string) {
  const text = normalizeConceptText(concept);
  if (text.includes('tachycardia')) {
    return ['Heart Rate Regulation', 'SA Node', 'Cardiac Conduction'];
  }
  if (text.includes('blood flow') || text.includes('ventric')) {
    return ['Heart Chambers', 'Blood Flow Direction', 'Valves'];
  }
  return [];
}
