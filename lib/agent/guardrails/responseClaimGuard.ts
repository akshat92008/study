/**
 * Response Claim Guard for Cognition OS.
 *
 * Ensures the final agent response does not make unverified claims about
 * learning state changes (saved cards, updated ATLAS, adapted plans, etc.)
 *
 * Rules:
 * - Response must NOT claim "I saved this", "I updated your weak areas",
 *   "I added a card", "Your plan has been adapted" unless verification confirms it.
 * - If verification failed, response may say explanation or "I could not save this update"
 * - Logs must contain the specific failure reason
 */
import type { VerificationResult, MutationSummary } from '@/lib/agent/types';

interface ClaimRedaction {
  pattern: RegExp;
  replacement: string;
  reason: string;
}

const UNVERIFIED_CLAIM_PATTERNS: ClaimRedaction[] = [
  {
    pattern: /i\s+(saved?|created?|added?|updated?|recorded?|tracked?|built?|made?)\s+this/gi,
    replacement: '',
    reason: 'unverified_save_claim',
  },
  {
    pattern: /i\s+(saved?|created?|added?|updated?|recorded?|tracked?)(\s+your)?\s+(weak\s+areas?|topics?|concepts?|atlas|memory|cards?|plan)/gi,
    replacement: '',
    reason: 'unverified_atlas_memory_claim',
  },
  {
    pattern: /your\s+(atlas|memory|plan|weak\s+areas?|topics?|concepts?)\s+has\s+been\s+(updated?|adapted?|created?|saved?)/gi,
    replacement: '',
    reason: 'unverified_state_change_claim',
  },
  {
    pattern: /i\s+added?\s+(a\s+)?(memory|revision)\s+card/gi,
    replacement: 'a revision card will be created',
    reason: 'unverified_memory_card_claim',
  },
  {
    pattern: /i\s+(have\s+)?(created?|added?|saved?)\s+(\d+)\s+card/gi,
    replacement: '',
    reason: 'unverified_card_count_claim',
  },
  {
    pattern: /your\s+(daily\s+)?plan\s+has\s+been\s+adapted/gi,
    replacement: '',
    reason: 'unverified_plan_adapt_claim',
  },
  {
    pattern: /i\s+(updated?|modified?|adapted?)\s+your\s+(today|tomorrow|daily)\s+(session|plan|target)/gi,
    replacement: '',
    reason: 'unverified_plan_update_claim',
  },
  {
    pattern: /successfully\s+(saved?|created?|recorded?|tracked?)/gi,
    replacement: '',
    reason: 'unverified_success_claim',
  },
];

export interface ClaimGuardResult {
  filteredResponse: string;
  removedClaims: string[];
  hasUnverifiedClaims: boolean;
  hasVerifiedClaims: boolean;
}

export function applyResponseClaimGuard(
  response: string | undefined | null,
  mutationSummary: MutationSummary,
  verification: VerificationResult
): ClaimGuardResult {
  const removedClaims: string[] = [];
  let filteredResponse = (response ?? '').trim();

  // If no unverified mutations and verification passed, allow most claims
  const hasMutations = mutationSummary.changed;
  const verified = verification.ok;

  if (!hasMutations) {
    // No mutations happened, filter any claims about state changes
    for (const claim of UNVERIFIED_CLAIM_PATTERNS) {
      const matches = filteredResponse.match(claim.pattern);
      if (matches) {
        for (const match of matches) {
          removedClaims.push(`${claim.reason}: "${match}"`);
        }
        filteredResponse = filteredResponse.replace(claim.pattern, claim.replacement);
      }
    }
  } else if (!verified) {
    // Mutations were attempted but verification failed - must not claim success
    for (const claim of UNVERIFIED_CLAIM_PATTERNS) {
      const matches = filteredResponse.match(claim.pattern);
      if (matches) {
        for (const match of matches) {
          removedClaims.push(`${claim.reason}: "${match}"`);
        }
        // Replace with acknowledgment that update couldn't be confirmed
        filteredResponse = filteredResponse.replace(claim.pattern, (match) => {
          // If it's a save/create claim, replace with acknowledgment
          if (/saved?|created?|added?/i.test(match)) {
            return 'This update could not be confirmed';
          }
          return '';
        });
      }
    }
  } else {
    // Verified mutations - allow positive claims but still sanitize any overclaiming
    // Only remove claims about things that weren't actually changed
    const actualChanges = extractActualMutations(mutationSummary);
    for (const claim of UNVERIFIED_CLAIM_PATTERNS) {
      const matches = filteredResponse.match(claim.pattern);
      if (matches) {
        for (const match of matches) {
          const claimType = classifyClaim(match);
          const wasChanged = actualChanges.has(claimType);
          if (!wasChanged) {
            removedClaims.push(`${claim.reason} (not changed): "${match}"`);
            filteredResponse = filteredResponse.replace(match, '');
          }
        }
      }
    }
  }

  // Clean up any double spaces or trailing fragments from removals
  filteredResponse = filteredResponse
    .replace(/\s{2,}/g, ' ')
    .replace(/[.,;]\s*\./g, '.')
    .trim();

  // If we removed claims but response still needs a safe fallback
  if (!filteredResponse && removedClaims.length > 0 && hasMutations && !verified) {
    filteredResponse = 'Your feedback has been noted. The learning system will update when changes are confirmed.';
  }

  return {
    filteredResponse,
    removedClaims,
    hasUnverifiedClaims: removedClaims.length > 0,
    hasVerifiedClaims: hasMutations && verified,
  };
}

function extractActualMutations(summary: MutationSummary): Set<string> {
  const changes = new Set<string>();
  if (summary.conceptsCreated > 0) changes.add('atlas');
  if (summary.conceptsUpdated > 0) changes.add('atlas');
  if (summary.revisionCardsCreated > 0) changes.add('memory');
  if (summary.eventsWritten > 0) changes.add('events');
  if (summary.microtargetsUpdated > 0) changes.add('mission');
  if (summary.sessionsCompleted > 0) changes.add('session');
  if (summary.practiceAttemptsProcessed > 0) changes.add('practice');
  return changes;
}

function classifyClaim(claim: string): string {
  const lower = claim.toLowerCase();
  if (/atlas|concept|topic|weak|mastery/i.test(lower)) return 'atlas';
  if (/memory|card|revision/i.test(lower)) return 'memory';
  if (/event|activity/i.test(lower)) return 'events';
  if (/plan|target|microtarget|mission/i.test(lower)) return 'mission';
  if (/session|streak/i.test(lower)) return 'session';
  if (/practice|quiz|attempt/i.test(lower)) return 'practice';
  return 'unknown';
}

export function sanitizeResponseForChannel(
  response: string | undefined | null,
  channel: string,
  mutationSummary: MutationSummary,
  verification: VerificationResult
): string {
  // For read-only channels (general chat with no mutations), be more permissive
  if (!mutationSummary.changed) {
    return response ?? '';
  }

  // For mutation channels, apply full claim guard
  return applyResponseClaimGuard(response, mutationSummary, verification).filteredResponse;
}