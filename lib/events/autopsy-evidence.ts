/**
 * Autopsy Evidence Helpers
 *
 * These utilities implement the three-tier mistake confidence gate that prevents
 * low-quality AI extractions from corrupting learner state (ATLAS mastery +
 * MEMORY revision cards).
 *
 * Three-tier evidence_status pipeline (enforced by ingest_mock_autopsy RPC):
 *
 *   verified_mistake    → confidence ≥ threshold AND needsReview is false
 *                         → ALLOWED to update ATLAS + create MEMORY cards
 *
 *   pending_review      → confidence < threshold OR needsReview is true
 *                         → STORED in mistakes table for future manual review
 *                         → MUST NOT mutate mastery or create revision cards
 *
 *   needs_review        → OCR/extraction issues flagged at extraction time
 *                         → STORED in mistakes table for future manual review
 *                         → MUST NOT mutate mastery or create revision cards
 *
 *   ignored_or_unverified → correct / unattempted questions
 *                           → NOT stored in mistakes table at all
 *
 * Usage in downstream consumers:
 *   if (!isVerifiedAutopsyMistake(q)) continue; // skip non-verified items
 */

export const DEFAULT_AUTOPSY_CONFIDENCE_THRESHOLD = 70;

function numberFrom(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
}

/**
 * Returns the confidence threshold above which an autopsy mistake is
 * considered verified and safe for automatic downstream processing.
 *
 * Configurable via AUTOPSY_VERIFIED_CONFIDENCE_THRESHOLD env var.
 * Defaults to 70 (0–100 scale, matching the ocrConfidence field from AI extraction).
 */
export function getAutopsyConfidenceThreshold(): number {
  const configured = Number(process.env.AUTOPSY_VERIFIED_CONFIDENCE_THRESHOLD);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_AUTOPSY_CONFIDENCE_THRESHOLD;
}

/**
 * Returns true only if an extracted mistake is verified and high-confidence.
 *
 * All three conditions must hold:
 *   1. status === 'verified_mistake'
 *   2. needsReview is not true
 *   3. confidence >= threshold (default 70)
 *
 * Used as the primary gate in AtlasConsumer and MemoryConsumer
 * to prevent pending_review / needs_review items from mutating learner state.
 */
export function isVerifiedAutopsyMistake(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const payload = input as Record<string, unknown>;

  // Accept both snake_case (DB) and camelCase (event payload) field names
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

/**
 * Returns true if a mistake is in pending_review or needs_review state.
 * Used in tests and UI logic to identify items awaiting manual confirmation.
 */
export function isPendingReviewMistake(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const payload = input as Record<string, unknown>;
  const status =
    payload.status ??
    payload.evidence_status ??
    payload.evidenceStatus;
  return status === 'pending_review' || status === 'needs_review';
}

/**
 * Returns a human-readable label for an evidence_status value.
 * Useful for UI display and logging.
 */
export function getEvidenceStatusLabel(status: string | undefined | null): string {
  switch (status) {
    case 'verified_mistake':       return 'Verified';
    case 'pending_review':         return 'Pending Review';
    case 'needs_review':           return 'Needs Review';
    case 'ignored_or_unverified':  return 'Not Tracked';
    default:                       return 'Unknown';
  }
}

/** All possible evidence_status values produced by the autopsy pipeline */
export type AutopsyEvidenceStatus =
  | 'verified_mistake'
  | 'pending_review'
  | 'needs_review'
  | 'ignored_or_unverified';
