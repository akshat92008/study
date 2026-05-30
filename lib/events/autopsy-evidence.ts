export const DEFAULT_AUTOPSY_CONFIDENCE_THRESHOLD = 70;

function numberFrom(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
}

export function getAutopsyConfidenceThreshold(): number {
  const configured = Number(process.env.AUTOPSY_VERIFIED_CONFIDENCE_THRESHOLD);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_AUTOPSY_CONFIDENCE_THRESHOLD;
}

export function isVerifiedAutopsyMistake(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const payload = input as Record<string, unknown>;
  const status =
    payload.status ??
    payload.evidence_status ??
    payload.evidenceStatus;
  const needsReview =
    payload.needs_review ??
    payload.needsReview;
  const confidence = numberFrom(
    payload.extraction_confidence ??
    payload.extractionConfidence ??
    payload.ocr_confidence ??
    payload.ocrConfidence
  );

  return status === 'verified_mistake' &&
    needsReview !== true &&
    Number.isFinite(confidence) &&
    confidence >= getAutopsyConfidenceThreshold();
}
