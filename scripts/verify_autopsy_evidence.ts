import { isVerifiedAutopsyMistake, isPendingReviewMistake } from '../lib/events/autopsy-evidence';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function runTests() {
  console.log('Testing Autopsy Evidence Status Gates...');

  // 1. Verified Mistake (Happy Path)
  const verified = {
    status: 'verified_mistake',
    needsReview: false,
    extractionConfidence: 85,
  };
  assert(isVerifiedAutopsyMistake(verified) === true, 'Failed: Valid verified mistake should pass');
  assert(isPendingReviewMistake(verified) === false, 'Failed: Verified mistake should not be pending review');

  // 2. Pending Review (Confidence too low)
  const pending = {
    status: 'pending_review',
    needsReview: false,
    extractionConfidence: 45, // below default 70
  };
  assert(isVerifiedAutopsyMistake(pending) === false, 'Failed: Pending review must not pass verified check');
  assert(isPendingReviewMistake(pending) === true, 'Failed: Pending review must pass pending review check');

  // 3. Needs Review (Explicitly flagged by OCR/UI)
  const needsReview = {
    status: 'needs_review',
    needsReview: true,
    extractionConfidence: 95, // Even with high confidence, it's blocked
  };
  assert(isVerifiedAutopsyMistake(needsReview) === false, 'Failed: Needs review must not pass verified check');
  assert(isPendingReviewMistake(needsReview) === true, 'Failed: Needs review must pass pending review check');

  // 4. Ignored or Unverified (Correct / Unattempted)
  const ignored = {
    status: 'ignored_or_unverified',
    needsReview: false,
    extractionConfidence: 100,
  };
  assert(isVerifiedAutopsyMistake(ignored) === false, 'Failed: Ignored item must not pass verified check');
  assert(isPendingReviewMistake(ignored) === false, 'Failed: Ignored item must not pass pending review check');

  // 5. Missing or invalid confidence
  const missingConfidence = {
    status: 'verified_mistake',
    needsReview: false,
  };
  assert(isVerifiedAutopsyMistake(missingConfidence) === false, 'Failed: Missing confidence must block verified check');

  // 6. DB formats (snake_case)
  const dbVerified = {
    evidence_status: 'verified_mistake',
    needs_review: false,
    ocr_confidence: 88,
  };
  assert(isVerifiedAutopsyMistake(dbVerified) === true, 'Failed: DB format verified mistake should pass');

  console.log('✅ All Autopsy Evidence Status Gates passed.');
}

try {
  runTests();
} catch (e) {
  console.error(e);
  process.exit(1);
}
